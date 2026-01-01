import { pool } from '../database/connection';
import logger from '../utils/logger';

export interface FeeConfiguration {
  id: string;
  fee_type: string;
  transaction_type: string;
  percentage_fee: number;
  minimum_fee: number;
  maximum_fee: number | null;
  flat_fee: number;
  currency: string;
  is_active: boolean;
  effective_from: Date;
  effective_to: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateFeeConfigRequest {
  fee_type: string;
  transaction_type: string;
  percentage_fee: number;
  minimum_fee: number;
  maximum_fee?: number;
  flat_fee?: number;
  currency?: string;
  created_by?: string;
}

export interface UpdateFeeConfigRequest {
  percentage_fee?: number;
  minimum_fee?: number;
  maximum_fee?: number;
  flat_fee?: number;
  is_active?: boolean;
  effective_to?: Date;
}

class FeeRepository {
  async findByType(feeType: string, transactionType: string, currency: string = 'NGN'): Promise<FeeConfiguration | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM fee_configurations
         WHERE fee_type = $1 AND transaction_type = $2 AND currency = $3
         AND is_active = true
         AND effective_from <= NOW()
         AND (effective_to IS NULL OR effective_to > NOW())
         ORDER BY effective_from DESC
         LIMIT 1`,
        [feeType, transactionType, currency]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find fee configuration', { error, feeType, transactionType });
      throw error;
    }
  }

  async findAll(includeInactive: boolean = false): Promise<FeeConfiguration[]> {
    try {
      const query = includeInactive
        ? 'SELECT * FROM fee_configurations ORDER BY fee_type, transaction_type, created_at DESC'
        : `SELECT * FROM fee_configurations
           WHERE is_active = true
           AND effective_from <= NOW()
           AND (effective_to IS NULL OR effective_to > NOW())
           ORDER BY fee_type, transaction_type`;

      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to list fee configurations', { error });
      throw error;
    }
  }

  async create(data: CreateFeeConfigRequest): Promise<FeeConfiguration> {
    try {
      const result = await pool.query(
        `INSERT INTO fee_configurations
         (fee_type, transaction_type, percentage_fee, minimum_fee, maximum_fee, flat_fee, currency, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          data.fee_type,
          data.transaction_type,
          data.percentage_fee,
          data.minimum_fee,
          data.maximum_fee || null,
          data.flat_fee || 0,
          data.currency || 'NGN',
          data.created_by || null
        ]
      );
      logger.info('Fee configuration created', { id: result.rows[0].id });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create fee configuration', { error, data });
      throw error;
    }
  }

  async update(id: string, data: UpdateFeeConfigRequest): Promise<FeeConfiguration | null> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.percentage_fee !== undefined) {
        updates.push(`percentage_fee = $${paramIndex++}`);
        values.push(data.percentage_fee);
      }
      if (data.minimum_fee !== undefined) {
        updates.push(`minimum_fee = $${paramIndex++}`);
        values.push(data.minimum_fee);
      }
      if (data.maximum_fee !== undefined) {
        updates.push(`maximum_fee = $${paramIndex++}`);
        values.push(data.maximum_fee);
      }
      if (data.flat_fee !== undefined) {
        updates.push(`flat_fee = $${paramIndex++}`);
        values.push(data.flat_fee);
      }
      if (data.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(data.is_active);
      }
      if (data.effective_to !== undefined) {
        updates.push(`effective_to = $${paramIndex++}`);
        values.push(data.effective_to);
      }

      if (updates.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      const result = await pool.query(
        `UPDATE fee_configurations SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      logger.info('Fee configuration updated', { id });
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to update fee configuration', { error, id });
      throw error;
    }
  }

  async findById(id: string): Promise<FeeConfiguration | null> {
    try {
      const result = await pool.query('SELECT * FROM fee_configurations WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find fee configuration by id', { error, id });
      throw error;
    }
  }

  async deactivate(id: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'UPDATE fee_configurations SET is_active = false, effective_to = NOW() WHERE id = $1 RETURNING id',
        [id]
      );
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to deactivate fee configuration', { error, id });
      throw error;
    }
  }
}

export default new FeeRepository();
