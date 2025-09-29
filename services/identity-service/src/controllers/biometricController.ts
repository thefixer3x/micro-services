import { Router, Response } from 'express';
import { BiometricService } from '../services/biometricService';
import { AuthenticatedRequest } from '../types';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { logRequest } from '../utils/logger';
import { setLanguageFromUser } from '../middleware/auth';
import {
  validateBiometricEnroll,
  handleValidationErrors
} from '../utils/validation';
import { t } from '../utils/i18n';

export const biometricRoutes = Router();
const biometricService = new BiometricService();

// Add middleware
biometricRoutes.use(logRequest);
biometricRoutes.use(setLanguageFromUser);
biometricRoutes.use(authenticateToken); // All biometric routes require authentication

/**
 * @route POST /api/v1/biometric/enroll
 * @description Enroll biometric data
 * @access Private
 */
biometricRoutes.post('/enroll',
  validateBiometricEnroll(),
  handleValidationErrors,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const biometricData = req.body;
    
    const result = await biometricService.enrollBiometric(userId, biometricData);
    
    res.status(201).json({
      success: true,
      message: t('biometric.enrolled_successfully'),
      data: {
        id: result.id,
        biometric_type: result.biometric_type,
        enrolled_at: result.created_at
      }
    });
  })
);

/**
 * @route POST /api/v1/biometric/verify
 * @description Verify biometric data
 * @access Private
 */
biometricRoutes.post('/verify',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const { biometric_type, data } = req.body;
    
    if (!biometric_type || !data) {
      return res.status(400).json({
        success: false,
        message: 'Biometric type and data are required',
        code: 'MISSING_BIOMETRIC_DATA'
      });
    }
    
    if (!['fingerprint', 'face', 'voice'].includes(biometric_type)) {
      return res.status(400).json({
        success: false,
        message: t('biometric.invalid_biometric_type'),
        code: 'INVALID_BIOMETRIC_TYPE'
      });
    }
    
    const result = await biometricService.verifyBiometric(userId, biometric_type, data);
    
    res.json({
      success: result.verified,
      message: result.verified 
        ? t('biometric.verification_successful')
        : t('biometric.verification_failed'),
      data: {
        verified: result.verified,
        confidence: result.confidence,
        biometric_type
      }
    });
  })
);

/**
 * @route GET /api/v1/biometric/status
 * @description Get user's enrolled biometric types
 * @access Private
 */
biometricRoutes.get('/status',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    
    const status = await biometricService.getUserBiometrics(userId);
    
    res.json({
      success: true,
      message: 'Biometric status retrieved successfully',
      data: {
        enrolled_types: status.enrolled_types,
        total_enrolled: status.total_enrolled,
        available_types: ['fingerprint', 'face', 'voice']
      }
    });
  })
);

/**
 * @route DELETE /api/v1/biometric/:biometricType
 * @description Delete enrolled biometric data
 * @access Private
 */
biometricRoutes.delete('/:biometricType',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const { biometricType } = req.params;
    
    if (!['fingerprint', 'face', 'voice'].includes(biometricType)) {
      return res.status(400).json({
        success: false,
        message: t('biometric.invalid_biometric_type'),
        code: 'INVALID_BIOMETRIC_TYPE'
      });
    }
    
    await biometricService.deleteBiometric(userId, biometricType as 'fingerprint' | 'face' | 'voice');
    
    res.json({
      success: true,
      message: 'Biometric data deleted successfully',
      data: {
        biometric_type: biometricType
      }
    });
  })
);

/**
 * @route POST /api/v1/biometric/challenge
 * @description Generate biometric challenge (stub for advanced authentication)
 * @access Private
 */
biometricRoutes.post('/challenge',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const { biometric_type } = req.body;
    
    if (!biometric_type || !['fingerprint', 'face', 'voice'].includes(biometric_type)) {
      return res.status(400).json({
        success: false,
        message: t('biometric.invalid_biometric_type'),
        code: 'INVALID_BIOMETRIC_TYPE'
      });
    }
    
    // This is a stub implementation for biometric challenges
    // In a real system, this might involve liveness detection, random challenges, etc.
    
    const challenge = {
      challenge_id: `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      biometric_type,
      expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      requirements: {
        fingerprint: 'Place finger on sensor',
        face: 'Look directly at camera and blink',
        voice: 'Say: "My voice is my password"'
      }[biometric_type]
    };
    
    res.json({
      success: true,
      message: 'Biometric challenge generated',
      data: challenge
    });
  })
);

/**
 * @route POST /api/v1/biometric/challenge/verify
 * @description Verify biometric challenge response (stub)
 * @access Private
 */
biometricRoutes.post('/challenge/verify',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const { challenge_id, response_data } = req.body;
    
    if (!challenge_id || !response_data) {
      return res.status(400).json({
        success: false,
        message: 'Challenge ID and response data are required',
        code: 'MISSING_CHALLENGE_DATA'
      });
    }
    
    // This is a stub implementation
    // In a real system, this would validate the challenge response
    const isValid = true; // Stub validation
    
    res.json({
      success: isValid,
      message: isValid 
        ? 'Challenge verification successful'
        : 'Challenge verification failed',
      data: {
        challenge_id,
        verified: isValid,
        verification_timestamp: new Date().toISOString()
      }
    });
  })
);