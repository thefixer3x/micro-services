/**
 * Base application error
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', code: string = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', code: string = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', code: string = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', code: string = 'CONFLICT') {
    super(message, 409, code);
  }
}

/**
 * Validation Error (422)
 */
export class ValidationError extends AppError {
  public readonly errors: any[];

  constructor(message: string = 'Validation failed', errors: any[] = []) {
    super(message, 422, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', code: string = 'INTERNAL_ERROR') {
    super(message, 500, code);
  }
}

/**
 * Service Unavailable Error (503)
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service unavailable', code: string = 'SERVICE_UNAVAILABLE') {
    super(message, 503, code);
  }
}

/**
 * Error handler middleware for Express
 */
export function errorHandlerMiddleware() {
  return (err: any, req: any, res: any, next: any) => {
    // Log error
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
    });

    // Handle AppError
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
        ...(err instanceof ValidationError && { errors: err.errors }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      });
    }

    // Handle unknown errors
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  };
}
