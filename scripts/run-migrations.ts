#!/usr/bin/env ts-node
/**
 * Database Migration Runner
 * 
 * Usage:
 *   npm run migrate -- --service=identity-service
 *   npm run migrate -- --service=wallet-service --rollback
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationFile {
  version: string;
  name: string;
  path: string;
  sql: string;
}

interface AppliedMigration {
  version: string;
  name: string;
  executed_at: Date;
}

class MigrationRunner {
  private pool: Pool;
  private serviceName: string;
  private migrationsDir: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.migrationsDir = path.join(__dirname, '..', 'services', serviceName, 'migrations');

    // Get database config from environment
    const dbUrl = process.env.DATABASE_URL || this.getDefaultDbUrl(serviceName);
    
    this.pool = new Pool({
      connectionString: dbUrl,
    });

    console.log(`[${serviceName}] Connecting to database...`);
  }

  private getDefaultDbUrl(serviceName: string): string {
    const dbName = serviceName.replace(/-/g, '_');
    return `postgresql://postgres:password@localhost:5432/${dbName}`;
  }

  async loadMigrations(): Promise<MigrationFile[]> {
    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const migrations: MigrationFile[] = [];

    for (const file of files) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        console.warn(`[${this.serviceName}] Skipping invalid migration file: ${file}`);
        continue;
      }

      const [, version, name] = match;
      const filePath = path.join(this.migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      migrations.push({
        version,
        name,
        path: filePath,
        sql,
      });
    }

    return migrations;
  }

  async getAppliedMigrations(): Promise<AppliedMigration[]> {
    try {
      const result = await this.pool.query(
        'SELECT version, name, executed_at FROM schema_migrations ORDER BY version'
      );
      return result.rows;
    } catch (error: any) {
      // If schema_migrations table doesn't exist, return empty array
      if (error.code === '42P01') {
        console.log(`[${this.serviceName}] schema_migrations table not found, will be created`);
        return [];
      }
      throw error;
    }
  }

  async runMigrations(): Promise<void> {
    console.log(`\n[${this.serviceName}] Loading migrations from ${this.migrationsDir}...`);
    
    const allMigrations = await this.loadMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));

    const pendingMigrations = allMigrations.filter(m => !appliedVersions.has(m.version));

    if (pendingMigrations.length === 0) {
      console.log(`[${this.serviceName}] No pending migrations`);
      return;
    }

    console.log(`[${this.serviceName}] Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }

    console.log(`\n[${this.serviceName}] All migrations completed successfully!`);
  }

  async runMigration(migration: MigrationFile): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      console.log(`\n[${this.serviceName}] Running migration ${migration.version}: ${migration.name}...`);
      
      await client.query('BEGIN');
      await client.query(migration.sql);
      await client.query('COMMIT');
      
      console.log(`[${this.serviceName}] ✓ Migration ${migration.version} completed`);
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error(`[${this.serviceName}] ✗ Migration ${migration.version} failed:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const serviceArg = args.find(arg => arg.startsWith('--service='));
  
  if (!serviceArg) {
    console.error('Error: --service argument is required');
    console.error('Usage: ts-node run-migrations.ts --service=identity-service');
    process.exit(1);
  }

  const serviceName = serviceArg.split('=')[1];
  const runner = new MigrationRunner(serviceName);

  try {
    await runner.runMigrations();
    await runner.close();
    process.exit(0);
  } catch (error: any) {
    console.error('Migration failed:', error);
    await runner.close();
    process.exit(1);
  }
}

main();
