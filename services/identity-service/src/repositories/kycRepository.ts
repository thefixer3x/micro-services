import { Pool } from 'pg';
import { KycDocument } from '../types';
import { getDatabase } from '../database/connection';
import { logger } from '../utils/logger';

export class KycRepository {
  private db: Pool;

  constructor() {
    this.db = getDatabase();
  }

  async create(data: {
    user_id: string;
    document_type: 'passport' | 'drivers_license' | 'national_id';
    document_url: string;
    document_number?: string;
    metadata?: Record<string, any>;
  }): Promise<KycDocument> {
    try {
      const query = `
        INSERT INTO kyc_documents 
        (user_id, document_type, document_url, document_number, metadata, verification_status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING *
      `;
      
      const values = [
        data.user_id,
        data.document_type,
        data.document_url,
        data.document_number || null,
        data.metadata ? JSON.stringify(data.metadata) : null
      ];
      
      const result = await this.db.query(query, values);
      return this.mapKycDocument(result.rows[0]);
    } catch (error) {
      logger.error('Error creating KYC document:', error);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<KycDocument[]> {
    try {
      const query = `
        SELECT * FROM kyc_documents 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;
      
      const result = await this.db.query(query, [userId]);
      return result.rows.map(row => this.mapKycDocument(row));
    } catch (error) {
      logger.error('Error finding KYC documents by user ID:', error);
      throw error;
    }
  }

  async findById(documentId: string): Promise<KycDocument | null> {
    try {
      const query = `
        SELECT * FROM kyc_documents 
        WHERE id = $1
      `;
      
      const result = await this.db.query(query, [documentId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapKycDocument(result.rows[0]);
    } catch (error) {
      logger.error('Error finding KYC document by ID:', error);
      throw error;
    }
  }

  async updateVerificationStatus(
    documentId: string, 
    status: 'pending' | 'verified' | 'rejected',
    metadata?: Record<string, any>
  ): Promise<KycDocument> {
    try {
      const query = `
        UPDATE kyc_documents 
        SET verification_status = $1, 
            verified_at = ${status === 'verified' ? 'NOW()' : 'NULL'},
            metadata = COALESCE($2, metadata),
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;
      
      const values = [
        status,
        metadata ? JSON.stringify(metadata) : null,
        documentId
      ];
      
      const result = await this.db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('KYC document not found');
      }
      
      return this.mapKycDocument(result.rows[0]);
    } catch (error) {
      logger.error('Error updating KYC verification status:', error);
      throw error;
    }
  }

  async getKycStatus(userId: string): Promise<{
    overall_status: 'unverified' | 'pending' | 'verified' | 'rejected';
    documents: KycDocument[];
    required_documents: string[];
  }> {
    try {
      const documents = await this.findByUserId(userId);
      
      // Define required document types (can be configurable)
      const requiredDocuments = ['passport', 'drivers_license', 'national_id'];
      
      // Determine overall status
      let overallStatus: 'unverified' | 'pending' | 'verified' | 'rejected' = 'unverified';
      
      if (documents.length === 0) {
        overallStatus = 'unverified';
      } else {
        const hasVerified = documents.some(doc => doc.verification_status === 'verified');
        const hasRejected = documents.some(doc => doc.verification_status === 'rejected');
        const hasPending = documents.some(doc => doc.verification_status === 'pending');
        
        if (hasVerified) {
          overallStatus = 'verified';
        } else if (hasRejected && !hasPending) {
          overallStatus = 'rejected';
        } else if (hasPending) {
          overallStatus = 'pending';
        }
      }
      
      // Update user profile KYC status if it has changed
      await this.updateUserKycStatus(userId, overallStatus);
      
      return {
        overall_status: overallStatus,
        documents,
        required_documents: requiredDocuments
      };
    } catch (error) {
      logger.error('Error getting KYC status:', error);
      throw error;
    }
  }

  private async updateUserKycStatus(
    userId: string, 
    status: 'unverified' | 'pending' | 'verified' | 'rejected'
  ): Promise<void> {
    try {
      const query = `
        UPDATE user_profiles 
        SET kyc_status = $1, updated_at = NOW()
        WHERE user_id = $2
      `;
      
      await this.db.query(query, [status, userId]);
    } catch (error) {
      logger.error('Error updating user KYC status:', error);
      // Don't throw here as this is a secondary operation
    }
  }

  private mapKycDocument(row: any): KycDocument {
    return {
      id: row.id,
      user_id: row.user_id,
      document_type: row.document_type,
      document_number: row.document_number,
      document_url: row.document_url,
      verification_status: row.verification_status,
      verified_at: row.verified_at,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}