import { config } from 'dotenv';

// Load environment variables first
config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './controllers/authController';
import { userRoutes } from './controllers/userController';
import { kycRoutes } from './controllers/kycController';
import { biometricRoutes } from './controllers/biometricController';
import pinRoutes from './controllers/pinController';
import securityQuestionsRoutes from './controllers/securityQuestionsController';
import { initializeDatabase } from './database/connection';
import { initializeI18n } from './utils/i18n';
import { NotificationService } from './services/notificationService';
import { NotificationEventConsumer } from './consumers/NotificationEventConsumer';

const app = express();
const server = createServer(app);

// Initialize services
async function initializeServices() {
  try {
    await initializeDatabase();
    await initializeI18n();
    
    // Initialize notification service and event consumer
    const notificationService = new NotificationService();
    const notificationEventConsumer = new NotificationEventConsumer(notificationService);
    
    // Store references for graceful shutdown
    (global as any).notificationEventConsumer = notificationEventConsumer;
    
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
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'identity-service',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Prometheus metrics endpoint
import { register } from './utils/metrics';
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end();
  }
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/kyc', kycRoutes);
app.use('/api/v1/biometric', biometricRoutes);
app.use('/api/v1/pin', pinRoutes);
app.use('/api/v1/security-questions', securityQuestionsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND'
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  // Stop the notification event consumer
  const notificationEventConsumer = (global as any).notificationEventConsumer;
  if (notificationEventConsumer) {
    try {
      await notificationEventConsumer.stop();
      logger.info('Notification event consumer stopped');
    } catch (error) {
      logger.error('Error stopping notification event consumer:', error);
    }
  }
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

async function startServer() {
  try {
    await initializeServices();
    
    // Start the notification event consumer
    const notificationEventConsumer = (global as any).notificationEventConsumer;
    if (notificationEventConsumer) {
      await notificationEventConsumer.start();
    }
    
    server.listen(PORT, () => {
      logger.info(`Identity Service running on ${HOST}:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
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