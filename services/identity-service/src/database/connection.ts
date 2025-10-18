import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

export const initializeDatabase = async (): Promise<void> => {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('Database connection established successfully');
    
    // Run migrations in development
    if (process.env.NODE_ENV !== 'test') {
      await runMigrations();
    }
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
};

export const getDatabase = (): Pool => {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
};

export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection closed');
  }
};

// Transaction helper
export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const db = getDatabase();
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Basic migration runner
const runMigrations = async (): Promise<void> => {
  const db = getDatabase();
  
  try {
    // Create migrations table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Define migrations
    const migrations = [
      {
        name: '001_create_users_table',
        sql: `
          CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
          
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE NOT NULL,
            phone VARCHAR(50) UNIQUE,
            username VARCHAR(100) UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('individual', 'business', 'joint')),
            status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'closed')),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );

          CREATE INDEX idx_users_email ON users(email);
          CREATE INDEX idx_users_phone ON users(phone);
          CREATE INDEX idx_users_status ON users(status);
        `
      },
      {
        name: '002_create_user_profiles_table',
        sql: `
          CREATE TABLE IF NOT EXISTS user_profiles (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            date_of_birth DATE,
            language VARCHAR(5) DEFAULT 'en' CHECK (language IN ('en', 'pcm', 'yo', 'fr')),
            address JSONB,
            kyc_status VARCHAR(20) DEFAULT 'unverified' CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );

          CREATE INDEX idx_user_profiles_kyc_status ON user_profiles(kyc_status);
        `
      },
      {
        name: '003_create_kyc_documents_table',
        sql: `
          CREATE TABLE IF NOT EXISTS kyc_documents (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('passport', 'drivers_license', 'national_id')),
            document_number VARCHAR(100),
            document_url VARCHAR(500) NOT NULL,
            verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
            verified_at TIMESTAMP,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );

          CREATE INDEX idx_kyc_documents_user_id ON kyc_documents(user_id);
          CREATE INDEX idx_kyc_documents_status ON kyc_documents(verification_status);
        `
      },
      {
        name: '004_create_biometric_data_table',
        sql: `
          CREATE TABLE IF NOT EXISTS biometric_data (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            biometric_type VARCHAR(20) NOT NULL CHECK (biometric_type IN ('fingerprint', 'face', 'voice')),
            template_data BYTEA NOT NULL,
            device_info JSONB,
            created_at TIMESTAMP DEFAULT NOW()
          );

          CREATE INDEX idx_biometric_data_user_id ON biometric_data(user_id);
          CREATE INDEX idx_biometric_data_type ON biometric_data(biometric_type);
        `
      },
      {
        name: '005_create_refresh_tokens_table',
        sql: `
          CREATE TABLE IF NOT EXISTS refresh_tokens (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(255) NOT NULL,
            device_id VARCHAR(100),
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          );

          CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
          CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
          CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
        `
      }
    ];

    // Run each migration
    for (const migration of migrations) {
      const result = await db.query(
        'SELECT name FROM migrations WHERE name = $1',
        [migration.name]
      );

      if (result.rowCount === 0) {
        logger.info(`Running migration: ${migration.name}`);
        await db.query(migration.sql);
        await db.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migration.name]
        );
        logger.info(`Migration completed: ${migration.name}`);
      }
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
};