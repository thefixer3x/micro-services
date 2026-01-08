/**
 * OAuth and API Key Authentication Integration
 *
 * Integrates @lanonasis/oauth-client for MCP authentication
 * Supports both OAuth2 PKCE flow and direct API key authentication
 * Falls back to Supabase Auth when custom auth is unavailable
 */

import { MCPClient, TokenStorage, ApiKeyStorage } from '@lanonasis/oauth-client';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Request, Response, NextFunction } from 'express';

// Re-export for convenience
export { MCPClient, TokenStorage, ApiKeyStorage } from '@lanonasis/oauth-client';

/**
 * Configuration for API Key authentication
 */
export interface ApiKeyAuthConfig {
  apiKey: string;
  mcpEndpoint?: string;
}

/**
 * Configuration for OAuth authentication
 */
export interface OAuthConfig {
  clientId: string;
  authBaseUrl?: string;
  mcpEndpoint?: string;
  scope?: string;
}

/**
 * Unified auth configuration - supports both modes
 */
export type AuthConfig =
  | ({ mode: 'apikey' } & ApiKeyAuthConfig)
  | ({ mode: 'oauth' } & OAuthConfig);

/**
 * MCP Service wrapper for authenticated connections
 */
export class MCPService {
  private client: MCPClient | null = null;
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Initialize and connect to MCP
   */
  async connect(): Promise<MCPClient> {
    if (this.client) {
      return this.client;
    }

    if (this.config.mode === 'apikey') {
      this.client = new MCPClient({
        apiKey: this.config.apiKey,
        mcpEndpoint: this.config.mcpEndpoint || 'wss://mcp.lanonasis.com',
      });
    } else {
      this.client = new MCPClient({
        clientId: this.config.clientId,
        authBaseUrl: this.config.authBaseUrl || 'https://auth.lanonasis.com',
        mcpEndpoint: this.config.mcpEndpoint || 'wss://mcp.lanonasis.com',
        scope: this.config.scope || 'memories:read memories:write memories:delete profile',
      });
    }

    await this.client.connect();
    return this.client;
  }

  /**
   * Get the connected client
   */
  getClient(): MCPClient {
    if (!this.client) {
      throw new Error('MCP client not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Disconnect from MCP
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      // The client handles cleanup internally
      this.client = null;
    }
  }
}

/**
 * API Key authentication error
 */
export class ApiKeyAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyAuthError';
  }
}

/**
 * Express middleware for API Key authentication
 * Validates API keys starting with 'lano_' prefix
 */
export function authenticateApiKey(options?: {
  headerName?: string;
  queryParam?: string;
  validateFn?: (apiKey: string) => Promise<boolean>;
}) {
  const headerName = options?.headerName || 'x-api-key';
  const queryParam = options?.queryParam || 'api_key';
  const validateFn = options?.validateFn;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract API key from header or query param
      let apiKey = req.headers[headerName] as string;

      if (!apiKey && queryParam) {
        apiKey = req.query[queryParam] as string;
      }

      if (!apiKey) {
        throw new ApiKeyAuthError('API key not provided');
      }

      // Validate API key format (lano_ prefix)
      if (!apiKey.startsWith('lano_')) {
        throw new ApiKeyAuthError('Invalid API key format');
      }

      // Custom validation if provided
      if (validateFn) {
        const isValid = await validateFn(apiKey);
        if (!isValid) {
          throw new ApiKeyAuthError('Invalid API key');
        }
      }

      // Attach API key info to request
      (req as any).apiKey = apiKey;
      (req as any).authType = 'apikey';

      next();
    } catch (error: any) {
      return res.status(401).json({
        error: error.message || 'API key authentication failed',
        code: 'UNAUTHORIZED',
      });
    }
  };
}

/**
 * Express middleware for combined auth (JWT or API Key)
 * Supports both authentication methods
 */
export function authenticateAny(options: {
  jwtVerifyFn: (token: string) => any;
  apiKeyValidateFn?: (apiKey: string) => Promise<boolean>;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['x-api-key'] as string;

      // Try API Key first
      if (apiKey) {
        if (!apiKey.startsWith('lano_')) {
          throw new ApiKeyAuthError('Invalid API key format');
        }

        if (options.apiKeyValidateFn) {
          const isValid = await options.apiKeyValidateFn(apiKey);
          if (!isValid) {
            throw new ApiKeyAuthError('Invalid API key');
          }
        }

        (req as any).apiKey = apiKey;
        (req as any).authType = 'apikey';
        return next();
      }

      // Try JWT
      if (authHeader) {
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
          throw new Error('Invalid authorization header format');
        }

        const token = parts[1];
        const payload = options.jwtVerifyFn(token);

        (req as any).user = payload;
        (req as any).authType = 'jwt';
        return next();
      }

      throw new Error('No authentication credentials provided');
    } catch (error: any) {
      return res.status(401).json({
        error: error.message || 'Authentication failed',
        code: 'UNAUTHORIZED',
      });
    }
  };
}

/**
 * Create MCP service from environment variables
 */
export function createMCPServiceFromEnv(): MCPService {
  const apiKey = process.env.LANONASIS_API_KEY;
  const clientId = process.env.LANONASIS_CLIENT_ID;
  const mcpEndpoint = process.env.LANONASIS_MCP_ENDPOINT;
  const authBaseUrl = process.env.LANONASIS_AUTH_URL;

  if (apiKey) {
    return new MCPService({
      mode: 'apikey',
      apiKey,
      mcpEndpoint,
    });
  }

  if (clientId) {
    return new MCPService({
      mode: 'oauth',
      clientId,
      authBaseUrl,
      mcpEndpoint,
    });
  }

  throw new Error(
    'No authentication configured. Set LANONASIS_API_KEY or LANONASIS_CLIENT_ID environment variable.'
  );
}

/**
 * Singleton MCP service instance
 */
let mcpServiceInstance: MCPService | null = null;

/**
 * Get or create singleton MCP service
 */
export function getMCPService(): MCPService {
  if (!mcpServiceInstance) {
    mcpServiceInstance = createMCPServiceFromEnv();
  }
  return mcpServiceInstance;
}

/**
 * Reset MCP service instance (for testing)
 */
export function resetMCPService(): void {
  if (mcpServiceInstance) {
    mcpServiceInstance.disconnect();
    mcpServiceInstance = null;
  }
}

// ============================================================================
// Supabase Auth Integration (Fallback)
// ============================================================================

/**
 * Supabase Auth configuration
 */
export interface SupabaseAuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey?: string;
}

/**
 * Supabase Auth Service for fallback authentication
 */
export class SupabaseAuthService {
  private client: SupabaseClient;
  private serviceClient: SupabaseClient | null = null;

  constructor(config: SupabaseAuthConfig) {
    // Public client for user authentication
    this.client = createClient(config.supabaseUrl, config.supabaseAnonKey);

    // Service client for admin operations (if service key provided)
    if (config.supabaseServiceKey) {
      this.serviceClient = createClient(config.supabaseUrl, config.supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }

  /**
   * Get the public Supabase client
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Get the service client (for admin operations)
   */
  getServiceClient(): SupabaseClient {
    if (!this.serviceClient) {
      throw new Error('Service client not configured. Provide supabaseServiceKey.');
    }
    return this.serviceClient;
  }

  /**
   * Verify a Supabase JWT token and return the user
   */
  async verifyToken(token: string): Promise<User> {
    const { data, error } = await this.client.auth.getUser(token);

    if (error || !data.user) {
      throw new SupabaseAuthError(error?.message || 'Invalid token');
    }

    return data.user;
  }

  /**
   * Get user by ID (admin operation)
   */
  async getUserById(userId: string): Promise<User> {
    const serviceClient = this.getServiceClient();
    const { data, error } = await serviceClient.auth.admin.getUserById(userId);

    if (error || !data.user) {
      throw new SupabaseAuthError(error?.message || 'User not found');
    }

    return data.user;
  }
}

/**
 * Supabase authentication error
 */
export class SupabaseAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseAuthError';
  }
}

/**
 * Express middleware for Supabase JWT authentication
 */
export function authenticateSupabase(supabaseAuth: SupabaseAuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        throw new SupabaseAuthError('No authorization header provided');
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw new SupabaseAuthError('Invalid authorization header format');
      }

      const token = parts[1];
      const user = await supabaseAuth.verifyToken(token);

      // Attach user info to request
      (req as any).user = {
        userId: user.id,
        email: user.email,
        roles: user.app_metadata?.roles || [],
        ...user.user_metadata,
      };
      (req as any).supabaseUser = user;
      (req as any).authType = 'supabase';

      next();
    } catch (error: any) {
      return res.status(401).json({
        error: error.message || 'Supabase authentication failed',
        code: 'UNAUTHORIZED',
      });
    }
  };
}

/**
 * Express middleware for combined auth with Supabase fallback
 * Priority: API Key > Custom JWT > Supabase JWT
 */
export function authenticateWithFallback(options: {
  jwtVerifyFn?: (token: string) => any;
  supabaseAuth?: SupabaseAuthService;
  apiKeyValidateFn?: (apiKey: string) => Promise<boolean>;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['x-api-key'] as string;

      // 1. Try API Key first (highest priority)
      if (apiKey) {
        if (!apiKey.startsWith('lano_')) {
          throw new ApiKeyAuthError('Invalid API key format');
        }

        if (options.apiKeyValidateFn) {
          const isValid = await options.apiKeyValidateFn(apiKey);
          if (!isValid) {
            throw new ApiKeyAuthError('Invalid API key');
          }
        }

        (req as any).apiKey = apiKey;
        (req as any).authType = 'apikey';
        return next();
      }

      // 2. Try JWT (custom or Supabase)
      if (authHeader) {
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
          throw new Error('Invalid authorization header format');
        }

        const token = parts[1];

        // 2a. Try custom JWT first
        if (options.jwtVerifyFn) {
          try {
            const payload = options.jwtVerifyFn(token);
            (req as any).user = payload;
            (req as any).authType = 'jwt';
            return next();
          } catch (jwtError) {
            // Custom JWT failed, try Supabase as fallback
          }
        }

        // 2b. Try Supabase JWT as fallback
        if (options.supabaseAuth) {
          try {
            const user = await options.supabaseAuth.verifyToken(token);
            (req as any).user = {
              userId: user.id,
              email: user.email,
              roles: user.app_metadata?.roles || [],
              ...user.user_metadata,
            };
            (req as any).supabaseUser = user;
            (req as any).authType = 'supabase';
            return next();
          } catch (supabaseError) {
            // Supabase also failed
          }
        }

        throw new Error('Token validation failed');
      }

      throw new Error('No authentication credentials provided');
    } catch (error: any) {
      return res.status(401).json({
        error: error.message || 'Authentication failed',
        code: 'UNAUTHORIZED',
      });
    }
  };
}

/**
 * Create Supabase Auth service from environment variables
 */
export function createSupabaseAuthFromEnv(): SupabaseAuthService {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
    );
  }

  return new SupabaseAuthService({
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceKey,
  });
}

/**
 * Singleton Supabase auth service instance
 */
let supabaseAuthInstance: SupabaseAuthService | null = null;

/**
 * Get or create singleton Supabase auth service
 */
export function getSupabaseAuth(): SupabaseAuthService {
  if (!supabaseAuthInstance) {
    supabaseAuthInstance = createSupabaseAuthFromEnv();
  }
  return supabaseAuthInstance;
}

/**
 * Reset Supabase auth instance (for testing)
 */
export function resetSupabaseAuth(): void {
  supabaseAuthInstance = null;
}
