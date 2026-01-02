import crypto from 'crypto';
import { getDatabase } from '../database/connection';
import { logger } from '../utils/logger';

interface Session {
  id: string;
  userId: string;
  deviceId: string | null;
  deviceName: string | null;
  deviceType: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  location: string | null;
  isActive: boolean;
  lastActivityAt: Date;
  createdAt: Date;
  expiresAt: Date;
}

interface SecurityEvent {
  userId: string;
  eventType: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  location?: string;
  metadata?: Record<string, unknown>;
  riskScore?: number;
}

export class SessionService {
  private db = getDatabase();

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    refreshTokenHash: string,
    metadata: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      ipAddress?: string;
      userAgent?: string;
      location?: string;
    },
    expiresAt: Date
  ): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO user_sessions (
        user_id, refresh_token_hash, device_id, device_name, device_type,
        ip_address, user_agent, location, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        userId,
        refreshTokenHash,
        metadata.deviceId,
        metadata.deviceName,
        metadata.deviceType,
        metadata.ipAddress,
        metadata.userAgent,
        metadata.location,
        expiresAt
      ]
    );

    logger.info('Session created', { userId, sessionId: result.rows[0].id });
    return result.rows[0].id;
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<Session[]> {
    const result = await this.db.query(
      `SELECT id, user_id, device_id, device_name, device_type,
              ip_address, user_agent, location, is_active,
              last_activity_at, created_at, expires_at
       FROM user_sessions
       WHERE user_id = $1 AND is_active = TRUE AND expires_at > NOW()
       ORDER BY last_activity_at DESC`,
      [userId]
    );

    return result.rows.map(this.mapSession);
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE user_sessions
       SET is_active = FALSE
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [sessionId, userId]
    );

    if (result.rows.length > 0) {
      logger.info('Session revoked', { userId, sessionId });
      await this.logSecurityEvent({
        userId,
        eventType: 'session_revoked',
        metadata: { sessionId }
      });
      return true;
    }

    return false;
  }

  /**
   * Revoke all sessions except current
   */
  async revokeAllOtherSessions(userId: string, currentTokenHash: string): Promise<number> {
    const result = await this.db.query(
      `UPDATE user_sessions
       SET is_active = FALSE
       WHERE user_id = $1 AND refresh_token_hash != $2 AND is_active = TRUE
       RETURNING id`,
      [userId, currentTokenHash]
    );

    const count = result.rows.length;
    if (count > 0) {
      logger.info('All other sessions revoked', { userId, count });
      await this.logSecurityEvent({
        userId,
        eventType: 'all_sessions_revoked',
        metadata: { revokedCount: count }
      });
    }

    return count;
  }

  /**
   * Revoke all sessions (force logout everywhere)
   */
  async revokeAllSessions(userId: string): Promise<number> {
    const result = await this.db.query(
      `UPDATE user_sessions
       SET is_active = FALSE
       WHERE user_id = $1 AND is_active = TRUE
       RETURNING id`,
      [userId]
    );

    const count = result.rows.length;
    logger.warn('All sessions revoked (force logout)', { userId, count });
    await this.logSecurityEvent({
      userId,
      eventType: 'force_logout_all',
      metadata: { revokedCount: count }
    });

    return count;
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(tokenHash: string): Promise<void> {
    await this.db.query(
      `UPDATE user_sessions
       SET last_activity_at = NOW()
       WHERE refresh_token_hash = $1 AND is_active = TRUE`,
      [tokenHash]
    );
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT id FROM trusted_devices
       WHERE user_id = $1 AND device_id = $2 AND is_trusted = TRUE`,
      [userId, deviceId]
    );

    return result.rows.length > 0;
  }

  /**
   * Trust a device
   */
  async trustDevice(
    userId: string,
    deviceId: string,
    deviceName?: string,
    deviceFingerprint?: string
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO trusted_devices (user_id, device_id, device_name, device_fingerprint)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET is_trusted = TRUE, device_name = COALESCE($3, trusted_devices.device_name),
                     last_used_at = NOW()`,
      [userId, deviceId, deviceName, deviceFingerprint]
    );

    logger.info('Device trusted', { userId, deviceId });
    await this.logSecurityEvent({
      userId,
      eventType: 'device_trusted',
      deviceId,
      metadata: { deviceName }
    });
  }

  /**
   * Remove trusted device
   */
  async untrustDevice(userId: string, deviceId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM trusted_devices
       WHERE user_id = $1 AND device_id = $2
       RETURNING id`,
      [userId, deviceId]
    );

    if (result.rows.length > 0) {
      logger.info('Device untrusted', { userId, deviceId });
      await this.logSecurityEvent({
        userId,
        eventType: 'device_untrusted',
        deviceId
      });
      return true;
    }

    return false;
  }

  /**
   * Get all trusted devices
   */
  async getTrustedDevices(userId: string): Promise<Array<{
    id: string;
    deviceId: string;
    deviceName: string | null;
    trustedAt: Date;
    lastUsedAt: Date;
  }>> {
    const result = await this.db.query(
      `SELECT id, device_id, device_name, trusted_at, last_used_at
       FROM trusted_devices
       WHERE user_id = $1 AND is_trusted = TRUE
       ORDER BY last_used_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      deviceId: row.device_id,
      deviceName: row.device_name,
      trustedAt: new Date(row.trusted_at),
      lastUsedAt: new Date(row.last_used_at)
    }));
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    await this.db.query(
      `INSERT INTO security_events (
        user_id, event_type, ip_address, user_agent, device_id,
        location, metadata, risk_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.userId,
        event.eventType,
        event.ipAddress,
        event.userAgent,
        event.deviceId,
        event.location,
        JSON.stringify(event.metadata || {}),
        event.riskScore || 0
      ]
    );
  }

  /**
   * Get recent security events for a user
   */
  async getSecurityEvents(
    userId: string,
    limit: number = 20
  ): Promise<Array<{
    id: string;
    eventType: string;
    ipAddress: string | null;
    location: string | null;
    createdAt: Date;
    metadata: Record<string, unknown>;
  }>> {
    const result = await this.db.query(
      `SELECT id, event_type, ip_address, location, metadata, created_at
       FROM security_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      eventType: row.event_type,
      ipAddress: row.ip_address,
      location: row.location,
      createdAt: new Date(row.created_at),
      metadata: row.metadata || {}
    }));
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM user_sessions
       WHERE expires_at < NOW() OR (is_active = FALSE AND created_at < NOW() - INTERVAL '30 days')
       RETURNING id`
    );

    const count = result.rows.length;
    if (count > 0) {
      logger.info('Cleaned up expired sessions', { count });
    }

    return count;
  }

  private mapSession(row: Record<string, unknown>): Session {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      deviceId: row.device_id as string | null,
      deviceName: row.device_name as string | null,
      deviceType: row.device_type as string | null,
      ipAddress: row.ip_address as string | null,
      userAgent: row.user_agent as string | null,
      location: row.location as string | null,
      isActive: row.is_active as boolean,
      lastActivityAt: new Date(row.last_activity_at as string),
      createdAt: new Date(row.created_at as string),
      expiresAt: new Date(row.expires_at as string)
    };
  }
}

export default new SessionService();
