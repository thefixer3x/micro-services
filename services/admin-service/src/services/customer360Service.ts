import pool from '../database/connection';
import { logger } from '../utils/logger';

interface Customer360View {
  user: UserSummary;
  wallets: WalletSummary[];
  transactions: TransactionSummary;
  support: SupportSummary;
  security: SecuritySummary;
  activity: ActivitySummary;
}

interface UserSummary {
  id: string;
  email: string;
  phone: string | null;
  accountType: string;
  status: string;
  kycStatus: string;
  createdAt: Date;
  profile: {
    firstName: string | null;
    lastName: string | null;
    language: string;
  };
}

interface WalletSummary {
  id: string;
  walletNumber: string;
  currency: string;
  balance: number;
  status: string;
  tier: string;
  createdAt: Date;
}

interface TransactionSummary {
  totalCount: number;
  totalVolume: number;
  last30DaysCount: number;
  last30DaysVolume: number;
  averageTransactionSize: number;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    createdAt: Date;
  }>;
}

interface SupportSummary {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  averageResolutionTime: number | null;
  recentTickets: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: Date;
  }>;
}

interface SecuritySummary {
  twoFactorEnabled: boolean;
  lastLogin: Date | null;
  loginCount30Days: number;
  activeSessions: number;
  securityQuestions: boolean;
  recentSecurityEvents: Array<{
    type: string;
    ipAddress: string | null;
    createdAt: Date;
  }>;
}

interface ActivitySummary {
  firstActivity: Date;
  lastActivity: Date;
  daysSinceLastActivity: number;
  activityScore: number; // 0-100 based on engagement
}

export class Customer360Service {
  /**
   * Get comprehensive 360-degree view of a customer
   */
  async getCustomer360(userId: string): Promise<Customer360View | null> {
    try {
      // Fetch all data in parallel for performance
      const [user, wallets, transactions, support, security] = await Promise.all([
        this.getUserSummary(userId),
        this.getWalletsSummary(userId),
        this.getTransactionsSummary(userId),
        this.getSupportSummary(userId),
        this.getSecuritySummary(userId)
      ]);

      if (!user) {
        return null;
      }

      const activity = this.calculateActivitySummary(user, transactions, security);

      logger.info('Customer 360 view generated', { userId });

      return {
        user,
        wallets,
        transactions,
        support,
        security,
        activity
      };
    } catch (error) {
      logger.error('Failed to generate Customer 360 view', { userId, error });
      throw error;
    }
  }

  private async getUserSummary(userId: string): Promise<UserSummary | null> {
    // Note: This would typically call the Identity Service API
    // For now, we'll simulate with a direct query (in production, use service mesh)
    const result = await pool.query(
      `SELECT u.id, u.email, u.phone, u.account_type, u.status, u.created_at,
              p.first_name, p.last_name, p.language, p.kyc_status
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Try to fetch from identity service if not in local cache
      return this.fetchFromIdentityService(userId);
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      accountType: row.account_type,
      status: row.status,
      kycStatus: row.kyc_status || 'unverified',
      createdAt: new Date(row.created_at),
      profile: {
        firstName: row.first_name,
        lastName: row.last_name,
        language: row.language || 'en'
      }
    };
  }

  private async fetchFromIdentityService(userId: string): Promise<UserSummary | null> {
    // In production, this would call the Identity Service API
    // For now, return a placeholder indicating the user should be fetched externally
    logger.warn('User not found in local cache, should fetch from Identity Service', { userId });
    return null;
  }

  private async getWalletsSummary(userId: string): Promise<WalletSummary[]> {
    // This would typically call the Wallet Service API
    const result = await pool.query(
      `SELECT id, wallet_number, currency_code, balance, status, tier, created_at
       FROM wallets
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      walletNumber: row.wallet_number,
      currency: row.currency_code,
      balance: parseFloat(row.balance),
      status: row.status,
      tier: row.tier || 'basic',
      createdAt: new Date(row.created_at)
    }));
  }

  private async getTransactionsSummary(userId: string): Promise<TransactionSummary> {
    // Aggregate transaction data
    const statsResult = await pool.query(
      `SELECT
         COUNT(*) as total_count,
         COALESCE(SUM(amount), 0) as total_volume,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30_count,
         COALESCE(SUM(amount) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'), 0) as last_30_volume
       FROM transactions t
       JOIN wallets w ON t.source_wallet_id = w.id OR t.destination_wallet_id = w.id
       WHERE w.user_id = $1`,
      [userId]
    );

    const recentResult = await pool.query(
      `SELECT t.id, t.transaction_type, t.amount, t.status, t.created_at
       FROM transactions t
       JOIN wallets w ON t.source_wallet_id = w.id OR t.destination_wallet_id = w.id
       WHERE w.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT 10`,
      [userId]
    );

    const stats = statsResult.rows[0];
    const totalCount = parseInt(stats.total_count);
    const totalVolume = parseFloat(stats.total_volume);

    return {
      totalCount,
      totalVolume,
      last30DaysCount: parseInt(stats.last_30_count),
      last30DaysVolume: parseFloat(stats.last_30_volume),
      averageTransactionSize: totalCount > 0 ? totalVolume / totalCount : 0,
      recentTransactions: recentResult.rows.map((row: any) => ({
        id: row.id,
        type: row.transaction_type,
        amount: parseFloat(row.amount),
        status: row.status,
        createdAt: new Date(row.created_at)
      }))
    };
  }

  private async getSupportSummary(userId: string): Promise<SupportSummary> {
    const statsResult = await pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) as open_count,
         COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
         AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)
           FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_hours
       FROM support_tickets
       WHERE customer_id = $1`,
      [userId]
    );

    const recentResult = await pool.query(
      `SELECT id, subject, status, priority, created_at
       FROM support_tickets
       WHERE customer_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    );

    const stats = statsResult.rows[0];

    return {
      totalTickets: parseInt(stats.total),
      openTickets: parseInt(stats.open_count),
      resolvedTickets: parseInt(stats.resolved_count),
      averageResolutionTime: stats.avg_resolution_hours ? parseFloat(stats.avg_resolution_hours) : null,
      recentTickets: recentResult.rows.map((row: any) => ({
        id: row.id,
        subject: row.subject,
        status: row.status,
        priority: row.priority,
        createdAt: new Date(row.created_at)
      }))
    };
  }

  private async getSecuritySummary(userId: string): Promise<SecuritySummary> {
    // Security data from identity service
    const userResult = await pool.query(
      `SELECT totp_enabled,
              (SELECT COUNT(*) FROM security_questions WHERE user_id = u.id) > 0 as has_questions
       FROM users u
       WHERE u.id = $1`,
      [userId]
    );

    const sessionResult = await pool.query(
      `SELECT COUNT(*) as active_sessions
       FROM user_sessions
       WHERE user_id = $1 AND is_active = TRUE AND expires_at > NOW()`,
      [userId]
    );

    const loginResult = await pool.query(
      `SELECT
         MAX(created_at) FILTER (WHERE event_type = 'login') as last_login,
         COUNT(*) FILTER (WHERE event_type = 'login' AND created_at > NOW() - INTERVAL '30 days') as login_count
       FROM security_events
       WHERE user_id = $1`,
      [userId]
    );

    const eventsResult = await pool.query(
      `SELECT event_type, ip_address, created_at
       FROM security_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    const user = userResult.rows[0] || {};
    const sessions = sessionResult.rows[0] || { active_sessions: 0 };
    const logins = loginResult.rows[0] || {};

    return {
      twoFactorEnabled: user.totp_enabled || false,
      lastLogin: logins.last_login ? new Date(logins.last_login) : null,
      loginCount30Days: parseInt(logins.login_count || '0'),
      activeSessions: parseInt(sessions.active_sessions),
      securityQuestions: user.has_questions || false,
      recentSecurityEvents: eventsResult.rows.map((row: any) => ({
        type: row.event_type,
        ipAddress: row.ip_address,
        createdAt: new Date(row.created_at)
      }))
    };
  }

  private calculateActivitySummary(
    user: UserSummary,
    transactions: TransactionSummary,
    security: SecuritySummary
  ): ActivitySummary {
    const now = new Date();
    const lastActivity = security.lastLogin || user.createdAt;
    const daysSinceLastActivity = Math.floor(
      (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate activity score (0-100)
    let score = 0;

    // Transaction frequency (max 40 points)
    if (transactions.last30DaysCount > 20) score += 40;
    else if (transactions.last30DaysCount > 10) score += 30;
    else if (transactions.last30DaysCount > 5) score += 20;
    else if (transactions.last30DaysCount > 0) score += 10;

    // Login frequency (max 30 points)
    if (security.loginCount30Days > 15) score += 30;
    else if (security.loginCount30Days > 7) score += 20;
    else if (security.loginCount30Days > 0) score += 10;

    // Security features (max 20 points)
    if (security.twoFactorEnabled) score += 10;
    if (security.securityQuestions) score += 10;

    // Recency (max 10 points)
    if (daysSinceLastActivity <= 1) score += 10;
    else if (daysSinceLastActivity <= 7) score += 7;
    else if (daysSinceLastActivity <= 30) score += 3;

    return {
      firstActivity: user.createdAt,
      lastActivity,
      daysSinceLastActivity,
      activityScore: Math.min(score, 100)
    };
  }

  /**
   * Search customers by various criteria
   */
  async searchCustomers(criteria: {
    email?: string;
    phone?: string;
    name?: string;
    status?: string;
    kycStatus?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ customers: UserSummary[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (criteria.email) {
      conditions.push(`u.email ILIKE $${paramIndex++}`);
      params.push(`%${criteria.email}%`);
    }

    if (criteria.phone) {
      conditions.push(`u.phone ILIKE $${paramIndex++}`);
      params.push(`%${criteria.phone}%`);
    }

    if (criteria.name) {
      conditions.push(`(p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex++})`);
      params.push(`%${criteria.name}%`);
    }

    if (criteria.status) {
      conditions.push(`u.status = $${paramIndex++}`);
      params.push(criteria.status);
    }

    if (criteria.kycStatus) {
      conditions.push(`p.kyc_status = $${paramIndex++}`);
      params.push(criteria.kycStatus);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = criteria.limit || 20;
    const offset = criteria.offset || 0;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users u LEFT JOIN user_profiles p ON u.id = p.user_id ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT u.id, u.email, u.phone, u.account_type, u.status, u.created_at,
              p.first_name, p.last_name, p.language, p.kyc_status
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      customers: result.rows.map((row: any) => ({
        id: row.id,
        email: row.email,
        phone: row.phone,
        accountType: row.account_type,
        status: row.status,
        kycStatus: row.kyc_status || 'unverified',
        createdAt: new Date(row.created_at),
        profile: {
          firstName: row.first_name,
          lastName: row.last_name,
          language: row.language || 'en'
        }
      })),
      total: parseInt(countResult.rows[0].count)
    };
  }
}

export default new Customer360Service();
