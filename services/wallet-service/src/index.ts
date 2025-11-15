import { config } from 'dotenv';

// Load environment variables first
config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { walletRoutes } from './controllers/walletController';
import { initializeDatabase } from './database/connection';

const app = express();
const server = createServer(app);

// Initialize services
async function initializeServices() {
  try {
    await initializeDatabase();
    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourplatform.com']
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8000'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'wallet-service',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/v1', walletRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || 'localhost';

async function startServer() {
  try {
    await initializeServices();

    server.listen(PORT, () => {
      logger.info(`Wallet Service running on ${HOST}:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Default Provider: ${process.env.DEFAULT_WALLET_PROVIDER || 'providus'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export { app };
