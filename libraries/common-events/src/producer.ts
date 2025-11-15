import { Kafka, Producer, ProducerRecord, RecordMetadata } from 'kafkajs';
import { EventPayload } from './types';
import { v4 as uuidv4 } from 'uuid';

export interface EventProducerConfig {
  brokers: string[];
  clientId: string;
  serviceName: string;
}

export class EventProducer {
  private kafka: Kafka;
  private producer: Producer;
  private serviceName: string;
  private isConnected: boolean = false;

  constructor(config: EventProducerConfig) {
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

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
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
      await this.producer.connect();
      this.isConnected = true;
      console.log(`[${this.serviceName}] Event producer connected to Kafka`);
    } catch (error) {
      console.error(`[${this.serviceName}] Failed to connect event producer:`, error);
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
      await this.producer.disconnect();
      this.isConnected = false;
      console.log(`[${this.serviceName}] Event producer disconnected from Kafka`);
    } catch (error) {
      console.error(`[${this.serviceName}] Failed to disconnect event producer:`, error);
      throw error;
    }
  }

  /**
   * Publish an event
   */
  async publish<T = any>(
    topic: string,
    eventType: string,
    data: T,
    metadata?: Record<string, any>
  ): Promise<RecordMetadata[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    const event: EventPayload<T> = {
      eventId: uuidv4(),
      eventType,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: this.serviceName,
      data,
      metadata,
    };

    const record: ProducerRecord = {
      topic,
      messages: [
        {
          key: event.eventId,
          value: JSON.stringify(event),
          headers: {
            eventType,
            source: this.serviceName,
            timestamp: event.timestamp,
          },
        },
      ],
    };

    try {
      const result = await this.producer.send(record);
      console.log(
        `[${this.serviceName}] Event published:`,
        { eventType, topic, eventId: event.eventId }
      );
      return result;
    } catch (error) {
      console.error(`[${this.serviceName}] Failed to publish event:`, error);
      throw error;
    }
  }

  /**
   * Publish multiple events in a batch
   */
  async publishBatch<T = any>(
    topic: string,
    events: Array<{ eventType: string; data: T; metadata?: Record<string, any> }>
  ): Promise<RecordMetadata[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    const messages = events.map(({ eventType, data, metadata }) => {
      const event: EventPayload<T> = {
        eventId: uuidv4(),
        eventType,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: this.serviceName,
        data,
        metadata,
      };

      return {
        key: event.eventId,
        value: JSON.stringify(event),
        headers: {
          eventType,
          source: this.serviceName,
          timestamp: event.timestamp,
        },
      };
    });

    const record: ProducerRecord = { topic, messages };

    try {
      const result = await this.producer.send(record);
      console.log(
        `[${this.serviceName}] Batch of ${events.length} events published to ${topic}`
      );
      return result;
    } catch (error) {
      console.error(`[${this.serviceName}] Failed to publish batch:`, error);
      throw error;
    }
  }
}

/**
 * UUID generation (can be replaced with a library)
 */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
