# Database Setup and Configuration

This directory contains all database-related code for the AI Provider Management system.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in the project root:

```env
# PostgreSQL Connection String (Neon)
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# Encryption Master Key (for AES-256 encryption)
ENCRYPTION_MASTER_KEY=your-32-byte-hex-key-here
```

**Generating an Encryption Master Key**:

```bash
# Generate a random 32-byte (256-bit) key in hex format
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run Migrations

```bash
# Using TypeScript
npx ts-node lib/db/migrate.ts

# Or using Node.js with ts-node
node -r ts-node/register lib/db/migrate.ts
```

### 4. Verify Schema

```bash
# Connect to your database
psql $DATABASE_URL

# List all tables
\dt

# Describe a table
\d api_keys

# Exit
\q
```

## File Structure

```
lib/db/
├── index.ts                    # Database connection pool and utilities
├── schema.ts                   # TypeScript interfaces for all tables
├── migrate.ts                  # Migration runner script
├── migrations/
│   └── 001_initial_schema.sql  # Initial schema creation
├── SCHEMA_DOCUMENTATION.md     # Comprehensive schema documentation
└── README.md                   # This file
```

## Database Connection

### Connection Pool

The database connection pool is initialized automatically when first needed:

```typescript
import { getPool, query, queryOne, queryMany } from '@/lib/db';

// Get the connection pool
const pool = getPool();

// Execute a query
const result = await query('SELECT * FROM providers');

// Get a single row
const provider = await queryOne('SELECT * FROM providers WHERE id = $1', [providerId]);

// Get multiple rows
const providers = await queryMany('SELECT * FROM providers');
```

### Connection Pool Configuration

- **Max connections**: 20
- **Idle timeout**: 30 seconds
- **Connection timeout**: 2 seconds

Adjust these values in `lib/db/index.ts` if needed.

## Transactions

Execute multiple queries within a transaction:

```typescript
import { withTransaction } from '@/lib/db';

const result = await withTransaction(async (client) => {
  // Execute queries within transaction
  await client.query('INSERT INTO api_keys (...) VALUES (...)');
  await client.query('INSERT INTO activity_log (...) VALUES (...)');
  
  // If any query fails, all changes are rolled back
  return { success: true };
});
```

## Tenant Isolation

All queries must filter by `tenant_id` for multi-tenant isolation:

```typescript
import { buildTenantFilter, addTenantParam, queryMany } from '@/lib/db';

const tenantId = 'tenant-123';

// Build WHERE clause
const whereClause = buildTenantFilter(tenantId);
// Result: "tenant_id = $1"

// Add tenant ID to parameters
const params = addTenantParam(tenantId, [providerId]);
// Result: ['tenant-123', 'provider-456']

// Execute query
const keys = await queryMany(
  `SELECT * FROM api_keys WHERE ${whereClause} AND provider_id = $2`,
  params
);
```

## Security

### API Key Encryption

API keys are encrypted using AES-256-GCM:

```typescript
import crypto from 'crypto';

const masterKey = Buffer.from(process.env.ENCRYPTION_MASTER_KEY!, 'hex');

// Encrypt a key
function encryptKey(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return: iv + authTag + encrypted (all hex encoded)
  return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

// Decrypt a key
function decryptKey(encrypted: string): string {
  const iv = Buffer.from(encrypted.slice(0, 32), 'hex');
  const authTag = Buffer.from(encrypted.slice(32, 64), 'hex');
  const ciphertext = encrypted.slice(64);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### Key Masking

API keys are masked in API responses (show only last 4 characters):

```typescript
function maskKey(fullKey: string): string {
  if (fullKey.length < 4) {
    return '****';
  }
  
  const lastFour = fullKey.slice(-4);
  const prefix = fullKey.split('_')[0] || 'key';
  
  return `${prefix}_...${lastFour}`;
}

// Example: "gsk_abc123def456" → "gsk_...def456"
```

### Activity Logging

All operations are logged to the immutable `activity_log` table:

```typescript
import { query } from '@/lib/db';

await query(
  `INSERT INTO activity_log (
    tenant_id, key_id, action_type, status, user_id, user_role, created_at
  ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
  [tenantId, keyId, 'add', 'success', userId, 'Tenant Admin']
);
```

## Monitoring

### Health Check

```typescript
import { healthCheck, getPoolStats } from '@/lib/db';

// Check database connection
const isHealthy = await healthCheck();

// Get pool statistics
const stats = getPoolStats();
console.log(`Total connections: ${stats.totalConnections}`);
console.log(`Idle connections: ${stats.idleConnections}`);
console.log(`Waiting requests: ${stats.waitingRequests}`);
```

### Slow Query Monitoring

Enable slow query logging in PostgreSQL:

```sql
-- Set log_min_duration_statement to log queries slower than 1 second
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Reload configuration
SELECT pg_reload_conf();
```

## Troubleshooting

### Connection Refused

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution**: Verify DATABASE_URL is correct and PostgreSQL is running

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Authentication Failed

**Error**: `Error: password authentication failed for user "postgres"`

**Solution**: Check username and password in DATABASE_URL

```bash
# Format: postgresql://username:password@host:port/database
```

### SSL Certificate Error

**Error**: `Error: self signed certificate`

**Solution**: Add `?sslmode=require` to DATABASE_URL for Neon

```env
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

### Migration Failed

**Error**: `Error: relation "providers" already exists`

**Solution**: Migrations are idempotent (use `IF NOT EXISTS`), but check for partial migrations

```bash
# Check which tables exist
psql $DATABASE_URL -c "\dt"

# If needed, drop all tables and re-run migrations
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npx ts-node lib/db/migrate.ts
```

### Pool Exhausted

**Error**: `Error: Client was not released. Did the client.release() fail?`

**Solution**: Ensure all queries are properly awaited and errors are handled

```typescript
// ✓ Correct
const result = await query('SELECT * FROM providers');

// ✗ Incorrect (missing await)
query('SELECT * FROM providers');
```

## Performance Tips

### 1. Use Indexes

All common query patterns have indexes. Check `SCHEMA_DOCUMENTATION.md` for index strategy.

### 2. Filter by Tenant First

Always filter by `tenant_id` first to leverage indexes:

```typescript
// ✓ Good - uses idx_api_keys_tenant_provider
const keys = await queryMany(
  'SELECT * FROM api_keys WHERE tenant_id = $1 AND provider_id = $2',
  [tenantId, providerId]
);

// ✗ Bad - full table scan
const keys = await queryMany(
  'SELECT * FROM api_keys WHERE provider_id = $1 AND tenant_id = $2',
  [providerId, tenantId]
);
```

### 3. Use LIMIT and OFFSET for Pagination

```typescript
const limit = 20;
const offset = (page - 1) * limit;

const keys = await queryMany(
  'SELECT * FROM api_keys WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
  [tenantId, limit, offset]
);
```

### 4. Use Prepared Statements

Always use parameterized queries to prevent SQL injection:

```typescript
// ✓ Correct - parameterized
const result = await query('SELECT * FROM api_keys WHERE id = $1', [keyId]);

// ✗ Incorrect - SQL injection vulnerability
const result = await query(`SELECT * FROM api_keys WHERE id = '${keyId}'`);
```

## Backup and Recovery

### Backup Database

```bash
# Full backup
pg_dump $DATABASE_URL > backup.sql

# Compressed backup
pg_dump $DATABASE_URL | gzip > backup.sql.gz

# Backup specific table
pg_dump $DATABASE_URL -t api_keys > api_keys_backup.sql
```

### Restore Database

```bash
# Restore from backup
psql $DATABASE_URL < backup.sql

# Restore from compressed backup
gunzip -c backup.sql.gz | psql $DATABASE_URL

# Restore specific table
psql $DATABASE_URL < api_keys_backup.sql
```

## Next Steps

1. **Create Services**: Implement business logic services in `lib/services/`
2. **Create API Routes**: Implement API endpoints in `app/api/`
3. **Create UI Components**: Implement React components in `components/`
4. **Write Tests**: Add unit and integration tests in `__tests__/`

See the main `README.md` for the complete implementation roadmap.
