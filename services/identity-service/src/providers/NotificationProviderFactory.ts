import { PushProvider, EmailProvider, SMSProvider } from '../services/notificationService';
import { PushProviderExtended, EmailProviderExtended, SMSProviderExtended, PushBatchResult, EmailDeliveryResult, SMSDeliveryResult } from './types';
import { SendGridProvider } from './email/SendGridProvider';
import { SESProvider } from './email/SESProvider';
import { TwilioProvider } from './sms/TwilioProvider';
import { TermiiProvider } from './sms/TermiiProvider';
import { FirebaseProvider } from './push/FirebaseProvider';
import { logger } from '../utils/logger';

// Import Firebase admin types
import * as admin from 'firebase-admin';

class StubPushProvider implements PushProviderExtended {
  name = 'stub-push';

  async send(token: string, title: string, body: string, data?: Record<string, unknown>) {
    logger.info('STUB PUSH', { token: token.slice(0, 20) + '...', title, body, data });
    return true;
  }

  async sendBatch(notifications: Array<{
    token: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }>): Promise<PushBatchResult> {
    logger.info('STUB PUSH BATCH', { count: notifications.length });
    return {
      results: notifications.map(() => ({ success: true })),
      successCount: notifications.length,
      failureCount: 0
    };
  }
}

class StubEmailProvider implements EmailProviderExtended {
  name = 'stub-email';

  async send(to: string, subject: string, body: string) {
    logger.info('STUB EMAIL', { to, subject, bodyLength: body.length });
    return true;
  }

  async sendWithTracking(
    to: string,
    subject: string,
    body: string,
    html?: string,
    options?: { replyTo?: string; senderName?: string }
  ): Promise<EmailDeliveryResult> {
    logger.info('STUB EMAIL WITH TRACKING', { to, subject, bodyLength: body.length, hasHtml: !!html });
    return {
      success: true,
      externalMessageId: `stub-${Date.now()}`
    };
  }
}

class StubSMSProvider implements SMSProviderExtended {
  name = 'stub-sms';

  async send(phone: string, message: string) {
    logger.info('STUB SMS', { phone, messageLength: message.length });
    return true;
  }

  async sendWithTracking(
    phone: string,
    message: string,
    options?: { senderId?: string }
  ): Promise<SMSDeliveryResult> {
    logger.info('STUB SMS WITH TRACKING', { phone, messageLength: message.length });
    return {
      success: true,
      externalMessageId: `stub-sms-${Date.now()}`
    };
  }
}

export class NotificationProviderFactory {
  private static instance: NotificationProviderFactory;
  private pushProvider!: PushProviderExtended;
  private emailProvider!: EmailProviderExtended;
  private smsProvider!: SMSProviderExtended;

  private constructor() {
    this.initializeProviders();
  }

  static getInstance(): NotificationProviderFactory {
    if (!NotificationProviderFactory.instance) {
      NotificationProviderFactory.instance = new NotificationProviderFactory();
    }
    return NotificationProviderFactory.instance;
  }

  private initializeProviders(): void {
    // Initialize Push Provider
    this.pushProvider = this.createPushProvider();

    // Initialize Email Provider
    this.emailProvider = this.createEmailProvider();

    // Initialize SMS Provider
    this.smsProvider = this.createSMSProvider();

    logger.info('Notification providers initialized', {
      push: this.pushProvider.name,
      email: this.emailProvider.name,
      sms: this.smsProvider.name
    });
  }

  private createPushProvider(): PushProviderExtended {
    const provider = process.env.PUSH_PROVIDER || 'stub';

    switch (provider.toLowerCase()) {
      case 'firebase':
        try {
          const serviceAccount = this.loadFirebaseCredentials();
          return new FirebaseProvider(serviceAccount);
        } catch (error) {
          logger.warn('Failed to initialize Firebase provider, falling back to stub', { error });
          return new StubPushProvider();
        }

      case 'stub':
      default:
        return new StubPushProvider();
    }
  }

  private createEmailProvider(): EmailProviderExtended {
    const provider = process.env.EMAIL_PROVIDER || 'stub';

    switch (provider.toLowerCase()) {
      case 'sendgrid':
        try {
          const apiKey = process.env.SENDGRID_API_KEY;
          if (!apiKey) throw new Error('SENDGRID_API_KEY not set');
          return new SendGridProvider(apiKey);
        } catch (error) {
          logger.warn('Failed to initialize SendGrid provider, falling back to stub', { error });
          return new StubEmailProvider();
        }

      case 'ses':
        try {
          const region = process.env.AWS_REGION || 'us-east-1';
          return new SESProvider({ region });
        } catch (error) {
          logger.warn('Failed to initialize SES provider, falling back to stub', { error });
          return new StubEmailProvider();
        }

      case 'stub':
      default:
        return new StubEmailProvider();
    }
  }

  private createSMSProvider(): SMSProviderExtended {
    const provider = process.env.SMS_PROVIDER || 'stub';

    switch (provider.toLowerCase()) {
      case 'twilio':
        try {
          const accountSid = process.env.TWILIO_ACCOUNT_SID;
          const authToken = process.env.TWILIO_AUTH_TOKEN;
          if (!accountSid || !authToken) throw new Error('Twilio credentials not set');
          return new TwilioProvider(accountSid, authToken);
        } catch (error) {
          logger.warn('Failed to initialize Twilio provider, falling back to stub', { error });
          return new StubSMSProvider();
        }

      case 'termii':
        try {
          const apiKey = process.env.TERMII_API_KEY;
          if (!apiKey) throw new Error('TERMII_API_KEY not set');
          return new TermiiProvider(apiKey);
        } catch (error) {
          logger.warn('Failed to initialize Termii provider, falling back to stub', { error });
          return new StubSMSProvider();
        }

      case 'stub':
      default:
        return new StubSMSProvider();
    }
  }

  private loadFirebaseCredentials(): admin.ServiceAccount {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      throw new Error('Firebase credentials not properly configured');
    }

    return {
      projectId: projectId,
      privateKey: privateKey,
      clientEmail: clientEmail
    };
  }

  // Getters for the providers
  getPushProvider(): PushProviderExtended {
    return this.pushProvider;
  }

  getEmailProvider(): EmailProviderExtended {
    return this.emailProvider;
  }

  getSMSProvider(): SMSProviderExtended {
    return this.smsProvider;
  }

  // Legacy compatibility getters
  getPushProviderLegacy(): PushProvider {
    return this.pushProvider as any;
  }

  getEmailProviderLegacy(): EmailProvider {
    return this.emailProvider as any;
  }

  getSMSProviderLegacy(): SMSProvider {
    return this.smsProvider as any;
  }

  // Health check method
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Test email provider
    try {
      // Note: In production, you might want to send a test email or use a health check endpoint
      results.email = this.emailProvider.name !== 'stub-email';
    } catch {
      results.email = false;
    }

    // Test SMS provider
    try {
      results.sms = this.smsProvider.name !== 'stub-sms';
    } catch {
      results.sms = false;
    }

    // Test push provider
    try {
      results.push = this.pushProvider.name !== 'stub-push';
    } catch {
      results.push = false;
    }

    return results;
  }
}