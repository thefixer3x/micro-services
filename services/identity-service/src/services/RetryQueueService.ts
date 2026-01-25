import { getDatabase } from '../database/connection';
import { logger } from '../utils/logger';
import { NotificationProviderFactory } from '../providers/NotificationProviderFactory';

interface RetryEntry {
  id: string;
  notificationId: string;
  channel: string;
  retryCount: number;
  scheduledAt: Date;
  processed: boolean;
  errorMessage?: string;
}

export class RetryQueueService {
  private db = getDatabase();
  private providerFactory = NotificationProviderFactory.getInstance();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  /**
   * Schedule a notification for retry
   */
  async scheduleRetry(
    notificationId: string,
    channel: string,
    retryCount: number = 0,
    delayMinutes: number = 1
  ): Promise<void> {
    const scheduledAt = new Date();
    scheduledAt.setMinutes(scheduledAt.getMinutes() + delayMinutes);

    try {
      await this.db.query(
        `INSERT INTO notification_retries
         (notification_id, channel, retry_count, scheduled_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (notification_id, channel, retry_count) DO NOTHING`,
        [notificationId, channel, retryCount, scheduledAt]
      );

      // Update notification retry count
      await this.db.query(
        `UPDATE notifications
         SET retry_count = $1, last_retry_at = NOW()
         WHERE id = $2`,
        [retryCount + 1, notificationId]
      );

      logger.info('Retry scheduled', { notificationId, channel, retryCount, scheduledAt });
    } catch (error) {
      logger.error('Failed to schedule retry', { notificationId, channel, error });
      throw error;
    }
  }

  /**
   * Process pending retries
   */
  async processRetries(): Promise<void> {
    if (this.isProcessing) {
      return; // Prevent concurrent processing
    }

    this.isProcessing = true;

    try {
      // Get pending retries ordered by scheduled time
      const result = await this.db.query(
        `SELECT * FROM notification_retries
         WHERE processed = FALSE AND scheduled_at <= NOW()
         ORDER BY scheduled_at ASC
         LIMIT 50`, // Process in batches
        []
      );

      const retries: RetryEntry[] = result.rows.map(row => ({
        id: row.id,
        notificationId: row.notification_id,
        channel: row.channel,
        retryCount: row.retry_count,
        scheduledAt: row.scheduled_at,
        processed: row.processed,
        errorMessage: row.error_message
      }));

      logger.info('Processing retries', { count: retries.length });

      for (const retry of retries) {
        await this.processRetry(retry);
      }

    } catch (error) {
      logger.error('Error processing retries', { error });
    } finally {
      this.isProcessing = false;
    }
  }

  private async processRetry(retry: RetryEntry): Promise<void> {
    try {
      // Mark as processed
      await this.db.query(
        'UPDATE notification_retries SET processed = TRUE, processed_at = NOW() WHERE id = $1',
        [retry.id]
      );

      // Get notification details
      const notificationResult = await this.db.query(
        'SELECT * FROM notifications WHERE id = $1',
        [retry.notificationId]
      );

      if (notificationResult.rows.length === 0) {
        logger.warn('Notification not found for retry', { notificationId: retry.notificationId });
        return;
      }

      const notification = notificationResult.rows[0];

      // Check if already permanently failed
      if (notification.permanently_failed) {
        logger.info('Skipping retry for permanently failed notification', { notificationId: retry.notificationId });
        return;
      }

      // Get user contact info
      const userResult = await this.db.query(
        `SELECT email, phone,
         (SELECT array_agg(token) FROM device_tokens WHERE user_id = n.user_id AND is_active = TRUE) as device_tokens
         FROM notifications n WHERE id = $1`,
        [retry.notificationId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User contact info not found');
      }

      const user = userResult.rows[0];

      // Attempt to resend based on channel
      const success = await this.resendNotification(notification, user, retry.channel);

      if (success) {
        // Update notification status
        await this.db.query(
          `UPDATE notifications
           SET ${retry.channel}_status = 'sent', ${retry.channel}_sent_at = NOW()
           WHERE id = $1`,
          [retry.notificationId]
        );

        logger.info('Retry successful', { notificationId: retry.notificationId, channel: retry.channel });
      } else {
        // Check if max retries reached
        const maxRetries = 3;
        if (retry.retryCount >= maxRetries) {
          // Mark as permanently failed
          await this.db.query(
            'UPDATE notifications SET permanently_failed = TRUE WHERE id = $1',
            [retry.notificationId]
          );

          logger.warn('Max retries reached, marking permanently failed', {
            notificationId: retry.notificationId,
            channel: retry.channel
          });
        } else {
          // Schedule next retry with exponential backoff
          const delays = [1, 5, 15]; // minutes
          const nextDelay = delays[retry.retryCount] || 60; // fallback to 1 hour
          await this.scheduleRetry(retry.notificationId, retry.channel, retry.retryCount + 1, nextDelay);
        }
      }

    } catch (error: any) {
      logger.error('Retry processing failed', {
        retryId: retry.id,
        notificationId: retry.notificationId,
        error: error.message
      });

      // Mark retry as failed
      await this.db.query(
        'UPDATE notification_retries SET error_message = $1 WHERE id = $2',
        [error.message, retry.id]
      );
    }
  }

  private async resendNotification(
    notification: any,
    user: any,
    channel: string
  ): Promise<boolean> {
    try {
      switch (channel) {
        case 'push':
          if (!user.device_tokens || user.device_tokens.length === 0) {
            return false;
          }

          const pushProvider = this.providerFactory.getPushProvider();
          const batchResult = await pushProvider.sendBatch(user.device_tokens.map((token: string) => ({
            token,
            title: notification.title,
            body: notification.body,
            data: notification.action_data || {}
          })));

          return batchResult.successCount > 0;

        case 'email':
          if (!user.email) {
            return false;
          }

          const emailProvider = this.providerFactory.getEmailProvider();
          const emailResult = await emailProvider.sendWithTracking(
            user.email,
            notification.title,
            notification.body
          );

          return emailResult.success;

        case 'sms':
          if (!user.phone) {
            return false;
          }

          const smsProvider = this.providerFactory.getSMSProvider();
          const smsResult = await smsProvider.sendWithTracking(
            user.phone,
            notification.body
          );

          return smsResult.success;

        default:
          logger.warn('Unknown channel for retry', { channel });
          return false;
      }
    } catch (error) {
      logger.error('Resend failed', { channel, error });
      return false;
    }
  }

  /**
   * Start periodic processing
   */
  startPeriodicProcessing(intervalMs: number = 60000): void { // Default 1 minute
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      this.processRetries().catch(error => {
        logger.error('Periodic retry processing failed', { error });
      });
    }, intervalMs);

    logger.info('Started periodic retry processing', { intervalMs });
  }

  /**
   * Stop periodic processing
   */
  stopPeriodicProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('Stopped periodic retry processing');
    }
  }

  /**
   * Get retry statistics
   */
  async getRetryStats(): Promise<{
    pending: number;
    processed: number;
    failed: number;
  }> {
    const result = await this.db.query(`
      SELECT
        COUNT(*) FILTER (WHERE processed = FALSE) as pending,
        COUNT(*) FILTER (WHERE processed = TRUE AND error_message IS NULL) as processed,
        COUNT(*) FILTER (WHERE processed = TRUE AND error_message IS NOT NULL) as failed
      FROM notification_retries
    `);

    return {
      pending: parseInt(result.rows[0].pending),
      processed: parseInt(result.rows[0].processed),
      failed: parseInt(result.rows[0].failed)
    };
  }
}