import { Router, Response } from 'express';
import { UserRepository } from '../repositories/userRepository';
import { AuthenticatedRequest } from '../types';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { logRequest } from '../utils/logger';
import { setLanguageFromUser } from '../middleware/auth';
import {
  validateProfileUpdate,
  handleValidationErrors
} from '../utils/validation';
import { t } from '../utils/i18n';

export const userRoutes = Router();
const userRepository = new UserRepository();

// Add middleware
userRoutes.use(logRequest);
userRoutes.use(setLanguageFromUser);
userRoutes.use(authenticateToken); // All user routes require authentication

/**
 * @route GET /api/v1/users/profile
 * @description Get user profile
 * @access Private
 */
userRoutes.get('/profile',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.user_id;
    
    const user = await userRepository.findById(userId);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: t('profile.not_found'),
        code: 'USER_NOT_FOUND'
      });
      return;
    }
    
    // Remove sensitive data
    const { password_hash, ...userProfile } = user;
    
    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: userProfile
    });
  })
);

/**
 * @route PUT /api/v1/users/profile
 * @description Update user profile
 * @access Private
 */
userRoutes.put('/profile',
  validateProfileUpdate(),
  handleValidationErrors,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    
    try {
      const updatedProfile = await userRepository.updateProfile(userId, req.body);
      
      res.json({
        success: true,
        message: t('profile.updated_successfully'),
        data: updatedProfile
      });
    } catch (error: any) {
      if (error.message === 'User profile not found') {
        return res.status(404).json({
          success: false,
          message: t('profile.not_found'),
          code: 'PROFILE_NOT_FOUND'
        });
      }
      throw error;
    }
  })
);

/**
 * @route GET /api/v1/users/profile/settings
 * @description Get user settings (language, preferences)
 * @access Private
 */
userRoutes.get('/profile/settings',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    
    const user = await userRepository.findById(userId);
    
    if (!user || !user.profile) {
      return res.status(404).json({
        success: false,
        message: t('profile.not_found'),
        code: 'USER_NOT_FOUND'
      });
    }
    
    const settings = {
      language: user.profile.language,
      notifications: {
        email: true, // Stub - would be stored in database
        sms: true,
        push: true
      },
      security: {
        two_factor_enabled: false, // Stub
        biometric_enabled: false // Would check biometric_data table
      }
    };
    
    res.json({
      success: true,
      message: 'Settings retrieved successfully',
      data: settings
    });
  })
);

/**
 * @route PUT /api/v1/users/profile/settings
 * @description Update user settings
 * @access Private
 */
userRoutes.put('/profile/settings',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const { language, notifications, security } = req.body;
    
    // Update language if provided
    if (language && ['en', 'pcm', 'yo', 'fr'].includes(language)) {
      await userRepository.updateProfile(userId, { language });
    }
    
    // In a real implementation, other settings would be stored/updated
    // For now, we just acknowledge the update
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        language: language || req.user!.language || 'en',
        notifications: notifications || {
          email: true,
          sms: true,
          push: true
        },
        security: security || {
          two_factor_enabled: false,
          biometric_enabled: false
        }
      }
    });
  })
);

/**
 * @route DELETE /api/v1/users/profile
 * @description Delete user account (Soft delete)
 * @access Private
 */
userRoutes.delete('/profile',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    
    // Soft delete by updating status
    await userRepository.updateStatus(userId, 'closed');
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  })
);