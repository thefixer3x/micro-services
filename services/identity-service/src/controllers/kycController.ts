import { Router, Response } from 'express';
import multer from 'multer';
import { KycService } from '../services/kycService';
import { AuthenticatedRequest } from '../types';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { logRequest } from '../utils/logger';
import { setLanguageFromUser } from '../middleware/auth';
import {
  validateKycUpload,
  handleValidationErrors
} from '../utils/validation';
import { t } from '../utils/i18n';
import fs from 'fs';
import path from 'path';

export const kycRoutes = Router();
const kycService = new KycService();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,application/pdf').split(',');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Add middleware
kycRoutes.use(logRequest);
kycRoutes.use(setLanguageFromUser);
kycRoutes.use(authenticateToken); // All KYC routes require authentication

/**
 * @route POST /api/v1/kyc/upload
 * @description Upload KYC document
 * @access Private
 */
kycRoutes.post('/upload',
  upload.single('document'),
  validateKycUpload(),
  handleValidationErrors,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const { document_type } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: t('kyc.document_required'),
        code: 'DOCUMENT_REQUIRED'
      });
    }
    
    const document = await kycService.uploadDocument(
      userId,
      document_type,
      req.file
    );
    
    res.status(201).json({
      success: true,
      message: t('kyc.upload_successful'),
      data: {
        id: document.id,
        document_type: document.document_type,
        verification_status: document.verification_status,
        created_at: document.created_at
      }
    });
  })
);

/**
 * @route GET /api/v1/kyc/status
 * @description Get KYC verification status
 * @access Private
 */
kycRoutes.get('/status',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    
    const kycStatus = await kycService.getKycStatus(userId);
    
    res.json({
      success: true,
      message: 'KYC status retrieved successfully',
      data: {
        overall_status: kycStatus.overall_status,
        documents: kycStatus.documents.map(doc => ({
          id: doc.id,
          document_type: doc.document_type,
          verification_status: doc.verification_status,
          created_at: doc.created_at,
          verified_at: doc.verified_at
        })),
        required_documents: kycStatus.required_documents
      }
    });
  })
);

/**
 * @route GET /api/v1/kyc/documents
 * @description Get user's KYC documents
 * @access Private
 */
kycRoutes.get('/documents',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    
    const documents = await kycService.getUserDocuments(userId);
    
    res.json({
      success: true,
      message: 'Documents retrieved successfully',
      data: documents.map(doc => ({
        id: doc.id,
        document_type: doc.document_type,
        verification_status: doc.verification_status,
        created_at: doc.created_at,
        verified_at: doc.verified_at,
        metadata: doc.metadata
      }))
    });
  })
);

/**
 * @route GET /api/v1/kyc/documents/:documentId
 * @description Get specific KYC document
 * @access Private
 */
kycRoutes.get('/documents/:documentId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const { documentId } = req.params;
    
    const document = await kycService.getDocument(documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
        code: 'DOCUMENT_NOT_FOUND'
      });
    }
    
    // Check ownership
    if (document.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }
    
    res.json({
      success: true,
      message: 'Document retrieved successfully',
      data: {
        id: document.id,
        document_type: document.document_type,
        verification_status: document.verification_status,
        created_at: document.created_at,
        verified_at: document.verified_at,
        metadata: document.metadata
      }
    });
  })
);

/**
 * @route GET /api/v1/kyc/documents/:documentId/download
 * @description Download KYC document file
 * @access Private
 */
kycRoutes.get('/documents/:documentId/download',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const { documentId } = req.params;
    
    const fileInfo = await kycService.getDocumentFile(documentId, userId);
    
    // Check if file exists
    if (!fs.existsSync(fileInfo.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server',
        code: 'FILE_NOT_FOUND'
      });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.originalName}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(fileInfo.filePath);
    fileStream.pipe(res);
  })
);

/**
 * @route PUT /api/v1/kyc/documents/:documentId/verify
 * @description Verify/reject KYC document (Admin only - stub)
 * @access Private (Admin)
 */
kycRoutes.put('/documents/:documentId/verify',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { documentId } = req.params;
    const { status, notes } = req.body;
    
    // This would typically require admin authentication
    // For now, it's a stub implementation
    
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status',
        code: 'INVALID_STATUS'
      });
    }
    
    const document = await kycService.verifyDocument(documentId, status, notes);
    
    res.json({
      success: true,
      message: `Document ${status} successfully`,
      data: {
        id: document.id,
        verification_status: document.verification_status,
        verified_at: document.verified_at,
        metadata: document.metadata
      }
    });
  })
);