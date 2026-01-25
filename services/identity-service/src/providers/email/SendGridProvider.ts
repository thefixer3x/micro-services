import sgMail from '@sendgrid/mail';
import { EmailProviderExtended, EmailDeliveryResult } from '../types';
import { logger } from '../../utils/logger';

export class SendGridProvider implements EmailProviderExtended {
  name = 'sendgrid';
  private rateLimitDelay = 1000; // 1 second between requests
  private lastRequestTime = 0;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('SendGrid API key is required');
    }
    sgMail.setApiKey(apiKey);
  }

  async sendWithTracking(
    to: string,
    subject: string,
    body: string,
    html?: string,
    options: { replyTo?: string; senderName?: string } = {}
  ): Promise<EmailDeliveryResult> {
    try {
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.rateLimitDelay) {
        const delay = this.rateLimitDelay - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      this.lastRequestTime = Date.now();

      const msg: any = {
        to,
        subject,
        text: body,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@grizzen.com',
          name: options.senderName || 'Grizzen'
        }
      };

      // Add HTML version if provided
      if (html) {
        msg.html = html;
      }

      // Add reply-to if specified
      if (options.replyTo) {
        msg.replyTo = options.replyTo;
      }

      const result = await sgMail.send(msg);

      logger.info('SendGrid email sent', {
        to,
        subject,
        messageId: result[0]?.headers?.['x-message-id']
      });

      return {
        success: true,
        externalMessageId: result[0]?.headers?.['x-message-id']
      };

    } catch (error: any) {
      logger.error('SendGrid email failed', {
        to,
        subject,
        error: error.message,
        code: error.code
      });

      // Handle rate limiting
      if (error.code === 429) {
        this.rateLimitDelay *= 2; // Exponential backoff
        logger.warn('SendGrid rate limit hit, increasing delay', { newDelay: this.rateLimitDelay });
      }

      return {
        success: false,
        error: error.message
      };
    }
  }
}