import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';

export interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
}

export class MigrationRunner {
  private pool: Pool;
  private tableName: string;

  constructor(pool: Pool, tableName: string = 'schema_migrations') {
    this.pool = pool;
    this.tableName = tableName;
  }

  /**
   * Create migrations table if it doesn't exist
   */
  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations(): Promise<number[]> {
    const result = await this.pool.query(
      `SELECT version FROM ${this.tableName} ORDER BY version ASC`
    );
    return result.rows.map(row => row.version);
  }

  /**
   * Run pending migrations
   */
  async runMigrations(migrations: Migration[]): Promise<void> {
    await this.initialize();

    const appliedVersions = await this.getAppliedMigrations();
    const pendingMigrations = migrations.filter(
      m => !appliedVersions.includes(m.version)
    );

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pendingMigrations.length} migrations...`);

    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }

    console.log('All migrations completed');
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      console.log(`Running migration ${migration.version}: ${migration.name}`);

      // Execute migration SQL
      await client.query(migration.up);

      // Record migration
      await client.query(
        `INSERT INTO ${this.tableName} (version, name) VALUES ($1, $2)`,
        [migration.version, migration.name]
      );

      await client.query('COMMIT');

      console.log(`Migration ${migration.version} completed successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Migration ${migration.version} failed:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Rollback last migration
   */
  async rollback(): Promise<void> {
    const appliedVersions = await this.getAppliedMigrations();

    if (appliedVersions.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const lastVersion = appliedVersions[appliedVersions.length - 1];
    console.log(`Rolling back migration version ${lastVersion}`);

    // Note: This requires down migrations to be defined
    // For now, this is a placeholder
    throw new Error('Rollback not implemented - down migrations needed');
  }

  /**
   * Load migrations from directory
   */
  static async loadMigrationsFromDirectory(directory: string): Promise<Migration[]> {
    const files = await fs.readdir(directory);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    const migrations: Migration[] = [];

    for (const file of sqlFiles) {
      // Extract version from filename (e.g., 001_create_users.sql)
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        console.warn(`Skipping file with invalid format: ${file}`);
        continue;
      }

      const version = parseInt(match[1], 10);
      const name = match[2].replace(/_/g, ' ');
      const filePath = path.join(directory, file);
      const sql = await fs.readFile(filePath, 'utf-8');

      migrations.push({
        version,
        name,
        up: sql,
      });
    }

    return migrations;
  }
}
