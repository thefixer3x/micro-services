import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../database/connection';
import logger from '../utils/logger';

interface Refund {
  id: string;
  refundReference: string;
  originalTransactionId: string;
  refundTransactionId: string | null;
  walletId: string;
  amount: number;
  feeRefund: number;
  totalRefund: number;
  reason: string;
  reasonCode: string | null;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected' | 'failed';
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  processedAt: Date | null;
  bankReference: string | null;
  createdAt: Date;
}

interface RefundApproval {
  id: string;
  refundId: string;
  approverId: string;
  action: 'approve' | 'reject' | 'escalate';
  comments: string | null;
  createdAt: Date;
}

// Refund Provider Interface (Adapter Pattern)
export interface RefundProvider {
  name: string;
  processRefund(refund: Refund): Promise<{
    success: boolean;
    transactionId?: string;
    bankReference?: string;
    error?: string;
  }>;
}

// Stub implementation for development
class StubRefundProvider implements RefundProvider {
  name = 'stub';

  async processRefund(refund: Refund) {
    logger.info('STUB: Processing refund', {
      refundReference: refund.refundReference,
      amount: refund.totalRefund,
      walletId: refund.walletId
    });

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      transactionId: uuidv4(),
      bankReference: `REF-STUB-${Date.now()}`
    };
  }
}

export class RefundService {
  private provider: RefundProvider;
  private autoApproveThreshold: number = 1000; // Auto-approve refunds under this amount

  constructor(provider?: RefundProvider) {
    this.provider = provider || new StubRefundProvider();
  }

  setProvider(provider: RefundProvider): void {
    this.provider = provider;
    logger.info('Refund provider changed', { provider: provider.name });
  }

  setAutoApproveThreshold(amount: number): void {
    this.autoApproveThreshold = amount;
  }

  /**
   * Request a refund
   */
  async requestRefund(data: {
    originalTransactionId: string;
    amount?: number;
    includeFees?: boolean;
    reason: string;
    reasonCode?: string;
    requestedBy: string;
  }): Promise<Refund> {
    // Get original transaction
    const txnResult = await query<Record<string, unknown>>(
      `SELECT * FROM transactions WHERE id = $1`,
      [data.originalTransactionId]
    );

    if (txnResult.length === 0) {
      throw new Error('Original transaction not found');
    }

    const originalTxn = txnResult[0];

    if (originalTxn.status !== 'completed') {
      throw new Error('Can only refund completed transactions');
    }

    // Check for existing refunds
    const existingRefund = await query<Record<string, unknown>>(
      `SELECT id FROM refunds
       WHERE original_transaction_id = $1 AND status NOT IN ('rejected', 'failed')`,
      [data.originalTransactionId]
    );

    if (existingRefund.length > 0) {
      throw new Error('A refund already exists for this transaction');
    }

    // Calculate refund amounts
    const originalAmount = parseFloat(originalTxn.amount as string);
    const originalFees = parseFloat(originalTxn.fee_amount as string || '0');

    const refundAmount = data.amount ? Math.min(data.amount, originalAmount) : originalAmount;
    const feeRefund = data.includeFees ? originalFees : 0;
    const totalRefund = refundAmount + feeRefund;

    const refundReference = `REF-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Determine initial status (auto-approve small refunds)
    const initialStatus = totalRefund <= this.autoApproveThreshold ? 'approved' : 'pending';

    const result = await query<Record<string, unknown>>(
      `INSERT INTO refunds (
        refund_reference, original_transaction_id, wallet_id,
        amount, fee_refund, total_refund,
        reason, reason_code, status, requested_by,
        approved_by, approved_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        refundReference,
        data.originalTransactionId,
        originalTxn.source_wallet_id,
        refundAmount,
        feeRefund,
        totalRefund,
        data.reason,
        data.reasonCode,
        initialStatus,
        data.requestedBy,
        initialStatus === 'approved' ? 'SYSTEM' : null,
        initialStatus === 'approved' ? new Date() : null
      ]
    );

    const refund = this.mapRefund(result[0]);

    logger.info('Refund requested', {
      refundId: refund.id,
      refundReference,
      amount: totalRefund,
      autoApproved: initialStatus === 'approved'
    });

    // If auto-approved, process immediately
    if (initialStatus === 'approved') {
      return this.processRefund(refund.id);
    }

    return refund;
  }

  /**
   * Approve a refund
   */
  async approveRefund(
    refundId: string,
    approverId: string,
    comments?: string
  ): Promise<Refund> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        'SELECT * FROM refunds WHERE id = $1 FOR UPDATE',
        [refundId]
      );

      if (result.rows.length === 0) {
        throw new Error('Refund not found');
      }

      const refund = this.mapRefund(result.rows[0]);

      if (refund.status !== 'pending') {
        throw new Error(`Cannot approve refund in ${refund.status} status`);
      }

      // Record approval
      await client.query(
        `INSERT INTO refund_approvals (refund_id, approver_id, action, comments)
         VALUES ($1, $2, 'approve', $3)`,
        [refundId, approverId, comments]
      );

      // Update refund status
      await client.query(
        `UPDATE refunds
         SET status = 'approved', approved_by = $1, approved_at = NOW()
         WHERE id = $2`,
        [approverId, refundId]
      );

      await client.query('COMMIT');

      logger.info('Refund approved', { refundId, approverId });

      // Process the refund
      return this.processRefund(refundId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject a refund
   */
  async rejectRefund(
    refundId: string,
    rejectedBy: string,
    reason: string
  ): Promise<Refund> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        'SELECT * FROM refunds WHERE id = $1 FOR UPDATE',
        [refundId]
      );

      if (result.rows.length === 0) {
        throw new Error('Refund not found');
      }

      const refund = this.mapRefund(result.rows[0]);

      if (refund.status !== 'pending') {
        throw new Error(`Cannot reject refund in ${refund.status} status`);
      }

      // Record rejection
      await client.query(
        `INSERT INTO refund_approvals (refund_id, approver_id, action, comments)
         VALUES ($1, $2, 'reject', $3)`,
        [refundId, rejectedBy, reason]
      );

      // Update refund status
      await client.query(
        `UPDATE refunds
         SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_reason = $2
         WHERE id = $3`,
        [rejectedBy, reason, refundId]
      );

      await client.query('COMMIT');

      const updated = await this.getRefund(refundId);
      logger.info('Refund rejected', { refundId, rejectedBy, reason });

      return updated!;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process an approved refund
   */
  async processRefund(refundId: string): Promise<Refund> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        'SELECT * FROM refunds WHERE id = $1 FOR UPDATE',
        [refundId]
      );

      if (result.rows.length === 0) {
        throw new Error('Refund not found');
      }

      const refund = this.mapRefund(result.rows[0]);

      if (refund.status !== 'approved') {
        throw new Error(`Cannot process refund in ${refund.status} status`);
      }

      // Update to processing
      await client.query(
        'UPDATE refunds SET status = $1 WHERE id = $2',
        ['processing', refundId]
      );

      await client.query('COMMIT');

      // Call refund provider
      const providerResult = await this.provider.processRefund(refund);

      if (providerResult.success) {
        await query(
          `UPDATE refunds
           SET status = 'completed',
               refund_transaction_id = $1,
               bank_reference = $2,
               processed_at = NOW()
           WHERE id = $3`,
          [providerResult.transactionId, providerResult.bankReference, refundId]
        );

        logger.info('Refund processed successfully', {
          refundId,
          transactionId: providerResult.transactionId
        });
      } else {
        await query(
          `UPDATE refunds SET status = 'failed' WHERE id = $1`,
          [refundId]
        );

        logger.error('Refund processing failed', { refundId, error: providerResult.error });
      }

      return (await this.getRefund(refundId))!;
    } catch (error) {
      await client.query('ROLLBACK');
      await query('UPDATE refunds SET status = $1 WHERE id = $2', ['failed', refundId]);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get refund by ID
   */
  async getRefund(refundId: string): Promise<Refund | null> {
    const result = await query<Record<string, unknown>>(
      'SELECT * FROM refunds WHERE id = $1',
      [refundId]
    );
    return result.length > 0 ? this.mapRefund(result[0]) : null;
  }

  /**
   * Get refund approval history
   */
  async getRefundApprovals(refundId: string): Promise<RefundApproval[]> {
    const result = await query<Record<string, unknown>>(
      'SELECT * FROM refund_approvals WHERE refund_id = $1 ORDER BY created_at DESC',
      [refundId]
    );

    return result.map((row) => ({
      id: row.id as string,
      refundId: row.refund_id as string,
      approverId: row.approver_id as string,
      action: row.action as RefundApproval['action'],
      comments: row.comments as string | null,
      createdAt: new Date(row.created_at as string)
    }));
  }

  /**
   * List refunds
   */
  async listRefunds(options: {
    walletId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ refunds: Refund[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.walletId) {
      conditions.push(`wallet_id = $${paramIndex++}`);
      params.push(options.walletId);
    }

    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM refunds ${whereClause}`,
      params
    );

    const result = await query<Record<string, unknown>>(
      `SELECT * FROM refunds ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      refunds: result.map(this.mapRefund),
      total: parseInt(countResult[0].count)
    };
  }

  /**
   * Get pending refunds requiring approval
   */
  async getPendingRefunds(): Promise<Refund[]> {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM refunds WHERE status = 'pending' ORDER BY created_at ASC`
    );
    return result.map(this.mapRefund);
  }

  private mapRefund(row: Record<string, unknown>): Refund {
    return {
      id: row.id as string,
      refundReference: row.refund_reference as string,
      originalTransactionId: row.original_transaction_id as string,
      refundTransactionId: row.refund_transaction_id as string | null,
      walletId: row.wallet_id as string,
      amount: parseFloat(row.amount as string),
      feeRefund: parseFloat(row.fee_refund as string),
      totalRefund: parseFloat(row.total_refund as string),
      reason: row.reason as string,
      reasonCode: row.reason_code as string | null,
      status: row.status as Refund['status'],
      requestedBy: row.requested_by as string,
      approvedBy: row.approved_by as string | null,
      approvedAt: row.approved_at ? new Date(row.approved_at as string) : null,
      rejectedBy: row.rejected_by as string | null,
      rejectedAt: row.rejected_at ? new Date(row.rejected_at as string) : null,
      rejectionReason: row.rejection_reason as string | null,
      processedAt: row.processed_at ? new Date(row.processed_at as string) : null,
      bankReference: row.bank_reference as string | null,
      createdAt: new Date(row.created_at as string)
    };
  }
}

export default new RefundService();
