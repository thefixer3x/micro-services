import winston from 'winston';
import { format } from 'winston';
import path from 'path';

const { combine, timestamp, errors, json, simple, printf, colorize } = format;

// Custom format for console output in development
const developmentFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}] ${stack || message}`;
});

// Create logger configuration
const createLogger = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
  const logDir = process.env.LOG_FILE || 'logs/identity-service.log';

  const transports: winston.transport[] = [];

  // Console transport
  if (!isProduction) {
    transports.push(
      new winston.transports.Console({
        format: combine(
          colorize(),
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          errors({ stack: true }),
          developmentFormat
        ),
      })
    );
  }

  // File transport for production
  if (isProduction) {
    transports.push(
      new winston.transports.File({
        filename: path.resolve(logDir),
        format: combine(
          timestamp(),
          errors({ stack: true }),
          json()
        ),
      })
    );
  }

  // Error log file (for all environments)
  transports.push(
    new winston.transports.File({
      filename: path.resolve(path.dirname(logDir || 'logs/error.log'), 'error.log'),
      level: 'error',
      format: combine(
        timestamp(),
        errors({ stack: true }),
        json()
      ),
    })
  );

  return winston.createLogger({
    level: logLevel,
    format: combine(
      errors({ stack: true }),
      timestamp(),
      json()
    ),
    defaultMeta: { 
      service: 'identity-service',
      version: process.env.npm_package_version || '1.0.0'
    },
    transports,
    exceptionHandlers: [
      new winston.transports.File({ 
        filename: path.resolve(path.dirname(logDir || 'logs/exceptions.log'), 'exceptions.log')
      })
    ],
    rejectionHandlers: [
      new winston.transports.File({ 
        filename: path.resolve(path.dirname(logDir || 'logs/rejections.log'), 'rejections.log')
      })
    ],
  });
};

export const logger = createLogger();

// Add request logging helper
export const logRequest = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};