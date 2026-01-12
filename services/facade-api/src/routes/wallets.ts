/**
 * Wallets Endpoints
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler, createError } from '../middleware/error-handler';
import { requirePermission } from '../middleware/auth';

export const walletsRouter = Router();

/**
 * Create a wallet
 */
walletsRouter.post(
  '/',
  requirePermission('wallets:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;
    const logger = (req as any).logger;

    const { customer_id, currency, type = 'personal', metadata } = req.body;

    // Validation
    if (!customer_id) {
      throw createError('VALIDATION_ERROR', 'customer_id is required', 400);
    }
    if (!currency) {
      throw createError('VALIDATION_ERROR', 'currency is required', 400);
    }

    // Check capabilities
    const capResult = await db.query(
      `SELECT wallet_enabled, allowed_currencies FROM project_capabilities WHERE project_id = $1`,
      [projectId]
    );

    if (capResult.rows.length === 0 || !capResult.rows[0].wallet_enabled) {
      throw createError('FEATURE_DISABLED', 'Wallets are not enabled for this project', 403);
    }

    const allowedCurrencies = capResult.rows[0].allowed_currencies || ['NGN'];
    if (!allowedCurrencies.includes(currency)) {
      throw createError('INVALID_CURRENCY', `Currency ${currency} is not allowed`, 400);
    }

    // TODO: Call provider via orchestrator to create wallet
    // For now, create locally

    const walletId = `wal_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    const result = await db.query(
      `
      INSERT INTO wallets (
        id, customer_id, project_id, type, currency, status, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'active', $6, NOW())
      RETURNING *
      `,
      [walletId, customer_id, projectId, type, currency, metadata || {}]
    );

    const wallet = result.rows[0];

    logger?.info('Wallet created', { walletId, customerId: customer_id, currency });

    res.status(201).json({
      success: true,
      data: {
        id: wallet.id,
        customerId: wallet.customer_id,
        type: wallet.type,
        currency: wallet.currency,
        status: wallet.status,
        accountNumber: wallet.account_number,
        accountName: wallet.account_name,
        bankName: wallet.bank_name,
        createdAt: wallet.created_at,
      },
      meta: { requestId: req.id },
    });
  })
);

/**
 * List wallets
 */
walletsRouter.get(
  '/',
  requirePermission('wallets:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;

    const { customer_id, limit = 20, cursor } = req.query;

    let query = `
      SELECT * FROM wallets
      WHERE project_id = $1
    `;
    const params: any[] = [projectId];
    let paramIndex = 2;

    if (customer_id) {
      query += ` AND customer_id = $${paramIndex}`;
      params.push(customer_id);
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

    const wallets = result.rows.map((w) => ({
      id: w.id,
      customerId: w.customer_id,
      type: w.type,
      currency: w.currency,
      status: w.status,
      accountNumber: w.account_number,
      accountName: w.account_name,
      bankName: w.bank_name,
      createdAt: w.created_at,
    }));

    const hasMore = wallets.length === Number(limit);
    const nextCursor = hasMore ? wallets[wallets.length - 1].createdAt : null;

    res.json({
      success: true,
      data: wallets,
      meta: {
        requestId: req.id,
        cursor: nextCursor,
        hasMore,
      },
    });
  })
);

/**
 * Get wallet by ID
 */
walletsRouter.get(
  '/:walletId',
  requirePermission('wallets:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;
    const { walletId } = req.params;

    const result = await db.query(
      `SELECT * FROM wallets WHERE id = $1 AND project_id = $2`,
      [walletId, projectId]
    );

    if (result.rows.length === 0) {
      throw createError('NOT_FOUND', 'Wallet not found', 404);
    }

    const w = result.rows[0];

    res.json({
      success: true,
      data: {
        id: w.id,
        customerId: w.customer_id,
        type: w.type,
        currency: w.currency,
        status: w.status,
        accountNumber: w.account_number,
        accountName: w.account_name,
        bankName: w.bank_name,
        createdAt: w.created_at,
      },
      meta: { requestId: req.id },
    });
  })
);

/**
 * Get wallet balance
 */
walletsRouter.get(
  '/:walletId/balance',
  requirePermission('wallets:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;
    const { walletId } = req.params;

    // Check wallet exists and belongs to project
    const walletResult = await db.query(
      `SELECT id, currency FROM wallets WHERE id = $1 AND project_id = $2`,
      [walletId, projectId]
    );

    if (walletResult.rows.length === 0) {
      throw createError('NOT_FOUND', 'Wallet not found', 404);
    }

    const wallet = walletResult.rows[0];

    // Get balance
    const balanceResult = await db.query(
      `
      SELECT
        COALESCE(available_balance, 0) as available,
        COALESCE(ledger_balance, 0) as ledger,
        COALESCE(reserved_balance, 0) as reserved,
        updated_at as last_updated
      FROM wallet_balances
      WHERE wallet_id = $1
      `,
      [walletId]
    );

    let balance;
    if (balanceResult.rows.length === 0) {
      balance = {
        available: 0,
        ledger: 0,
        reserved: 0,
        currency: wallet.currency,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      const b = balanceResult.rows[0];
      balance = {
        available: Number(b.available),
        ledger: Number(b.ledger),
        reserved: Number(b.reserved),
        currency: wallet.currency,
        lastUpdated: b.last_updated,
      };
    }

    res.json({
      success: true,
      data: balance,
      meta: { requestId: req.id },
    });
  })
);
