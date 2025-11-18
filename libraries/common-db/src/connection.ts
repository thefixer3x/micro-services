import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';

export interface DatabaseConfig extends PoolConfig {
  connectionString?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class DatabaseConnection {
  private pool: Pool;
  private serviceName: string;

  constructor(config: DatabaseConfig, serviceName: string = 'service') {
    this.serviceName = serviceName;
    this.pool = new Pool({
      ...config,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error(`[${this.serviceName}] Unexpected database pool error:`, err);
    });

    this.pool.on('connect', () => {
      console.log(`[${this.serviceName}] New database client connected`);
    });

    this.pool.on('remove', () => {
      console.log(`[${this.serviceName}] Database client removed from pool`);
    });
  }

  /**
   * Get the pool instance
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * Execute a query
   */
  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      console.log(`[${this.serviceName}] Query executed in ${duration}ms`);
      return result;
    } catch (error) {
      console.error(`[${this.serviceName}] Query error:`, error);
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();

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
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      console.log(`[${this.serviceName}] Database connected successfully at:`, result.rows[0].now);
      return true;
    } catch (error) {
      console.error(`[${this.serviceName}] Database connection failed:`, error);
      return false;
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
    console.log(`[${this.serviceName}] Database connection pool closed`);
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

/**
 * Create a database connection
 */
export function createDatabaseConnection(
  config: DatabaseConfig,
  serviceName: string
): DatabaseConnection {
  return new DatabaseConnection(config, serviceName);
}
