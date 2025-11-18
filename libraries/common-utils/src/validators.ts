import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errors';

/**
 * Validation middleware to check for errors
 */
export function validate() {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map(err => ({
        field: err.type === 'field' ? (err as any).path : undefined,
        message: err.msg,
      }));

      throw new ValidationError('Validation failed', formattedErrors);
    }

    next();
  };
}

/**
 * Common validators
 */
export const validators = {
  // Email validation
  email: (field: string = 'email') =>
    body(field)
      .isEmail()
      .withMessage('Must be a valid email address')
      .normalizeEmail(),

  // UUID validation
  uuid: (field: string = 'id', location: 'body' | 'param' | 'query' = 'param') => {
    const validator = location === 'body' ? body(field) : location === 'query' ? query(field) : param(field);
    return validator.isUUID().withMessage(`${field} must be a valid UUID`);
  },

  // Required string
  requiredString: (field: string, minLength: number = 1, maxLength?: number) => {
    let validator = body(field)
      .trim()
      .notEmpty()
      .withMessage(`${field} is required`)
      .isLength({ min: minLength })
      .withMessage(`${field} must be at least ${minLength} characters`);

    if (maxLength) {
      validator = validator.isLength({ max: maxLength })
        .withMessage(`${field} must not exceed ${maxLength} characters`);
    }

    return validator;
  },

  // Optional string
  optionalString: (field: string, minLength?: number, maxLength?: number) => {
    let validator = body(field).optional().trim();

    if (minLength) {
      validator = validator.isLength({ min: minLength })
        .withMessage(`${field} must be at least ${minLength} characters`);
    }

    if (maxLength) {
      validator = validator.isLength({ max: maxLength })
        .withMessage(`${field} must not exceed ${maxLength} characters`);
    }

    return validator;
  },

  // Number validation
  number: (field: string, min?: number, max?: number) => {
    let validator = body(field)
      .isNumeric()
      .withMessage(`${field} must be a number`);

    if (min !== undefined) {
      validator = validator.custom(value => {
        if (parseFloat(value) < min) {
          throw new Error(`${field} must be at least ${min}`);
        }
        return true;
      });
    }

    if (max !== undefined) {
      validator = validator.custom(value => {
        if (parseFloat(value) > max) {
          throw new Error(`${field} must not exceed ${max}`);
        }
        return true;
      });
    }

    return validator;
  },

  // Phone number validation
  phoneNumber: (field: string = 'phoneNumber') =>
    body(field)
      .isMobilePhone('any')
      .withMessage('Must be a valid phone number'),

  // Date validation
  date: (field: string) =>
    body(field)
      .isISO8601()
      .withMessage(`${field} must be a valid ISO 8601 date`),

  // Boolean validation
  boolean: (field: string) =>
    body(field)
      .isBoolean()
      .withMessage(`${field} must be a boolean`),

  // Enum validation
  enum: (field: string, allowedValues: string[]) =>
    body(field)
      .isIn(allowedValues)
      .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`),
};

export { body, param, query };
