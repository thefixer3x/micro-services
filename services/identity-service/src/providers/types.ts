// Extended Provider Interfaces with Tracking Support
// These interfaces extend the basic provider interfaces with delivery tracking capabilities

export interface EmailDeliveryResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
}

export interface SMSDeliveryResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
}

export interface PushDeliveryResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
  invalidTokens?: string[];
}

export interface PushBatchResult {
  results: PushDeliveryResult[];
  successCount: number;
  failureCount: number;
  invalidTokens?: string[];
}

// Extended Email Provider Interface
export interface EmailProviderExtended {
  name: string;
  sendWithTracking(
    to: string,
    subject: string,
    body: string,
    html?: string,
    options?: {
      replyTo?: string;
      senderName?: string;
    }
  ): Promise<EmailDeliveryResult>;
}

// Extended SMS Provider Interface
export interface SMSProviderExtended {
  name: string;
  sendWithTracking(
    phone: string,
    message: string,
    options?: {
      senderId?: string;
    }
  ): Promise<SMSDeliveryResult>;
}

// Extended Push Provider Interface
export interface PushProviderExtended {
  name: string;
  sendBatch(
    notifications: Array<{
      token: string;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    }>
  ): Promise<PushBatchResult>;
}