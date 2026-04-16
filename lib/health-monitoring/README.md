# Key Health Monitoring Service

Tracks API key status (active, rate_limited, invalid, expired) and implements automatic recovery when quota resets.

## Overview

The Key Health Monitoring Service provides real-time tracking of API key health status with automatic detection of rate limiting and invalid keys. It integrates with the activity logging system to maintain an immutable audit trail of all status changes.

**Requirements:** 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7

## Key Features

- **Real-time Status Tracking**: Updates key health status within 1 second of detection
- **HTTP 429 Detection**: Automatically detects rate limiting and extracts reset times
- **HTTP 401 Detection**: Automatically detects invalid keys and disables them
- **Automatic Recovery**: Re-enables keys when quota resets
- **Activity Logging**: Logs all status changes for audit compliance
- **Multi-tenant Support**: Complete tenant isolation with tenant_id filtering
- **Batch Operations**: Retrieve health status for multiple keys efficiently

## Status Types

- **active**: Key is working normally
- **rate_limited**: Key has hit rate limit, will recover when quota resets
- **invalid**: Key is invalid or unauthorized, permanently disabled
- **expired**: Key has expired (future use)

## Core Functions

### trackKeyHealth(keyId, tenantId, response)

Main function to track key health based on HTTP response from provider API.

```typescript
const response: HttpResponse = {
  statusCode: 429,
  headers: { 'retry-after': '60' },
};

const update = await trackKeyHealth(keyId, tenantId, response);
// Returns: { keyId, previousStatus, newStatus, timestamp, reason }
```

**Behavior:**
- HTTP 200-299: Marks rate-limited keys as active (quota recovered)
- HTTP 401: Marks key as invalid and disables it
- HTTP 403/404: Marks key as invalid
- HTTP 429: Marks key as rate-limited
- HTTP 500+: Logs error but doesn't change status

### detectRateLimit(response)

Detects if HTTP response indicates rate limiting.

```typescript
const detection = detectRateLimit(response);
// Returns: { isRateLimited, resetTime, retryAfter }
```

**Extracts:**
- `retry-after` header (in seconds or HTTP date format)
- `x-ratelimit-reset` header
- Calculates reset time from current time + retry-after seconds

### detectInvalidKey(response)

Detects if HTTP response indicates invalid key.

```typescript
const detection = detectInvalidKey(response);
// Returns: { isInvalid, errorCode, errorMessage }
```

**Extracts:**
- Error code from response body (`error_code`, `code`)
- Error message from response body (`error_message`, `message`)

### markKeyRateLimited(keyId, tenantId, resetTime?)

Marks a key as rate-limited and logs the event.

```typescript
const health = await markKeyRateLimited(keyId, tenantId);
// Returns: KeyHealth object
```

### disableKey(keyId, tenantId, errorMessage?)

Disables an invalid key and logs the event.

```typescript
const health = await disableKey(keyId, tenantId, 'API key expired');
// Returns: KeyHealth object
```

**Side effects:**
- Sets `health_status` to 'invalid'
- Sets `active` to false
- Logs event to activity_log

### autoReenableKey(keyId, tenantId)

Re-enables a rate-limited key when quota resets.

```typescript
const health = await autoReenableKey(keyId, tenantId);
// Returns: KeyHealth object
```

**Behavior:**
- Only re-enables if key is currently rate-limited
- Sets `health_status` to 'active'
- Sets `active` to true
- Logs event to activity_log

### getKeyHealth(keyId, tenantId)

Retrieves current health status for a key.

```typescript
const health = await getKeyHealth(keyId, tenantId);
// Returns: {
//   keyId,
//   status: 'active' | 'rate_limited' | 'invalid' | 'expired',
//   lastStatusChange,
//   quotaPercentage
// }
```

### getHealthStatus(keyId, tenantId)

Retrieves health status with display information for UI.

```typescript
const status = await getHealthStatus(keyId, tenantId);
// Returns: {
//   status,
//   statusLabel: 'Active' | 'Rate Limited' | 'Invalid' | 'Expired',
//   statusColor: 'green' | 'orange' | 'red',
//   warningLevel: 'none' | 'warning' | 'critical',
//   quotaPercentage,
//   quotaLabel: '50% used'
// }
```

**Warning Levels:**
- `none`: Status is active, quota < 80%
- `warning`: Status is rate-limited OR quota 80-89%
- `critical`: Status is invalid/expired OR quota >= 90%

### updateKeyHealth(keyId, tenantId, newStatus, reason?, resetTime?)

Updates key health status in database and logs the change.

```typescript
const update = await updateKeyHealth(
  keyId,
  tenantId,
  'rate_limited',
  'Rate limit detected'
);
// Returns: {
//   keyId,
//   previousStatus,
//   newStatus,
//   timestamp,
//   reason
// }
```

## Batch Operations

### getProviderKeyHealth(tenantId, providerId)

Get health status for all keys of a provider.

```typescript
const health = await getProviderKeyHealth(tenantId, providerId);
// Returns: KeyHealth[]
```

### getRateLimitedKeys(tenantId)

Get all rate-limited keys for a tenant.

```typescript
const keys = await getRateLimitedKeys(tenantId);
// Returns: KeyHealth[]
```

### getInvalidKeys(tenantId)

Get all invalid keys for a tenant.

```typescript
const keys = await getInvalidKeys(tenantId);
// Returns: KeyHealth[]
```

### getActiveKeys(tenantId)

Get all active keys for a tenant.

```typescript
const keys = await getActiveKeys(tenantId);
// Returns: KeyHealth[]
```

## Integration with Activity Logging

All health status changes are automatically logged to the `activity_log` table:

```sql
INSERT INTO activity_log (
  id, tenant_id, key_id, action_type, status,
  action_details, error_message, created_at
) VALUES (
  gen_random_uuid(),
  $1,  -- tenantId
  $2,  -- keyId
  'use',  -- action_type
  'success',  -- status
  '{"health_status": "rate_limited"}',  -- action_details
  'Rate limited detected (HTTP 429)',  -- error_message
  NOW()
);
```

## Real-time Updates

Health status updates are guaranteed to complete within 1 second:

1. **Detection**: HTTP response analyzed (< 100ms)
2. **Database Update**: Status updated in api_keys table (< 500ms)
3. **Activity Logging**: Event logged to activity_log (< 500ms)

Total: < 1 second from detection to persistence

## Multi-tenant Isolation

All functions enforce tenant isolation:

```typescript
// Only returns keys belonging to the specified tenant
const health = await getKeyHealth(keyId, tenantId);

// Query includes tenant_id filter
SELECT * FROM api_keys WHERE id = $1 AND tenant_id = $2
```

## Error Handling

### Key Not Found

```typescript
try {
  await getKeyHealth('invalid-id', tenantId);
} catch (error) {
  // Error: Key not found: invalid-id
}
```

### Database Errors

All database errors are caught and logged:

```typescript
try {
  await trackKeyHealth(keyId, tenantId, response);
} catch (error) {
  console.error('Error tracking key health:', error);
  throw error;
}
```

## Usage Examples

### Detecting Rate Limiting

```typescript
// When provider API returns HTTP 429
const response = {
  statusCode: 429,
  headers: { 'retry-after': '60' },
};

const update = await trackKeyHealth(keyId, tenantId, response);
// Key is now marked as rate-limited
// Will automatically recover when quota resets
```

### Detecting Invalid Key

```typescript
// When provider API returns HTTP 401
const response = {
  statusCode: 401,
  body: {
    error_code: 'INVALID_API_KEY',
    error_message: 'The API key is invalid or has been revoked',
  },
};

const update = await trackKeyHealth(keyId, tenantId, response);
// Key is now marked as invalid and disabled
// Admin must manually delete and re-add the key
```

### Monitoring Key Health

```typescript
// Get health status for display in UI
const status = await getHealthStatus(keyId, tenantId);

if (status.warningLevel === 'critical') {
  // Show red warning badge
  // Display: "Invalid" or "90% quota used"
}
```

### Batch Health Check

```typescript
// Check all keys for a provider
const health = await getProviderKeyHealth(tenantId, providerId);

const rateLimited = health.filter(k => k.status === 'rate_limited');
const invalid = health.filter(k => k.status === 'invalid');

console.log(`${rateLimited.length} keys rate-limited`);
console.log(`${invalid.length} keys invalid`);
```

## Database Schema

The service uses the following database tables:

### api_keys

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  key_value_encrypted TEXT NOT NULL,
  email_address VARCHAR(255) NOT NULL,
  label VARCHAR(255),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  daily_usage_tokens BIGINT DEFAULT 0,
  monthly_usage_tokens BIGINT DEFAULT 0,
  health_status VARCHAR(50) DEFAULT 'active',
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (provider_id) REFERENCES providers(id)
);
```

### activity_log

```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  key_id UUID REFERENCES api_keys(id),
  action_type VARCHAR(50) NOT NULL,
  action_details JSONB,
  tokens_used BIGINT,
  cost_usd DECIMAL(10, 4),
  cost_pkr DECIMAL(12, 2),
  status VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

## Testing

Run unit tests:

```bash
npm run test lib/health-monitoring/index.test.ts
```

Test coverage includes:

- Rate limit detection (HTTP 429, retry-after headers)
- Invalid key detection (HTTP 401, error messages)
- Status transitions (active → rate_limited → active)
- Status transitions (active → invalid → disabled)
- Auto re-enabling logic
- Batch operations
- Edge cases (high quota usage, invalid headers, etc.)

## Performance Considerations

- **Database Queries**: All queries use indexed columns (tenant_id, provider_id, health_status)
- **Batch Operations**: Use `queryMany` for efficient bulk retrieval
- **Transactions**: Status updates use transactions for consistency
- **Caching**: Consider caching health status in memory for high-frequency checks

## Future Enhancements

- Automatic quota reset detection based on provider-specific patterns
- Predictive rate limiting (warn before hitting limit)
- Health status webhooks for external monitoring
- Custom recovery strategies per provider
- Health status metrics and analytics
