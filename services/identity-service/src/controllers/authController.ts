import { Router, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
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
 * @description Enable two-factor authentication (Stub)
 * @access Private
 */
authRoutes.post('/2fa/enable',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // This is a stub implementation for 2FA
    // In a real implementation, this would generate TOTP secrets
    
    res.json({
      success: true,
      message: '2FA setup initiated (stub)',
      data: {
        secret: 'JBSWY3DPEHPK3PXP', // Example TOTP secret
        qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        backup_codes: [
          '123456789',
          '987654321',
          '456789123'
        ]
      }
    });
  })
);

/**
 * @route POST /api/v1/auth/2fa/verify
 * @description Verify 2FA code (Stub)
 * @access Private
 */
authRoutes.post('/2fa/verify',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code } = req.body;
    
    // This is a stub implementation
    // In a real implementation, this would verify TOTP codes
    const isValid = code === '123456'; // Stub verification
    
    res.json({
      success: isValid,
      message: isValid ? '2FA verification successful' : '2FA verification failed',
      data: {
        verified: isValid
      }
    });
  })
);