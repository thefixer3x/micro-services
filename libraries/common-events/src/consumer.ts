import { Kafka, Consumer, EachMessagePayload, ConsumerConfig } from 'kafkajs';
import { EventPayload } from './types';

export interface EventConsumerConfig {
  brokers: string[];
  groupId: string;
  clientId: string;
  serviceName: string;
}

export type EventHandler<T = any> = (event: EventPayload<T>) => Promise<void>;

export class EventConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private serviceName: string;
  private isConnected: boolean = false;
  private handlers: Map<string, EventHandler[]> = new Map();

  constructor(config: EventConsumerConfig) {
    this.serviceName = config.serviceName;

    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      retry: {
        retries: 5,
        initialRetryTime: 300,
        multiplier: 2,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.consumer.connect();
      this.isConnected = true;
      console.log(`[${this.serviceName}] Event consumer connected to Kafka`);
    } catch (error) {
      console.error(`[${this.serviceName}] Failed to connect event consumer:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.consumer.disconnect();
      this.isConnected = false;
      console.log(`[${this.serviceName}] Event consumer disconnected from Kafka`);
    } catch (error) {
      console.error(`[${this.serviceName}] Failed to disconnect event consumer:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to a topic
   */
  async subscribe(topic: string | string[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const topics = Array.isArray(topic) ? topic : [topic];

    await this.consumer.subscribe({
      topics,
      fromBeginning: false,
    });

    console.log(`[${this.serviceName}] Subscribed to topics:`, topics);
  }

  /**
   * Register an event handler
   */
  on<T = any>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    this.handlers.get(eventType)!.push(handler as EventHandler);
    console.log(`[${this.serviceName}] Handler registered for event: ${eventType}`);
  }

  /**
   * Start consuming events
   */
  async start(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Consumer not connected. Call connect() first.');
    }

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });

    console.log(`[${this.serviceName}] Event consumer started`);
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      const event: EventPayload = JSON.parse(message.value!.toString());

      console.log(
        `[${this.serviceName}] Received event:`,
        { eventType: event.eventType, eventId: event.eventId, topic }
      );

      const handlers = this.handlers.get(event.eventType) || [];

      if (handlers.length === 0) {
        console.warn(
          `[${this.serviceName}] No handlers registered for event type: ${event.eventType}`
        );
        return;
      }

      // Execute all handlers for this event type
      await Promise.all(handlers.map(handler => handler(event)));

      console.log(
        `[${this.serviceName}] Event processed successfully:`,
        { eventType: event.eventType, eventId: event.eventId }
      );
    } catch (error) {
      console.error(
        `[${this.serviceName}] Error processing message:`,
        { topic, partition, error }
      );
      // Note: In production, you might want to send to a dead letter queue
      throw error;
    }
  }
}
