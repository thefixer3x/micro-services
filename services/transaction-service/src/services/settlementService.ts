import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../database/connection';
import logger from '../utils/logger';

interface SettlementBatch {
  id: string;
  batchReference: string;
  settlementDate: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  totalAmount: number;
  totalFees: number;
  netAmount: number;
  transactionCount: number;
  currencyCode: string;
  bankReference: string | null;
  processedAt: Date | null;
  processedBy: string | null;
  failureReason: string | null;
  createdAt: Date;
}

interface SettlementItem {
  id: string;
  batchId: string;
  transactionId: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  status: 'pending' | 'settled' | 'failed';
  failureReason: string | null;
}

// Bank Settlement Provider Interface (Adapter Pattern)
export interface SettlementProvider {
  name: string;
  processSettlement(batch: SettlementBatch, items: SettlementItem[]): Promise<{
    success: boolean;
    bankReference?: string;
    failedItems?: Array<{ transactionId: string; reason: string }>;
    error?: string;
  }>;
}

// Stub implementation for development
class StubSettlementProvider implements SettlementProvider {
  name = 'stub';

  async processSettlement(batch: SettlementBatch, items: SettlementItem[]) {
    logger.info('STUB: Processing settlement', {
      batchReference: batch.batchReference,
      amount: batch.netAmount,
      itemCount: items.length
    });

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      bankReference: `STUB-${Date.now()}`
    };
  }
}

export class SettlementService {
  private provider: SettlementProvider;

  constructor(provider?: SettlementProvider) {
    this.provider = provider || new StubSettlementProvider();
  }

  setProvider(provider: SettlementProvider): void {
    this.provider = provider;
    logger.info('Settlement provider changed', { provider: provider.name });
  }

  /**
   * Create a new settlement batch from unsettled transactions
   */
  async createBatch(
    settlementDate: Date,
    currencyCode: string = 'NGN'
  ): Promise<SettlementBatch> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const batchReference = `STL-${settlementDate.toISOString().split('T')[0]}-${uuidv4().slice(0, 8).toUpperCase()}`;

      // Find unsettled completed transactions
      const transactionsResult = await client.query(
        `SELECT t.id, t.amount, t.fee_amount
         FROM transactions t
         LEFT JOIN settlement_items si ON t.id = si.transaction_id
         WHERE t.status = 'completed'
           AND t.currency_code = $1
           AND si.id IS NULL
           AND t.created_at::date <= $2
         ORDER BY t.created_at
         LIMIT 1000`,
        [currencyCode, settlementDate]
      );

      if (transactionsResult.rows.length === 0) {
        throw new Error('No transactions to settle');
      }

      // Calculate totals
      let totalAmount = 0;
      let totalFees = 0;

      for (const txn of transactionsResult.rows) {
        totalAmount += parseFloat(txn.amount);
        totalFees += parseFloat(txn.fee_amount || 0);
      }

      const netAmount = totalAmount - totalFees;

      // Create batch
      const batchResult = await client.query(
        `INSERT INTO settlement_batches
         (batch_reference, settlement_date, total_amount, total_fees, net_amount, transaction_count, currency_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [batchReference, settlementDate, totalAmount, totalFees, netAmount, transactionsResult.rows.length, currencyCode]
      );

      const batch = this.mapBatch(batchResult.rows[0]);

      // Create settlement items
      for (const txn of transactionsResult.rows) {
        const itemNet = parseFloat(txn.amount) - parseFloat(txn.fee_amount || 0);
        await client.query(
          `INSERT INTO settlement_items (batch_id, transaction_id, amount, fee_amount, net_amount)
           VALUES ($1, $2, $3, $4, $5)`,
          [batch.id, txn.id, txn.amount, txn.fee_amount || 0, itemNet]
        );
      }

      await client.query('COMMIT');

      logger.info('Settlement batch created', {
        batchId: batch.id,
        batchReference,
        transactionCount: transactionsResult.rows.length,
        netAmount
      });

      return batch;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process a settlement batch
   */
  async processBatch(batchId: string, processedBy: string): Promise<SettlementBatch> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get batch
      const batchResult = await client.query(
        'SELECT * FROM settlement_batches WHERE id = $1 FOR UPDATE',
        [batchId]
      );

      if (batchResult.rows.length === 0) {
        throw new Error('Settlement batch not found');
      }

      const batch = this.mapBatch(batchResult.rows[0]);

      if (batch.status !== 'pending') {
        throw new Error(`Cannot process batch in ${batch.status} status`);
      }

      // Update status to processing
      await client.query(
        'UPDATE settlement_batches SET status = $1 WHERE id = $2',
        ['processing', batchId]
      );

      // Get items
      const itemsResult = await client.query(
        'SELECT * FROM settlement_items WHERE batch_id = $1',
        [batchId]
      );

      const items = itemsResult.rows.map(this.mapItem);

      // Call settlement provider
      const result = await this.provider.processSettlement(batch, items);

      if (result.success) {
        // Update batch as completed
        await client.query(
          `UPDATE settlement_batches
           SET status = 'completed', bank_reference = $1, processed_at = NOW(), processed_by = $2
           WHERE id = $3`,
          [result.bankReference, processedBy, batchId]
        );

        // Update all items as settled
        await client.query(
          `UPDATE settlement_items SET status = 'settled' WHERE batch_id = $1`,
          [batchId]
        );
      } else {
        // Handle failures
        if (result.failedItems && result.failedItems.length > 0) {
          // Partial failure
          for (const failed of result.failedItems) {
            await client.query(
              `UPDATE settlement_items SET status = 'failed', failure_reason = $1
               WHERE batch_id = $2 AND transaction_id = $3`,
              [failed.reason, batchId, failed.transactionId]
            );
          }

          await client.query(
            `UPDATE settlement_items SET status = 'settled'
             WHERE batch_id = $1 AND status = 'pending'`,
            [batchId]
          );

          await client.query(
            `UPDATE settlement_batches
             SET status = 'partial', bank_reference = $1, processed_at = NOW(), processed_by = $2
             WHERE id = $3`,
            [result.bankReference, processedBy, batchId]
          );
        } else {
          // Complete failure
          await client.query(
            `UPDATE settlement_batches
             SET status = 'failed', failure_reason = $1, processed_at = NOW(), processed_by = $2
             WHERE id = $3`,
            [result.error, processedBy, batchId]
          );
        }
      }

      await client.query('COMMIT');

      // Return updated batch
      const updatedResult = await query<Record<string, unknown>>(
        'SELECT * FROM settlement_batches WHERE id = $1',
        [batchId]
      );

      logger.info('Settlement batch processed', {
        batchId,
        success: result.success,
        bankReference: result.bankReference
      });

      return this.mapBatch(updatedResult[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Settlement processing failed', { batchId, error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get settlement batch by ID
   */
  async getBatch(batchId: string): Promise<SettlementBatch | null> {
    const result = await query<Record<string, unknown>>(
      'SELECT * FROM settlement_batches WHERE id = $1',
      [batchId]
    );
    return result.length > 0 ? this.mapBatch(result[0]) : null;
  }

  /**
   * Get batch items
   */
  async getBatchItems(batchId: string): Promise<SettlementItem[]> {
    const result = await query<Record<string, unknown>>(
      'SELECT * FROM settlement_items WHERE batch_id = $1',
      [batchId]
    );
    return result.map(this.mapItem);
  }

  /**
   * List settlement batches
   */
  async listBatches(options: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ batches: SettlementBatch[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    if (options.startDate) {
      conditions.push(`settlement_date >= $${paramIndex++}`);
      params.push(options.startDate);
    }

    if (options.endDate) {
      conditions.push(`settlement_date <= $${paramIndex++}`);
      params.push(options.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM settlement_batches ${whereClause}`,
      params
    );

    const result = await query<Record<string, unknown>>(
      `SELECT * FROM settlement_batches ${whereClause}
       ORDER BY settlement_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      batches: result.map(this.mapBatch),
      total: parseInt(countResult[0].count)
    };
  }

  private mapBatch(row: Record<string, unknown>): SettlementBatch {
    return {
      id: row.id as string,
      batchReference: row.batch_reference as string,
      settlementDate: new Date(row.settlement_date as string),
      status: row.status as SettlementBatch['status'],
      totalAmount: parseFloat(row.total_amount as string),
      totalFees: parseFloat(row.total_fees as string),
      netAmount: parseFloat(row.net_amount as string),
      transactionCount: row.transaction_count as number,
      currencyCode: row.currency_code as string,
      bankReference: row.bank_reference as string | null,
      processedAt: row.processed_at ? new Date(row.processed_at as string) : null,
      processedBy: row.processed_by as string | null,
      failureReason: row.failure_reason as string | null,
      createdAt: new Date(row.created_at as string)
    };
  }

  private mapItem(row: Record<string, unknown>): SettlementItem {
    return {
      id: row.id as string,
      batchId: row.batch_id as string,
      transactionId: row.transaction_id as string,
      amount: parseFloat(row.amount as string),
      feeAmount: parseFloat(row.fee_amount as string),
      netAmount: parseFloat(row.net_amount as string),
      status: row.status as SettlementItem['status'],
      failureReason: row.failure_reason as string | null
    };
  }
}

export default new SettlementService();
