import { UserRepository } from '../repositories/userRepository';
import { User, RegisterRequest, LoginRequest, AuthResponse } from '../types';
import { hashPassword, comparePassword } from '../utils/password';
import { generateTokens, verifyRefreshToken, generateRefreshTokenHash } from '../utils/jwt';
import { createError } from '../middleware/errorHandler';
import { t } from '../utils/i18n';
import { logger } from '../utils/logger';
import { getDatabase } from '../database/connection';

export class AuthService {
  private userRepository: UserRepository;
  private db = getDatabase();

  constructor() {
    this.userRepository = new UserRepository();
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(data.email);
      if (existingUser) {
        throw createError(t('auth.user_already_exists'), 409, 'USER_EXISTS');
      }

      // Check phone if provided
      if (data.phone) {
        const existingPhoneUser = await this.userRepository.findByPhone(data.phone);
        if (existingPhoneUser) {
          throw createError(t('auth.user_already_exists'), 409, 'PHONE_EXISTS');
        }
      }

      // Hash password
      const passwordHash = await hashPassword(data.password);

      // Create user
      const user = await this.userRepository.create({
        email: data.email,
        phone: data.phone || undefined,
        password_hash: passwordHash,
        account_type: data.account_type,
        language: data.language || undefined
      });

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user);

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken);

      // Activate user account (for MVP - in production, this might require email verification)
      await this.userRepository.updateStatus(user.id, 'active');
      user.status = 'active';

      logger.info(`User registered successfully: ${user.email}`, { userId: user.id });

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 900, // 15 minutes
        user: this.sanitizeUser(user)
      };
    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    }
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      // Find user by email or phone
      let user: User | null = null;
      
      if (data.username.includes('@')) {
        user = await this.userRepository.findByEmail(data.username);
      } else {
        user = await this.userRepository.findByPhone(data.username);
      }

      if (!user) {
        throw createError(t('auth.invalid_credentials'), 401, 'INVALID_CREDENTIALS');
      }

      // Verify password
      const isValidPassword = await comparePassword(data.password, user.password_hash);
      if (!isValidPassword) {
        throw createError(t('auth.invalid_credentials'), 401, 'INVALID_CREDENTIALS');
      }

      // Check account status
      if (user.status !== 'active') {
        throw createError('Account is not active', 403, 'ACCOUNT_INACTIVE');
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user);

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken, data.device_id);

      logger.info(`User logged in successfully: ${user.email}`, { 
        userId: user.id,
        deviceId: data.device_id 
      });

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 900, // 15 minutes
        user: this.sanitizeUser(user)
      };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      // Remove refresh token
      const tokenHash = generateRefreshTokenHash(refreshToken);
      
      await this.db.query(
        'DELETE FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2',
        [userId, tokenHash]
      );

      logger.info('User logged out successfully', { userId });
    } catch (error) {
      logger.error('Logout failed:', error);
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
    try {
      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);
      
      // Check if refresh token exists in database
      const tokenHash = generateRefreshTokenHash(refreshToken);
      const result = await this.db.query(
        'SELECT * FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
        [decoded.user_id, tokenHash]
      );

      if (result.rows.length === 0) {
        throw createError(t('auth.token_expired'), 401, 'INVALID_REFRESH_TOKEN');
      }

      // Get user
      const user = await this.userRepository.findById(decoded.user_id);
      if (!user || user.status !== 'active') {
        throw createError(t('auth.unauthorized'), 401, 'ACCOUNT_INACTIVE');
      }

      // Generate new access token
      const { accessToken } = generateTokens(user);

      return {
        access_token: accessToken,
        expires_in: 900 // 15 minutes
      };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw error;
    }
  }

  private async storeRefreshToken(
    userId: string, 
    refreshToken: string, 
    deviceId?: string
  ): Promise<void> {
    try {
      const tokenHash = generateRefreshTokenHash(refreshToken);
      const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days

      await this.db.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, device_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, tokenHash, deviceId, expiresAt]
      );

      // Clean up expired tokens for this user
      await this.db.query(
        'DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at <= NOW()',
        [userId]
      );
    } catch (error) {
      logger.error('Error storing refresh token:', error);
      throw error;
    }
  }

  private sanitizeUser(user: User): Omit<User, 'password_hash'> & { profile?: any } {
    const { password_hash, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}