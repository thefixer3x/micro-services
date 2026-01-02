import { v4 as uuidv4 } from 'uuid';
import { PoolClient } from 'pg';
import { query, transaction as dbTransaction } from '../database/connection';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
  TransactionFee,
  TransactionRoute,
  PaginationParams,
  PaginatedResponse
} from '../types';
import logger from '../utils/logger';

function generateReferenceNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN${timestamp}${random}`;
}

export class TransactionRepository {
  async create(data: Partial<Transaction>): Promise<Transaction> {
    const id = uuidv4();
    const referenceNumber = generateReferenceNumber();

    const rows = await query<Transaction>(
      `INSERT INTO transactions (
        id, reference_number, transaction_type, source_wallet_id,
        destination_wallet_id, destination_account_number, destination_bank_code,
        amount, currency_code, exchange_rate, fee_amount, status, narration,
        idempotency_key, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        id,
        referenceNumber,
        data.transactionType,
        data.sourceWalletId,
        data.destinationWalletId,
        data.destinationAccountNumber,
        data.destinationBankCode,
        data.amount,
        data.currencyCode,
        data.exchangeRate,
        data.feeAmount || 0,
        TransactionStatus.PENDING,
        data.narration,
        data.metadata?.idempotencyKey,
        JSON.stringify(data.metadata || {})
      ]
    );

    return this.mapToTransaction(rows[0]);
  }

  /**
   * Create transaction within an existing database transaction
   */
  async createWithClient(client: PoolClient, data: Partial<Transaction>): Promise<Transaction> {
    const id = uuidv4();
    const referenceNumber = generateReferenceNumber();

    const result = await client.query(
      `INSERT INTO transactions (
        id, reference_number, transaction_type, source_wallet_id,
        destination_wallet_id, destination_account_number, destination_bank_code,
        amount, currency_code, exchange_rate, fee_amount, status, narration,
        idempotency_key, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        id,
        referenceNumber,
        data.transactionType,
        data.sourceWalletId,
        data.destinationWalletId,
        data.destinationAccountNumber,
        data.destinationBankCode,
        data.amount,
        data.currencyCode,
        data.exchangeRate,
        data.feeAmount || 0,
        TransactionStatus.PENDING,
        data.narration,
        data.metadata?.idempotencyKey,
        JSON.stringify(data.metadata || {})
      ]
    );

    return this.mapToTransaction(result.rows[0]);
  }

  async findById(id: string): Promise<Transaction | null> {
    const rows = await query<Transaction>(
      'SELECT * FROM transactions WHERE id = $1',
      [id]
    );
    return rows.length > 0 ? this.mapToTransaction(rows[0]) : null;
  }

  async findByReference(referenceNumber: string): Promise<Transaction | null> {
    const rows = await query<Transaction>(
      'SELECT * FROM transactions WHERE reference_number = $1',
      [referenceNumber]
    );
    return rows.length > 0 ? this.mapToTransaction(rows[0]) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Transaction | null> {
    const rows = await query<Transaction>(
      'SELECT * FROM transactions WHERE idempotency_key = $1',
      [key]
    );
    return rows.length > 0 ? this.mapToTransaction(rows[0]) : null;
  }

  async findByWalletId(
    walletId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<Transaction>> {
    const { page, limit, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
    const offset = (page - 1) * limit;

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM transactions
       WHERE source_wallet_id = $1 OR destination_wallet_id = $1`,
      [walletId]
    );
    const total = parseInt(countResult[0].count, 10);

    const rows = await query<Transaction>(
      `SELECT * FROM transactions
       WHERE source_wallet_id = $1 OR destination_wallet_id = $1
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $2 OFFSET $3`,
      [walletId, limit, offset]
    );

    return {
      data: rows.map(this.mapToTransaction),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async updateStatus(
    id: string,
    status: TransactionStatus,
    completedAt?: Date
  ): Promise<Transaction | null> {
    const rows = await query<Transaction>(
      `UPDATE transactions
       SET status = $2, completed_at = $3
       WHERE id = $1
       RETURNING *`,
      [id, status, completedAt]
    );
    return rows.length > 0 ? this.mapToTransaction(rows[0]) : null;
  }

  async addFee(data: Partial<TransactionFee>): Promise<TransactionFee> {
    const id = uuidv4();
    const rows = await query<TransactionFee>(
      `INSERT INTO transaction_fees (id, transaction_id, fee_type, fee_amount, fee_currency, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, data.transactionId, data.feeType, data.feeAmount, data.feeCurrency, null]
    );
    return this.mapToFee(rows[0]);
  }

  /**
   * Add fee within an existing database transaction
   */
  async addFeeWithClient(client: PoolClient, data: Partial<TransactionFee>): Promise<TransactionFee> {
    const id = uuidv4();
    const result = await client.query(
      `INSERT INTO transaction_fees (id, transaction_id, fee_type, fee_amount, fee_currency, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, data.transactionId, data.feeType, data.feeAmount, data.feeCurrency, null]
    );
    return this.mapToFee(result.rows[0]);
  }

  async getFeesByTransactionId(transactionId: string): Promise<TransactionFee[]> {
    const rows = await query<TransactionFee>(
      'SELECT * FROM transaction_fees WHERE transaction_id = $1',
      [transactionId]
    );
    return rows.map(this.mapToFee);
  }

  async addRoute(data: Partial<TransactionRoute>): Promise<TransactionRoute> {
    const id = uuidv4();
    const rows = await query<TransactionRoute>(
      `INSERT INTO transaction_routes (id, transaction_id, route_type, partner_id, partner_reference, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, data.transactionId, data.routeType, data.partnerId, data.partnerReference, data.status || 'initiated']
    );
    return this.mapToRoute(rows[0]);
  }

  async getTransactionStats(walletId: string): Promise<{
    totalTransactions: number;
    totalVolume: number;
    successRate: number;
  }> {
    const stats = await query<{
      total: string;
      volume: string;
      completed: string;
    }>(
      `SELECT
        COUNT(*) as total,
        COALESCE(SUM(amount), 0) as volume,
        COUNT(*) FILTER (WHERE status = 'completed') as completed
       FROM transactions
       WHERE source_wallet_id = $1 OR destination_wallet_id = $1`,
      [walletId]
    );

    const total = parseInt(stats[0].total, 10);
    const completed = parseInt(stats[0].completed, 10);

    return {
      totalTransactions: total,
      totalVolume: parseFloat(stats[0].volume),
      successRate: total > 0 ? (completed / total) * 100 : 0
    };
  }

  async findByWalletIdAndDateRange(
    walletId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Transaction[]> {
    const rows = await query<Transaction>(
      `SELECT *,
        CASE
          WHEN destination_wallet_id = $1 THEN 'inbound'
          ELSE 'outbound'
        END as direction
       FROM transactions
       WHERE (source_wallet_id = $1 OR destination_wallet_id = $1)
         AND created_at >= $2
         AND created_at <= $3
         AND status = 'completed'
       ORDER BY created_at ASC`,
      [walletId, startDate, endDate]
    );

    return rows.map(row => ({
      ...this.mapToTransaction(row),
      direction: row.direction as 'inbound' | 'outbound'
    }));
  }

  async getBalanceAtDate(walletId: string, date: Date): Promise<number> {
    // Calculate balance based on all completed transactions before the given date
    const result = await query<{ balance: string }>(
      `SELECT
        COALESCE(
          SUM(CASE WHEN destination_wallet_id = $1 THEN amount ELSE 0 END) -
          SUM(CASE WHEN source_wallet_id = $1 THEN amount + fee_amount ELSE 0 END),
          0
        ) as balance
       FROM transactions
       WHERE (source_wallet_id = $1 OR destination_wallet_id = $1)
         AND created_at < $2
         AND status = 'completed'`,
      [walletId, date]
    );

    return parseFloat(result[0]?.balance || '0');
  }

  private mapToTransaction(row: Record<string, unknown>): Transaction {
    return {
      id: row.id as string,
      referenceNumber: row.reference_number as string,
      transactionType: row.transaction_type as TransactionType,
      sourceWalletId: row.source_wallet_id as string,
      destinationWalletId: row.destination_wallet_id as string,
      destinationAccountNumber: row.destination_account_number as string,
      destinationBankCode: row.destination_bank_code as string,
      amount: parseFloat(row.amount as string),
      currencyCode: row.currency_code as string,
      exchangeRate: row.exchange_rate ? parseFloat(row.exchange_rate as string) : undefined,
      feeAmount: parseFloat(row.fee_amount as string),
      status: row.status as TransactionStatus,
      narration: row.narration as string,
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      metadata: row.metadata as Record<string, unknown>
    };
  }

  private mapToFee(row: Record<string, unknown>): TransactionFee {
    return {
      id: row.id as string,
      transactionId: row.transaction_id as string,
      feeType: row.fee_type as string,
      feeAmount: parseFloat(row.fee_amount as string),
      feeCurrency: row.fee_currency as string,
      appliedAt: new Date(row.applied_at as string)
    };
  }

  private mapToRoute(row: Record<string, unknown>): TransactionRoute {
    return {
      id: row.id as string,
      transactionId: row.transaction_id as string,
      routeType: row.route_type as TransactionRoute['routeType'],
      partnerId: row.partner_id as string,
      partnerReference: row.partner_reference as string,
      status: row.status as string,
      createdAt: new Date(row.created_at as string)
    };
  }
}

export default new TransactionRepository();
