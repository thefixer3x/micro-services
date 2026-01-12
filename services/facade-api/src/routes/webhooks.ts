/**
 * Webhooks Endpoints
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { asyncHandler, createError } from '../middleware/error-handler';
import { requirePermission } from '../middleware/auth';

export const webhooksRouter = Router();

/**
 * Create webhook endpoint
 */
webhooksRouter.post(
  '/',
  requirePermission('webhooks:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;
    const logger = (req as any).logger;

    const { url, events = [], description } = req.body;

    // Validation
    if (!url) {
      throw createError('VALIDATION_ERROR', 'url is required', 400);
    }

    try {
      new URL(url);
    } catch {
      throw createError('VALIDATION_ERROR', 'url must be a valid URL', 400);
    }

    if (!url.startsWith('https://')) {
      throw createError('VALIDATION_ERROR', 'url must use HTTPS', 400);
    }

    // Check for duplicate
    const existingResult = await db.query(
      `SELECT id FROM webhook_endpoints WHERE project_id = $1 AND url = $2`,
      [projectId, url]
    );

    if (existingResult.rows.length > 0) {
      throw createError('DUPLICATE_WEBHOOK', 'Webhook endpoint already exists for this URL', 409);
    }

    // Generate webhook ID and secret
    const webhookId = `whk_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const result = await db.query(
      `
      INSERT INTO webhook_endpoints (
        id, project_id, url, events, description, secret, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
      RETURNING *
      `,
      [webhookId, projectId, url, events, description, secret]
    );

    const webhook = result.rows[0];

    logger?.info('Webhook created', { webhookId, url, events });

    res.status(201).json({
      success: true,
      data: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        description: webhook.description,
        secret, // Only returned on creation
        status: webhook.status,
        createdAt: webhook.created_at,
      },
      meta: { requestId: req.id },
    });
  })
);

/**
 * List webhook endpoints
 */
webhooksRouter.get(
  '/',
  requirePermission('webhooks:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;

    const result = await db.query(
      `
      SELECT id, url, events, description, status,
             total_deliveries, successful_deliveries, failed_deliveries,
             created_at
      FROM webhook_endpoints
      WHERE project_id = $1
      ORDER BY created_at DESC
      `,
      [projectId]
    );

    const webhooks = result.rows.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      description: w.description,
      status: w.status,
      stats: {
        total: w.total_deliveries || 0,
        successful: w.successful_deliveries || 0,
        failed: w.failed_deliveries || 0,
      },
      createdAt: w.created_at,
    }));

    res.json({
      success: true,
      data: webhooks,
      meta: { requestId: req.id },
    });
  })
);

/**
 * Get webhook by ID
 */
webhooksRouter.get(
  '/:webhookId',
  requirePermission('webhooks:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;
    const { webhookId } = req.params;

    const result = await db.query(
      `
      SELECT id, url, events, description, status,
             total_deliveries, successful_deliveries, failed_deliveries,
             created_at
      FROM webhook_endpoints
      WHERE id = $1 AND project_id = $2
      `,
      [webhookId, projectId]
    );

    if (result.rows.length === 0) {
      throw createError('NOT_FOUND', 'Webhook not found', 404);
    }

    const w = result.rows[0];

    res.json({
      success: true,
      data: {
        id: w.id,
        url: w.url,
        events: w.events,
        description: w.description,
        status: w.status,
        stats: {
          total: w.total_deliveries || 0,
          successful: w.successful_deliveries || 0,
          failed: w.failed_deliveries || 0,
        },
        createdAt: w.created_at,
      },
      meta: { requestId: req.id },
    });
  })
);

/**
 * Update webhook
 */
webhooksRouter.patch(
  '/:webhookId',
  requirePermission('webhooks:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;
    const { webhookId } = req.params;
    const { events, description, status } = req.body;

    // Check exists
    const existingResult = await db.query(
      `SELECT id FROM webhook_endpoints WHERE id = $1 AND project_id = $2`,
      [webhookId, projectId]
    );

    if (existingResult.rows.length === 0) {
      throw createError('NOT_FOUND', 'Webhook not found', 404);
    }

    // Build update
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (events !== undefined) {
      updates.push(`events = $${paramIndex}`);
      params.push(events);
      paramIndex++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }
    if (status !== undefined) {
      if (!['active', 'paused', 'disabled'].includes(status)) {
        throw createError('VALIDATION_ERROR', 'Invalid status', 400);
      }
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw createError('VALIDATION_ERROR', 'No updates provided', 400);
    }

    updates.push(`updated_at = NOW()`);

    params.push(webhookId);
    params.push(projectId);

    const result = await db.query(
      `
      UPDATE webhook_endpoints
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND project_id = $${paramIndex + 1}
      RETURNING *
      `,
      params
    );

    const w = result.rows[0];

    res.json({
      success: true,
      data: {
        id: w.id,
        url: w.url,
        events: w.events,
        description: w.description,
        status: w.status,
        createdAt: w.created_at,
      },
      meta: { requestId: req.id },
    });
  })
);

/**
 * Delete webhook
 */
webhooksRouter.delete(
  '/:webhookId',
  requirePermission('webhooks:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;
    const { webhookId } = req.params;
    const logger = (req as any).logger;

    const result = await db.query(
      `DELETE FROM webhook_endpoints WHERE id = $1 AND project_id = $2 RETURNING id`,
      [webhookId, projectId]
    );

    if (result.rows.length === 0) {
      throw createError('NOT_FOUND', 'Webhook not found', 404);
    }

    logger?.info('Webhook deleted', { webhookId });

    res.status(204).send();
  })
);
