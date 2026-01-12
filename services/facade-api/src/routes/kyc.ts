/**
 * KYC/Verification Endpoints
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler, createError } from '../middleware/error-handler';
import { requirePermission } from '../middleware/auth';

export const kycRouter = Router();

const VALID_VERIFICATION_TYPES = [
  'bvn',
  'nin',
  'phone',
  'passport',
  'drivers_license',
  'address',
];

/**
 * Submit verification
 */
kycRouter.post(
  '/verify',
  requirePermission('kyc:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const db: Pool = (req as any).db;
    const projectId = req.projectId;
    const logger = (req as any).logger;

    const { type, value, first_name, last_name, date_of_birth } = req.body;

    // Validation
    if (!type || !VALID_VERIFICATION_TYPES.includes(type)) {
      throw createError(
        'VALIDATION_ERROR',
        `type must be one of: ${VALID_VERIFICATION_TYPES.join(', ')}`,
        400
      );
    }
    if (!value) {
      throw createError('VALIDATION_ERROR', 'value is required', 400);
    }

    // Check capabilities
    const capResult = await db.query(
      `SELECT kyc_enabled, kyc_types FROM project_capabilities WHERE project_id = $1`,
      [projectId]
    );

    if (capResult.rows.length === 0 || !capResult.rows[0].kyc_enabled) {
      throw createError('FEATURE_DISABLED', 'KYC is not enabled for this project', 403);
    }

    const allowedTypes = capResult.rows[0].kyc_types || ['bvn', 'phone'];
    if (!allowedTypes.includes(type)) {
      throw createError(
        'VERIFICATION_TYPE_NOT_ALLOWED',
        `Verification type '${type}' is not enabled for this project`,
        403
      );
    }

    // TODO: Use orchestrator to route to verification provider
    // For now, return mock verification

    const verificationId = `ver_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    // Sandbox mode: certain values always succeed/fail
    const environment = (req as any).environment || 'sandbox';
    let status: 'verified' | 'failed' | 'pending' = 'pending';
    let match = false;
    let verifiedData = {};

    if (environment === 'sandbox') {
      // Test values
      if (value === '22222222222' || value === '+2348000000000') {
        status = 'verified';
        match = true;
        verifiedData = {
          firstName: first_name || 'John',
          lastName: last_name || 'Doe',
          dateOfBirth: '1990-01-15',
          phoneNumber: '+2348012345678',
          gender: 'male',
        };
      } else if (value === '11111111111') {
        status = 'failed';
        match = false;
      } else {
        // Simulate async verification
        status = 'pending';
      }
    }

    logger?.info('Verification submitted', {
      verificationId,
      type,
      status,
    });

    res.json({
      success: true,
      data: {
        id: verificationId,
        type,
        status,
        match,
        confidence: match ? 100 : 0,
        data: status === 'verified' ? verifiedData : undefined,
        verifiedAt: status === 'verified' ? new Date().toISOString() : undefined,
      },
      meta: { requestId: req.id },
    });
  })
);

/**
 * Get verification status
 */
kycRouter.get(
  '/:verificationId',
  requirePermission('kyc:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const { verificationId } = req.params;

    // TODO: Look up verification from database
    // For now, return mock status

    res.json({
      success: true,
      data: {
        id: verificationId,
        type: 'bvn',
        status: 'pending',
        match: false,
      },
      meta: { requestId: req.id },
    });
  })
);
