/**
 * Seftec Unified Finance API - Facade Service
 *
 * This is the main entry point for external applications.
 * It provides a unified, vendor-agnostic API for:
 * - Wallet management
 * - Transfers
 * - Payments
 * - KYC verification
 * - Webhooks
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import { Kafka } from 'kafkajs';
import Redis from 'ioredis';
import { createLogger, format, transports } from 'winston';
import { collectDefaultMetrics, Registry } from 'prom-client';

// Routes
import { capabilitiesRouter } from './routes/capabilities';
import { walletsRouter } from './routes/wallets';
import { transfersRouter } from './routes/transfers';
import { paymentsRouter } from './routes/payments';
import { kycRouter } from './routes/kyc';
import { webhooksRouter } from './routes/webhooks';

// Middleware
import { authMiddleware } from './middleware/auth';
import { idempotencyMiddleware } from './middleware/idempotency';
import { errorHandler } from './middleware/error-handler';

// =============================================================================
// Configuration
// =============================================================================

const config = {
  port: parseInt(process.env.PORT || '3010'),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/seftec',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Kafka
  kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),

  // Rate limiting
  rateLimitWindowMs: 60 * 1000, // 1 minute
  rateLimitMax: 100,

  // CORS
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
};

// =============================================================================
// Logger
// =============================================================================

const logger = createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'facade-api' },
  transports: [
    new transports.Console({
      format: config.nodeEnv === 'production'
        ? format.json()
        : format.combine(format.colorize(), format.simple()),
    }),
  ],
});

// =============================================================================
// Database
// =============================================================================

const db = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on('error', (err) => {
  logger.error('Unexpected database error', { error: err.message });
});

// =============================================================================
// Redis
// =============================================================================

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on('error', (err) => {
  logger.error('Redis error', { error: err.message });
});

// =============================================================================
// Kafka
// =============================================================================

const kafka = new Kafka({
  clientId: 'facade-api',
  brokers: config.kafkaBrokers,
});

// =============================================================================
// Metrics
// =============================================================================

const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

// =============================================================================
// Express App
// =============================================================================

const app = express();

// Trust proxy (for rate limiting behind load balancer)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: config.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'Idempotency-Key'],
  exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request ID
app.use((req: Request, res: Response, next: NextFunction) => {
  req.id = req.headers['x-request-id'] as string || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      requestId: req.id,
    });
  });

  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use project ID if authenticated, otherwise IP
    return (req as any).projectId || req.ip || 'unknown';
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
      meta: { requestId: req.id },
    });
  },
});

app.use('/v1', limiter);

// =============================================================================
// Health & Metrics Endpoints
// =============================================================================

app.get('/health', async (req: Request, res: Response) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed',
    });
  }
});

app.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

// =============================================================================
// API Routes
// =============================================================================

// Attach dependencies to request
app.use((req: Request, res: Response, next: NextFunction) => {
  (req as any).db = db;
  (req as any).redis = redis;
  (req as any).kafka = kafka;
  (req as any).logger = logger;
  next();
});

// Authentication
app.use('/v1', authMiddleware);

// Idempotency (for POST requests)
app.use('/v1', idempotencyMiddleware);

// API routes
app.use('/v1/capabilities', capabilitiesRouter);
app.use('/v1/wallets', walletsRouter);
app.use('/v1/transfers', transfersRouter);
app.use('/v1/payments', paymentsRouter);
app.use('/v1/kyc', kycRouter);
app.use('/v1/webhooks', webhooksRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`,
    },
    meta: { requestId: req.id },
  });
});

// Error handler
app.use(errorHandler);

// =============================================================================
// Startup
// =============================================================================

async function start() {
  try {
    // Verify database connection
    await db.query('SELECT 1');
    logger.info('Database connected');

    // Start server
    app.listen(config.port, () => {
      logger.info(`Facade API started`, {
        port: config.port,
        env: config.nodeEnv,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.end();
  await redis.quit();
  process.exit(0);
});

start();

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      id?: string;
      projectId?: string;
      apiKeyId?: string;
    }
  }
}

export { app, db, redis, kafka, logger };
