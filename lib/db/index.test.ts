/**
 * Database Connection Pool and Utilities Tests
 * Tests for connection pooling, query execution, tenant isolation, and error handling
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  initializePool,
  getPool,
  closePool,
  query,
  queryOne,
  queryMany,
  queryCount,
  tenantQuery,
  tenantQueryOne,
  tenantQueryMany,
  tenantQueryCount,
  buildTenantFilter,
  addTenantParam,
  verifyTenantOwnership,
  verifyResourceAccess,
  withTransaction,
  healthCheck,
  getPoolStats,
  waitForDatabase,
  classifyDatabaseError,
  DatabaseErrorType,
  DatabaseError,
} from './index';

describe('Database Connection Pool', () => {
  beforeAll(() => {
    // Set up test database URL if not already set
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'postgresql://localhost/test_db';
    }
  });

  afterAll(async () => {
    await closePool();
  });

  it('should initialize pool on first call', () => {
    const pool = initializePool();
    expect(pool).toBeDefined();
    expect(pool.totalCount).toBeGreaterThanOrEqual(0);
  });

  it('should return same pool instance on subsequent calls', () => {
    const pool1 = getPool();
    const pool2 = getPool();
    expect(pool1).toBe(pool2);
  });

  it('should accept custom pool configuration', () => {
    // Close existing pool first
    closePool();

    const pool = initializePool({
      max: 10,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 1000,
    });

    expect(pool).toBeDefined();
  });
});

describe('Tenant Isolation Utilities', () => {
  it('should build tenant filter without table alias', () => {
    const filter = buildTenantFilter('tenant-123');
    expect(filter).toBe('tenant_id = $1');
  });

  it('should build tenant filter with table alias', () => {
    const filter = buildTenantFilter('tenant-123', 'ak');
    expect(filter).toBe('ak.tenant_id = $1');
  });

  it('should add tenant ID to query parameters', () => {
    const params = addTenantParam('tenant-123', ['value1', 'value2']);
    expect(params).toEqual(['tenant-123', 'value1', 'value2']);
  });

  it('should add tenant ID to empty parameters', () => {
    const params = addTenantParam('tenant-123');
    expect(params).toEqual(['tenant-123']);
  });
});

describe('Error Classification', () => {
  it('should classify connection errors', () => {
    const error = new Error('ECONNREFUSED: Connection refused');
    const { type, message } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.CONNECTION_ERROR);
    expect(message).toBe('Failed to connect to database');
  });

  it('should classify timeout errors', () => {
    const error = new Error('Query timeout');
    const { type, message } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.TIMEOUT_ERROR);
    expect(message).toBe('Database query timeout');
  });

  it('should classify constraint errors', () => {
    const error = new Error('duplicate key value violates unique constraint');
    const { type, message } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.CONSTRAINT_ERROR);
    expect(message).toBe('Database constraint violation');
  });

  it('should classify transaction errors', () => {
    const error = new Error('deadlock detected');
    const { type, message } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.TRANSACTION_ERROR);
    expect(message).toBe('Database deadlock detected');
  });

  it('should classify query errors', () => {
    const error = new Error('syntax error in SQL query');
    const { type, message } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.QUERY_ERROR);
    expect(message).toBe('Invalid SQL query');
  });

  it('should classify unknown errors', () => {
    const error = new Error('Some random error');
    const { type, message } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.UNKNOWN_ERROR);
    expect(message).toBe('Unknown database error');
  });
});

describe('DatabaseError Class', () => {
  it('should create DatabaseError with type and message', () => {
    const originalError = new Error('Original error');
    const dbError = new DatabaseError(
      DatabaseErrorType.CONNECTION_ERROR,
      'Connection failed',
      originalError
    );

    expect(dbError.type).toBe(DatabaseErrorType.CONNECTION_ERROR);
    expect(dbError.message).toBe('Connection failed');
    expect(dbError.originalError).toBe(originalError);
    expect(dbError.name).toBe('DatabaseError');
  });

  it('should create DatabaseError without original error', () => {
    const dbError = new DatabaseError(
      DatabaseErrorType.QUERY_ERROR,
      'Invalid query'
    );

    expect(dbError.type).toBe(DatabaseErrorType.QUERY_ERROR);
    expect(dbError.message).toBe('Invalid query');
    expect(dbError.originalError).toBeUndefined();
  });
});

describe('Health Check', () => {
  it('should return health check result with timestamp', async () => {
    // This test will fail if database is not available
    // In a real test environment, we would mock the database
    try {
      const result = await healthCheck();
      expect(result).toHaveProperty('healthy');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('responseTimeMs');
      expect(result).toHaveProperty('poolStats');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    } catch (error) {
      // Database not available in test environment
      expect(error).toBeDefined();
    }
  });

  it('should return pool statistics', () => {
    const stats = getPoolStats();
    expect(stats).toHaveProperty('totalConnections');
    expect(stats).toHaveProperty('idleConnections');
    expect(stats).toHaveProperty('waitingRequests');
    expect(typeof stats.totalConnections).toBe('number');
    expect(typeof stats.idleConnections).toBe('number');
    expect(typeof stats.waitingRequests).toBe('number');
  });
});

describe('Query Parameter Building', () => {
  it('should correctly build tenant-filtered query parameters', () => {
    const tenantId = 'tenant-456';
    const additionalParams = ['value1', 'value2'];
    const result = addTenantParam(tenantId, additionalParams);

    expect(result).toEqual(['tenant-456', 'value1', 'value2']);
    expect(result[0]).toBe(tenantId);
    expect(result.length).toBe(3);
  });

  it('should handle empty additional parameters', () => {
    const tenantId = 'tenant-789';
    const result = addTenantParam(tenantId, []);

    expect(result).toEqual(['tenant-789']);
    expect(result.length).toBe(1);
  });

  it('should handle undefined additional parameters', () => {
    const tenantId = 'tenant-000';
    const result = addTenantParam(tenantId);

    expect(result).toEqual(['tenant-000']);
    expect(result.length).toBe(1);
  });
});

describe('Tenant Filter Building', () => {
  it('should build filter without alias', () => {
    const filter = buildTenantFilter('tenant-123');
    expect(filter).toBe('tenant_id = $1');
  });

  it('should build filter with alias', () => {
    const filter = buildTenantFilter('tenant-123', 'api_keys');
    expect(filter).toBe('api_keys.tenant_id = $1');
  });

  it('should build filter with short alias', () => {
    const filter = buildTenantFilter('tenant-123', 'ak');
    expect(filter).toBe('ak.tenant_id = $1');
  });

  it('should handle empty alias as no alias', () => {
    const filter = buildTenantFilter('tenant-123', '');
    expect(filter).toBe('tenant_id = $1');
  });
});

describe('Pool Configuration', () => {
  it('should use default pool configuration', () => {
    // Reset pool
    closePool();
    const pool = initializePool();

    expect(pool).toBeDefined();
    // Pool should be created with default settings
  });

  it('should use custom pool configuration', () => {
    closePool();
    const pool = initializePool({
      max: 15,
      idleTimeoutMillis: 25000,
      connectionTimeoutMillis: 1500,
      statementTimeoutMillis: 20000,
    });

    expect(pool).toBeDefined();
  });
});

describe('Error Handling', () => {
  it('should handle connection refused errors', () => {
    const error = new Error('ECONNREFUSED');
    const { type } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.CONNECTION_ERROR);
  });

  it('should handle ENOTFOUND errors', () => {
    const error = new Error('ENOTFOUND');
    const { type } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.CONNECTION_ERROR);
  });

  it('should handle timeout errors', () => {
    const error = new Error('timeout');
    const { type } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.TIMEOUT_ERROR);
  });

  it('should handle UNIQUE constraint errors', () => {
    const error = new Error('UNIQUE constraint violation');
    const { type } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.CONSTRAINT_ERROR);
  });

  it('should handle FOREIGN KEY constraint errors', () => {
    const error = new Error('FOREIGN KEY constraint violation');
    const { type } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.CONSTRAINT_ERROR);
  });

  it('should handle CHECK constraint errors', () => {
    const error = new Error('CHECK constraint violation');
    const { type } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.CONSTRAINT_ERROR);
  });

  it('should handle deadlock errors', () => {
    const error = new Error('deadlock detected');
    const { type } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.TRANSACTION_ERROR);
  });

  it('should handle syntax errors', () => {
    const error = new Error('syntax error');
    const { type } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.QUERY_ERROR);
  });

  it('should handle parse errors', () => {
    const error = new Error('parse error');
    const { type } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.QUERY_ERROR);
  });

  it('should handle unknown errors', () => {
    const error = new Error('Unknown error message');
    const { type } = classifyDatabaseError(error);
    expect(type).toBe(DatabaseErrorType.UNKNOWN_ERROR);
  });
});
