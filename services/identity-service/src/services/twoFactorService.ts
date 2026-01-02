import crypto from 'crypto';
import { getDatabase } from '../database/connection';
import { logger } from '../utils/logger';

const TOTP_WINDOW = 1; // Allow 1 step before/after for clock drift
const TOTP_STEP = 30; // 30 second window
const BACKUP_CODE_COUNT = 10;

export class TwoFactorService {
  private db = getDatabase();

  /**
   * Generate a new TOTP secret for a user
   */
  generateSecret(email: string): { secret: string; otpauthUrl: string } {
    // Generate 20-byte secret (160 bits)
    const buffer = crypto.randomBytes(20);
    const secret = this.base32Encode(buffer);

    // Create otpauth URL for QR code
    const issuer = encodeURIComponent(process.env.APP_NAME || 'MicroServices');
    const accountName = encodeURIComponent(email);
    const otpauthUrl = `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=${TOTP_STEP}`;

    return { secret, otpauthUrl };
  }

  /**
   * Generate backup codes for account recovery
   */
  generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      // Generate 8-character alphanumeric codes
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  /**
   * Verify a TOTP code
   */
  verifyToken(secret: string, token: string): boolean {
    if (!token || token.length !== 6 || !/^\d+$/.test(token)) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);

    // Check current window and adjacent windows for clock drift
    for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
      const counter = Math.floor((now + i * TOTP_STEP) / TOTP_STEP);
      const expectedToken = this.generateTOTP(secret, counter);

      if (expectedToken === token) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate TOTP token for a given counter
   */
  private generateTOTP(secret: string, counter: number): string {
    const buffer = Buffer.alloc(8);
    for (let i = 7; i >= 0; i--) {
      buffer[i] = counter & 0xff;
      counter = Math.floor(counter / 256);
    }

    const decodedSecret = this.base32Decode(secret);
    const hmac = crypto.createHmac('sha1', decodedSecret);
    hmac.update(buffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0xf;
    const code = (
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)
    ) % 1000000;

    return code.toString().padStart(6, '0');
  }

  /**
   * Enable 2FA for a user
   */
  async enable2FA(userId: string, email: string): Promise<{
    secret: string;
    otpauthUrl: string;
    backupCodes: string[];
  }> {
    const { secret, otpauthUrl } = this.generateSecret(email);
    const backupCodes = this.generateBackupCodes();

    // Store secret (not yet verified)
    await this.db.query(
      `UPDATE users
       SET totp_secret = $1, backup_codes = $2, backup_codes_generated_at = NOW()
       WHERE id = $3`,
      [secret, backupCodes, userId]
    );

    logger.info('2FA setup initiated', { userId });

    return { secret, otpauthUrl, backupCodes };
  }

  /**
   * Confirm and activate 2FA after user verifies with a code
   */
  async confirm2FA(userId: string, token: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT totp_secret FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].totp_secret) {
      throw new Error('2FA not initialized');
    }

    const secret = result.rows[0].totp_secret;
    const isValid = this.verifyToken(secret, token);

    if (!isValid) {
      return false;
    }

    // Enable 2FA
    await this.db.query(
      `UPDATE users
       SET totp_enabled = TRUE, totp_verified_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    logger.info('2FA enabled successfully', { userId });
    return true;
  }

  /**
   * Disable 2FA for a user
   */
  async disable2FA(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users
       SET totp_secret = NULL, totp_enabled = FALSE, totp_verified_at = NULL,
           backup_codes = NULL, backup_codes_generated_at = NULL
       WHERE id = $1`,
      [userId]
    );

    logger.info('2FA disabled', { userId });
  }

  /**
   * Verify 2FA code during login
   */
  async verify2FALogin(userId: string, token: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT totp_secret, totp_enabled, backup_codes FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];

    if (!user.totp_enabled) {
      throw new Error('2FA not enabled');
    }

    // First try TOTP
    if (this.verifyToken(user.totp_secret, token)) {
      return true;
    }

    // Try backup codes
    if (user.backup_codes && user.backup_codes.length > 0) {
      const codeIndex = user.backup_codes.findIndex(
        (code: string) => code === token.toUpperCase().replace('-', '')
      );

      if (codeIndex !== -1) {
        // Remove used backup code
        const updatedCodes = [...user.backup_codes];
        updatedCodes.splice(codeIndex, 1);

        await this.db.query(
          'UPDATE users SET backup_codes = $1 WHERE id = $2',
          [updatedCodes.length > 0 ? updatedCodes : null, userId]
        );

        logger.warn('Backup code used for 2FA', { userId, remainingCodes: updatedCodes.length });
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user has 2FA enabled
   */
  async is2FAEnabled(userId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT totp_enabled FROM users WHERE id = $1',
      [userId]
    );

    return result.rows.length > 0 && result.rows[0].totp_enabled === true;
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const backupCodes = this.generateBackupCodes();

    await this.db.query(
      `UPDATE users
       SET backup_codes = $1, backup_codes_generated_at = NOW()
       WHERE id = $2`,
      [backupCodes, userId]
    );

    logger.info('Backup codes regenerated', { userId });
    return backupCodes;
  }

  /**
   * Get 2FA status
   */
  async get2FAStatus(userId: string): Promise<{
    enabled: boolean;
    verifiedAt: Date | null;
    backupCodesRemaining: number;
  }> {
    const result = await this.db.query(
      'SELECT totp_enabled, totp_verified_at, backup_codes FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];
    return {
      enabled: user.totp_enabled || false,
      verifiedAt: user.totp_verified_at || null,
      backupCodesRemaining: user.backup_codes?.length || 0
    };
  }

  // Base32 encoding/decoding utilities
  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        bits -= 5;
        result += alphabet[(value >> bits) & 0x1f];
      }
    }

    if (bits > 0) {
      result += alphabet[(value << (5 - bits)) & 0x1f];
    }

    return result;
  }

  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes: number[] = [];
    let bits = 0;
    let value = 0;

    for (const char of encoded.toUpperCase()) {
      const index = alphabet.indexOf(char);
      if (index === -1) continue;

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        bits -= 8;
        bytes.push((value >> bits) & 0xff);
      }
    }

    return Buffer.from(bytes);
  }
}

export default new TwoFactorService();
