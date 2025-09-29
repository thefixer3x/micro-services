import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError, ApiResponse } from '../types';
import { t, getLanguageFromHeader } from '../utils/i18n';

export class AppErrorClass extends Error implements AppError {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (
  message: string, 
  statusCode: number = 500, 
  code: string = 'INTERNAL_ERROR'
): AppError => {
  return new AppErrorClass(message, statusCode, code);
};

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = error.message;
  let isOperational = false;

  // Get user's preferred language
  const language = getLanguageFromHeader(req.headers['accept-language'] as string);

  if (error instanceof AppErrorClass) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    isOperational = error.isOperational;
  }

  // Log the error
  const errorData = {
    message: error.message,
    stack: error.stack,
    statusCode,
    code,
    url: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.user_id,
  };

  if (statusCode >= 500) {
    logger.error('Server Error:', errorData);
  } else {
    logger.warn('Client Error:', errorData);
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = t('error.bad_request');
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = t('auth.unauthorized');
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = t('auth.token_expired');
  } else if (error.message.includes('duplicate key')) {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    message = t('auth.user_already_exists');
  } else if (!isOperational && statusCode === 500) {
    // Don't leak error details for non-operational errors in production
    if (process.env.NODE_ENV === 'production') {
      message = t('error.internal_server');
    }
  }

  const response: ApiResponse = {
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      code,
    }),
  };

  res.status(statusCode).json(response);
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const error = createError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};