/**
 * Database Connection and Query Utilities
 * Provides connection pooling, query execution, and tenant isolation
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
export type { PoolClient };

// ============================================================================
// DATABASE CONNECTION POOL
// ============================================================================

let pool: Pool | null = null;

/**
 * Configuration for the database connection pool
 */
interface PoolConfig {
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  statementTimeoutMillis?: number;
}

/**
 * Initialize the database connection pool
 * Should be called once at application startup
 * @param config Optional pool configuration
 */
export function initializePool(config?: PoolConfig): Pool {
  if (pool) {
    return pool;
  }

  // Support both prefixed (Vercel: aidemo_DATABASE_URL) and plain names
  const connectionString = process.env.aidemo_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const poolConfig = {
    connectionString,
    max: config?.max ?? 20,  // Maximum number of connections in the pool
    idleTimeoutMillis: config?.idleTimeoutMillis ?? 30000,  // Close idle connections after 30 seconds
    connectionTimeoutMillis: config?.connectionTimeoutMillis ?? 2000,  // Timeout for acquiring a connection
    statement_timeout: config?.statementTimeoutMillis ?? 30000,  // Statement timeout
  };

  pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  pool.on('connect', () => {
    // Connection established
  });

  pool.on('remove', () => {
    // Connection removed from pool
  });

  return pool;
}

/**
 * Get the database connection pool
 * Initializes if not already initialized
 */
export function getPool(): Pool {
  if (!pool) {
    return initializePool();
  }
  return pool;
}

/**
 * Close the database connection pool
 * Should be called at application shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ============================================================================
// QUERY EXECUTION UTILITIES
// ============================================================================

/**
 * Execute a query with the connection pool
 * @param query SQL query string
 * @param values Query parameters
 * @returns Query result
 */
export async function query<T extends Record<string, any> = any>(
  query: string,
  values?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(query, values);
}

/**
 * Execute a query and return the first row
 * @param queryStr SQL query string
 * @param values Query parameters
 * @returns First row or null
 */
export async function queryOne<T extends Record<string, any> = any>(
  queryStr: string,
  values?: any[]
): Promise<T | null> {
  const result = await query<T>(queryStr, values);
  return result.rows[0] || null;
}

/**
 * Execute a query and return all rows
 * @param queryStr SQL query string
 * @param values Query parameters
 * @returns Array of rows
 */
export async function queryMany<T extends Record<string, any> = any>(
  queryStr: string,
  values?: any[]
): Promise<T[]> {
  const result = await query<T>(queryStr, values);
  return result.rows;
}

/**
 * Execute a query and return the count
 * @param queryStr SQL query string
 * @param values Query parameters
 * @returns Count
 */
export async function queryCount(
  queryStr: string,
  values?: any[]
): Promise<number> {
  const result = await query<{ count: string }>(queryStr, values);
  return parseInt(result.rows[0]?.count || '0', 10);
}

// ============================================================================
// TENANT-FILTERED QUERY UTILITIES
// ============================================================================

/**
 * Execute a query with automatic tenant_id filtering
 * Ensures tenant isolation at the database level
 * @param tenantId Tenant ID to filter by
 * @param query SQL query string (must include $1 placeholder for tenant_id)
 * @param values Additional query parameters (tenant_id will be prepended)
 * @returns Query result
 */
export async function tenantQuery<T extends QueryResultRow = any>(
  tenantId: string,
  sql: string,
  values?: any[]
): Promise<QueryResult<T>> {
  const params = [tenantId, ...(values || [])];
  return query<T>(sql, params);
}

/**
 * Execute a tenant-filtered query and return the first row
 * @param tenantId Tenant ID to filter by
 * @param query SQL query string (must include $1 placeholder for tenant_id)
 * @param values Additional query parameters
 * @returns First row or null
 */
export async function tenantQueryOne<T extends QueryResultRow = any>(
  tenantId: string,
  query: string,
  values?: any[]
): Promise<T | null> {
  const result = await tenantQuery<T>(tenantId, query, values);
  return result.rows[0] || null;
}

/**
 * Execute a tenant-filtered query and return all rows
 * @param tenantId Tenant ID to filter by
 * @param query SQL query string (must include $1 placeholder for tenant_id)
 * @param values Additional query parameters
 * @returns Array of rows
 */
export async function tenantQueryMany<T extends QueryResultRow = any>(
  tenantId: string,
  query: string,
  values?: any[]
): Promise<T[]> {
  const result = await tenantQuery<T>(tenantId, query, values);
  return result.rows;
}

/**
 * Execute a tenant-filtered query and return the count
 * @param tenantId Tenant ID to filter by
 * @param query SQL query string (must include $1 placeholder for tenant_id)
 * @param values Additional query parameters
 * @returns Count
 */
export async function tenantQueryCount(
  tenantId: string,
  query: string,
  values?: any[]
): Promise<number> {
  const result = await tenantQuery<{ count: string }>(
    tenantId,
    query,
    values
  );
  return parseInt(result.rows[0]?.count || '0', 10);
}

/**
 * Get all API keys for a tenant
 * @param tenantId Tenant ID
 * @returns Array of API keys
 */
export async function getKeysByTenant(tenantId: string): Promise<any[]> {
  return tenantQueryMany(
    tenantId,
    `SELECT * FROM api_keys WHERE tenant_id = $1 ORDER BY created_at DESC`
  );
}

/**
 * Get all providers for a tenant (with their keys)
 * @param tenantId Tenant ID
 * @returns Array of providers with key counts
 */
export async function getProvidersByTenant(tenantId: string): Promise<any[]> {
  return tenantQueryMany(
    tenantId,
    `
    SELECT DISTINCT p.*, COUNT(ak.id) as key_count
    FROM providers p
    LEFT JOIN api_keys ak ON p.id = ak.provider_id AND ak.tenant_id = $1
    GROUP BY p.id
    ORDER BY p.name
    `
  );
}

/**
 * Get active keys for a provider and tenant
 * @param tenantId Tenant ID
 * @param providerId Provider ID
 * @returns Array of active API keys
 */
export async function getActiveKeysByProvider(
  tenantId: string,
  providerId: string
): Promise<any[]> {
  return tenantQueryMany(
    tenantId,
    `
    SELECT * FROM api_keys
    WHERE tenant_id = $1 AND provider_id = $2 AND active = true
    ORDER BY created_at ASC
    `
  );
}

/**
 * Get activity log entries for a tenant
 * @param tenantId Tenant ID
 * @param limit Maximum number of entries to return
 * @param offset Offset for pagination
 * @returns Array of activity log entries
 */
export async function getActivityLogByTenant(
  tenantId: string,
  limit: number = 100,
  offset: number = 0
): Promise<any[]> {
  return tenantQueryMany(
    tenantId,
    `
    SELECT * FROM activity_log
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [limit, offset]
  );
}

/**
 * Get cost records for a tenant within a date range
 * @param tenantId Tenant ID
 * @param startDate Start date
 * @param endDate End date
 * @returns Array of cost records
 */
export async function getCostRecordsByTenant(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  return tenantQueryMany(
    tenantId,
    `
    SELECT * FROM cost_records
    WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3
    ORDER BY created_at DESC
    `,
    [startDate, endDate]
  );
}

// ============================================================================
// TRANSACTION UTILITIES
// ============================================================================

/**
 * Retry configuration for transactions
 */
interface RetryConfig {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Execute a function within a database transaction
 * @param callback Function to execute within transaction
 * @param retryConfig Optional retry configuration
 * @returns Result of callback
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  retryConfig?: RetryConfig
): Promise<T> {
  const maxAttempts = retryConfig?.maxAttempts ?? 3;
  const delayMs = retryConfig?.delayMs ?? 100;
  const backoffMultiplier = retryConfig?.backoffMultiplier ?? 2;

  let lastError: Error | null = null;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {
        // Ignore rollback errors
      });

      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable =
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('deadlock');

      if (!isRetryable || attempt === maxAttempts) {
        throw lastError;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay *= backoffMultiplier;
    } finally {
      client.release();
    }
  }

  throw lastError || new Error('Transaction failed after retries');
}

/**
 * Execute a query within a transaction
 * @param client Database client
 * @param query SQL query string
 * @param values Query parameters
 * @returns Query result
 */
export async function transactionQuery<T extends QueryResultRow = any>(
  client: PoolClient,
  query: string,
  values?: any[]
): Promise<QueryResult<T>> {
  return client.query<T>(query, values);
}

/**
 * Execute a tenant-filtered query within a transaction
 * @param client Database client
 * @param tenantId Tenant ID to filter by
 * @param query SQL query string (must include $1 placeholder for tenant_id)
 * @param values Additional query parameters
 * @returns Query result
 */
export async function transactionTenantQuery<T extends QueryResultRow = any>(
  client: PoolClient,
  tenantId: string,
  query: string,
  values?: any[]
): Promise<QueryResult<T>> {
  const params = [tenantId, ...(values || [])];
  return client.query<T>(query, params);
}

// ============================================================================
// TENANT ISOLATION UTILITIES
// ============================================================================

/**
 * Build a WHERE clause for tenant isolation
 * @param tenantId Tenant ID to filter by
 * @param tableAlias Optional table alias (e.g., 'k' for 'api_keys k')
 * @returns WHERE clause string
 */
export function buildTenantFilter(
  tenantId: string,
  tableAlias?: string
): string {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  return `${prefix}tenant_id = $1`;
}

/**
 * Add tenant ID to query parameters
 * @param tenantId Tenant ID
 * @param existingParams Existing query parameters
 * @returns Updated parameters with tenant ID as first parameter
 */
export function addTenantParam(
  tenantId: string,
  existingParams: any[] = []
): any[] {
  return [tenantId, ...existingParams];
}

/**
 * Verify that a resource belongs to a tenant
 * @param resourceId Resource ID
 * @param tenantId Tenant ID
 * @param table Table name
 * @returns true if resource belongs to tenant, false otherwise
 */
export async function verifyTenantOwnership(
  resourceId: string,
  tenantId: string,
  table: string
): Promise<boolean> {
  const result = await queryOne<{ id: string }>(
    `SELECT id FROM ${table} WHERE id = $1 AND tenant_id = $2`,
    [resourceId, tenantId]
  );
  return !!result;
}

// ============================================================================
// AUTHORIZATION UTILITIES
// ============================================================================

/**
 * Verify that a user has access to a resource
 * Checks both direct ownership and shared access
 * @param resourceId Resource ID (e.g., API key ID)
 * @param tenantId Tenant ID
 * @param userId User ID (optional, for audit logging)
 * @returns true if user has access, false otherwise
 */
export async function verifyResourceAccess(
  resourceId: string,
  tenantId: string,
  userId?: string
): Promise<boolean> {
  // Check if resource is owned by tenant
  const owned = await queryOne<{ id: string }>(
    `SELECT id FROM api_keys WHERE id = $1 AND tenant_id = $2`,
    [resourceId, tenantId]
  );

  if (owned) {
    return true;
  }

  // Check if resource is shared with tenant
  const shared = await queryOne<{ id: string }>(
    `SELECT id FROM key_sharing 
     WHERE key_id = $1 AND shared_tenant_id = $2 AND revoked_at IS NULL`,
    [resourceId, tenantId]
  );

  return !!shared;
}

// ============================================================================
// MIGRATION UTILITIES
// ============================================================================

/**
 * Read migration file content
 * @param migrationName Migration file name (e.g., '001_initial_schema.sql')
 * @returns Migration SQL content
 */
export async function readMigration(migrationName: string): Promise<string> {
  const fs = await import('fs').then(m => m.promises);
  const path = await import('path');
  const migrationPath = path.join(
    process.cwd(),
    'lib/db/migrations',
    migrationName
  );
  return fs.readFile(migrationPath, 'utf-8');
}

/**
 * Execute a migration
 * @param migrationName Migration file name
 */
export async function executeMigration(migrationName: string): Promise<void> {
  const migrationSql = await readMigration(migrationName);
  const pool = getPool();
  await pool.query(migrationSql);
  console.log(`Migration ${migrationName} executed successfully`);
}

/**
 * Check if a table exists
 * @param tableName Table name
 * @returns true if table exists, false otherwise
 */
export async function tableExists(tableName: string): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = $1
    )`,
    [tableName]
  );
  return result?.exists || false;
}

// ============================================================================
// HEALTH CHECK UTILITIES
// ============================================================================

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  timestamp: Date;
  responseTimeMs: number;
  poolStats: {
    totalConnections: number;
    idleConnections: number;
    waitingRequests: number;
  };
  error?: string;
}

/**
 * Check database connection health
 * @returns Health check result
 */
export async function healthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const result = await query('SELECT 1');
    const responseTimeMs = Date.now() - startTime;

    return {
      healthy: result.rowCount === 1,
      timestamp: new Date(),
      responseTimeMs,
      poolStats: getPoolStats(),
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    return {
      healthy: false,
      timestamp: new Date(),
      responseTimeMs,
      poolStats: getPoolStats(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get database connection pool statistics
 * @returns Pool statistics
 */
export function getPoolStats(): {
  totalConnections: number;
  idleConnections: number;
  waitingRequests: number;
} {
  const pool = getPool();
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingRequests: pool.waitingCount,
  };
}

/**
 * Wait for database to be ready (with timeout)
 * @param timeoutMs Maximum time to wait in milliseconds
 * @returns true if database is ready, false if timeout
 */
export async function waitForDatabase(timeoutMs: number = 10000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await query('SELECT 1');
      if (result.rowCount === 1) {
        return true;
      }
    } catch (error) {
      // Connection not ready yet, retry
    }

    // Wait 100ms before retrying
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Database error types
 */
export enum DatabaseErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  QUERY_ERROR = 'QUERY_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONSTRAINT_ERROR = 'CONSTRAINT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom database error
 */
export class DatabaseError extends Error {
  constructor(
    public type: DatabaseErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Classify a database error
 * @param error The error to classify
 * @returns Error type and message
 */
export function classifyDatabaseError(
  error: any
): { type: DatabaseErrorType; message: string } {
  const errorMessage = (error?.message || String(error)).toLowerCase();

  if (
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound') ||
    errorMessage.includes('connect')
  ) {
    return {
      type: DatabaseErrorType.CONNECTION_ERROR,
      message: 'Failed to connect to database',
    };
  }

  if (errorMessage.includes('timeout')) {
    return {
      type: DatabaseErrorType.TIMEOUT_ERROR,
      message: 'Database query timeout',
    };
  }

  if (
    errorMessage.includes('unique') ||
    errorMessage.includes('foreign key') ||
    errorMessage.includes('check')
  ) {
    return {
      type: DatabaseErrorType.CONSTRAINT_ERROR,
      message: 'Database constraint violation',
    };
  }

  if (errorMessage.includes('deadlock')) {
    return {
      type: DatabaseErrorType.TRANSACTION_ERROR,
      message: 'Database deadlock detected',
    };
  }

  if (errorMessage.includes('syntax') || errorMessage.includes('parse')) {
    return {
      type: DatabaseErrorType.QUERY_ERROR,
      message: 'Invalid SQL query',
    };
  }

  return {
    type: DatabaseErrorType.UNKNOWN_ERROR,
    message: 'Unknown database error',
  };
}

/**
 * Execute a query with error handling
 * @param queryStr SQL query string
 * @param values Query parameters
 * @returns Query result or throws DatabaseError
 */
export async function queryWithErrorHandling<T extends QueryResultRow = any>(
  queryStr: string,
  values?: any[]
): Promise<QueryResult<T>> {
  try {
    return await query<T>(queryStr, values);
  } catch (error) {
    const { type, message } = classifyDatabaseError(error);
    throw new DatabaseError(type, message, error instanceof Error ? error : undefined);
  }
}

// ============================================================================
// EXPORT TYPES AND INTERFACES
// ============================================================================

export type { PoolConfig, RetryConfig };
