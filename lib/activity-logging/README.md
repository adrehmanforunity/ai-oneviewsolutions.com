# Activity Logging Service

The Activity Logging Service provides an immutable append-only audit trail for all API key operations in the AI Provider Management system. This service ensures compliance, enables debugging, and provides comprehensive operational visibility.

## Features

- **Immutable Append-Only Logs**: All logs are write-once, read-many. Database triggers prevent updates or deletions.
- **Comprehensive Metadata**: Each log entry includes tenant_id, timestamp, user_id, provider, key_id, action_type, status, and cost information.
- **Multi-Tenant Isolation**: Logs are automatically filtered by tenant_id to ensure data isolation.
- **Flexible Filtering**: Query logs by action type, status, date range, provider, and key.
- **Statistics & Analytics**: Calculate operation counts, success rates, and cost summaries.
- **Export Capabilities**: Export logs as CSV or JSON for external analysis.
- **Role Tracking**: Track which user role performed each operation (Tenant Admin, Super Admin, etc.).
- **Cost Tracking**: Log costs in both USD and PKR for financial tracking.

## Installation

The Activity Logging Service is part of the AI Provider Management system. No additional installation is required.

## Usage

### Basic Logging

```typescript
import * as activityLogging from './lib/activity-logging';

// Log key creation
await activityLogging.logKeyCreated(
  tenantId,
  keyId,
  providerId,
  'user@example.com',
  userId,
  'Tenant Admin'
);

// Log key usage
await activityLogging.logKeyUsed(
  tenantId,
  keyId,
  providerId,
  1000,  // tokens used
  0.01,  // cost in USD
  1.50,  // cost in PKR
  'success'
);

// Log key test
await activityLogging.logKeyTested(
  tenantId,
  keyId,
  providerId,
  'valid',  // test status
  150,      // response time in ms
  undefined,
  userId,
  'Tenant Admin'
);
```

### Retrieving Logs

```typescript
// Get all logs for a tenant
const logs = await activityLogging.getActivityLog(tenantId);

// Get logs with filters
const logs = await activityLogging.getActivityLog(tenantId, {
  actionType: 'use',
  status: 'success',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  limit: 100,
  offset: 0,
});

// Get single log entry
const entry = await activityLogging.getActivityLogEntry(tenantId, entryId);
```

### Statistics & Analytics

```typescript
// Get activity log statistics
const stats = await activityLogging.getActivityLogStats(tenantId);

console.log(stats);
// {
//   totalOperations: 1250,
//   operationsByType: {
//     add: 50,
//     delete: 10,
//     test: 200,
//     rotate: 100,
//     enable: 50,
//     disable: 50,
//     use: 750,
//     share: 30,
//     unshare: 10
//   },
//   operationsByStatus: {
//     success: 1200,
//     failed: 30,
//     rate_limited: 15,
//     invalid: 5
//   },
//   operationsByProvider: {
//     'provider-1': 600,
//     'provider-2': 400,
//     'provider-3': 250
//   },
//   successRate: 96,
//   failureRate: 4,
//   averageCostUsd: 0.008,
//   totalCostUsd: 10.00,
//   totalCostPkr: 1500.00
// }
```

### Exporting Logs

```typescript
// Export as CSV
const csv = await activityLogging.exportActivityLogAsCSV(tenantId, {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
});

// Export as JSON
const json = await activityLogging.exportActivityLogAsJSON(tenantId, {
  actionType: 'use',
  status: 'success',
});
```

## API Reference

### Logging Functions

#### `logKeyOperation(tenantId, actionType, status, options?)`

Main function to log a key operation. Used internally by all other logging functions.

**Parameters:**
- `tenantId` (string): Tenant ID
- `actionType` (ActivityActionType): Type of action (add, delete, test, rotate, enable, disable, use, share, unshare)
- `status` (ActivityStatus): Status of the operation (success, failed, rate_limited, invalid)
- `options` (object, optional):
  - `keyId` (string): API key ID
  - `userId` (string): User ID
  - `userRole` (UserRole): User role (Tenant Admin, Super Admin, etc.)
  - `primaryTenantId` (string): Primary tenant ID (for shared keys)
  - `affectedTenants` (string[]): Affected tenant IDs (for shared keys)
  - `tokensUsed` (number): Tokens used
  - `costUsd` (number): Cost in USD
  - `costPkr` (number): Cost in PKR
  - `errorMessage` (string): Error message
  - `actionDetails` (object): Additional context

**Returns:** `Promise<ActivityLogEntry>`

#### `logKeyCreated(tenantId, keyId, providerId, emailAddress, userId?, userRole?)`

Log key creation.

#### `logKeyDeleted(tenantId, keyId, providerId, emailAddress, userId?, userRole?)`

Log key deletion.

#### `logKeyTested(tenantId, keyId, providerId, testStatus, responseTimeMs, errorMessage?, userId?, userRole?)`

Log key test.

**Parameters:**
- `testStatus` ('valid' | 'invalid' | 'rate_limited'): Test result status

#### `logKeyRotated(tenantId, previousKeyId, newKeyId, providerId, reason)`

Log key rotation (switching to next key due to rate limiting or failure).

#### `logKeyEnabled(tenantId, keyId, providerId, userId?, userRole?, affectedTenants?, primaryTenantId?)`

Log key enable.

#### `logKeyDisabled(tenantId, keyId, providerId, reason?, userId?, userRole?, affectedTenants?, primaryTenantId?)`

Log key disable.

#### `logKeyUsed(tenantId, keyId, providerId, tokensUsed, costUsd, costPkr, status?, errorMessage?)`

Log key usage (AI call made with this key).

#### `logKeyShared(tenantId, keyId, providerId, sharedTenantIds, userId, userRole)`

Log key sharing (Super Admin shares key with other tenants).

#### `logKeyUnshared(tenantId, keyId, providerId, revokedTenantIds, userId, userRole)`

Log key unsharing (Super Admin revokes key from tenants).

### Retrieval Functions

#### `getActivityLog(tenantId, filter?)`

Get activity log entries with optional filtering.

**Parameters:**
- `tenantId` (string): Tenant ID
- `filter` (ActivityLogFilter, optional):
  - `providerId` (string): Filter by provider ID
  - `keyId` (string): Filter by key ID
  - `actionType` (ActivityActionType): Filter by action type
  - `status` (ActivityStatus): Filter by status
  - `startDate` (Date): Filter by start date
  - `endDate` (Date): Filter by end date
  - `limit` (number): Limit number of results
  - `offset` (number): Offset for pagination

**Returns:** `Promise<ActivityLogEntry[]>`

#### `getActivityLogEntry(tenantId, entryId)`

Get single activity log entry.

**Parameters:**
- `tenantId` (string): Tenant ID
- `entryId` (string): Entry ID

**Returns:** `Promise<ActivityLogEntry | null>`

#### `getActivityLogStats(tenantId, filter?)`

Get activity log statistics.

**Parameters:**
- `tenantId` (string): Tenant ID
- `filter` (ActivityLogFilter, optional): Optional filter

**Returns:** `Promise<ActivityLogStats>`

### Export Functions

#### `exportActivityLogAsCSV(tenantId, filter?)`

Export activity log as CSV.

**Parameters:**
- `tenantId` (string): Tenant ID
- `filter` (ActivityLogFilter, optional): Optional filter

**Returns:** `Promise<string>` (CSV string)

#### `exportActivityLogAsJSON(tenantId, filter?)`

Export activity log as JSON.

**Parameters:**
- `tenantId` (string): Tenant ID
- `filter` (ActivityLogFilter, optional): Optional filter

**Returns:** `Promise<string>` (JSON string)

### Utility Functions

#### `verifyActivityLogImmutability(tenantId, entryId)`

Verify that activity log is immutable (no updates or deletes).

**Parameters:**
- `tenantId` (string): Tenant ID
- `entryId` (string): Entry ID

**Returns:** `Promise<boolean>`

## Data Types

### ActivityLogEntry

```typescript
interface ActivityLogEntry {
  id: string;
  tenantId: string;
  keyId?: string;
  actionType: ActivityActionType;
  actionDetails?: Record<string, any>;
  tokensUsed?: number;
  costUsd?: number;
  costPkr?: number;
  status: ActivityStatus;
  errorMessage?: string;
  userId?: string;
  userRole?: UserRole;
  primaryTenantId?: string;
  affectedTenants?: string[];
  createdAt: Date;
}
```

### ActivityActionType

```typescript
type ActivityActionType = 'add' | 'delete' | 'test' | 'rotate' | 'enable' | 'disable' | 'use' | 'share' | 'unshare';
```

### ActivityStatus

```typescript
type ActivityStatus = 'success' | 'failed' | 'rate_limited' | 'invalid';
```

### ActivityLogFilter

```typescript
interface ActivityLogFilter {
  providerId?: string;
  keyId?: string;
  actionType?: ActivityActionType;
  status?: ActivityStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
```

### ActivityLogStats

```typescript
interface ActivityLogStats {
  totalOperations: number;
  operationsByType: Record<ActivityActionType, number>;
  operationsByStatus: Record<ActivityStatus, number>;
  operationsByProvider: Record<string, number>;
  successRate: number;  // percentage
  failureRate: number;  // percentage
  averageCostUsd: number;
  totalCostUsd: number;
  totalCostPkr: number;
}
```

## Database Schema

The Activity Logging Service uses the `activity_log` table:

```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,
  action_details JSONB,
  tokens_used BIGINT,
  cost_usd DECIMAL(10, 4),
  cost_pkr DECIMAL(12, 2),
  status VARCHAR(50),
  error_message TEXT,
  user_id UUID,
  user_role VARCHAR(50),
  primary_tenant_id UUID,
  affected_tenants TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Immutability Enforcement

The database includes a trigger that prevents UPDATE or DELETE operations on the `activity_log` table:

```sql
CREATE OR REPLACE FUNCTION prevent_activity_log_update()
RETURNS TRIGGER AS $
BEGIN
  RAISE EXCEPTION 'Activity log entries cannot be updated or deleted';
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER activity_log_immutable
BEFORE UPDATE OR DELETE ON activity_log
FOR EACH ROW
EXECUTE FUNCTION prevent_activity_log_update();
```

## Multi-Tenant Isolation

All activity log queries automatically filter by `tenant_id` to ensure data isolation:

```typescript
// This query only returns logs for the specified tenant
const logs = await activityLogging.getActivityLog(tenantId);

// Even if you try to query with a different tenant ID, you'll only get that tenant's logs
const otherTenantLogs = await activityLogging.getActivityLog(otherTenantId);
```

## Requirements Coverage

This service implements the following requirements:

- **6.1**: Log all key operations (add, delete, test, rotate, enable, disable, use)
- **6.2**: Log AI calls with timestamp, provider, key_id, tokens/characters, response time, status, cost
- **6.3**: Log rate-limited keys with timestamp, provider, key_id, rate limit error, reset time
- **6.4**: Log key rotations with timestamp, previous key, new key, reason
- **6.8**: Include tenant_id, timestamp, user_id, provider, key_id, action_type, status, cost_usd, cost_pkr
- **6.9**: Ensure logs are immutable (no editing or deletion)

## Testing

The Activity Logging Service includes comprehensive unit tests:

```bash
npm run test lib/activity-logging/index.test.ts
```

Test coverage includes:
- Log creation for all operation types
- Log retrieval with various filters
- Statistics calculation
- CSV/JSON export
- Multi-tenant isolation
- Immutability verification
- Error handling
- Cost tracking
- User role tracking

## Performance Considerations

- **Indexes**: The `activity_log` table includes indexes on `tenant_id`, `created_at`, `key_id`, `action_type`, and `user_id` for fast queries.
- **Pagination**: Use `limit` and `offset` parameters to paginate through large result sets.
- **Date Range Filtering**: Use `startDate` and `endDate` to limit query scope for historical data.
- **Archival**: Consider archiving old logs to a separate table or data warehouse for long-term storage.

## Security Considerations

- **Tenant Isolation**: All queries are automatically scoped to the requesting tenant.
- **Immutability**: Database triggers prevent accidental or malicious modification of logs.
- **Audit Trail**: All operations are logged with user ID and role for accountability.
- **Cost Tracking**: Costs are logged in both USD and PKR for financial transparency.

## Troubleshooting

### Logs not appearing

1. Verify that the `activity_log` table exists and has the correct schema.
2. Check that the database connection is working correctly.
3. Verify that the tenant_id is correct.

### Export is slow

1. Use date range filtering to limit the number of entries.
2. Consider archiving old logs to improve query performance.
3. Increase the `limit` parameter to reduce the number of queries.

### Immutability trigger not working

1. Verify that the trigger is created: `SELECT * FROM pg_trigger WHERE tgname = 'activity_log_immutable';`
2. Check the trigger function: `SELECT * FROM pg_proc WHERE proname = 'prevent_activity_log_update';`
3. Re-create the trigger if necessary.

## Future Enhancements

- **Real-time Alerts**: Send alerts when certain operations occur (e.g., key deletion, rate limiting).
- **Log Retention Policies**: Automatically archive or delete logs after a certain period.
- **Advanced Analytics**: Provide dashboards and reports for activity analysis.
- **Webhook Integration**: Send log events to external systems for integration.
- **Log Encryption**: Encrypt sensitive fields in logs for additional security.

## Related Services

- **Key Management Service** (`lib/key-management`): Creates and manages API keys.
- **Health Monitoring Service** (`lib/health-monitoring`): Tracks key health status.
- **Rotation Engine** (`lib/rotation`): Rotates keys based on configured strategies.
- **Cost Tracking Service** (`lib/cost-tracking`): Calculates and tracks costs.

## License

This service is part of the AI Provider Management system and is subject to the same license.
