/**
 * Payments Endpoints
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler, createError } from '../middleware/error-handler';
import { requirePermission } from '../middleware/auth';

export const paymentsRouter = Router();

/**
 * Initialize a payment
 */
paymentsRouter.post(
  '/',
  requirePermission('payments:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;
    const logger = (req as any).logger;

    const {
      amount,
      currency,
      email,
      reference,
      callback_url,
      channels,
      metadata,
    } = req.body;

    // Validation
    if (!amount || amount < 100) {
      throw createError('VALIDATION_ERROR', 'amount must be at least 100', 400);
    }
    if (!currency) {
      throw createError('VALIDATION_ERROR', 'currency is required', 400);
    }
    if (!email) {
      throw createError('VALIDATION_ERROR', 'email is required', 400);
    }

    // Check capabilities
    const capResult = await db.query(
      `SELECT payments_enabled FROM project_capabilities WHERE project_id = $1`,
      [projectId]
    );

    if (capResult.rows.length === 0 || !capResult.rows[0].payments_enabled) {
      throw createError('FEATURE_DISABLED', 'Payments are not enabled for this project', 403);
    }

    // Generate IDs
    const paymentId = `pay_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const paymentRef = reference || `ref_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    // TODO: Use orchestrator to route to payment provider (Paystack/Flutterwave)
    // For now, create a pending record and return mock authorization URL

    const result = await db.query(
      `
      INSERT INTO transactions (
        id, reference, project_id, type, amount, currency,
        status, metadata, created_at
      ) VALUES ($1, $2, $3, 'payment', $4, $5, 'pending', $6, NOW())
      RETURNING *
      `,
      [
        paymentId,
        paymentRef,
        projectId,
        amount,
        currency,
        { email, callback_url, channels, ...metadata },
      ]
    );

    const payment = result.rows[0];

    // Mock authorization URL (in production, this comes from provider)
    const environment = (req as any).environment || 'sandbox';
    const baseUrl = environment === 'sandbox'
      ? 'https://sandbox.seftechub.com'
      : 'https://pay.seftechub.com';

    const authorizationUrl = `${baseUrl}/checkout/${paymentId}`;

    logger?.info('Payment initialized', {
      paymentId,
      amount,
      currency,
      email,
    });

    res.status(201).json({
      success: true,
      data: {
        id: payment.id,
        reference: payment.reference,
        authorizationUrl,
        accessCode: paymentId.slice(4), // Mock access code
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      },
      meta: { requestId: req.id },
    });
  })
);

/**
 * Verify a payment
 */
paymentsRouter.post(
  '/:paymentId/verify',
  requirePermission('payments:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;
    const { paymentId } = req.params;

    const result = await db.query(
      `SELECT * FROM transactions WHERE id = $1 AND project_id = $2 AND type = 'payment'`,
      [paymentId, projectId]
    );

    if (result.rows.length === 0) {
      throw createError('NOT_FOUND', 'Payment not found', 404);
    }

    const payment = result.rows[0];

    // TODO: Use orchestrator to verify with payment provider
    // For now, return current status

    res.json({
      success: true,
      data: {
        id: payment.id,
        reference: payment.reference,
        status: payment.status,
        amount: Number(payment.amount),
        currency: payment.currency,
        channel: payment.metadata?.channel,
        paidAt: payment.completed_at,
      },
      meta: { requestId: req.id },
    });
  })
);

/**
 * List payments
 */
paymentsRouter.get(
  '/',
  requirePermission('payments:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;

    const { status, limit = 20, cursor } = req.query;

    let query = `
      SELECT * FROM transactions
      WHERE project_id = $1 AND type = 'payment'
    `;
    const params: any[] = [projectId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (cursor) {
      query += ` AND created_at < $${paramIndex}`;
      params.push(new Date(cursor as string));
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(Math.min(Number(limit), 100));

    const result = await db.query(query, params);

    const payments = result.rows.map((p) => ({
      id: p.id,
      reference: p.reference,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      channel: p.metadata?.channel,
      createdAt: p.created_at,
      paidAt: p.completed_at,
    }));

    const hasMore = payments.length === Number(limit);
    const nextCursor = hasMore ? payments[payments.length - 1].createdAt : null;

    res.json({
      success: true,
      data: payments,
      meta: {
        requestId: req.id,
        cursor: nextCursor,
        hasMore,
      },
    });
  })
);
