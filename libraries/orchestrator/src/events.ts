/**
 * Event Emitter
 *
 * Publishes events to Kafka for webhook delivery and other consumers.
 * Uses the outbox pattern for reliability.
 */

import { Kafka, Producer } from 'kafkajs';

export interface WebhookEvent {
  type: string;
  sourceType: string;
  sourceId: string;
  payload: any;
  projectId?: string;
}

interface EventEmitterOptions {
  kafkaBrokers: string[];
  clientId: string;
  topic?: string;
}

export class EventEmitter {
  private producer: Producer;
  private db: any;
  private topic: string;
  private isConnected: boolean = false;

  constructor(db: any, kafka: Kafka, options: { topic?: string } = {}) {
    this.db = db;
    this.producer = kafka.producer();
    this.topic = options.topic ?? 'webhook-events';
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.producer.connect();
      this.isConnected = true;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.producer.disconnect();
      this.isConnected = false;
    }
  }

  /**
   * Emit an event using the outbox pattern
   *
   * 1. Store in webhook_events table (outbox)
   * 2. Publish to Kafka for async processing
   */
  async emit(event: WebhookEvent): Promise<string> {
    // 1. Store in outbox
    const eventId = await this.storeEvent(event);

    // 2. Publish to Kafka
    try {
      await this.connect();
      await this.producer.send({
        topic: this.topic,
        messages: [
          {
            key: event.sourceId,
            value: JSON.stringify({
              eventId,
              ...event,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      });
    } catch (error) {
      console.error('Failed to publish event to Kafka:', error);
      // Event is still in outbox, will be picked up by polling worker
    }

    return eventId;
  }

  /**
   * Store event in outbox table
   */
  private async storeEvent(event: WebhookEvent): Promise<string> {
    const result = await this.db.query(
      `
      INSERT INTO webhook_events
      (event_type, source_type, source_id, payload)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [event.type, event.sourceType, event.sourceId, JSON.stringify(event.payload)]
    );

    return result.rows[0].id;
  }

  /**
   * Create deliveries for an event
   * Called by webhook worker after receiving event from Kafka
   */
  async createDeliveries(eventId: string, projectId: string): Promise<number> {
    // Get event details
    const eventResult = await this.db.query(
      `SELECT event_type FROM webhook_events WHERE id = $1`,
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      throw new Error(`Event ${eventId} not found`);
    }

    const eventType = eventResult.rows[0].event_type;

    // Find matching endpoints
    const endpointsResult = await this.db.query(
      `
      SELECT id, retry_count
      FROM webhook_endpoints
      WHERE project_id = $1
        AND status = 'active'
        AND (events = '{}' OR $2 = ANY(events))
      `,
      [projectId, eventType]
    );

    // Create deliveries
    for (const endpoint of endpointsResult.rows) {
      await this.db.query(
        `
        INSERT INTO webhook_deliveries
        (endpoint_id, event_id, max_attempts, next_retry_at)
        VALUES ($1, $2, $3, NOW())
        `,
        [endpoint.id, eventId, endpoint.retry_count || 5]
      );
    }

    // Mark event as processed
    await this.db.query(
      `UPDATE webhook_events SET processed = TRUE, processed_at = NOW() WHERE id = $1`,
      [eventId]
    );

    return endpointsResult.rows.length;
  }

  /**
   * Helper to emit common event types
   */
  async emitTransferEvent(
    projectId: string,
    transferId: string,
    status: 'completed' | 'failed' | 'pending' | 'reversed',
    transfer: any
  ): Promise<string> {
    return this.emit({
      type: `transfer.${status}`,
      sourceType: 'transfer',
      sourceId: transferId,
      projectId,
      payload: {
        id: transferId,
        status,
        ...transfer,
      },
    });
  }

  async emitPaymentEvent(
    projectId: string,
    paymentId: string,
    status: 'successful' | 'failed' | 'pending',
    payment: any
  ): Promise<string> {
    return this.emit({
      type: `payment.${status}`,
      sourceType: 'payment',
      sourceId: paymentId,
      projectId,
      payload: {
        id: paymentId,
        status,
        ...payment,
      },
    });
  }

  async emitWalletEvent(
    projectId: string,
    walletId: string,
    action: 'created' | 'credited' | 'debited' | 'frozen' | 'unfrozen',
    wallet: any
  ): Promise<string> {
    return this.emit({
      type: `wallet.${action}`,
      sourceType: 'wallet',
      sourceId: walletId,
      projectId,
      payload: {
        id: walletId,
        action,
        ...wallet,
      },
    });
  }

  async emitVerificationEvent(
    projectId: string,
    verificationId: string,
    status: 'verified' | 'failed',
    verification: any
  ): Promise<string> {
    return this.emit({
      type: `kyc.${status}`,
      sourceType: 'verification',
      sourceId: verificationId,
      projectId,
      payload: {
        id: verificationId,
        status,
        ...verification,
      },
    });
  }
}

export default EventEmitter;
