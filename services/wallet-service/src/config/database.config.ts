/**
 * Database Configuration
 * Toggle between Neon (dev/test) and Supabase (production)
 */

export type DatabaseEnv = 'dev' | 'staging' | 'production';

export interface DatabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  env: DatabaseEnv;
}

/**
 * Get database configuration based on DATABASE_ENV
 * - dev/staging: Uses Neon
 * - production: Uses Supabase
 */
export function getDatabaseConfig(): DatabaseConfig {
  const env = (process.env.DATABASE_ENV || 'dev') as DatabaseEnv;

  if (env === 'production') {
    // Production: Supabase
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY required for production');
    }

    return { url, anonKey, serviceRoleKey, env };
  }

  // Dev/Staging: Neon
  const url = process.env.NEON_DATABASE_URL;
  const anonKey = process.env.NEON_ANON_KEY;
  const serviceRoleKey = process.env.NEON_SERVICE_ROLE_KEY;

  // Fallback to Supabase vars if Neon not configured (backwards compatibility)
  if (!url && process.env.SUPABASE_URL) {
    return {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY || '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      env,
    };
  }

  if (!url || !anonKey) {
    throw new Error('NEON_DATABASE_URL and NEON_ANON_KEY required for dev/staging');
  }

  return { url, anonKey, serviceRoleKey, env };
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.DATABASE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  const env = process.env.DATABASE_ENV || 'dev';
  return env === 'dev' || env === 'staging';
}

/**
 * Get current environment name
 */
export function getEnvironmentName(): string {
  const env = process.env.DATABASE_ENV || 'dev';
  return env === 'production' ? 'Supabase (Production)' : `Neon (${env})`;
}
