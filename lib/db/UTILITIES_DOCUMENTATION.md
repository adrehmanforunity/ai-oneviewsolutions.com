# Database Connection Pool and Utilities Documentation

## Overview

The database utilities module (`lib/db/index.ts`) provides a comprehensive set of functions for managing PostgreSQL connections, executing queries, handling transactions, and ensuring multi-tenant isolation. The module is built on top of the `pg` library and provides connection pooling, error handling, and tenant-aware query execution.

## Connection Pool Management

### Initialization

The connection pool should be initialized once at application startup:

```typescript
import { initializePool, getPool, closePool } from 'lib/db';

// Initialize with default configuration
const pool = initializePool();

// Or with custom configuration
const pool = initializePool({
  max: 15,                      // Maximum connections (default: 20)
  idleTimeoutMillis: 25000,     // Idle timeout in ms (default: 30000)
  connectionTimeoutMillis: 1500, // Connection timeout in ms (default: 2000)
  statementTimeoutMillis: 20000, // Statement timeout in ms (default: 30000)
});

// Get the pool instance
const pool = getPool();

// Close the pool at application shutdown
await closePool();
```

### Pool Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `max` | 20 | Maximum number of connections in the pool |
| `idleTimeoutMillis` | 30000 | Time in milliseconds before idle connections are closed |
| `connectionTimeoutMillis` | 2000 | Time in milliseconds to wait for a connection |
| `statementTimeoutMillis` | 30000 | Time in milliseconds for statement execution timeout |

## Query Execution

### Basic Query Functions

#### `query<T>(queryStr: string, values?: any[]): Promise<QueryResult<T>>`

Execute a raw SQL query and return the full result object:

```typescript
import { query } from 'lib/db';

const result = await query('SELECT * FROM api_keys WHERE id = $1', ['key-123']);
console.log(result.rows);      // Array of rows
console.log(result.rowCount);  // Number of affected rows
```

#### `queryOne<T>(queryStr: string, values?: any[]): Promise<T | null>`

Execute a query and return the first row or null:

```typescript
import { queryOne } from 'lib/db';

const key = await queryOne('SELECT * FROM api_keys WHERE id = $1', ['key-123']);
if (key) {
  console.log(key.email_address);
}
```

#### `queryMany<T>(queryStr: string, values?: any[]): Promise<T[]>`

Execute a query and return all rows as an array:

```typescript
import { queryMany } from 'lib/db';

const keys = await queryMany('SELECT * FROM api_keys WHERE active = true');
console.log(keys.length);
```

#### `queryCount(queryStr: string, values?: any[]): Promise<number>`

Execute a query and return the count:

```typescript
import { queryCount } from 'lib/db';

const count = await queryCount('SELECT COUNT(*) FROM api_keys WHERE tenant_id = $1', ['tenant-123']);
console.log(`Total keys: ${count}`);
```

## Tenant-Filtered Queries

Tenant-filtered queries automatically prepend the tenant ID as the first parameter, ensuring multi-tenant isolation at the database level.

### Tenant Query Functions

#### `tenantQuery<T>(tenantId: string, queryStr: string, values?: any[]): Promise<QueryResult<T>>`

Execute a tenant-filtered query:

```typescript
import { tenantQuery } from 'lib/db';

// Query must include $1 placeholder for tenant_id
const result = await tenantQuery(
  'tenant-123',
  'SELECT * FROM api_keys WHERE tenant_id = $1 AND active = true'
);
```

#### `tenantQueryOne<T>(tenantId: string, queryStr: string, values?: any[]): Promise<T | null>`

Execute a tenant-filtered query and return the first row:

```typescript
import { tenantQueryOne } from 'lib/db';

const key = await tenantQueryOne(
  'tenant-123',
  'SELECT * FROM api_keys WHERE tenant_id = $1 AND id = $2',
  ['key-456']
);
```

#### `tenantQueryMany<T>(tenantId: string, queryStr: string, values?: any[]): Promise<T[]>`

Execute a tenant-filtered query and return all rows:

```typescript
import { tenantQueryMany } from 'lib/db';

const keys = await tenantQueryMany(
  'tenant-123',
  'SELECT * FROM api_keys WHERE tenant_id = $1 ORDER BY created_at DESC'
);
```

#### `tenantQueryCount(tenantId: string, queryStr: string, values?: any[]): Promise<number>`

Execute a tenant-filtered query and return the count:

```typescript
import { tenantQueryCount } from 'lib/db';

const count = await tenantQueryCount(
  'tenant-123',
  'SELECT COUNT(*) FROM api_keys WHERE tenant_id = $1'
);
```

## Tenant Isolation Utilities

### `buildTenantFilter(tenantId: string, tableAlias?: string): string`

Build a WHERE clause for tenant isolation:

```typescript
import { buildTenantFilter } from 'lib/db';

const filter = buildTenantFilter('tenant-123');
// Returns: "tenant_id = $1"

const filterWithAlias = buildTenantFilter('tenant-123', 'ak');
// Returns: "ak.tenant_id = $1"
```

### `addTenantParam(tenantId: string, existingParams?: any[]): any[]`

Add tenant ID to query parameters:

```typescript
import { addTenantParam } from 'lib/db';

const params = addTenantParam('tenant-123', ['value1', 'value2']);
// Returns: ['tenant-123', 'value1', 'value2']
```

### `verifyTenantOwnership(resourceId: string, tenantId: string, table: string): Promise<boolean>`

Verify that a resource belongs to a tenant:

```typescript
import { verifyTenantOwnership } from 'lib/db';

const owns = await verifyTenantOwnership('key-123', 'tenant-456', 'api_keys');
if (!owns) {
  throw new Error('Unauthorized');
}
```

### `verifyResourceAccess(resourceId: string, tenantId: string, userId?: string): Promise<boolean>`

Verify that a tenant has access to a resource (owned or shared):

```typescript
import { verifyResourceAccess } from 'lib/db';

const hasAccess = await verifyResourceAccess('key-123', 'tenant-456');
if (!hasAccess) {
  throw new Error('Access denied');
}
```

## Common Tenant-Filtered Queries

### `getKeysByTenant(tenantId: string): Promise<any[]>`

Get all API keys for a tenant:

```typescript
import { getKeysByTenant } from 'lib/db';

const keys = await getKeysByTenant('tenant-123');
```

### `getProvidersByTenant(tenantId: string): Promise<any[]>`

Get all providers with key counts for a tenant:

```typescript
import { getProvidersByTenant } from 'lib/db';

const providers = await getProvidersByTenant('tenant-123');
// Returns: [{ id, name, provider_type, key_count }, ...]
```

### `getActiveKeysByProvider(tenantId: string, providerId: string): Promise<any[]>`

Get active keys for a provider and tenant:

```typescript
import { getActiveKeysByProvider } from 'lib/db';

const keys = await getActiveKeysByProvider('tenant-123', 'provider-456');
```

### `getActivityLogByTenant(tenantId: string, limit?: number, offset?: number): Promise<any[]>`

Get activity log entries for a tenant:

```typescript
import { getActivityLogByTenant } from 'lib/db';

const logs = await getActivityLogByTenant('tenant-123', 100, 0);
```

### `getCostRecordsByTenant(tenantId: string, startDate: Date, endDate: Date): Promise<any[]>`

Get cost records for a tenant within a date range:

```typescript
import { getCostRecordsByTenant } from 'lib/db';

const costs = await getCostRecordsByTenant(
  'tenant-123',
  new Date('2024-01-01'),
  new Date('2024-01-31')
);
```

## Transaction Management

### `withTransaction<T>(callback: (client: PoolClient) => Promise<T>, retryConfig?: RetryConfig): Promise<T>`

Execute a function within a database transaction with automatic retry logic:

```typescript
import { withTransaction } from 'lib/db';

const result = await withTransaction(async (client) => {
  // Execute multiple queries within a transaction
  await client.query('INSERT INTO api_keys (...) VALUES (...)');
  await client.query('INSERT INTO activity_log (...) VALUES (...)');
  return { success: true };
});
```

#### Retry Configuration

```typescript
const result = await withTransaction(
  async (client) => {
    // Transaction logic
  },
  {
    maxAttempts: 3,           // Number of retry attempts (default: 3)
    delayMs: 100,             // Initial delay in milliseconds (default: 100)
    backoffMultiplier: 2,     // Exponential backoff multiplier (default: 2)
  }
);
```

### `transactionQuery<T>(client: PoolClient, queryStr: string, values?: any[]): Promise<QueryResult<T>>`

Execute a query within a transaction:

```typescript
import { withTransaction, transactionQuery } from 'lib/db';

await withTransaction(async (client) => {
  const result = await transactionQuery(
    client,
    'INSERT INTO api_keys (...) VALUES (...)',
    [...]
  );
});
```

### `transactionTenantQuery<T>(client: PoolClient, tenantId: string, queryStr: string, values?: any[]): Promise<QueryResult<T>>`

Execute a tenant-filtered query within a transaction:

```typescript
import { withTransaction, transactionTenantQuery } from 'lib/db';

await withTransaction(async (client) => {
  const result = await transactionTenantQuery(
    client,
    'tenant-123',
    'SELECT * FROM api_keys WHERE tenant_id = $1 AND id = $2',
    ['key-456']
  );
});
```

## Health Checks

### `healthCheck(): Promise<HealthCheckResult>`

Check database connection health:

```typescript
import { healthCheck } from 'lib/db';

const result = await healthCheck();
console.log(result.healthy);        // boolean
console.log(result.responseTimeMs); // number
console.log(result.poolStats);      // { totalConnections, idleConnections, waitingRequests }
console.log(result.error);          // string | undefined
```

### `getPoolStats(): { totalConnections: number; idleConnections: number; waitingRequests: number }`

Get current pool statistics:

```typescript
import { getPoolStats } from 'lib/db';

const stats = getPoolStats();
console.log(`Total: ${stats.totalConnections}, Idle: ${stats.idleConnections}`);
```

### `waitForDatabase(timeoutMs?: number): Promise<boolean>`

Wait for database to be ready (useful for startup):

```typescript
import { waitForDatabase } from 'lib/db';

const ready = await waitForDatabase(10000); // Wait up to 10 seconds
if (!ready) {
  console.error('Database not ready');
  process.exit(1);
}
```

## Error Handling

### Error Types

```typescript
import { DatabaseErrorType } from 'lib/db';

enum DatabaseErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  QUERY_ERROR = 'QUERY_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONSTRAINT_ERROR = 'CONSTRAINT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
```

### `classifyDatabaseError(error: any): { type: DatabaseErrorType; message: string }`

Classify a database error:

```typescript
import { classifyDatabaseError } from 'lib/db';

try {
  await query('SELECT * FROM api_keys');
} catch (error) {
  const { type, message } = classifyDatabaseError(error);
  console.log(`Error type: ${type}, Message: ${message}`);
}
```

### `DatabaseError` Class

Custom error class for database errors:

```typescript
import { DatabaseError, DatabaseErrorType } from 'lib/db';

try {
  await query('SELECT * FROM api_keys');
} catch (error) {
  const { type, message } = classifyDatabaseError(error);
  throw new DatabaseError(type, message, error);
}
```

### `queryWithErrorHandling<T>(queryStr: string, values?: any[]): Promise<QueryResult<T>>`

Execute a query with automatic error classification:

```typescript
import { queryWithErrorHandling } from 'lib/db';

try {
  const result = await queryWithErrorHandling('SELECT * FROM api_keys');
} catch (error) {
  if (error instanceof DatabaseError) {
    console.log(`Database error: ${error.type}`);
  }
}
```

## Best Practices

### 1. Always Use Tenant-Filtered Queries

For multi-tenant isolation, always use tenant-filtered queries:

```typescript
// ✅ Good - Tenant-filtered
const keys = await tenantQueryMany('tenant-123', 'SELECT * FROM api_keys WHERE tenant_id = $1');

// ❌ Bad - Not tenant-filtered
const keys = await queryMany('SELECT * FROM api_keys');
```

### 2. Use Transactions for Multi-Step Operations

When performing multiple related operations, use transactions:

```typescript
// ✅ Good - Transactional
await withTransaction(async (client) => {
  await transactionQuery(client, 'INSERT INTO api_keys (...) VALUES (...)');
  await transactionQuery(client, 'INSERT INTO activity_log (...) VALUES (...)');
});

// ❌ Bad - Not transactional
await query('INSERT INTO api_keys (...) VALUES (...)');
await query('INSERT INTO activity_log (...) VALUES (...)');
```

### 3. Verify Tenant Ownership Before Operations

Always verify tenant ownership before performing operations:

```typescript
// ✅ Good - Verified
const owns = await verifyTenantOwnership('key-123', 'tenant-456', 'api_keys');
if (!owns) throw new Error('Unauthorized');
await query('DELETE FROM api_keys WHERE id = $1', ['key-123']);

// ❌ Bad - Not verified
await query('DELETE FROM api_keys WHERE id = $1', ['key-123']);
```

### 4. Use Parameterized Queries

Always use parameterized queries to prevent SQL injection:

```typescript
// ✅ Good - Parameterized
const key = await queryOne('SELECT * FROM api_keys WHERE id = $1', ['key-123']);

// ❌ Bad - String concatenation
const key = await queryOne(`SELECT * FROM api_keys WHERE id = 'key-123'`);
```

### 5. Handle Errors Appropriately

Classify and handle errors appropriately:

```typescript
// ✅ Good - Error handling
try {
  await query('INSERT INTO api_keys (...) VALUES (...)');
} catch (error) {
  const { type, message } = classifyDatabaseError(error);
  if (type === DatabaseErrorType.CONSTRAINT_ERROR) {
    // Handle constraint violation
  } else if (type === DatabaseErrorType.CONNECTION_ERROR) {
    // Handle connection error
  }
}
```

## Testing

The database utilities include comprehensive unit tests. Run tests with:

```bash
npm run test:run
```

Tests cover:
- Connection pool initialization and management
- Tenant isolation utilities
- Error classification
- Query parameter building
- Health checks
- Error handling

## Migration Utilities

### `readMigration(migrationName: string): Promise<string>`

Read migration file content:

```typescript
import { readMigration } from 'lib/db';

const sql = await readMigration('001_initial_schema.sql');
```

### `executeMigration(migrationName: string): Promise<void>`

Execute a migration:

```typescript
import { executeMigration } from 'lib/db';

await executeMigration('001_initial_schema.sql');
```

### `tableExists(tableName: string): Promise<boolean>`

Check if a table exists:

```typescript
import { tableExists } from 'lib/db';

const exists = await tableExists('api_keys');
```

## Environment Variables

The database utilities require the following environment variable:

```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

For Neon PostgreSQL:

```bash
DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require
```

## Performance Considerations

1. **Connection Pooling**: The pool maintains up to 20 connections by default. Adjust based on your workload.
2. **Query Optimization**: Use indexes on frequently queried columns (tenant_id, provider_id, active status).
3. **Batch Operations**: Use transactions for batch operations to reduce round-trips.
4. **Monitoring**: Use `getPoolStats()` to monitor pool usage and adjust configuration as needed.

## Troubleshooting

### Connection Refused

```
Error: ECONNREFUSED: Connection refused
```

**Solution**: Verify DATABASE_URL is correct and database is running.

### Connection Timeout

```
Error: timeout acquiring a client from the pool
```

**Solution**: Increase `connectionTimeoutMillis` or reduce concurrent connections.

### Statement Timeout

```
Error: Query timeout
```

**Solution**: Optimize query or increase `statementTimeoutMillis`.

### Constraint Violations

```
Error: duplicate key value violates unique constraint
```

**Solution**: Check for duplicate values or handle constraint errors appropriately.
