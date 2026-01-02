import { Router, Response } from 'express';
import { body } from 'express-validator';
import { AuthService } from '../services/authService';
import twoFactorService from '../services/twoFactorService';
import sessionService from '../services/sessionService';
import { AuthenticatedRequest } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { logRequest } from '../utils/logger';
import { setLanguageFromUser } from '../middleware/auth';
import {
  validateRegistration,
  validateLogin,
  handleValidationErrors
} from '../utils/validation';
import { t } from '../utils/i18n';

export const authRoutes = Router();
const authService = new AuthService();

// Add middleware
authRoutes.use(logRequest);
authRoutes.use(setLanguageFromUser);

/**
 * @route POST /api/v1/auth/register
 * @description Register a new user
 * @access Public
 */
authRoutes.post('/register', 
  validateRegistration(),
  handleValidationErrors,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await authService.register(req.body);
    
    res.status(201).json({
      success: true,
      message: t('auth.registration_successful'),
      data: result
    });
  })
);

/**
 * @route POST /api/v1/auth/login
 * @description Login user
 * @access Public
 */
authRoutes.post('/login',
  validateLogin(),
  handleValidationErrors,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await authService.login(req.body);
    
    res.json({
      success: true,
      message: t('auth.login_successful'),
      data: result
    });
  })
);

/**
 * @route POST /api/v1/auth/logout
 * @description Logout user
 * @access Private
 */
authRoutes.post('/logout',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const refreshToken = req.body.refresh_token;
    const userId = req.user?.user_id;
    
    if (refreshToken && userId) {
      await authService.logout(userId, refreshToken);
    }
    
    res.json({
      success: true,
      message: t('auth.logout_successful')
    });
  })
);

/**
 * @route POST /api/v1/auth/refresh
 * @description Refresh access token
 * @access Public
 */
authRoutes.post('/refresh',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }
    
    const result = await authService.refreshAccessToken(refresh_token);
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: result
    });
  })
);

/**
 * @route POST /api/v1/auth/2fa/enable
 * @description Enable two-factor authentication
 * @access Private
 */
authRoutes.post('/2fa/enable',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.user_id;
    const email = req.user?.email;

    if (!userId || !email) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // Check if 2FA is already enabled
    const status = await twoFactorService.get2FAStatus(userId);
    if (status.enabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled',
        code: '2FA_ALREADY_ENABLED'
      });
    }

    // Generate secret and backup codes
    const { secret, otpauthUrl, backupCodes } = await twoFactorService.enable2FA(userId, email);

    res.json({
      success: true,
      message: '2FA setup initiated. Please verify with the code from your authenticator app.',
      data: {
        secret,
        otpauth_url: otpauthUrl,
        backup_codes: backupCodes
      }
    });
  })
);

/**
 * @route POST /api/v1/auth/2fa/confirm
 * @description Confirm 2FA setup with initial code
 * @access Private
 */
authRoutes.post('/2fa/confirm',
  authenticateToken,
  [
    body('code').isString().isLength({ min: 6, max: 6 }).matches(/^\d+$/)
      .withMessage('Code must be 6 digits')
  ],
  handleValidationErrors,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.user_id;
    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const confirmed = await twoFactorService.confirm2FA(userId, code);

    if (!confirmed) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code',
        code: 'INVALID_2FA_CODE'
      });
    }

    // Log security event
    await sessionService.logSecurityEvent({
      userId,
      eventType: '2fa_enabled',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: '2FA has been enabled successfully'
    });
  })
);

/**
 * @route POST /api/v1/auth/2fa/verify
 * @description Verify 2FA code during login
 * @access Public (with pending auth)
 */
authRoutes.post('/2fa/verify',
  [
    body('user_id').isUUID().withMessage('Valid user ID required'),
    body('code').isString().isLength({ min: 6, max: 10 })
      .withMessage('Code must be 6-10 characters')
  ],
  handleValidationErrors,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { user_id, code } = req.body;

    const isValid = await twoFactorService.verify2FALogin(user_id, code);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA code',
        code: 'INVALID_2FA_CODE'
      });
    }

    res.json({
      success: true,
      message: '2FA verification successful',
      data: { verified: true }
    });
  })
);

/**
 * @route POST /api/v1/auth/2fa/disable
 * @description Disable two-factor authentication
 * @access Private
 */
authRoutes.post('/2fa/disable',
  authenticateToken,
  [
    body('code').isString().isLength({ min: 6, max: 10 })
      .withMessage('Valid 2FA code required'),
    body('password').isString().withMessage('Password required')
  ],
  handleValidationErrors,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.user_id;
    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // Verify 2FA code before disabling
    const isValid = await twoFactorService.verify2FALogin(userId, code);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA code',
        code: 'INVALID_2FA_CODE'
      });
    }

    await twoFactorService.disable2FA(userId);

    // Log security event
    await sessionService.logSecurityEvent({
      userId,
      eventType: '2fa_disabled',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: '2FA has been disabled'
    });
  })
);

/**
 * @route GET /api/v1/auth/2fa/status
 * @description Get 2FA status
 * @access Private
 */
authRoutes.get('/2fa/status',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const status = await twoFactorService.get2FAStatus(userId);

    res.json({
      success: true,
      data: {
        enabled: status.enabled,
        verified_at: status.verifiedAt,
        backup_codes_remaining: status.backupCodesRemaining
      }
    });
  })
);

/**
 * @route POST /api/v1/auth/2fa/backup-codes/regenerate
 * @description Regenerate backup codes
 * @access Private
 */
authRoutes.post('/2fa/backup-codes/regenerate',
  authenticateToken,
  [
    body('code').isString().isLength({ min: 6, max: 10 })
      .withMessage('Valid 2FA code required')
  ],
  handleValidationErrors,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.user_id;
    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // Verify current 2FA code
    const isValid = await twoFactorService.verify2FALogin(userId, code);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA code',
        code: 'INVALID_2FA_CODE'
      });
    }

    const backupCodes = await twoFactorService.regenerateBackupCodes(userId);

    res.json({
      success: true,
      message: 'Backup codes regenerated. Store these securely.',
      data: { backup_codes: backupCodes }
    });
  })
);

// ========================================================================
// Session Management Endpoints
// ========================================================================

/**
 * @route GET /api/v1/auth/sessions
 * @description Get all active sessions
 * @access Private
 */
authRoutes.get('/sessions',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const sessions = await sessionService.getActiveSessions(userId);

    res.json({
      success: true,
      data: sessions.map(session => ({
        id: session.id,
        device_name: session.deviceName || 'Unknown Device',
        device_type: session.deviceType,
        ip_address: session.ipAddress,
        location: session.location,
        last_activity: session.lastActivityAt,
        created_at: session.createdAt
      }))
    });
  })
);

/**
 * @route DELETE /api/v1/auth/sessions/:sessionId
 * @description Revoke a specific session
 * @access Private
 */
authRoutes.delete('/sessions/:sessionId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.user_id;
    const { sessionId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const revoked = await sessionService.revokeSession(userId, sessionId);

    if (!revoked) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  })
);

/**
 * @route POST /api/v1/auth/sessions/revoke-all
 * @description Revoke all sessions except current
 * @access Private
 */
authRoutes.post('/sessions/revoke-all',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // Get current token hash from the refresh token if provided
    const currentTokenHash = req.body.current_token_hash || '';
    const count = await sessionService.revokeAllOtherSessions(userId, currentTokenHash);

    res.json({
      success: true,
      message: `${count} session(s) revoked`,
      data: { revoked_count: count }
    });
  })
);

/**
 * @route GET /api/v1/auth/security-events
 * @description Get recent security events
 * @access Private
 */
authRoutes.get('/security-events',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.user_id;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const events = await sessionService.getSecurityEvents(userId, Math.min(limit, 100));

    res.json({
      success: true,
      data: events
    });
  })
);

// ========================================================================
// Trusted Devices Endpoints
// ========================================================================

/**
 * @route GET /api/v1/auth/trusted-devices
 * @description Get all trusted devices
 * @access Private
 */
authRoutes.get('/trusted-devices',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const devices = await sessionService.getTrustedDevices(userId);

    res.json({
      success: true,
      data: devices
    });
  })
);

/**
 * @route POST /api/v1/auth/trusted-devices
 * @description Trust current device
 * @access Private
 */
authRoutes.post('/trusted-devices',
  authenticateToken,
  [
    body('device_id').isString().withMessage('Device ID required'),
    body('device_name').optional().isString()
  ],
  handleValidationErrors,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.user_id;
    const { device_id, device_name, device_fingerprint } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    await sessionService.trustDevice(userId, device_id, device_name, device_fingerprint);

    res.json({
      success: true,
      message: 'Device trusted successfully'
    });
  })
);

/**
 * @route DELETE /api/v1/auth/trusted-devices/:deviceId
 * @description Remove trusted device
 * @access Private
 */
authRoutes.delete('/trusted-devices/:deviceId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.user_id;
    const { deviceId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const removed = await sessionService.untrustDevice(userId, deviceId);

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
        code: 'DEVICE_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Device removed from trusted list'
    });
  })
);