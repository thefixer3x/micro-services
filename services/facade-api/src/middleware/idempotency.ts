/**
 * Idempotency Middleware
 *
 * Prevents duplicate operations by caching responses for a given idempotency key.
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import crypto from 'crypto';

const IDEMPOTENCY_HEADER = 'idempotency-key';

export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Only apply to mutating requests
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.headers[IDEMPOTENCY_HEADER] as string;

  // If no key provided, continue without idempotency
  if (!idempotencyKey) {
    return next();
  }

  const projectId = req.projectId;
  if (!projectId) {
    return next();
  }

  const db: Pool = (req as any).db;
  const logger = (req as any).logger;

  try {
    // Hash the request body for fingerprinting
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    const lockId = crypto.randomUUID();

    // Try to acquire lock
    const result = await db.query(
      `SELECT * FROM acquire_idempotency_lock($1, $2, $3, $4, $5, $6)`,
      [projectId, idempotencyKey, req.path, req.method, requestHash, lockId]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];

      if (!row.acquired && row.existing_response) {
        // Return cached response
        logger?.debug('Returning cached idempotency response', {
          idempotencyKey,
          requestId: req.id,
        });

        res.status(row.existing_status || 200).json(row.existing_response);
        return;
      }
    }

    // Store key info for response caching
    (req as any).idempotencyKey = idempotencyKey;

    // Intercept response to cache it
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Cache the response
      cacheIdempotencyResponse(db, projectId, idempotencyKey, res.statusCode, body)
        .catch((err) => logger?.error('Failed to cache idempotency response', { error: err }));

      return originalJson(body);
    };

    next();
  } catch (error: any) {
    logger?.error('Idempotency middleware error', { error: error.message });

    if (error.message === 'Idempotency key already used for different request') {
      res.status(409).json({
        success: false,
        error: {
          code: 'IDEMPOTENCY_KEY_CONFLICT',
          message: 'This idempotency key was already used for a different request',
        },
        meta: { requestId: req.id },
      });
      return;
    }

    if (error.message === 'Request in progress' || error.message === 'Concurrent request') {
      res.status(409).json({
        success: false,
        error: {
          code: 'REQUEST_IN_PROGRESS',
          message: 'Another request with this idempotency key is currently being processed',
        },
        meta: { requestId: req.id },
      });
      return;
    }

    // For other errors, continue without idempotency
    next();
  }
}

async function cacheIdempotencyResponse(
  db: Pool,
  projectId: string,
  idempotencyKey: string,
  status: number,
  body: any
): Promise<void> {
  await db.query(
    `SELECT complete_idempotency_request($1, $2, $3, $4)`,
    [projectId, idempotencyKey, status, JSON.stringify(body)]
  );
}
