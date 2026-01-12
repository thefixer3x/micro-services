/**
 * Global Error Handler
 */

import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  details?: any;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const logger = (req as any).logger;

  // Log the error
  logger?.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    code: err.code,
    requestId: req.id,
    path: req.path,
    method: req.method,
  });

  // Determine status code
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = statusCode === 500
    ? 'An unexpected error occurred'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: err.details,
    },
    meta: {
      requestId: req.id,
    },
  });
}

/**
 * Create an API error
 */
export function createError(
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
): AppError {
  const error = new Error(message) as AppError;
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

/**
 * Async route handler wrapper
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
