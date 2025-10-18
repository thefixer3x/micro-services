import { KycRepository } from '../repositories/kycRepository';
import { KycDocument, KycUploadRequest } from '../types';
import { createError } from '../middleware/errorHandler';
import { t } from '../utils/i18n';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

export class KycService {
  private kycRepository: KycRepository;

  constructor() {
    this.kycRepository = new KycRepository();
  }

  async uploadDocument(
    userId: string,
    documentType: 'passport' | 'drivers_license' | 'national_id',
    file: Express.Multer.File
  ): Promise<KycDocument> {
    try {
      // Validate file
      if (!file) {
        throw createError(t('kyc.document_required'), 400, 'DOCUMENT_REQUIRED');
      }

      // Check file size
      const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '5242880'); // 5MB
      if (file.size > maxFileSize) {
        throw createError(t('kyc.file_too_large'), 400, 'FILE_TOO_LARGE');
      }

      // Validate file type
      const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,application/pdf').split(',');
      if (!allowedTypes.includes(file.mimetype)) {
        throw createError('Invalid file type', 400, 'INVALID_FILE_TYPE');
      }

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const fileName = `kyc_${userId}_${documentType}_${Date.now()}${fileExtension}`;
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const filePath = path.join(uploadDir, fileName);

      // Ensure upload directory exists
      await fs.mkdir(uploadDir, { recursive: true });

      // Save file
      await fs.writeFile(filePath, file.buffer);

      // Extract metadata
      const metadata = {
        original_name: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
        upload_timestamp: new Date().toISOString()
      };

      // Save to database
      const document = await this.kycRepository.create({
        user_id: userId,
        document_type: documentType,
        document_url: filePath,
        metadata
      });

      logger.info(`KYC document uploaded successfully`, {
        userId,
        documentId: document.id,
        documentType
      });

      return document;
    } catch (error) {
      logger.error('KYC document upload failed:', error);
      throw error;
    }
  }

  async getUserDocuments(userId: string): Promise<KycDocument[]> {
    try {
      return await this.kycRepository.findByUserId(userId);
    } catch (error) {
      logger.error('Error fetching user KYC documents:', error);
      throw error;
    }
  }

  async getKycStatus(userId: string): Promise<{
    overall_status: 'unverified' | 'pending' | 'verified' | 'rejected';
    documents: KycDocument[];
    required_documents: string[];
  }> {
    try {
      return await this.kycRepository.getKycStatus(userId);
    } catch (error) {
      logger.error('Error fetching KYC status:', error);
      throw error;
    }
  }

  async verifyDocument(
    documentId: string,
    status: 'verified' | 'rejected',
    adminNotes?: string
  ): Promise<KycDocument> {
    try {
      const metadata = adminNotes ? { admin_notes: adminNotes, verified_by: 'admin' } : undefined;
      
      const document = await this.kycRepository.updateVerificationStatus(
        documentId,
        status,
        metadata
      );

      logger.info(`KYC document ${status}`, {
        documentId,
        status,
        userId: document.user_id
      });

      return document;
    } catch (error) {
      logger.error('Error verifying KYC document:', error);
      throw error;
    }
  }

  async getDocument(documentId: string): Promise<KycDocument | null> {
    try {
      return await this.kycRepository.findById(documentId);
    } catch (error) {
      logger.error('Error fetching KYC document:', error);
      throw error;
    }
  }

  async getDocumentFile(documentId: string, userId: string): Promise<{ 
    filePath: string; 
    mimeType: string; 
    originalName: string; 
  }> {
    try {
      const document = await this.kycRepository.findById(documentId);
      
      if (!document) {
        throw createError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
      }

      // Verify ownership
      if (document.user_id !== userId) {
        throw createError('Access denied', 403, 'ACCESS_DENIED');
      }

      // Check if file exists
      try {
        await fs.access(document.document_url);
      } catch {
        throw createError('File not found on server', 404, 'FILE_NOT_FOUND');
      }

      return {
        filePath: document.document_url,
        mimeType: document.metadata?.mime_type || 'application/octet-stream',
        originalName: document.metadata?.original_name || 'document'
      };
    } catch (error) {
      logger.error('Error fetching document file:', error);
      throw error;
    }
  }
}