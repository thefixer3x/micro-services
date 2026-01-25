import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { EmailProviderExtended, EmailDeliveryResult } from '../types';
import { logger } from '../../utils/logger';

export class SESProvider implements EmailProviderExtended {
  name = 'ses';
  private client: SESClient;
  private rateLimitDelay = 1000; // 1 second between requests for SES
  private lastRequestTime = 0;

  constructor(config: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  }) {
    if (!config.region) {
      throw new Error('AWS region is required for SES');
    }

    this.client = new SESClient({
      region: config.region,
      credentials: config.accessKeyId && config.secretAccessKey ? {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      } : undefined
    });
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

      const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@grizzen.com';
      const fromName = options.senderName || 'Grizzen';

      const params: SendEmailCommandInput = {
        Source: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        Destination: {
          ToAddresses: [to]
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8'
          },
          Body: {
            Text: {
              Data: body,
              Charset: 'UTF-8'
            }
          }
        }
      };

      // Add HTML version if provided
      if (html) {
        params.Message!.Body!.Html = {
          Data: html,
          Charset: 'UTF-8'
        };
      }

      // Add reply-to if specified
      if (options.replyTo) {
        params.ReplyToAddresses = [options.replyTo];
      }

      const command = new SendEmailCommand(params);
      const result = await this.client.send(command);

      logger.info('SES email sent', {
        to,
        subject,
        messageId: result.MessageId
      });

      return {
        success: true,
        externalMessageId: result.MessageId
      };

    } catch (error: any) {
      logger.error('SES email failed', {
        to,
        subject,
        error: error.message,
        code: error.name
      });

      // Handle throttling
      if (error.name === 'ThrottlingException') {
        this.rateLimitDelay *= 2; // Exponential backoff
        logger.warn('SES throttling hit, increasing delay', { newDelay: this.rateLimitDelay });
      }

      return {
        success: false,
        error: error.message
      };
    }
  }
}