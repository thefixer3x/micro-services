/**
 * Capabilities Endpoint
 *
 * Returns what features are enabled for a project.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { asyncHandler } from '../middleware/error-handler';

export const capabilitiesRouter = Router();

capabilitiesRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;

    // Get project capabilities
    const result = await db.query(
      `
      SELECT * FROM project_capabilities_with_tier
      WHERE project_id = $1
      `,
      [projectId]
    );

    let capabilities;

    if (result.rows.length === 0) {
      // Return default capabilities
      capabilities = {
        wallet: { enabled: false },
        transfers: {
          enabled: false,
          currencies: ['NGN'],
          dailyLimit: 1000000,
          perTransferLimit: 100000,
        },
        payments: {
          enabled: false,
          channels: [],
        },
        cards: { enabled: false },
        kyc: {
          enabled: false,
          types: [],
        },
        webhooks: { enabled: true },
        rateLimit: {
          requestsPerMinute: 60,
          requestsPerHour: 500,
        },
        tier: 'starter',
      };
    } else {
      const row = result.rows[0];
      capabilities = {
        wallet: { enabled: row.wallet_enabled },
        transfers: {
          enabled: row.transfers_enabled,
          currencies: row.allowed_currencies || ['NGN'],
          dailyLimit: row.effective_daily_transfer_limit,
          perTransferLimit: row.effective_per_transfer_limit,
        },
        payments: {
          enabled: row.payments_enabled,
          channels: row.payments_enabled
            ? ['card', 'bank_transfer', 'ussd', 'bank']
            : [],
        },
        cards: { enabled: row.cards_enabled },
        kyc: {
          enabled: row.kyc_enabled,
          types: row.kyc_types || [],
        },
        webhooks: { enabled: row.webhooks_enabled },
        rateLimit: {
          requestsPerMinute: row.effective_requests_per_minute || 60,
          requestsPerHour: row.effective_requests_per_hour || 500,
        },
        tier: row.tier || 'starter',
      };
    }

    res.json({
      success: true,
      data: capabilities,
      meta: { requestId: req.id },
    });
  })
);
