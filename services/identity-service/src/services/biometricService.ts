import { Pool } from 'pg';
import { BiometricData, BiometricEnrollRequest } from '../types';
import { getDatabase } from '../database/connection';
import { createError } from '../middleware/errorHandler';
import { t } from '../utils/i18n';
import { logger } from '../utils/logger';

export class BiometricService {
  private db: Pool;

  constructor() {
    this.db = getDatabase();
  }

  async enrollBiometric(userId: string, data: BiometricEnrollRequest): Promise<BiometricData> {
    try {
      // Validate biometric data
      if (!data.data || !data.biometric_type) {
        throw createError('Invalid biometric data', 400, 'INVALID_BIOMETRIC_DATA');
      }

      // Convert base64 to buffer
      let templateData: Buffer;
      try {
        templateData = Buffer.from(data.data, 'base64');
      } catch (error) {
        throw createError('Invalid base64 data', 400, 'INVALID_BASE64');
      }

      // Check if user already has this biometric type
      const existingBiometric = await this.findByUserAndType(userId, data.biometric_type);
      
      let query: string;
      let values: any[];
      
      if (existingBiometric) {
        // Update existing biometric
        query = `
          UPDATE biometric_data 
          SET template_data = $1, device_info = $2, created_at = NOW()
          WHERE user_id = $3 AND biometric_type = $4
          RETURNING *
        `;
        values = [templateData, JSON.stringify(data.device_info), userId, data.biometric_type];
      } else {
        // Create new biometric entry
        query = `
          INSERT INTO biometric_data (user_id, biometric_type, template_data, device_info)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        values = [userId, data.biometric_type, templateData, JSON.stringify(data.device_info)];
      }

      const result = await this.db.query(query, values);
      const biometric = this.mapBiometricData(result.rows[0]);

      logger.info(`Biometric ${existingBiometric ? 'updated' : 'enrolled'} successfully`, {
        userId,
        biometricType: data.biometric_type,
        biometricId: biometric.id
      });

      return biometric;
    } catch (error) {
      logger.error('Biometric enrollment failed:', error);
      throw error;
    }
  }

  async verifyBiometric(
    userId: string, 
    biometricType: 'fingerprint' | 'face' | 'voice',
    data: string
  ): Promise<{ verified: boolean; confidence: number }> {
    try {
      // Get stored biometric template
      const storedBiometric = await this.findByUserAndType(userId, biometricType);
      
      if (!storedBiometric) {
        throw createError('Biometric not enrolled', 404, 'BIOMETRIC_NOT_ENROLLED');
      }

      // Convert incoming data to buffer
      let incomingData: Buffer;
      try {
        incomingData = Buffer.from(data, 'base64');
      } catch (error) {
        throw createError('Invalid base64 data', 400, 'INVALID_BASE64');
      }

      // Stub biometric verification logic
      // In a real implementation, this would use biometric matching algorithms
      const verified = await this.performBiometricMatching(
        storedBiometric.template_data,
        incomingData,
        biometricType
      );

      logger.info('Biometric verification completed', {
        userId,
        biometricType,
        verified: verified.verified,
        confidence: verified.confidence
      });

      return verified;
    } catch (error) {
      logger.error('Biometric verification failed:', error);
      throw error;
    }
  }

  async getUserBiometrics(userId: string): Promise<{
    enrolled_types: string[];
    total_enrolled: number;
  }> {
    try {
      const query = `
        SELECT biometric_type 
        FROM biometric_data 
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;
      
      const result = await this.db.query(query, [userId]);
      const enrolledTypes = result.rows.map(row => row.biometric_type);
      
      return {
        enrolled_types: enrolledTypes,
        total_enrolled: enrolledTypes.length
      };
    } catch (error) {
      logger.error('Error fetching user biometrics:', error);
      throw error;
    }
  }

  async deleteBiometric(userId: string, biometricType: 'fingerprint' | 'face' | 'voice'): Promise<void> {
    try {
      const query = `
        DELETE FROM biometric_data 
        WHERE user_id = $1 AND biometric_type = $2
      `;
      
      const result = await this.db.query(query, [userId, biometricType]);
      
      if (result.rowCount === 0) {
        throw createError('Biometric not found', 404, 'BIOMETRIC_NOT_FOUND');
      }

      logger.info('Biometric deleted successfully', {
        userId,
        biometricType
      });
    } catch (error) {
      logger.error('Error deleting biometric:', error);
      throw error;
    }
  }

  private async findByUserAndType(
    userId: string, 
    biometricType: 'fingerprint' | 'face' | 'voice'
  ): Promise<BiometricData | null> {
    try {
      const query = `
        SELECT * FROM biometric_data 
        WHERE user_id = $1 AND biometric_type = $2
      `;
      
      const result = await this.db.query(query, [userId, biometricType]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapBiometricData(result.rows[0]);
    } catch (error) {
      logger.error('Error finding biometric:', error);
      throw error;
    }
  }

  private async performBiometricMatching(
    storedTemplate: Buffer,
    incomingTemplate: Buffer,
    biometricType: string
  ): Promise<{ verified: boolean; confidence: number }> {
    // This is a stub implementation for biometric matching
    // In a real system, this would use specialized biometric libraries
    // like VeriFinger SDK, FaceSDK, or cloud services like AWS Rekognition
    
    try {
      // Simulate basic comparison
      const similarity = this.calculateSimilarity(storedTemplate, incomingTemplate);
      
      // Different thresholds for different biometric types
      const thresholds = {
        fingerprint: 0.85,
        face: 0.80,
        voice: 0.75
      };
      
      const threshold = thresholds[biometricType as keyof typeof thresholds] || 0.80;
      const verified = similarity >= threshold;
      
      // Add some randomness to simulate real-world variability
      const confidenceAdjustment = (Math.random() - 0.5) * 0.1;
      const confidence = Math.max(0, Math.min(1, similarity + confidenceAdjustment));
      
      return {
        verified,
        confidence: Math.round(confidence * 100) / 100
      };
    } catch (error) {
      logger.error('Biometric matching error:', error);
      return { verified: false, confidence: 0 };
    }
  }

  private calculateSimilarity(template1: Buffer, template2: Buffer): number {
    // Simple similarity calculation (not suitable for production)
    // This is just for demonstration purposes
    
    if (template1.length !== template2.length) {
      return 0;
    }
    
    let matches = 0;
    const length = Math.min(template1.length, template2.length, 1000); // Limit comparison
    
    for (let i = 0; i < length; i++) {
      if (template1[i] === template2[i]) {
        matches++;
      }
    }
    
    return matches / length;
  }

  private mapBiometricData(row: any): BiometricData {
    return {
      id: row.id,
      user_id: row.user_id,
      biometric_type: row.biometric_type,
      template_data: row.template_data,
      device_info: row.device_info,
      created_at: row.created_at
    };
  }
}