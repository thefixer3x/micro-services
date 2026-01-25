import twilio from 'twilio';
import { SMSProviderExtended, SMSDeliveryResult } from '../types';
import { logger } from '../../utils/logger';

export class TwilioProvider implements SMSProviderExtended {
  name = 'twilio';
  private client: twilio.Twilio;
  private rateLimitDelay = 1000; // 1 second between requests
  private lastRequestTime = 0;

  constructor(accountSid: string, authToken: string) {
    if (!accountSid || !authToken) {
      throw new Error('Twilio account SID and auth token are required');
    }
    this.client = twilio(accountSid, authToken);
  }

  async sendWithTracking(
    phone: string,
    message: string,
    options: { senderId?: string } = {}
  ): Promise<SMSDeliveryResult> {
    try {
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.rateLimitDelay) {
        const delay = this.rateLimitDelay - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      this.lastRequestTime = Date.now();

      // Handle message segmentation for long messages
      const segments = this.segmentMessage(message);
      const results: any[] = [];

      for (const segment of segments) {
        const result = await this.client.messages.create({
          body: segment,
          from: options.senderId || process.env.TWILIO_PHONE_NUMBER || '+1234567890',
          to: phone
        });
        results.push(result);
      }

      for (const segment of segments) {
        const result = await this.client.messages.create({
          body: segment,
          from: options.senderId || process.env.TWILIO_PHONE_NUMBER || '+1234567890',
          to: phone
        });
        results.push(result);
      }

      logger.info('Twilio SMS sent', {
        to: phone,
        segments: segments.length,
        messageId: results[0]?.sid
      });

      return {
        success: true,
        externalMessageId: results[0]?.sid
      };

    } catch (error: any) {
      logger.error('Twilio SMS failed', {
        to: phone,
        error: error.message,
        code: error.code
      });

      // Handle rate limiting
      if (error.code === 20429) { // Twilio rate limit error
        this.rateLimitDelay *= 2; // Exponential backoff
        logger.warn('Twilio rate limit hit, increasing delay', { newDelay: this.rateLimitDelay });
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  private segmentMessage(message: string): string[] {
    const maxLength = 160; // Standard SMS length
    const segments: string[] = [];

    if (message.length <= maxLength) {
      return [message];
    }

    // Simple segmentation - in production, you'd want more sophisticated segmentation
    // that respects word boundaries and adds segment indicators
    let remaining = message;
    while (remaining.length > 0) {
      const segment = remaining.slice(0, maxLength);
      segments.push(segment);
      remaining = remaining.slice(maxLength);
    }

    return segments;
  }
}