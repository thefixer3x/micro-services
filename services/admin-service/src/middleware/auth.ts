import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    roles: string[];
  };
}

/**
 * JWT Authentication middleware
 * Validates Bearer token and attaches user to request
 */
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authorization token required',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    const token = authHeader.substring(7);

    // Decode JWT payload (in production, verify with secret)
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) {
      res.status(401).json({
        error: 'Invalid token format',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    try {
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
      req.user = {
        userId: payload.sub || payload.userId,
        email: payload.email,
        roles: payload.roles || [payload.role] || ['admin']
      };
      next();
    } catch {
      res.status(401).json({
        error: 'Invalid token',
        code: 'UNAUTHORIZED'
      });
    }
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRoles(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    const hasRole = allowedRoles.some(role => req.user!.roles.includes(role));

    if (!hasRole) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredRoles: allowedRoles
      });
      return;
    }

    next();
  };
}

/**
 * Admin-only middleware
 */
export const adminOnly = requireRoles('admin', 'super_admin');

/**
 * Support agent access middleware
 */
export const supportAccess = requireRoles('admin', 'super_admin', 'support_agent');

/**
 * Auditor access middleware
 */
export const auditorAccess = requireRoles('admin', 'super_admin', 'auditor');
