import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/connection';
import { Transaction, TransactionType } from '../types';
import logger from '../utils/logger';

interface AlertConfig {
  id: string;
  walletId: string;
  alertType: string;
  thresholdAmount: number | null;
  dailyLimit: number | null;
  isEnabled: boolean;
  notificationChannels: string[];
}

interface TransactionAlert {
  id: string;
  transactionId: string;
  walletId: string;
  alertType: string;
  alertMessage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isAcknowledged: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

interface AlertThreshold {
  tier: string;
  highValueThreshold: number;
  dailyLimit: number;
  internationalThreshold: number;
  require2faAbove: number | null;
}

export class AlertService {
  private defaultThresholds: Map<string, AlertThreshold> = new Map();

  constructor() {
    this.loadDefaultThresholds();
  }

  private async loadDefaultThresholds(): Promise<void> {
    try {
      const result = await query<Record<string, unknown>>(
        'SELECT * FROM alert_thresholds'
      );

      for (const row of result) {
        this.defaultThresholds.set(row.tier as string, {
          tier: row.tier as string,
          highValueThreshold: parseFloat(row.high_value_threshold as string),
          dailyLimit: parseFloat(row.daily_limit as string),
          internationalThreshold: parseFloat(row.international_threshold as string),
          require2faAbove: row.require_2fa_above ? parseFloat(row.require_2fa_above as string) : null
        });
      }

      logger.info('Alert thresholds loaded', { count: this.defaultThresholds.size });
    } catch (error) {
      logger.warn('Failed to load alert thresholds, using defaults', { error });
      // Set fallback defaults
      this.defaultThresholds.set('basic', {
        tier: 'basic',
        highValueThreshold: 50000,
        dailyLimit: 100000,
        internationalThreshold: 10000,
        require2faAbove: 25000
      });
    }
  }

  /**
   * Check transaction and create alerts if needed
   */
  async checkAndCreateAlerts(
    transaction: Transaction,
    walletTier: string = 'basic'
  ): Promise<TransactionAlert[]> {
    const alerts: TransactionAlert[] = [];
    const threshold = this.defaultThresholds.get(walletTier) || this.defaultThresholds.get('basic')!;

    // Get wallet-specific config if exists
    const config = await this.getWalletAlertConfig(transaction.sourceWalletId);

    // Check high-value transaction
    const highValueThreshold = config?.thresholdAmount || threshold.highValueThreshold;
    if (transaction.amount >= highValueThreshold) {
      const alert = await this.createAlert({
        transactionId: transaction.id,
        walletId: transaction.sourceWalletId,
        alertType: 'high_value',
        alertMessage: `High-value transaction of ${transaction.currencyCode} ${transaction.amount.toLocaleString()} detected`,
        severity: this.calculateSeverity(transaction.amount, highValueThreshold),
        metadata: {
          amount: transaction.amount,
          threshold: highValueThreshold,
          transactionType: transaction.transactionType
        }
      });
      alerts.push(alert);
    }

    // Check international transaction
    if (transaction.destinationBankCode && !transaction.destinationBankCode.startsWith('000')) {
      if (transaction.amount >= threshold.internationalThreshold) {
        const alert = await this.createAlert({
          transactionId: transaction.id,
          walletId: transaction.sourceWalletId,
          alertType: 'international',
          alertMessage: `International transaction of ${transaction.currencyCode} ${transaction.amount.toLocaleString()} to bank ${transaction.destinationBankCode}`,
          severity: 'medium',
          metadata: {
            amount: transaction.amount,
            destinationBank: transaction.destinationBankCode,
            threshold: threshold.internationalThreshold
          }
        });
        alerts.push(alert);
      }
    }

    // Check daily limit
    const dailyTotal = await this.getDailyTransactionTotal(transaction.sourceWalletId);
    const dailyLimit = config?.dailyLimit || threshold.dailyLimit;
    if (dailyTotal + transaction.amount > dailyLimit) {
      const alert = await this.createAlert({
        transactionId: transaction.id,
        walletId: transaction.sourceWalletId,
        alertType: 'daily_limit',
        alertMessage: `Daily transaction limit approaching. Total today: ${transaction.currencyCode} ${(dailyTotal + transaction.amount).toLocaleString()} (Limit: ${dailyLimit.toLocaleString()})`,
        severity: dailyTotal + transaction.amount > dailyLimit * 0.9 ? 'high' : 'medium',
        metadata: {
          dailyTotal: dailyTotal + transaction.amount,
          dailyLimit,
          transactionAmount: transaction.amount
        }
      });
      alerts.push(alert);
    }

    return alerts;
  }

  /**
   * Check if 2FA is required for this transaction
   */
  async requires2FA(
    amount: number,
    walletTier: string = 'basic'
  ): Promise<boolean> {
    const threshold = this.defaultThresholds.get(walletTier) || this.defaultThresholds.get('basic')!;
    return threshold.require2faAbove !== null && amount >= threshold.require2faAbove;
  }

  /**
   * Get wallet-specific alert configuration
   */
  async getWalletAlertConfig(walletId: string): Promise<AlertConfig | null> {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM transaction_alert_configs
       WHERE wallet_id = $1 AND alert_type = 'high_value' AND is_enabled = TRUE`,
      [walletId]
    );

    if (result.length === 0) return null;

    return this.mapAlertConfig(result[0]);
  }

  /**
   * Get all alert configs for a wallet
   */
  async getWalletAlertConfigs(walletId: string): Promise<AlertConfig[]> {
    const result = await query<Record<string, unknown>>(
      'SELECT * FROM transaction_alert_configs WHERE wallet_id = $1',
      [walletId]
    );

    return result.map(this.mapAlertConfig);
  }

  /**
   * Set alert configuration for a wallet
   */
  async setAlertConfig(
    walletId: string,
    alertType: string,
    config: {
      thresholdAmount?: number;
      dailyLimit?: number;
      isEnabled?: boolean;
      notificationChannels?: string[];
    }
  ): Promise<AlertConfig> {
    const result = await query<Record<string, unknown>>(
      `INSERT INTO transaction_alert_configs (wallet_id, alert_type, threshold_amount, daily_limit, is_enabled, notification_channels)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (wallet_id, alert_type)
       DO UPDATE SET
         threshold_amount = COALESCE($3, transaction_alert_configs.threshold_amount),
         daily_limit = COALESCE($4, transaction_alert_configs.daily_limit),
         is_enabled = COALESCE($5, transaction_alert_configs.is_enabled),
         notification_channels = COALESCE($6, transaction_alert_configs.notification_channels),
         updated_at = NOW()
       RETURNING *`,
      [
        walletId,
        alertType,
        config.thresholdAmount,
        config.dailyLimit,
        config.isEnabled ?? true,
        config.notificationChannels || ['push', 'email']
      ]
    );

    logger.info('Alert config updated', { walletId, alertType });
    return this.mapAlertConfig(result[0]);
  }

  /**
   * Get alerts for a wallet
   */
  async getAlerts(
    walletId: string,
    options: { includeAcknowledged?: boolean; limit?: number } = {}
  ): Promise<TransactionAlert[]> {
    const { includeAcknowledged = false, limit = 50 } = options;

    const whereClause = includeAcknowledged
      ? 'wallet_id = $1'
      : 'wallet_id = $1 AND is_acknowledged = FALSE';

    const result = await query<Record<string, unknown>>(
      `SELECT * FROM transaction_alerts
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2`,
      [walletId, limit]
    );

    return result.map(this.mapAlert);
  }

  /**
   * Get alert by ID
   */
  async getAlertById(alertId: string): Promise<TransactionAlert | null> {
    const result = await query<Record<string, unknown>>(
      'SELECT * FROM transaction_alerts WHERE id = $1',
      [alertId]
    );

    return result.length > 0 ? this.mapAlert(result[0]) : null;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
  ): Promise<boolean> {
    const result = await query<Record<string, unknown>>(
      `UPDATE transaction_alerts
       SET is_acknowledged = TRUE, acknowledged_at = NOW(), acknowledged_by = $2
       WHERE id = $1
       RETURNING id`,
      [alertId, acknowledgedBy]
    );

    if (result.length > 0) {
      logger.info('Alert acknowledged', { alertId, acknowledgedBy });
      return true;
    }

    return false;
  }

  /**
   * Get unacknowledged alert count
   */
  async getUnacknowledgedCount(walletId: string): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM transaction_alerts
       WHERE wallet_id = $1 AND is_acknowledged = FALSE`,
      [walletId]
    );

    return parseInt(result[0].count, 10);
  }

  /**
   * Get default thresholds for a tier
   */
  getDefaultThresholds(tier: string = 'basic'): AlertThreshold | undefined {
    return this.defaultThresholds.get(tier);
  }

  private async createAlert(data: {
    transactionId: string;
    walletId: string;
    alertType: string;
    alertMessage: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metadata: Record<string, unknown>;
  }): Promise<TransactionAlert> {
    const id = uuidv4();

    const result = await query<Record<string, unknown>>(
      `INSERT INTO transaction_alerts (id, transaction_id, wallet_id, alert_type, alert_message, severity, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        data.transactionId,
        data.walletId,
        data.alertType,
        data.alertMessage,
        data.severity,
        JSON.stringify(data.metadata)
      ]
    );

    logger.info('Alert created', {
      alertId: id,
      transactionId: data.transactionId,
      alertType: data.alertType,
      severity: data.severity
    });

    return this.mapAlert(result[0]);
  }

  private async getDailyTransactionTotal(walletId: string): Promise<number> {
    const result = await query<{ total: string }>(
      `SELECT COALESCE(SUM(amount + fee_amount), 0) as total
       FROM transactions
       WHERE source_wallet_id = $1
         AND created_at >= CURRENT_DATE
         AND status NOT IN ('cancelled', 'failed')`,
      [walletId]
    );

    return parseFloat(result[0].total);
  }

  private calculateSeverity(amount: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = amount / threshold;
    if (ratio >= 5) return 'critical';
    if (ratio >= 3) return 'high';
    if (ratio >= 2) return 'medium';
    return 'low';
  }

  private mapAlertConfig(row: Record<string, unknown>): AlertConfig {
    return {
      id: row.id as string,
      walletId: row.wallet_id as string,
      alertType: row.alert_type as string,
      thresholdAmount: row.threshold_amount ? parseFloat(row.threshold_amount as string) : null,
      dailyLimit: row.daily_limit ? parseFloat(row.daily_limit as string) : null,
      isEnabled: row.is_enabled as boolean,
      notificationChannels: row.notification_channels as string[] || []
    };
  }

  private mapAlert(row: Record<string, unknown>): TransactionAlert {
    return {
      id: row.id as string,
      transactionId: row.transaction_id as string,
      walletId: row.wallet_id as string,
      alertType: row.alert_type as string,
      alertMessage: row.alert_message as string,
      severity: row.severity as 'low' | 'medium' | 'high' | 'critical',
      isAcknowledged: row.is_acknowledged as boolean,
      metadata: row.metadata as Record<string, unknown> || {},
      createdAt: new Date(row.created_at as string)
    };
  }
}

export default new AlertService();
