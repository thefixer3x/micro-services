import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, TokenPayload } from '../types';
import { createError } from './errorHandler';
import { t, getLanguageFromHeader, setLanguage } from '../utils/i18n';
import { logger } from '../utils/logger';

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      throw createError(t('auth.token_required'), 401, 'TOKEN_REQUIRED');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured');
      throw createError(t('error.internal_server'), 500, 'CONFIGURATION_ERROR');
    }

    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
    
    // Check if user account is active
    if (decoded.status !== 'active') {
      throw createError(t('auth.unauthorized'), 401, 'ACCOUNT_INACTIVE');
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createError(t('auth.unauthorized'), 401, 'INVALID_TOKEN'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(createError(t('auth.token_expired'), 401, 'TOKEN_EXPIRED'));
    } else {
      next(error);
    }
  }
};

export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (token) {
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret) {
        try {
          const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
          if (decoded.status === 'active') {
            req.user = decoded;
          }
        } catch (error) {
          // Silently ignore token errors for optional auth
          logger.debug('Optional auth token validation failed:', error);
        }
      }
    }

    next();
  } catch (error) {
    // For optional auth, continue even if there's an error
    next();
  }
};

export const requireActiveStatus = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    throw createError(t('auth.unauthorized'), 401, 'UNAUTHORIZED');
  }

  if (req.user.status !== 'active') {
    throw createError(
      'Account is not active', 
      403, 
      'ACCOUNT_INACTIVE'
    );
  }

  next();
};

export const requireKycVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // This would typically check KYC status from database
  // For now, it's a stub that allows all authenticated users
  if (!req.user) {
    throw createError(t('auth.unauthorized'), 401, 'UNAUTHORIZED');
  }

  next();
};

// Language middleware to set user's preferred language
export const setLanguageFromUser = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Get language from user preferences, request header, or use default
  let language = 'en';

  // Priority: URL param > User preference > Accept-Language header > default
  if (req.query.lang && typeof req.query.lang === 'string') {
    language = req.query.lang;
  } else if (req.user?.language) {
    // Would need to fetch from user profile
    language = req.user.language || 'en';
  } else {
    language = getLanguageFromHeader(req.headers['accept-language'] as string);
  }

  req.language = language;
  setLanguage(language);
  next();
};