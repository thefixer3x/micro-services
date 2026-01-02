import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../database/connection';
import transactionService from './transactionService';
import logger from '../utils/logger';

interface ScheduledTransfer {
  id: string;
  userId: string;
  sourceWalletId: string;
  destinationWalletId: string | null;
  destinationAccountNumber: string | null;
  destinationBankCode: string | null;
  destinationName: string | null;
  amount: number;
  currencyCode: string;
  narration: string | null;

  scheduleType: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
  scheduledDate: Date | null;
  scheduledTime: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  cronExpression: string | null;
  timezone: string;

  nextExecutionAt: Date | null;
  lastExecutionAt: Date | null;
  executionCount: number;
  maxExecutions: number | null;

  status: 'active' | 'paused' | 'completed' | 'cancelled' | 'failed';
  failureCount: number;
  lastFailureReason: string | null;

  createdAt: Date;
}

interface ScheduledTransferExecution {
  id: string;
  scheduledTransferId: string;
  transactionId: string | null;
  status: 'success' | 'failed' | 'skipped';
  amount: number;
  feeAmount: number | null;
  failureReason: string | null;
  executedAt: Date;
}

export class ScheduledTransferService {
  private maxFailuresBeforeDisable = 3;

  /**
   * Create a scheduled transfer
   */
  async create(data: {
    userId: string;
    sourceWalletId: string;
    destinationWalletId?: string;
    destinationAccountNumber?: string;
    destinationBankCode?: string;
    destinationName?: string;
    amount: number;
    currencyCode?: string;
    narration?: string;
    scheduleType: ScheduledTransfer['scheduleType'];
    scheduledDate?: Date;
    scheduledTime?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    cronExpression?: string;
    timezone?: string;
    maxExecutions?: number;
  }): Promise<ScheduledTransfer> {
    // Validate destination
    if (!data.destinationWalletId && !data.destinationAccountNumber) {
      throw new Error('Either destinationWalletId or destinationAccountNumber is required');
    }

    // Calculate next execution
    const nextExecutionAt = this.calculateNextExecution({
      scheduleType: data.scheduleType,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime || '09:00:00',
      dayOfWeek: data.dayOfWeek,
      dayOfMonth: data.dayOfMonth,
      cronExpression: data.cronExpression,
      timezone: data.timezone || 'Africa/Lagos'
    });

    const result = await query<Record<string, unknown>>(
      `INSERT INTO scheduled_transfers (
        user_id, source_wallet_id, destination_wallet_id,
        destination_account_number, destination_bank_code, destination_name,
        amount, currency_code, narration,
        schedule_type, scheduled_date, scheduled_time,
        day_of_week, day_of_month, cron_expression, timezone,
        next_execution_at, max_executions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        data.userId,
        data.sourceWalletId,
        data.destinationWalletId,
        data.destinationAccountNumber,
        data.destinationBankCode,
        data.destinationName,
        data.amount,
        data.currencyCode || 'NGN',
        data.narration,
        data.scheduleType,
        data.scheduledDate,
        data.scheduledTime || '09:00:00',
        data.dayOfWeek,
        data.dayOfMonth,
        data.cronExpression,
        data.timezone || 'Africa/Lagos',
        nextExecutionAt,
        data.maxExecutions
      ]
    );

    const transfer = this.mapTransfer(result[0]);
    logger.info('Scheduled transfer created', { id: transfer.id, scheduleType: data.scheduleType });
    return transfer;
  }

  /**
   * Get scheduled transfer by ID
   */
  async getById(id: string): Promise<ScheduledTransfer | null> {
    const result = await query<Record<string, unknown>>(
      'SELECT * FROM scheduled_transfers WHERE id = $1',
      [id]
    );
    return result.length > 0 ? this.mapTransfer(result[0]) : null;
  }

  /**
   * List user's scheduled transfers
   */
  async listByUser(
    userId: string,
    options: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<{ transfers: ScheduledTransfer[]; total: number }> {
    const conditions = ['user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM scheduled_transfers ${whereClause}`,
      params
    );

    const result = await query<Record<string, unknown>>(
      `SELECT * FROM scheduled_transfers ${whereClause}
       ORDER BY next_execution_at ASC NULLS LAST, created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      transfers: result.map(this.mapTransfer),
      total: parseInt(countResult[0].count)
    };
  }

  /**
   * Pause a scheduled transfer
   */
  async pause(id: string, userId: string): Promise<ScheduledTransfer> {
    const result = await query<Record<string, unknown>>(
      `UPDATE scheduled_transfers
       SET status = 'paused'
       WHERE id = $1 AND user_id = $2 AND status = 'active'
       RETURNING *`,
      [id, userId]
    );

    if (result.length === 0) {
      throw new Error('Scheduled transfer not found or not active');
    }

    logger.info('Scheduled transfer paused', { id });
    return this.mapTransfer(result[0]);
  }

  /**
   * Resume a paused scheduled transfer
   */
  async resume(id: string, userId: string): Promise<ScheduledTransfer> {
    const transfer = await this.getById(id);
    if (!transfer || transfer.userId !== userId) {
      throw new Error('Scheduled transfer not found');
    }

    if (transfer.status !== 'paused') {
      throw new Error('Transfer is not paused');
    }

    // Recalculate next execution
    const nextExecutionAt = this.calculateNextExecution({
      scheduleType: transfer.scheduleType,
      scheduledDate: transfer.scheduledDate,
      scheduledTime: transfer.scheduledTime,
      dayOfWeek: transfer.dayOfWeek,
      dayOfMonth: transfer.dayOfMonth,
      cronExpression: transfer.cronExpression,
      timezone: transfer.timezone
    });

    const result = await query<Record<string, unknown>>(
      `UPDATE scheduled_transfers
       SET status = 'active', next_execution_at = $1, failure_count = 0
       WHERE id = $2
       RETURNING *`,
      [nextExecutionAt, id]
    );

    logger.info('Scheduled transfer resumed', { id });
    return this.mapTransfer(result[0]);
  }

  /**
   * Cancel a scheduled transfer
   */
  async cancel(id: string, userId: string): Promise<ScheduledTransfer> {
    const result = await query<Record<string, unknown>>(
      `UPDATE scheduled_transfers
       SET status = 'cancelled', next_execution_at = NULL
       WHERE id = $1 AND user_id = $2 AND status IN ('active', 'paused')
       RETURNING *`,
      [id, userId]
    );

    if (result.length === 0) {
      throw new Error('Scheduled transfer not found or already cancelled/completed');
    }

    logger.info('Scheduled transfer cancelled', { id });
    return this.mapTransfer(result[0]);
  }

  /**
   * Execute due transfers (called by scheduler/cron)
   */
  async executeDueTransfers(): Promise<{ executed: number; failed: number }> {
    const client = await getClient();
    let executed = 0;
    let failed = 0;

    try {
      // Get due transfers
      const dueTransfers = await query<Record<string, unknown>>(
        `SELECT * FROM scheduled_transfers
         WHERE status = 'active'
           AND next_execution_at <= NOW()
         ORDER BY next_execution_at ASC
         LIMIT 100`
      );

      for (const row of dueTransfers) {
        const transfer = this.mapTransfer(row);

        try {
          await this.executeTransfer(transfer);
          executed++;
        } catch (error) {
          failed++;
          logger.error('Scheduled transfer execution failed', { id: transfer.id, error });
        }
      }

      logger.info('Scheduled transfers batch execution completed', { executed, failed });
    } finally {
      client.release();
    }

    return { executed, failed };
  }

  /**
   * Execute a single scheduled transfer
   */
  private async executeTransfer(transfer: ScheduledTransfer): Promise<void> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Lock the transfer
      await client.query(
        'SELECT * FROM scheduled_transfers WHERE id = $1 FOR UPDATE',
        [transfer.id]
      );

      // Create the transaction
      const transaction = await transactionService.createTransfer({
        sourceWalletId: transfer.sourceWalletId,
        destinationWalletId: transfer.destinationWalletId || undefined,
        destinationAccountNumber: transfer.destinationAccountNumber || undefined,
        destinationBankCode: transfer.destinationBankCode || undefined,
        amount: transfer.amount,
        currencyCode: transfer.currencyCode,
        narration: transfer.narration || `Scheduled transfer`,
        idempotencyKey: `scheduled-${transfer.id}-${Date.now()}`
      });

      // Log execution
      await client.query(
        `INSERT INTO scheduled_transfer_executions
         (scheduled_transfer_id, transaction_id, status, amount, fee_amount)
         VALUES ($1, $2, 'success', $3, $4)`,
        [transfer.id, transaction.id, transfer.amount, transaction.feeAmount]
      );

      // Calculate next execution
      const nextExecutionAt = this.calculateNextExecution({
        scheduleType: transfer.scheduleType,
        scheduledDate: transfer.scheduledDate,
        scheduledTime: transfer.scheduledTime,
        dayOfWeek: transfer.dayOfWeek,
        dayOfMonth: transfer.dayOfMonth,
        cronExpression: transfer.cronExpression,
        timezone: transfer.timezone
      });

      const newExecutionCount = transfer.executionCount + 1;
      const isCompleted = transfer.scheduleType === 'once' ||
        (transfer.maxExecutions && newExecutionCount >= transfer.maxExecutions);

      // Update transfer
      await client.query(
        `UPDATE scheduled_transfers
         SET execution_count = $1,
             last_execution_at = NOW(),
             next_execution_at = $2,
             failure_count = 0,
             status = $3
         WHERE id = $4`,
        [
          newExecutionCount,
          isCompleted ? null : nextExecutionAt,
          isCompleted ? 'completed' : 'active',
          transfer.id
        ]
      );

      await client.query('COMMIT');

      logger.info('Scheduled transfer executed', {
        id: transfer.id,
        transactionId: transaction.id,
        executionCount: newExecutionCount
      });
    } catch (error) {
      await client.query('ROLLBACK');

      // Log failed execution
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await query(
        `INSERT INTO scheduled_transfer_executions
         (scheduled_transfer_id, status, amount, failure_reason)
         VALUES ($1, 'failed', $2, $3)`,
        [transfer.id, transfer.amount, errorMessage]
      );

      // Update failure count
      const newFailureCount = transfer.failureCount + 1;
      const shouldDisable = newFailureCount >= this.maxFailuresBeforeDisable;

      await query(
        `UPDATE scheduled_transfers
         SET failure_count = $1,
             last_failure_reason = $2,
             status = $3
         WHERE id = $4`,
        [
          newFailureCount,
          errorMessage,
          shouldDisable ? 'failed' : 'active',
          transfer.id
        ]
      );

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(
    transferId: string,
    limit: number = 20
  ): Promise<ScheduledTransferExecution[]> {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM scheduled_transfer_executions
       WHERE scheduled_transfer_id = $1
       ORDER BY executed_at DESC
       LIMIT $2`,
      [transferId, limit]
    );

    return result.map((row) => ({
      id: row.id as string,
      scheduledTransferId: row.scheduled_transfer_id as string,
      transactionId: row.transaction_id as string | null,
      status: row.status as ScheduledTransferExecution['status'],
      amount: parseFloat(row.amount as string),
      feeAmount: row.fee_amount ? parseFloat(row.fee_amount as string) : null,
      failureReason: row.failure_reason as string | null,
      executedAt: new Date(row.executed_at as string)
    }));
  }

  /**
   * Calculate next execution time
   */
  private calculateNextExecution(config: {
    scheduleType: ScheduledTransfer['scheduleType'];
    scheduledDate: Date | null;
    scheduledTime: string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    cronExpression: string | null;
    timezone: string;
  }): Date | null {
    const now = new Date();
    const [hours, minutes] = config.scheduledTime.split(':').map(Number);

    switch (config.scheduleType) {
      case 'once': {
        if (!config.scheduledDate) return null;
        const date = new Date(config.scheduledDate);
        date.setHours(hours, minutes, 0, 0);
        return date > now ? date : null;
      }

      case 'daily': {
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        return next;
      }

      case 'weekly': {
        if (config.dayOfWeek === null) return null;
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);
        const daysUntilTarget = (config.dayOfWeek - now.getDay() + 7) % 7 || 7;
        next.setDate(now.getDate() + daysUntilTarget);
        if (next <= now) {
          next.setDate(next.getDate() + 7);
        }
        return next;
      }

      case 'monthly': {
        if (config.dayOfMonth === null) return null;
        const next = new Date(now);
        next.setDate(config.dayOfMonth);
        next.setHours(hours, minutes, 0, 0);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        // Handle months with fewer days
        while (next.getDate() !== config.dayOfMonth) {
          next.setDate(0); // Go to last day of previous month
          next.setMonth(next.getMonth() + 1);
          next.setDate(Math.min(config.dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
        }
        return next;
      }

      case 'custom': {
        // For custom cron expressions, would need a cron parser library
        // For now, return next day as fallback
        const next = new Date(now);
        next.setDate(next.getDate() + 1);
        next.setHours(hours, minutes, 0, 0);
        return next;
      }

      default:
        return null;
    }
  }

  private mapTransfer(row: Record<string, unknown>): ScheduledTransfer {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      sourceWalletId: row.source_wallet_id as string,
      destinationWalletId: row.destination_wallet_id as string | null,
      destinationAccountNumber: row.destination_account_number as string | null,
      destinationBankCode: row.destination_bank_code as string | null,
      destinationName: row.destination_name as string | null,
      amount: parseFloat(row.amount as string),
      currencyCode: row.currency_code as string,
      narration: row.narration as string | null,
      scheduleType: row.schedule_type as ScheduledTransfer['scheduleType'],
      scheduledDate: row.scheduled_date ? new Date(row.scheduled_date as string) : null,
      scheduledTime: row.scheduled_time as string,
      dayOfWeek: row.day_of_week as number | null,
      dayOfMonth: row.day_of_month as number | null,
      cronExpression: row.cron_expression as string | null,
      timezone: row.timezone as string,
      nextExecutionAt: row.next_execution_at ? new Date(row.next_execution_at as string) : null,
      lastExecutionAt: row.last_execution_at ? new Date(row.last_execution_at as string) : null,
      executionCount: row.execution_count as number,
      maxExecutions: row.max_executions as number | null,
      status: row.status as ScheduledTransfer['status'],
      failureCount: row.failure_count as number,
      lastFailureReason: row.last_failure_reason as string | null,
      createdAt: new Date(row.created_at as string)
    };
  }
}

export default new ScheduledTransferService();
