/**
 * Transfers Endpoints
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler, createError } from '../middleware/error-handler';
import { requirePermission } from '../middleware/auth';

export const transfersRouter = Router();

/**
 * Create a transfer
 */
transfersRouter.post(
  '/',
  requirePermission('transfers:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;
    const logger = (req as any).logger;

    const {
      source_wallet_id,
      amount,
      currency,
      destination,
      narration,
      reference,
      metadata,
    } = req.body;

    // Validation
    if (!source_wallet_id) {
      throw createError('VALIDATION_ERROR', 'source_wallet_id is required', 400);
    }
    if (!amount || amount <= 0) {
      throw createError('VALIDATION_ERROR', 'amount must be positive', 400);
    }
    if (!currency) {
      throw createError('VALIDATION_ERROR', 'currency is required', 400);
    }
    if (!destination || !destination.type) {
      throw createError('VALIDATION_ERROR', 'destination is required', 400);
    }

    // Check capabilities
    const capResult = await db.query(
      `
      SELECT
        transfers_enabled,
        allowed_currencies,
        effective_daily_transfer_limit as daily_limit,
        effective_per_transfer_limit as per_limit
      FROM project_capabilities_with_tier
      WHERE project_id = $1
      `,
      [projectId]
    );

    if (capResult.rows.length === 0 || !capResult.rows[0].transfers_enabled) {
      throw createError('FEATURE_DISABLED', 'Transfers are not enabled for this project', 403);
    }

    const caps = capResult.rows[0];

    // Check per-transfer limit
    if (caps.per_limit && amount > caps.per_limit) {
      throw createError(
        'LIMIT_EXCEEDED',
        `Amount exceeds per-transfer limit of ${caps.per_limit}`,
        400,
        { limit: caps.per_limit, requested: amount }
      );
    }

    // Verify source wallet
    const walletResult = await db.query(
      `SELECT * FROM wallets WHERE id = $1 AND project_id = $2`,
      [source_wallet_id, projectId]
    );

    if (walletResult.rows.length === 0) {
      throw createError('NOT_FOUND', 'Source wallet not found', 404);
    }

    const sourceWallet = walletResult.rows[0];

    if (sourceWallet.status !== 'active') {
      throw createError('WALLET_INACTIVE', 'Source wallet is not active', 400);
    }

    // Check balance
    const balanceResult = await db.query(
      `SELECT available_balance FROM wallet_balances WHERE wallet_id = $1`,
      [source_wallet_id]
    );

    const availableBalance = balanceResult.rows.length > 0
      ? Number(balanceResult.rows[0].available_balance)
      : 0;

    if (availableBalance < amount) {
      throw createError(
        'INSUFFICIENT_FUNDS',
        'Wallet balance is insufficient for this transfer',
        402,
        { available: availableBalance, required: amount }
      );
    }

    // Generate reference
    const transferRef = reference || `txn_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const transferId = `tfr_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    // Calculate fee (example: 1% for bank, 0 for wallet)
    const feeAmount = destination.type === 'bank' ? Math.ceil(amount * 0.01) : 0;

    // Create transfer record
    const result = await db.query(
      `
      INSERT INTO transactions (
        id, reference, project_id, type, amount, fee, currency,
        status, source_wallet_id, destination_type, destination_details,
        narration, metadata, created_at
      ) VALUES ($1, $2, $3, 'transfer_out', $4, $5, $6, 'pending', $7, $8, $9, $10, $11, NOW())
      RETURNING *
      `,
      [
        transferId,
        transferRef,
        projectId,
        amount,
        feeAmount,
        currency,
        source_wallet_id,
        destination.type,
        JSON.stringify(destination),
        narration,
        metadata || {},
      ]
    );

    const transfer = result.rows[0];

    // TODO: Use orchestrator to route to provider
    // For now, mark as processing and simulate async processing
    await db.query(
      `UPDATE transactions SET status = 'processing' WHERE id = $1`,
      [transferId]
    );

    logger?.info('Transfer initiated', {
      transferId,
      amount,
      currency,
      destination: destination.type,
    });

    res.status(202).json({
      success: true,
      data: {
        id: transfer.id,
        reference: transfer.reference,
        amount: Number(transfer.amount),
        fee: Number(transfer.fee),
        currency: transfer.currency,
        status: 'processing',
        sourceWalletId: transfer.source_wallet_id,
        destination: destination,
        narration: transfer.narration,
        createdAt: transfer.created_at,
      },
      meta: { requestId: req.id },
    });
  })
);

/**
 * List transfers
 */
transfersRouter.get(
  '/',
  requirePermission('transfers:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;

    const { wallet_id, status, limit = 20, cursor } = req.query;

    let query = `
      SELECT * FROM transactions
      WHERE project_id = $1 AND type IN ('transfer_out', 'transfer_in')
    `;
    const params: any[] = [projectId];
    let paramIndex = 2;

    if (wallet_id) {
      query += ` AND source_wallet_id = $${paramIndex}`;
      params.push(wallet_id);
      paramIndex++;
    }

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

    const transfers = result.rows.map((t) => ({
      id: t.id,
      reference: t.reference,
      amount: Number(t.amount),
      fee: Number(t.fee),
      currency: t.currency,
      status: t.status,
      sourceWalletId: t.source_wallet_id,
      destination: t.destination_details,
      narration: t.narration,
      createdAt: t.created_at,
      completedAt: t.completed_at,
    }));

    const hasMore = transfers.length === Number(limit);
    const nextCursor = hasMore ? transfers[transfers.length - 1].createdAt : null;

    res.json({
      success: true,
      data: transfers,
      meta: {
        requestId: req.id,
        cursor: nextCursor,
        hasMore,
      },
    });
  })
);

/**
 * Get transfer by ID
 */
transfersRouter.get(
  '/:transferId',
  requirePermission('transfers:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;
    const { transferId } = req.params;

    const result = await db.query(
      `
      SELECT * FROM transactions
      WHERE id = $1 AND project_id = $2 AND type IN ('transfer_out', 'transfer_in')
      `,
      [transferId, projectId]
    );

    if (result.rows.length === 0) {
      throw createError('NOT_FOUND', 'Transfer not found', 404);
    }

    const t = result.rows[0];

    res.json({
      success: true,
      data: {
        id: t.id,
        reference: t.reference,
        amount: Number(t.amount),
        fee: Number(t.fee),
        currency: t.currency,
        status: t.status,
        sourceWalletId: t.source_wallet_id,
        destination: t.destination_details,
        narration: t.narration,
        createdAt: t.created_at,
        completedAt: t.completed_at,
      },
      meta: { requestId: req.id },
    });
  })
);
