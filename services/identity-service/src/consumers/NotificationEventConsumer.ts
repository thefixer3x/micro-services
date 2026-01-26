import { EventConsumer, EventPayload } from '../../../../libraries/common-events/dist';
import {
  Topics,
  TransactionCompletedEvent,
  TransactionFailedEvent,
  WalletCreditedEvent,
  WalletDebitedEvent,
  UserLoginEvent
} from '../../../../libraries/common-events/dist';
import { NotificationService } from '../services/notificationService';
import { logger } from '../utils/logger';

export class NotificationEventConsumer {
  private consumer: EventConsumer;
  private notificationService: NotificationService;
  private isRunning: boolean = false;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;

    // Initialize Kafka consumer
    this.consumer = new EventConsumer({
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      groupId: 'notification-service',
      clientId: 'notification-service-consumer',
      serviceName: 'notification-service'
    });

    this.setupEventHandlers();
  }

  /**
   * Set up event handlers for different event types
   */
  private setupEventHandlers(): void {
    // Transaction Events
    this.consumer.on<TransactionCompletedEvent>('TransactionCompleted', this.handleTransactionCompleted.bind(this));
    this.consumer.on<TransactionFailedEvent>('TransactionFailed', this.handleTransactionFailed.bind(this));

    // Wallet Events
    this.consumer.on<WalletCreditedEvent>('WalletCredited', this.handleWalletCredited.bind(this));
    this.consumer.on<WalletDebitedEvent>('WalletDebited', this.handleWalletDebited.bind(this));

    // Identity Events
    this.consumer.on<UserLoginEvent>('UserLogin', this.handleUserLogin.bind(this));
  }

  /**
   * Start the event consumer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.info('Notification event consumer is already running');
      return;
    }

    try {
      // Subscribe to relevant topics
      await this.consumer.subscribe([
        Topics.TRANSACTION,
        Topics.WALLET,
        Topics.IDENTITY
      ]);

      // Start consuming
      await this.consumer.start();

      this.isRunning = true;
      logger.info('Notification event consumer started successfully');
    } catch (error) {
      logger.error('Failed to start notification event consumer', { error });
      throw error;
    }
  }

  /**
   * Stop the event consumer
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.consumer.disconnect();
      this.isRunning = false;
      logger.info('Notification event consumer stopped');
    } catch (error) {
      logger.error('Error stopping notification event consumer', { error });
      throw error;
    }
  }

  /**
   * Handle transaction completed events
   */
  private async handleTransactionCompleted(event: EventPayload<TransactionCompletedEvent>): Promise<void> {
    const { data } = event;

    try {
      logger.info('Processing transaction completed event', {
        transactionId: data.transactionId,
        userId: data.userId,
        amount: data.amount,
        currency: data.currency
      });

      // Send notification using transaction_debit template (since it's a debit from user's perspective)
      await this.notificationService.sendFromTemplate(
        data.userId,
        'transaction_debit',
        {
          amount: data.amount.toFixed(2),
          currency: data.currency,
          reference: data.referenceNumber,
          recipient: 'recipient', // This would need to be extracted from transaction data
          time: new Date(data.completedAt).toLocaleString()
        }
      );

      logger.info('Transaction completed notification sent', {
        transactionId: data.transactionId,
        userId: data.userId
      });
    } catch (error) {
      logger.error('Failed to process transaction completed event', {
        transactionId: data.transactionId,
        userId: data.userId,
        error
      });
      // Continue processing other events - don't throw
    }
  }

  /**
   * Handle transaction failed events
   */
  private async handleTransactionFailed(event: EventPayload<TransactionFailedEvent>): Promise<void> {
    const { data } = event;

    try {
      logger.info('Processing transaction failed event', {
        transactionId: data.transactionId,
        userId: data.userId,
        failureReason: data.failureReason
      });

      await this.notificationService.sendFromTemplate(
        data.userId,
        'transaction_failed',
        {
          amount: data.amount.toFixed(2),
          currency: data.currency,
          reference: data.referenceNumber,
          reason: data.failureReason,
          time: new Date(data.failedAt).toLocaleString()
        }
      );

      logger.info('Transaction failed notification sent', {
        transactionId: data.transactionId,
        userId: data.userId
      });
    } catch (error) {
      logger.error('Failed to process transaction failed event', {
        transactionId: data.transactionId,
        userId: data.userId,
        error
      });
    }
  }

  /**
   * Handle wallet credited events
   */
  private async handleWalletCredited(event: EventPayload<WalletCreditedEvent>): Promise<void> {
    const { data } = event;

    try {
      logger.info('Processing wallet credited event', {
        walletId: data.walletId,
        userId: data.userId,
        amount: data.amount,
        currency: data.currency
      });

      await this.notificationService.sendFromTemplate(
        data.userId,
        'transaction_credit',
        {
          amount: data.amount.toFixed(2),
          currency: data.currency,
          reference: data.reference,
          sender: data.source,
          time: new Date().toLocaleString() // Event doesn't have timestamp, use current time
        }
      );

      logger.info('Wallet credited notification sent', {
        walletId: data.walletId,
        userId: data.userId
      });
    } catch (error) {
      logger.error('Failed to process wallet credited event', {
        walletId: data.walletId,
        userId: data.userId,
        error
      });
    }
  }

  /**
   * Handle wallet debited events
   */
  private async handleWalletDebited(event: EventPayload<WalletDebitedEvent>): Promise<void> {
    const { data } = event;

    try {
      logger.info('Processing wallet debited event', {
        walletId: data.walletId,
        userId: data.userId,
        amount: data.amount,
        currency: data.currency
      });

      await this.notificationService.sendFromTemplate(
        data.userId,
        'transaction_debit',
        {
          amount: data.amount.toFixed(2),
          currency: data.currency,
          reference: data.reference,
          recipient: data.destination,
          time: new Date().toLocaleString()
        }
      );

      logger.info('Wallet debited notification sent', {
        walletId: data.walletId,
        userId: data.userId
      });
    } catch (error) {
      logger.error('Failed to process wallet debited event', {
        walletId: data.walletId,
        userId: data.userId,
        error
      });
    }
  }

  /**
   * Handle user login events - detect new device and send security notification
   */
  private async handleUserLogin(event: EventPayload<UserLoginEvent>): Promise<void> {
    const { data } = event;

    // Only send notifications for successful logins
    if (!data.success) {
      return;
    }

    try {
      logger.info('Processing user login event', {
        userId: data.userId,
        email: data.email,
        ipAddress: data.ipAddress
      });

      // Check if this is a new device (simplified logic - in production you'd track device fingerprints)
      const isNewDevice = await this.isNewDeviceLogin(data.userId, data.userAgent);

      if (isNewDevice) {
        // Extract location from IP (simplified - in production use a geolocation service)
        const location = await this.getLocationFromIP(data.ipAddress);

        await this.notificationService.sendFromTemplate(
          data.userId,
          'security_login',
          {
            device: this.parseUserAgent(data.userAgent),
            location: location,
            time: new Date().toLocaleString()
          }
        );

        logger.info('New device login notification sent', {
          userId: data.userId,
          ipAddress: data.ipAddress
        });
      }
    } catch (error) {
      logger.error('Failed to process user login event', {
        userId: data.userId,
        error
      });
    }
  }

  /**
   * Check if this is a new device login (simplified implementation)
   */
  private async isNewDeviceLogin(userId: string, userAgent: string): Promise<boolean> {
    try {
      // In a real implementation, you'd check against a device registry
      // For now, we'll consider it a new device if we haven't seen this user agent recently
      const db = this.notificationService['db']; // Access private db - in real code, make this a proper method

      const result = await db.query(
        `SELECT COUNT(*) as count FROM device_tokens
         WHERE user_id = $1 AND app_version = $2
         AND last_used_at > NOW() - INTERVAL '30 days'`,
        [userId, userAgent]
      );

      return parseInt(result.rows[0].count) === 0;
    } catch (error) {
      logger.error('Error checking new device login', { userId, error });
      return true; // Default to sending notification on error
    }
  }

  /**
   * Get location from IP address (simplified implementation)
   */
  private async getLocationFromIP(ipAddress: string): Promise<string> {
    try {
      // In production, you'd use a geolocation service like MaxMind
      // For now, return a placeholder
      return `${ipAddress} (Unknown Location)`;
    } catch (error) {
      logger.error('Error getting location from IP', { ipAddress, error });
      return 'Unknown Location';
    }
  }

  /**
   * Parse user agent string to extract device info
   */
  private parseUserAgent(userAgent: string): string {
    try {
      // Simple user agent parsing - in production use a proper library
      if (userAgent.includes('Mobile')) {
        return 'Mobile Device';
      } else if (userAgent.includes('iPhone')) {
        return 'iPhone';
      } else if (userAgent.includes('Android')) {
        return 'Android Device';
      } else {
        return 'Desktop Browser';
      }
    } catch (error) {
      return 'Unknown Device';
    }
  }

  /**
   * Get consumer health status
   */
  getHealthStatus(): { isRunning: boolean; consumerConnected: boolean } {
    return {
      isRunning: this.isRunning,
      consumerConnected: this.consumer ? true : false // Simplified check
    };
  }
}