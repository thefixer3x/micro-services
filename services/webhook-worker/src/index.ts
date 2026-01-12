/**
 * Webhook Delivery Worker
 *
 * Consumes events from Kafka and delivers them to registered webhook endpoints.
 * Implements retry logic with exponential backoff.
 */

import { Pool } from 'pg';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import Redis from 'ioredis';
import crypto from 'crypto';
import { createLogger, format, transports } from 'winston';
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';
import http from 'http';

// =============================================================================
// Configuration
// =============================================================================

const config = {
  // Kafka
  kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  kafkaGroupId: process.env.KAFKA_GROUP_ID || 'webhook-worker',
  kafkaTopic: process.env.KAFKA_TOPIC || 'webhook-events',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/seftec',

  // Redis (for distributed locking)
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Worker settings
  concurrency: parseInt(process.env.CONCURRENCY || '10'),
  pollingInterval: parseInt(process.env.POLLING_INTERVAL || '5000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '5'),
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),

  // Retry delays in seconds: 1min, 5min, 30min, 2hr, 24hr
  retryDelays: [60, 300, 1800, 7200, 86400],

  // Metrics
  metricsPort: parseInt(process.env.METRICS_PORT || '9091'),
};

// =============================================================================
// Logger
// =============================================================================

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'webhook-worker' },
  transports: [new transports.Console()],
});

// =============================================================================
// Metrics
// =============================================================================

const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

const deliveriesTotal = new Counter({
  name: 'webhook_deliveries_total',
  help: 'Total webhook delivery attempts',
  labelNames: ['status'],
  registers: [metricsRegistry],
});

const deliveryDuration = new Histogram({
  name: 'webhook_delivery_duration_seconds',
  help: 'Webhook delivery duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry],
});

// =============================================================================
// Database
// =============================================================================

const db = new Pool({
  connectionString: config.databaseUrl,
  max: config.concurrency + 5,
});

// =============================================================================
// Redis
// =============================================================================

const redis = new Redis(config.redisUrl);

// =============================================================================
// Kafka
// =============================================================================

const kafka = new Kafka({
  clientId: 'webhook-worker',
  brokers: config.kafkaBrokers,
});

const consumer: Consumer = kafka.consumer({ groupId: config.kafkaGroupId });

// =============================================================================
// Webhook Delivery
// =============================================================================

interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventId: string;
  attemptCount: number;
  maxAttempts: number;
  endpointUrl: string;
  endpointSecret: string;
  signatureHeader: string;
  eventType: string;
  payload: any;
}

/**
 * Sign webhook payload with HMAC
 */
function signPayload(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

/**
 * Deliver a webhook
 */
async function deliverWebhook(delivery: WebhookDelivery): Promise<void> {
  const payloadString = JSON.stringify(delivery.payload);
  const signature = signPayload(payloadString, delivery.endpointSecret);

  const timer = deliveryDuration.startTimer();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeout);

    const response = await fetch(delivery.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [delivery.signatureHeader]: signature,
        'X-Webhook-ID': delivery.id,
        'X-Event-Type': delivery.eventType,
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    timer({ status: response.ok ? 'success' : 'failed' });

    if (response.ok) {
      // Success - mark delivery as complete
      await db.query(
        `
        UPDATE webhook_deliveries
        SET status = 'success',
            last_attempt_at = NOW(),
            last_status_code = $2,
            updated_at = NOW()
        WHERE id = $1
        `,
        [delivery.id, response.status]
      );

      deliveriesTotal.inc({ status: 'success' });
      logger.info('Webhook delivered', {
        deliveryId: delivery.id,
        eventType: delivery.eventType,
        statusCode: response.status,
      });
    } else {
      // Non-2xx response - schedule retry
      const responseBody = await response.text().catch(() => '');
      await scheduleRetry(delivery, response.status, responseBody);
      deliveriesTotal.inc({ status: 'failed' });
    }
  } catch (error: any) {
    timer({ status: 'error' });

    const errorMessage = error.name === 'AbortError'
      ? 'Request timeout'
      : error.message;

    await scheduleRetry(delivery, null, errorMessage);
    deliveriesTotal.inc({ status: 'error' });

    logger.error('Webhook delivery failed', {
      deliveryId: delivery.id,
      error: errorMessage,
    });
  }
}

/**
 * Schedule a retry for failed delivery
 */
async function scheduleRetry(
  delivery: WebhookDelivery,
  statusCode: number | null,
  error: string
): Promise<void> {
  const attempt = delivery.attemptCount + 1;

  if (attempt >= delivery.maxAttempts) {
    // Exhausted all retries
    await db.query(
      `
      UPDATE webhook_deliveries
      SET status = 'exhausted',
          attempt_count = $2,
          last_attempt_at = NOW(),
          last_status_code = $3,
          last_error = $4,
          updated_at = NOW()
      WHERE id = $1
      `,
      [delivery.id, attempt, statusCode, error]
    );

    logger.warn('Webhook delivery exhausted', {
      deliveryId: delivery.id,
      attempts: attempt,
    });
    return;
  }

  // Calculate next retry time
  const delayIndex = Math.min(attempt - 1, config.retryDelays.length - 1);
  const delaySeconds = config.retryDelays[delayIndex];

  await db.query(
    `
    UPDATE webhook_deliveries
    SET attempt_count = $2,
        last_attempt_at = NOW(),
        last_status_code = $3,
        last_error = $4,
        next_retry_at = NOW() + INTERVAL '${delaySeconds} seconds',
        updated_at = NOW()
    WHERE id = $1
    `,
    [delivery.id, attempt, statusCode, error]
  );

  logger.info('Webhook retry scheduled', {
    deliveryId: delivery.id,
    attempt,
    nextRetryIn: `${delaySeconds}s`,
  });
}

/**
 * Process pending deliveries from the database
 */
async function processPendingDeliveries(): Promise<void> {
  // Get deliveries that are due
  const result = await db.query<WebhookDelivery>(
    `
    SELECT
      d.id,
      d.endpoint_id as "endpointId",
      d.event_id as "eventId",
      d.attempt_count as "attemptCount",
      d.max_attempts as "maxAttempts",
      e.url as "endpointUrl",
      e.secret as "endpointSecret",
      e.signature_header as "signatureHeader",
      ev.event_type as "eventType",
      ev.payload
    FROM webhook_deliveries d
    JOIN webhook_endpoints e ON d.endpoint_id = e.id
    JOIN webhook_events ev ON d.event_id = ev.id
    WHERE d.status = 'pending'
      AND (d.next_retry_at IS NULL OR d.next_retry_at <= NOW())
      AND e.status = 'active'
    ORDER BY d.created_at
    LIMIT $1
    FOR UPDATE SKIP LOCKED
    `,
    [config.concurrency]
  );

  if (result.rows.length === 0) {
    return;
  }

  logger.debug(`Processing ${result.rows.length} pending deliveries`);

  // Process in parallel
  await Promise.all(result.rows.map(deliverWebhook));
}

/**
 * Handle incoming Kafka events
 */
async function handleKafkaMessage({ message }: EachMessagePayload): Promise<void> {
  try {
    const value = message.value?.toString();
    if (!value) return;

    const event = JSON.parse(value);
    const { eventId, projectId, type } = event;

    logger.debug('Received event from Kafka', { eventId, type });

    // Create deliveries for all matching endpoints
    const endpointsResult = await db.query(
      `
      SELECT id, retry_count
      FROM webhook_endpoints
      WHERE project_id = $1
        AND status = 'active'
        AND (events = '{}' OR $2 = ANY(events))
      `,
      [projectId, type]
    );

    for (const endpoint of endpointsResult.rows) {
      await db.query(
        `
        INSERT INTO webhook_deliveries (endpoint_id, event_id, max_attempts, next_retry_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT DO NOTHING
        `,
        [endpoint.id, eventId, endpoint.retry_count || config.maxRetries]
      );
    }

    // Mark event as processed
    await db.query(
      `UPDATE webhook_events SET processed = TRUE, processed_at = NOW() WHERE id = $1`,
      [eventId]
    );
  } catch (error) {
    logger.error('Error processing Kafka message', { error });
  }
}

// =============================================================================
// Metrics Server
// =============================================================================

const metricsServer = http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.setHeader('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  } else if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'healthy' }));
  } else {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

// =============================================================================
// Main
// =============================================================================

async function start(): Promise<void> {
  logger.info('Starting webhook worker', { config: { ...config, databaseUrl: '[REDACTED]' } });

  // Start metrics server
  metricsServer.listen(config.metricsPort, () => {
    logger.info(`Metrics server listening on port ${config.metricsPort}`);
  });

  // Connect to Kafka
  await consumer.connect();
  await consumer.subscribe({ topic: config.kafkaTopic, fromBeginning: false });

  logger.info('Connected to Kafka');

  // Start Kafka consumer
  consumer.run({
    eachMessage: handleKafkaMessage,
  });

  // Start polling for pending deliveries
  const pollInterval = setInterval(async () => {
    try {
      await processPendingDeliveries();
    } catch (error) {
      logger.error('Error processing pending deliveries', { error });
    }
  }, config.pollingInterval);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    clearInterval(pollInterval);
    await consumer.disconnect();
    await db.end();
    await redis.quit();
    metricsServer.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('Webhook worker started');
}

start().catch((error) => {
  logger.error('Failed to start webhook worker', { error });
  process.exit(1);
});
