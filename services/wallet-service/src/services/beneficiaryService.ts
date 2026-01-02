import pool from '../database';
import { logger } from '../utils/logger';

interface Beneficiary {
  id: string;
  userId: string;
  nickname: string | null;
  beneficiaryType: 'wallet' | 'bank_account' | 'mobile_money';
  walletId: string | null;
  accountNumber: string | null;
  bankCode: string | null;
  bankName: string | null;
  accountName: string | null;
  phoneNumber: string | null;
  mobileProvider: string | null;
  isFavorite: boolean;
  isVerified: boolean;
  verifiedAt: Date | null;
  transferCount: number;
  lastTransferAt: Date | null;
  totalTransferred: number;
  createdAt: Date;
}

interface CreateBeneficiaryRequest {
  userId: string;
  nickname?: string;
  beneficiaryType: Beneficiary['beneficiaryType'];
  walletId?: string;
  accountNumber?: string;
  bankCode?: string;
  bankName?: string;
  accountName?: string;
  phoneNumber?: string;
  mobileProvider?: string;
}

// Bank name lookup provider interface
export interface BankLookupProvider {
  getBankName(bankCode: string): Promise<string | null>;
  verifyAccountName(bankCode: string, accountNumber: string): Promise<string | null>;
}

// Stub implementation
class StubBankLookupProvider implements BankLookupProvider {
  private banks: Record<string, string> = {
    '000001': 'Sterling Bank',
    '000002': 'Keystone Bank',
    '000003': 'First City Monument Bank',
    '000004': 'United Bank for Africa',
    '000005': 'Diamond Bank',
    '000006': 'JAIZ Bank',
    '000007': 'Fidelity Bank',
    '000008': 'Polaris Bank',
    '000009': 'Citi Bank',
    '000010': 'Ecobank Bank',
    '000011': 'Unity Bank',
    '000012': 'StanbicIBTC Bank',
    '000013': 'GTBank',
    '000014': 'Access Bank',
    '000015': 'Zenith Bank',
    '000016': 'First Bank',
    '000017': 'Wema Bank',
    '000018': 'Union Bank'
  };

  async getBankName(bankCode: string): Promise<string | null> {
    return this.banks[bankCode] || null;
  }

  async verifyAccountName(bankCode: string, accountNumber: string): Promise<string | null> {
    // In production, this would call NIP/NIBSS to verify
    logger.info('STUB: Account name verification', { bankCode, accountNumber });
    return `Account Holder ${accountNumber.slice(-4)}`;
  }
}

export class BeneficiaryService {
  private bankLookup: BankLookupProvider;

  constructor(bankLookup?: BankLookupProvider) {
    this.bankLookup = bankLookup || new StubBankLookupProvider();
  }

  setBankLookupProvider(provider: BankLookupProvider): void {
    this.bankLookup = provider;
  }

  /**
   * Create a new beneficiary
   */
  async create(data: CreateBeneficiaryRequest): Promise<Beneficiary> {
    // Validate based on type
    if (data.beneficiaryType === 'wallet' && !data.walletId) {
      throw new Error('walletId is required for wallet beneficiaries');
    }

    if (data.beneficiaryType === 'bank_account') {
      if (!data.accountNumber || !data.bankCode) {
        throw new Error('accountNumber and bankCode are required for bank beneficiaries');
      }

      // Look up bank name if not provided
      if (!data.bankName) {
        data.bankName = await this.bankLookup.getBankName(data.bankCode) || undefined;
      }

      // Verify account name if not provided
      if (!data.accountName) {
        data.accountName = await this.bankLookup.verifyAccountName(data.bankCode, data.accountNumber) || undefined;
      }
    }

    if (data.beneficiaryType === 'mobile_money') {
      if (!data.phoneNumber || !data.mobileProvider) {
        throw new Error('phoneNumber and mobileProvider are required for mobile money beneficiaries');
      }
    }

    const result = await pool.query(
      `INSERT INTO beneficiaries (
        user_id, nickname, beneficiary_type,
        wallet_id, account_number, bank_code, bank_name, account_name,
        phone_number, mobile_provider
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        data.userId,
        data.nickname,
        data.beneficiaryType,
        data.walletId,
        data.accountNumber,
        data.bankCode,
        data.bankName,
        data.accountName,
        data.phoneNumber,
        data.mobileProvider
      ]
    );

    logger.info('Beneficiary created', { userId: data.userId, type: data.beneficiaryType });
    return this.mapBeneficiary(result.rows[0]);
  }

  /**
   * Get beneficiary by ID
   */
  async getById(id: string, userId: string): Promise<Beneficiary | null> {
    const result = await pool.query(
      'SELECT * FROM beneficiaries WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rows.length > 0 ? this.mapBeneficiary(result.rows[0]) : null;
  }

  /**
   * List user's beneficiaries
   */
  async listByUser(
    userId: string,
    options: {
      type?: Beneficiary['beneficiaryType'];
      favoritesOnly?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ beneficiaries: Beneficiary[]; total: number }> {
    const conditions = ['user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options.type) {
      conditions.push(`beneficiary_type = $${paramIndex++}`);
      params.push(options.type);
    }

    if (options.favoritesOnly) {
      conditions.push('is_favorite = TRUE');
    }

    if (options.search) {
      conditions.push(`(
        nickname ILIKE $${paramIndex} OR
        account_name ILIKE $${paramIndex} OR
        account_number ILIKE $${paramIndex} OR
        phone_number ILIKE $${paramIndex}
      )`);
      params.push(`%${options.search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM beneficiaries ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT * FROM beneficiaries ${whereClause}
       ORDER BY is_favorite DESC, last_transfer_at DESC NULLS LAST, created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      beneficiaries: result.rows.map(this.mapBeneficiary),
      total: parseInt(countResult.rows[0].count)
    };
  }

  /**
   * Get recent beneficiaries
   */
  async getRecent(userId: string, limit: number = 5): Promise<Beneficiary[]> {
    const result = await pool.query(
      `SELECT * FROM beneficiaries
       WHERE user_id = $1 AND last_transfer_at IS NOT NULL
       ORDER BY last_transfer_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows.map(this.mapBeneficiary);
  }

  /**
   * Get favorites
   */
  async getFavorites(userId: string): Promise<Beneficiary[]> {
    const result = await pool.query(
      `SELECT * FROM beneficiaries
       WHERE user_id = $1 AND is_favorite = TRUE
       ORDER BY nickname ASC, account_name ASC`,
      [userId]
    );
    return result.rows.map(this.mapBeneficiary);
  }

  /**
   * Update beneficiary
   */
  async update(
    id: string,
    userId: string,
    data: { nickname?: string }
  ): Promise<Beneficiary | null> {
    const result = await pool.query(
      `UPDATE beneficiaries
       SET nickname = COALESCE($1, nickname)
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [data.nickname, id, userId]
    );

    return result.rows.length > 0 ? this.mapBeneficiary(result.rows[0]) : null;
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(id: string, userId: string): Promise<Beneficiary | null> {
    const result = await pool.query(
      `UPDATE beneficiaries
       SET is_favorite = NOT is_favorite
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length > 0) {
      const beneficiary = this.mapBeneficiary(result.rows[0]);
      logger.info('Beneficiary favorite toggled', { id, isFavorite: beneficiary.isFavorite });
      return beneficiary;
    }

    return null;
  }

  /**
   * Delete beneficiary
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM beneficiaries WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Record a transfer to beneficiary (called after successful transfer)
   */
  async recordTransfer(id: string, amount: number): Promise<void> {
    await pool.query(
      `UPDATE beneficiaries
       SET transfer_count = transfer_count + 1,
           last_transfer_at = NOW(),
           total_transferred = total_transferred + $1
       WHERE id = $2`,
      [amount, id]
    );
  }

  /**
   * Find beneficiary by destination details
   */
  async findByDestination(
    userId: string,
    destination: {
      walletId?: string;
      accountNumber?: string;
      bankCode?: string;
      phoneNumber?: string;
    }
  ): Promise<Beneficiary | null> {
    let query: string;
    let params: any[];

    if (destination.walletId) {
      query = 'SELECT * FROM beneficiaries WHERE user_id = $1 AND wallet_id = $2';
      params = [userId, destination.walletId];
    } else if (destination.accountNumber && destination.bankCode) {
      query = 'SELECT * FROM beneficiaries WHERE user_id = $1 AND account_number = $2 AND bank_code = $3';
      params = [userId, destination.accountNumber, destination.bankCode];
    } else if (destination.phoneNumber) {
      query = 'SELECT * FROM beneficiaries WHERE user_id = $1 AND phone_number = $2';
      params = [userId, destination.phoneNumber];
    } else {
      return null;
    }

    const result = await pool.query(query, params);
    return result.rows.length > 0 ? this.mapBeneficiary(result.rows[0]) : null;
  }

  /**
   * Verify a beneficiary (mark as verified after successful transfer)
   */
  async verify(id: string): Promise<void> {
    await pool.query(
      `UPDATE beneficiaries
       SET is_verified = TRUE, verified_at = NOW()
       WHERE id = $1 AND is_verified = FALSE`,
      [id]
    );
  }

  private mapBeneficiary(row: any): Beneficiary {
    return {
      id: row.id,
      userId: row.user_id,
      nickname: row.nickname,
      beneficiaryType: row.beneficiary_type,
      walletId: row.wallet_id,
      accountNumber: row.account_number,
      bankCode: row.bank_code,
      bankName: row.bank_name,
      accountName: row.account_name,
      phoneNumber: row.phone_number,
      mobileProvider: row.mobile_provider,
      isFavorite: row.is_favorite,
      isVerified: row.is_verified,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
      transferCount: row.transfer_count,
      lastTransferAt: row.last_transfer_at ? new Date(row.last_transfer_at) : null,
      totalTransferred: parseFloat(row.total_transferred || '0'),
      createdAt: new Date(row.created_at)
    };
  }
}

export default new BeneficiaryService();
