import winston from 'winston';

export interface LoggerConfig {
  serviceName: string;
  level?: string;
  logFile?: string;
  consoleOutput?: boolean;
}

/**
 * Create a logger instance for a service
 */
export function createLogger(config: LoggerConfig): winston.Logger {
  const {
    serviceName,
    level = process.env.LOG_LEVEL || 'info',
    logFile = `logs/${serviceName}.log`,
    consoleOutput = true,
  } = config;

  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  );

  const transports: winston.transport[] = [];

  // Console transport
  if (consoleOutput) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            ({ level, message, timestamp, ...metadata }) => {
              let msg = `${timestamp} [${level}] [${serviceName}]: ${message}`;
              if (Object.keys(metadata).length > 0) {
                msg += ` ${JSON.stringify(metadata)}`;
              }
              return msg;
            }
          )
        ),
      })
    );
  }

  // File transport
  if (logFile) {
    transports.push(
      new winston.transports.File({ filename: logFile }),
      new winston.transports.File({
        filename: `logs/${serviceName}-error.log`,
        level: 'error',
      })
    );
  }

  return winston.createLogger({
    level,
    format: logFormat,
    defaultMeta: { service: serviceName },
    transports,
  });
}
