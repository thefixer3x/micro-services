import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface TokenPayload {
  userId: string;
  email: string;
  roles?: string[];
  [key: string]: any;
}

export interface JwtConfig {
  secret: string;
  expiresIn?: string | number;
  issuer?: string;
  audience?: string;
}

export class JwtService {
  private secret: string;
  private config: JwtConfig;

  constructor(config: JwtConfig) {
    this.secret = config.secret;
    this.config = config;
  }

  /**
   * Generate JWT token
   */
  generateToken(payload: TokenPayload): string {
    const options: any = {};

    if (this.config.expiresIn) {
      options.expiresIn = this.config.expiresIn;
    }
    if (this.config.issuer) {
      options.issuer = this.config.issuer;
    }
    if (this.config.audience) {
      options.audience = this.config.audience;
    }

    return jwt.sign(payload, this.secret, options);
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): TokenPayload {
    try {
      const options: any = {};

      if (this.config.issuer) {
        options.issuer = this.config.issuer;
      }
      if (this.config.audience) {
        options.audience = this.config.audience;
      }

      return jwt.verify(token, this.secret, options) as unknown as TokenPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Invalid token');
      }
      throw new AuthenticationError('Token verification failed');
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): TokenPayload | null {
    return jwt.decode(token) as TokenPayload | null;
  }

  /**
   * Refresh token (generate new token from old one)
   */
  refreshToken(token: string): string {
    const decoded = this.verifyToken(token);
    // Remove JWT-specific fields
    const { iat, exp, iss, aud, ...payload } = decoded as any;
    return this.generateToken(payload);
  }
}

/**
 * Express middleware for JWT authentication
 */
export function authenticateJWT(jwtService: JwtService) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        throw new AuthenticationError('No authorization header provided');
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw new AuthenticationError('Invalid authorization header format');
      }

      const token = parts[1];
      const payload = jwtService.verifyToken(token);

      // Attach user info to request
      (req as any).user = payload;

      next();
    } catch (error: any) {
      return res.status(401).json({
        error: error.message || 'Authentication failed',
        code: 'UNAUTHORIZED',
      });
    }
  };
}

/**
 * Express middleware for role-based authorization
 */
export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as TokenPayload;

    if (!user) {
      return res.status(401).json({
        error: 'Not authenticated',
        code: 'UNAUTHORIZED',
      });
    }

    const userRoles = user.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
}

/**
 * Express middleware for optional authentication
 */
export function optionalAuth(jwtService: JwtService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next();
    }

    try {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const payload = jwtService.verifyToken(token);
        (req as any).user = payload;
      }
    } catch (error) {
      // Silently fail for optional auth
    }

    next();
  };
}

/**
 * Custom authentication error
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Extract user ID from request (after authentication)
 */
export function getUserId(req: Request): string {
  const user = (req as any).user as TokenPayload;
  if (!user || !user.userId) {
    throw new AuthenticationError('User not authenticated');
  }
  return user.userId;
}

/**
 * Check if user has specific role
 */
export function hasRole(req: Request, role: string): boolean {
  const user = (req as any).user as TokenPayload;
  if (!user || !user.roles) {
    return false;
  }
  return user.roles.includes(role);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(req: Request, roles: string[]): boolean {
  const user = (req as any).user as TokenPayload;
  if (!user || !user.roles) {
    return false;
  }
  return roles.some(role => user.roles!.includes(role));
}
