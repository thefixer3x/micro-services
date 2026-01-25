import axios, { AxiosInstance } from 'axios';
import { SMSProviderExtended, SMSDeliveryResult } from '../types';
import { logger } from '../../utils/logger';

interface TermiiResponse {
  message_id?: string;
  message?: string;
  balance?: number;
  status?: string;
  user?: string;
}

export class TermiiProvider implements SMSProviderExtended {
  name = 'termii';
  private client: AxiosInstance;
  private rateLimitDelay = 1000; // 1 second between requests
  private lastRequestTime = 0;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Termii API key is required');
    }

    this.client = axios.create({
      baseURL: 'https://api.ng.termii.com/api',
      headers: {
        'Content-Type': 'application/json'
      }
    });
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

      // Format Nigerian phone numbers
      const formattedPhone = this.formatNigerianPhone(phone);

      // Determine channel based on message type or explicit option
      const channel = this.determineChannel(message);

      const payload = {
        to: formattedPhone,
        from: options.senderId || 'Grizzen',
        sms: message,
        type: 'plain',
        channel: channel,
        api_key: process.env.TERMII_API_KEY
      };

      const response = await this.client.post('/sms/send', payload);
      const data: TermiiResponse = response.data;

      if (data.message_id) {
        logger.info('Termii SMS sent', {
          to: formattedPhone,
          channel,
          messageId: data.message_id
        });

        return {
          success: true,
          externalMessageId: data.message_id
        };
      } else {
        throw new Error(data.message || 'Unknown error from Termii');
      }

    } catch (error: any) {
      logger.error('Termii SMS failed', {
        to: phone,
        error: error.message,
        response: error.response?.data
      });

      // Handle rate limiting
      if (error.response?.status === 429) {
        this.rateLimitDelay *= 2; // Exponential backoff
        logger.warn('Termii rate limit hit, increasing delay', { newDelay: this.rateLimitDelay });
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  private formatNigerianPhone(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle different Nigerian number formats
    if (cleaned.startsWith('234')) {
      return cleaned; // Already in international format
    } else if (cleaned.startsWith('0')) {
      return '234' + cleaned.slice(1); // Convert 080... to 23480...
    } else if (cleaned.length === 10) {
      return '234' + cleaned; // Assume it's 80... format
    }

    // For non-Nigerian numbers, return as-is
    return phone;
  }

  private determineChannel(message: string): 'generic' | 'dnd' | 'whatsapp' {
    // Simple logic - in production, you might want more sophisticated detection
    // For now, use generic for most messages, dnd for transactional
    if (message.toLowerCase().includes('otp') ||
        message.toLowerCase().includes('code') ||
        message.toLowerCase().includes('verification')) {
      return 'dnd'; // DND channel for OTP/transactional messages
    }

    return 'generic'; // Generic channel for marketing/promotional
  }
}