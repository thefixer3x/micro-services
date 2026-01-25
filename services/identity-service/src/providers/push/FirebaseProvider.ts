import * as admin from 'firebase-admin';
import { PushProviderExtended, PushBatchResult, PushDeliveryResult } from '../types';
import { logger } from '../../utils/logger';

interface FirebaseMessage {
  token: string;
  notification?: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
  android?: {
    priority: 'normal' | 'high';
  };
  apns?: {
    payload: {
      aps: {
        alert?: {
          title: string;
          body: string;
        };
        sound?: string;
        badge?: number;
      };
    };
  };
}

export class FirebaseProvider implements PushProviderExtended {
  name = 'firebase';
  private app: admin.app.App;

  constructor(serviceAccount: admin.ServiceAccount) {
    if (!serviceAccount) {
      throw new Error('Firebase service account credentials are required');
    }

    this.app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  async sendBatch(notifications: Array<{
    token: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }>): Promise<PushBatchResult> {
    const results: PushDeliveryResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    const invalidTokens: string[] = [];

    // Process in batches to avoid Firebase limits
    const batchSize = 500; // Firebase recommends batches of 500
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const batchResults = await this.sendBatchInternal(batch);
      results.push(...batchResults.results);
      successCount += batchResults.successCount;
      failureCount += batchResults.failureCount;
      invalidTokens.push(...(batchResults.invalidTokens || []));
    }

    logger.info('Firebase push batch completed', {
      total: notifications.length,
      success: successCount,
      failure: failureCount,
      invalidTokens: invalidTokens.length
    });

    return {
      results,
      successCount,
      failureCount
    };
  }

  private async sendBatchInternal(notifications: Array<{
    token: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }>): Promise<PushBatchResult> {
    const messages: FirebaseMessage[] = notifications.map(notification => ({
      token: notification.token,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data ? this.convertDataToStrings(notification.data) : undefined,
      android: {
        priority: 'high' // High priority for important notifications
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body
            },
            sound: 'default',
            badge: 1
          }
        }
      }
    }));

    try {
      // Send messages individually for now (Firebase sendMulticast may not be available in this version)
      const promises = messages.map(async (message) => {
        try {
          const result = await admin.messaging(this.app).send(message);
          return { success: true, messageId: result, error: null };
        } catch (error: any) {
          return { success: false, messageId: null, error };
        }
      });

      const response = await Promise.all(promises);

      const results: PushDeliveryResult[] = [];
      const invalidTokens: string[] = [];
      let successCount = 0;
      let failureCount = 0;

      response.forEach((res, index) => {
        const originalNotification = notifications[index];

        if (res.success) {
          successCount++;
          results.push({
            success: true,
            externalMessageId: res.messageId || undefined
          });
        } else {
          failureCount++;
          const error = res.error!;

          // Check for invalid token errors
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered') {
            invalidTokens.push(originalNotification.token);
          }

          results.push({
            success: false,
            error: error.message
          });

          logger.warn('Firebase push failed', {
            token: originalNotification.token.slice(0, 20) + '...',
            error: error.message,
            code: error.code
          });
        }
      });

      return {
        results,
        successCount,
        failureCount,
        invalidTokens
      };

    } catch (error: any) {
      logger.error('Firebase batch send failed', { error: error.message });

      // If batch fails entirely, mark all as failed
      return {
        results: notifications.map(() => ({
          success: false,
          error: error.message
        })),
        successCount: 0,
        failureCount: notifications.length
      };
    }
  }

  private convertDataToStrings(data: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return result;
  }
}