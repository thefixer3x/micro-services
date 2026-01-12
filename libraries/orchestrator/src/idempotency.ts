/**
 * Idempotency Middleware
 *
 * Prevents duplicate operations by tracking request keys.
 * Critical for payment and transfer operations.
 */

import crypto from 'crypto';

interface IdempotencyResult {
  acquired: boolean;
  existingResponse?: {
    status: number;
    body: any;
  };
}

interface IdempotencyOptions {
  headerName?: string;       // Header containing idempotency key
  ttlSeconds?: number;       // How long to keep keys (default 24h)
  lockTimeoutSeconds?: number; // Lock timeout for in-progress requests
}

export class IdempotencyManager {
  private db: any;
  private options: Required<IdempotencyOptions>;

  constructor(db: any, options: IdempotencyOptions = {}) {
    this.db = db;
    this.options = {
      headerName: options.headerName ?? 'Idempotency-Key',
      ttlSeconds: options.ttlSeconds ?? 86400, // 24 hours
      lockTimeoutSeconds: options.lockTimeoutSeconds ?? 300, // 5 minutes
    };
  }

  /**
   * Hash request body for fingerprinting
   */
  private hashRequest(body: any): string {
    const normalized = JSON.stringify(body, Object.keys(body).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Try to acquire an idempotency lock
   * Returns existing response if key was already used
   */
  async acquireLock(
    projectId: string,
    idempotencyKey: string,
    requestPath: string,
    requestMethod: string,
    requestBody: any
  ): Promise<IdempotencyResult> {
    const requestHash = this.hashRequest(requestBody);
    const lockId = crypto.randomUUID();

    try {
      const result = await this.db.query(
        `SELECT * FROM acquire_idempotency_lock($1, $2, $3, $4, $5, $6)`,
        [projectId, idempotencyKey, requestPath, requestMethod, requestHash, lockId]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        if (row.acquired) {
          return { acquired: true };
        } else {
          return {
            acquired: false,
            existingResponse: {
              status: row.existing_status,
              body: row.existing_response,
            },
          };
        }
      }

      return { acquired: true };
    } catch (error: any) {
      if (error.message === 'Idempotency key already used for different request') {
        throw new IdempotencyError(
          'IDEMPOTENCY_KEY_CONFLICT',
          'Idempotency key was already used for a different request'
        );
      }
      if (error.message === 'Request in progress' || error.message === 'Concurrent request') {
        throw new IdempotencyError(
          'REQUEST_IN_PROGRESS',
          'Another request with this idempotency key is currently being processed'
        );
      }
      throw error;
    }
  }

  /**
   * Complete an idempotency request with the response
   */
  async completeRequest(
    projectId: string,
    idempotencyKey: string,
    responseStatus: number,
    responseBody: any
  ): Promise<void> {
    await this.db.query(
      `SELECT complete_idempotency_request($1, $2, $3, $4)`,
      [projectId, idempotencyKey, responseStatus, JSON.stringify(responseBody)]
    );
  }

  /**
   * Release a lock without completing (for errors)
   */
  async releaseLock(projectId: string, idempotencyKey: string): Promise<void> {
    await this.db.query(
      `
      UPDATE idempotency_keys
      SET locked_at = NULL, locked_by = NULL
      WHERE project_id = $1 AND idempotency_key = $2
      `,
      [projectId, idempotencyKey]
    );
  }

  /**
   * Cleanup expired keys (run periodically)
   */
  async cleanup(): Promise<number> {
    const result = await this.db.query(`SELECT cleanup_expired_idempotency_keys()`);
    return result.rows[0]?.cleanup_expired_idempotency_keys ?? 0;
  }

  /**
   * Express middleware
   */
  middleware() {
    return async (req: any, res: any, next: any) => {
      const idempotencyKey = req.headers[this.options.headerName.toLowerCase()];

      // If no key, proceed normally
      if (!idempotencyKey) {
        return next();
      }

      // Get project ID from auth context
      const projectId = req.projectId || req.user?.projectId;
      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PROJECT',
            message: 'Project ID required for idempotency',
          },
        });
      }

      try {
        const result = await this.acquireLock(
          projectId,
          idempotencyKey,
          req.path,
          req.method,
          req.body
        );

        if (!result.acquired && result.existingResponse) {
          // Return cached response
          return res
            .status(result.existingResponse.status)
            .json(result.existingResponse.body);
        }

        // Store for later completion
        req.idempotencyKey = idempotencyKey;
        req.idempotencyProjectId = projectId;

        // Intercept response to cache it
        const originalJson = res.json.bind(res);
        res.json = async (body: any) => {
          try {
            await this.completeRequest(
              projectId,
              idempotencyKey,
              res.statusCode,
              body
            );
          } catch (error) {
            console.error('Failed to complete idempotency request:', error);
          }
          return originalJson(body);
        };

        next();
      } catch (error: any) {
        if (error instanceof IdempotencyError) {
          return res.status(409).json({
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
          });
        }
        next(error);
      }
    };
  }
}

export class IdempotencyError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'IdempotencyError';
  }
}

export default IdempotencyManager;
