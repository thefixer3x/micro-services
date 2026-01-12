/**
 * Authentication Middleware
 *
 * Validates API keys and attaches project context to requests.
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

interface ApiKeyData {
  id: string;
  projectId: string;
  permissions: string[];
  rateLimit: number;
  environment: 'sandbox' | 'live';
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'API key required. Provide X-API-Key header.',
      },
      meta: { requestId: req.id },
    });
    return;
  }

  try {
    const db: Pool = (req as any).db;

    // Validate API key
    const result = await db.query<ApiKeyData>(
      `
      SELECT
        ak.id,
        ak.project_id as "projectId",
        ak.permissions,
        ak.rate_limit_per_hour as "rateLimit",
        CASE
          WHEN ak.key_hash LIKE 'sk_test_%' THEN 'sandbox'
          ELSE 'live'
        END as environment
      FROM api_keys ak
      WHERE ak.key_hash = crypt($1, ak.key_hash)
        AND ak.is_active = true
        AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
      `,
      [apiKey]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid or expired API key',
        },
        meta: { requestId: req.id },
      });
      return;
    }

    const keyData = result.rows[0];

    // Attach to request
    req.projectId = keyData.projectId;
    req.apiKeyId = keyData.id;
    (req as any).permissions = keyData.permissions;
    (req as any).environment = keyData.environment;
    (req as any).rateLimit = keyData.rateLimit;

    // Log API key usage
    await db.query(
      `
      UPDATE api_keys
      SET last_used_at = NOW(), usage_count = usage_count + 1
      WHERE id = $1
      `,
      [keyData.id]
    );

    next();
  } catch (error) {
    (req as any).logger?.error('Auth middleware error', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Failed to validate API key',
      },
      meta: { requestId: req.id },
    });
  }
}

/**
 * Permission check middleware factory
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const permissions: string[] = (req as any).permissions || [];

    if (!permissions.includes(permission) && !permissions.includes('*')) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `This action requires the '${permission}' permission`,
        },
        meta: { requestId: req.id },
      });
      return;
    }

    next();
  };
}

/**
 * Environment check middleware (sandbox vs production)
 */
export function requireEnvironment(env: 'sandbox' | 'live') {
  return (req: Request, res: Response, next: NextFunction) => {
    const currentEnv = (req as any).environment;

    if (currentEnv !== env) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ENVIRONMENT_MISMATCH',
          message: `This endpoint requires a ${env} API key`,
        },
        meta: { requestId: req.id },
      });
      return;
    }

    next();
  };
}
