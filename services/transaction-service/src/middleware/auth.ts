import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import logger from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization token required' });
      return;
    }

    const token = authHeader.substring(7);

    // In production, validate JWT locally or call identity service
    // For now, decode the JWT payload (this is NOT secure, just for skeleton)
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) {
      res.status(401).json({ error: 'Invalid token format' });
      return;
    }

    try {
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
      req.user = {
        id: payload.sub || payload.userId,
        email: payload.email,
        role: payload.role || 'user'
      };
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({ error: 'Authentication failed' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
