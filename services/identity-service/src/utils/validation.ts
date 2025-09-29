import { body, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler';
import { t } from './i18n';

// Helper function to handle validation results
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: 'path' in error ? error.path : 'unknown',
      message: error.msg,
      code: 'VALIDATION_ERROR'
    }));
    
    const error = createError(
      'Validation failed',
      400,
      'VALIDATION_ERROR'
    );
    (error as any).validationErrors = validationErrors;
    
    return next(error);
  }
  
  next();
};

// Email validation
export const validateEmail = (): ValidationChain => {
  return body('email')
    .isEmail()
    .withMessage(t('validation.invalid_email'))
    .normalizeEmail()
    .notEmpty()
    .withMessage(t('validation.email_required'));
};

// Password validation
export const validatePassword = (): ValidationChain => {
  return body('password')
    .isLength({ min: 8 })
    .withMessage(t('validation.password_min_length'))
    .notEmpty()
    .withMessage(t('validation.password_required'));
};

// Phone validation (optional)
export const validatePhone = (): ValidationChain => {
  return body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage(t('validation.phone_invalid'));
};

// Account type validation
export const validateAccountType = (): ValidationChain => {
  return body('account_type')
    .isIn(['individual', 'business', 'joint'])
    .withMessage(t('validation.invalid_account_type'))
    .notEmpty()
    .withMessage(t('validation.account_type_required'));
};

// Language validation
export const validateLanguage = (): ValidationChain => {
  return body('language')
    .optional()
    .isIn(['en', 'pcm', 'yo', 'fr'])
    .withMessage('Invalid language');
};

// Login validation
export const validateLogin = (): ValidationChain[] => {
  return [
    body('username')
      .notEmpty()
      .withMessage('Username (email or phone) is required'),
    body('password')
      .notEmpty()
      .withMessage(t('validation.password_required'))
  ];
};

// Registration validation
export const validateRegistration = (): ValidationChain[] => {
  return [
    validateEmail(),
    validatePhone(),
    validatePassword(),
    validateAccountType(),
    validateLanguage()
  ];
};

// Profile update validation
export const validateProfileUpdate = (): ValidationChain[] => {
  return [
    body('first_name')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('First name must be between 1 and 100 characters'),
    body('last_name')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Last name must be between 1 and 100 characters'),
    body('date_of_birth')
      .optional()
      .isISO8601()
      .withMessage('Invalid date format'),
    body('address.street')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Street address too long'),
    body('address.city')
      .optional()
      .isLength({ max: 100 })
      .withMessage('City name too long'),
    body('address.state')
      .optional()
      .isLength({ max: 100 })
      .withMessage('State name too long'),
    body('address.country')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Country name too long'),
    body('address.postal_code')
      .optional()
      .isLength({ max: 20 })
      .withMessage('Postal code too long'),
    validateLanguage()
  ];
};

// KYC document type validation
export const validateKycUpload = (): ValidationChain[] => {
  return [
    body('document_type')
      .isIn(['passport', 'drivers_license', 'national_id'])
      .withMessage(t('kyc.invalid_document_type'))
      .notEmpty()
      .withMessage('Document type is required')
  ];
};

// Biometric enrollment validation
export const validateBiometricEnroll = (): ValidationChain[] => {
  return [
    body('biometric_type')
      .isIn(['fingerprint', 'face', 'voice'])
      .withMessage(t('biometric.invalid_biometric_type'))
      .notEmpty()
      .withMessage('Biometric type is required'),
    body('data')
      .notEmpty()
      .withMessage('Biometric data is required')
      .isBase64()
      .withMessage('Biometric data must be valid base64')
  ];
};

// UUID validation helper
export const isValidUUID = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

// Sanitization helper
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>\"']/g, '');
};