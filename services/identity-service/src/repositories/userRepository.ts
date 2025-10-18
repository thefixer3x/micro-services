import { Pool, PoolClient } from 'pg';
import { User, UserProfile, UpdateProfileRequest } from '../types';
import { getDatabase } from '../database/connection';
import { logger } from '../utils/logger';

export class UserRepository {
  private db: Pool;

  constructor() {
    this.db = getDatabase();
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const query = `
        SELECT u.*, up.first_name, up.last_name, up.date_of_birth, 
               up.language, up.address, up.kyc_status,
               up.created_at as profile_created_at, up.updated_at as profile_updated_at
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.email = $1
      `;
      
      const result = await this.db.query(query, [email]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapUserWithProfile(result.rows[0]);
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  async findByPhone(phone: string): Promise<User | null> {
    try {
      const query = `
        SELECT u.*, up.first_name, up.last_name, up.date_of_birth, 
               up.language, up.address, up.kyc_status,
               up.created_at as profile_created_at, up.updated_at as profile_updated_at
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.phone = $1
      `;
      
      const result = await this.db.query(query, [phone]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapUserWithProfile(result.rows[0]);
    } catch (error) {
      logger.error('Error finding user by phone:', error);
      throw error;
    }
  }

  async findById(userId: string): Promise<User | null> {
    try {
      const query = `
        SELECT u.*, up.first_name, up.last_name, up.date_of_birth, 
               up.language, up.address, up.kyc_status,
               up.created_at as profile_created_at, up.updated_at as profile_updated_at
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.id = $1
      `;
      
      const result = await this.db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapUserWithProfile(result.rows[0]);
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  async create(userData: {
    email: string;
    phone?: string;
    password_hash: string;
    account_type: 'individual' | 'business' | 'joint';
    language?: 'en' | 'pcm' | 'yo' | 'fr';
  }): Promise<User> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert user
      const userQuery = `
        INSERT INTO users (email, phone, password_hash, account_type, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *
      `;
      
      const userResult = await client.query(userQuery, [
        userData.email,
        userData.phone,
        userData.password_hash,
        userData.account_type
      ]);
      
      const user = userResult.rows[0];
      
      // Insert user profile
      const profileQuery = `
        INSERT INTO user_profiles (user_id, language, kyc_status)
        VALUES ($1, $2, 'unverified')
        RETURNING *
      `;
      
      const profileResult = await client.query(profileQuery, [
        user.id,
        userData.language || 'en'
      ]);
      
      await client.query('COMMIT');
      
      const profile = profileResult.rows[0];
      
      return {
        ...user,
        profile: {
          user_id: profile.user_id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          date_of_birth: profile.date_of_birth,
          language: profile.language,
          address: profile.address,
          kyc_status: profile.kyc_status,
          created_at: profile.created_at,
          updated_at: profile.updated_at
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProfile(userId: string, profileData: UpdateProfileRequest): Promise<UserProfile> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (profileData.first_name !== undefined) {
        fields.push(`first_name = $${paramIndex++}`);
        values.push(profileData.first_name);
      }

      if (profileData.last_name !== undefined) {
        fields.push(`last_name = $${paramIndex++}`);
        values.push(profileData.last_name);
      }

      if (profileData.date_of_birth !== undefined) {
        fields.push(`date_of_birth = $${paramIndex++}`);
        values.push(profileData.date_of_birth);
      }

      if (profileData.language !== undefined) {
        fields.push(`language = $${paramIndex++}`);
        values.push(profileData.language);
      }

      if (profileData.address !== undefined) {
        fields.push(`address = $${paramIndex++}`);
        values.push(JSON.stringify(profileData.address));
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(userId);

      const query = `
        UPDATE user_profiles 
        SET ${fields.join(', ')}
        WHERE user_id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('User profile not found');
      }

      const profile = result.rows[0];
      return {
        user_id: profile.user_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        date_of_birth: profile.date_of_birth,
        language: profile.language,
        address: profile.address,
        kyc_status: profile.kyc_status,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      };
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  async updateStatus(userId: string, status: 'pending' | 'active' | 'suspended' | 'closed'): Promise<void> {
    try {
      const query = `
        UPDATE users 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `;
      
      await this.db.query(query, [status, userId]);
    } catch (error) {
      logger.error('Error updating user status:', error);
      throw error;
    }
  }

  private mapUserWithProfile(row: any): User {
    const user: User = {
      id: row.id,
      email: row.email,
      phone: row.phone,
      username: row.username,
      password_hash: row.password_hash,
      account_type: row.account_type,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at
    };

    if (row.first_name || row.language) {
      user.profile = {
        user_id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        date_of_birth: row.date_of_birth,
        language: row.language || 'en',
        address: row.address,
        kyc_status: row.kyc_status || 'unverified',
        created_at: row.profile_created_at || row.created_at,
        updated_at: row.profile_updated_at || row.updated_at
      };
    }

    return user;
  }
}