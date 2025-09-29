import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, TokenPayload } from '../types';
import { logger } from './logger';

export const generateTokens = (user: User): { accessToken: string; refreshToken: string } => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
  const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  if (!jwtSecret || !jwtRefreshSecret) {
    throw new Error('JWT secrets not configured');
  }

  const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
    user_id: user.id,
    email: user.email,
    account_type: user.account_type,
    status: user.status,
  };

  const accessToken = jwt.sign(payload, jwtSecret, {
    expiresIn: jwtExpiresIn,
    issuer: 'identity-service',
    audience: 'platform-users',
  });

  const refreshToken = jwt.sign(
    { user_id: user.id },
    jwtRefreshSecret,
    {
      expiresIn: jwtRefreshExpiresIn,
      issuer: 'identity-service',
      audience: 'platform-users',
    }
  );

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): TokenPayload => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.verify(token, jwtSecret, {
    issuer: 'identity-service',
    audience: 'platform-users',
  }) as TokenPayload;
};

export const verifyRefreshToken = (token: string): { user_id: string; iat: number; exp: number } => {
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!jwtRefreshSecret) {
    throw new Error('JWT_REFRESH_SECRET not configured');
  }

  return jwt.verify(token, jwtRefreshSecret, {
    issuer: 'identity-service',
    audience: 'platform-users',
  }) as { user_id: string; iat: number; exp: number };
};

export const getTokenExpirationTime = (): number => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  
  // Convert time string to seconds
  const timeValue = parseInt(expiresIn.slice(0, -1));
  const timeUnit = expiresIn.slice(-1);
  
  switch (timeUnit) {
    case 's': return timeValue;
    case 'm': return timeValue * 60;
    case 'h': return timeValue * 3600;
    case 'd': return timeValue * 86400;
    default: return 900; // Default 15 minutes
  }
};

export const generateRefreshTokenHash = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};