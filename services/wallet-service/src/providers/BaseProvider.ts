import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger';
import {
  IWalletProvider,
  ProviderConfig,
  ProviderError,
  AuthenticationError,
} from './IWalletProvider';

/**
 * Base Provider Class
 *
 * Provides common functionality for all wallet providers:
 * - HTTP client configuration
 * - Error handling
 * - Request/response logging
 * - Retry logic
 * - Token management
 */
export abstract class BaseProvider implements Partial<IWalletProvider> {
  protected httpClient: AxiosInstance;
  protected config: ProviderConfig;
  protected accessToken?: string;
  protected refreshToken?: string;
  protected tokenExpiresAt?: number;

  abstract readonly name: string;
  abstract readonly version: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.httpClient = this.createHttpClient();
  }

  /**
   * Create and configure HTTP client
   */
  protected createHttpClient(): AxiosInstance {
    const client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Request interceptor for logging and auth
    client.interceptors.request.use(
      (config) => {
        // Add access token if available
        if (this.accessToken) {
          config.headers['X-Access-Token'] = this.accessToken;
        }

        if (this.refreshToken) {
          config.headers['X-Refresh-Token'] = this.refreshToken;
        }

        // Add API key if configured
        if (this.config.apiKey) {
          config.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        logger.debug(`[${this.name}] Request:`, {
          method: config.method,
          url: config.url,
          headers: this.sanitizeHeaders(config.headers),
        });

        return config;
      },
      (error) => {
        logger.error(`[${this.name}] Request error:`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    client.interceptors.response.use(
      (response) => {
        // Extract tokens from response headers
        const accessToken = response.headers['x-access-token'];
        const refreshToken = response.headers['x-refresh-token'];

        if (accessToken) {
          this.accessToken = accessToken;
          logger.debug(`[${this.name}] Access token updated`);
        }

        if (refreshToken) {
          this.refreshToken = refreshToken;
          logger.debug(`[${this.name}] Refresh token updated`);
        }

        logger.debug(`[${this.name}] Response:`, {
          status: response.status,
          url: response.config.url,
        });

        return response;
      },
      (error) => {
        return this.handleError(error);
      }
    );

    return client;
  }

  /**
   * Handle HTTP errors and convert to ProviderError
   */
  protected handleError(error: any): Promise<never> {
    if (error.response) {
      const { status, data } = error.response;

      logger.error(`[${this.name}] HTTP Error:`, {
        status,
        data,
        url: error.config?.url,
      });

      // Authentication errors
      if (status === 401 || status === 403) {
        throw new AuthenticationError(
          data.message || 'Authentication failed',
          data
        );
      }

      // Map provider-specific errors
      throw new ProviderError(
        data.message || error.message || 'Provider request failed',
        data.code || 'PROVIDER_ERROR',
        status,
        data
      );
    }

    // Network errors
    if (error.request) {
      logger.error(`[${this.name}] Network error:`, error.message);
      throw new ProviderError(
        'Network error: Unable to reach provider',
        'NETWORK_ERROR',
        undefined,
        error
      );
    }

    // Other errors
    logger.error(`[${this.name}] Unknown error:`, error);
    throw new ProviderError(
      error.message || 'Unknown error occurred',
      'UNKNOWN_ERROR'
    );
  }

  /**
   * Make HTTP request with retry logic
   */
  protected async request<T>(config: AxiosRequestConfig): Promise<T> {
    const maxRetries = this.config.retries || 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.httpClient.request<T>(config);
        return response.data;
      } catch (error: any) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        // Don't retry on authentication errors
        if (error instanceof AuthenticationError) {
          throw error;
        }

        // Retry on 5xx errors or network errors
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.warn(`[${this.name}] Retrying request (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if token is expired or about to expire
   */
  protected isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) {
      return true;
    }
    // Consider token expired if it expires in less than 5 minutes
    return Date.now() >= this.tokenExpiresAt - 5 * 60 * 1000;
  }

  /**
   * Set token expiry time
   */
  protected setTokenExpiry(expiresIn: number): void {
    this.tokenExpiresAt = Date.now() + expiresIn * 1000;
  }

  /**
   * Sanitize headers for logging (remove sensitive data)
   */
  protected sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveKeys = ['authorization', 'x-access-token', 'x-refresh-token', 'x-api-key'];

    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '***REDACTED***';
      }
    });

    return sanitized;
  }

  /**
   * Sleep utility for retry logic
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate a unique reference/idempotency key
   */
  protected generateReference(prefix: string = 'TXN'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Validate required configuration
   */
  protected validateConfig(requiredFields: string[]): void {
    const missing = requiredFields.filter(
      field => !this.config[field as keyof ProviderConfig]
    );

    if (missing.length > 0) {
      throw new ProviderError(
        `Missing required configuration: ${missing.join(', ')}`,
        'CONFIG_ERROR'
      );
    }
  }
}
