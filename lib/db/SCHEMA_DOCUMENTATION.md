# AI Provider Management - Database Schema Documentation

## Overview

This document provides comprehensive documentation for the AI Provider Management database schema. The schema supports multi-tenant isolation, API key management, cost tracking, voice configuration, and audit logging.

## Table of Contents

1. [Tables](#tables)
2. [Indexes](#indexes)
3. [Constraints](#constraints)
4. [Triggers](#triggers)
5. [Data Types](#data-types)
6. [Security Considerations](#security-considerations)
7. [Query Examples](#query-examples)

---

## Tables

### 1. `providers`

Stores information about external AI service providers.

**Purpose**: Central registry of all supported AI providers (Groq, Claude, OpenAI, ElevenLabs, Uplift AI, Google Cloud, Amazon Polly)

**Columns**:
- `id` (UUID, PK): Unique provider identifier
- `name` (VARCHAR(100), UNIQUE): Provider name (e.g., "Groq", "Claude")
- `provider_type` (VARCHAR(50)): Type of provider - LLM, STT, or TTS
- `api_endpoint` (VARCHAR(500)): Base URL for provider API
- `api_version` (VARCHAR(50)): API version (e.g., "v1")
- `pricing_per_1k_tokens` (DECIMAL(10,6)): Cost per 1000 tokens in USD
- `created_at` (TIMESTAMP): Record creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp (auto-updated by trigger)

**Indexes**:
- `idx_providers_name`: Fast lookup by provider name
- `idx_providers_type`: Fast lookup by provider type

**Example Data**:
```sql
INSERT INTO providers (name, provider_type, api_endpoint, pricing_per_1k_tokens)
VALUES 
  ('Groq', 'LLM', 'https://api.groq.com/openai/v1/', 0.0001),
  ('Claude', 'LLM', 'https://api.anthropic.com/v1/', 0.0003),
  ('ElevenLabs', 'TTS', 'https://api.elevenlabs.io/v1/', 0.0001);
```

---

### 2. `provider_models`

Stores available models for each provider.

**Purpose**: Track which models are available for each provider, including pricing and capabilities

**Columns**:
- `id` (UUID, PK): Unique model identifier
- `provider_id` (UUID, FK): Reference to providers table
- `model_name` (VARCHAR(255)): Human-readable model name (e.g., "Llama 3.3 70B")
- `model_id` (VARCHAR(255)): Provider's model identifier (e.g., "llama-3.3-70b-versatile")
- `pricing_per_1k_tokens` (DECIMAL(10,6)): Model-specific pricing (overrides provider default)
- `context_window` (INT): Maximum context window in tokens
- `created_at` (TIMESTAMP): Record creation timestamp

**Constraints**:
- UNIQUE(provider_id, model_id): Prevent duplicate models per provider

**Indexes**:
- `idx_provider_models_provider`: Fast lookup by provider

**Example Data**:
```sql
INSERT INTO provider_models (provider_id, model_name, model_id, pricing_per_1k_tokens, context_window)
VALUES 
  ('provider-groq-id', 'Llama 3.3 70B', 'llama-3.3-70b-versatile', 0.0001, 8192),
  ('provider-groq-id', 'Llama 3.1 8B', 'llama-3.1-8b-instant', 0.00005, 8192);
```

---

### 3. `provider_voices`

Stores available voices for TTS providers.

**Purpose**: Track TTS voices with metadata for voice selection and preview

**Columns**:
- `id` (UUID, PK): Unique voice identifier
- `provider_id` (UUID, FK): Reference to providers table
- `voice_id` (VARCHAR(255)): Provider's voice identifier
- `voice_name` (VARCHAR(255)): Human-readable voice name
- `gender` (VARCHAR(50)): Voice gender (male, female, neutral)
- `tone` (VARCHAR(100)): Voice tone/style (professional, warm, neutral, etc.)
- `language` (VARCHAR(10)): Language code (en, ur, etc.)
- `sample_audio_url` (TEXT): URL to sample audio file
- `created_at` (TIMESTAMP): Record creation timestamp

**Constraints**:
- UNIQUE(provider_id, voice_id): Prevent duplicate voices per provider

**Indexes**:
- `idx_provider_voices_provider`: Fast lookup by provider
- `idx_provider_voices_language`: Fast lookup by language

**Example Data**:
```sql
INSERT INTO provider_voices (provider_id, voice_id, voice_name, gender, tone, language, sample_audio_url)
VALUES 
  ('provider-elevenlabs-id', 'voice-1', 'Rachel', 'female', 'professional', 'en', 'https://...'),
  ('provider-uplift-id', 'voice-ur-1', 'Aisha', 'female', 'warm', 'ur', 'https://...');
```

---

### 4. `api_keys`

Stores encrypted API keys for each provider, with tenant isolation.

**Purpose**: Central repository for all API keys with encryption, health tracking, and usage monitoring

**CRITICAL SECURITY NOTES**:
- `key_value_encrypted` is AES-256-GCM encrypted and MUST NEVER be exposed in API responses
- Email addresses are stored in plaintext for billing system integration
- All queries must filter by `tenant_id` for multi-tenant isolation
- Keys are automatically masked in API responses (show only last 4 characters)

**Columns**:
- `id` (UUID, PK): Unique key identifier
- `tenant_id` (UUID): Tenant that owns this key (references external tenants table)
- `provider_id` (UUID, FK): Reference to providers table
- `key_value_encrypted` (TEXT): AES-256-GCM encrypted API key value
- `email_address` (VARCHAR(255)): Email associated with key (plaintext for billing)
- `label` (VARCHAR(255)): Optional user-friendly label
- `active` (BOOLEAN): Whether key is currently active
- `created_at` (TIMESTAMP): Record creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp (auto-updated by trigger)
- `last_used_at` (TIMESTAMP): Timestamp of last usage
- `daily_usage_tokens` (BIGINT): Tokens used today
- `monthly_usage_tokens` (BIGINT): Tokens used this month
- `health_status` (VARCHAR(50)): Key status (active, rate_limited, invalid, expired)

**Constraints**:
- UNIQUE(tenant_id, provider_id, email_address): Prevent duplicate keys per tenant/provider/email
- Foreign key on provider_id with CASCADE delete

**Indexes**:
- `idx_api_keys_tenant_provider`: Fast lookup by tenant and provider
- `idx_api_keys_tenant_active`: Fast lookup of active keys for tenant
- `idx_api_keys_tenant`: Fast lookup by tenant
- `idx_api_keys_provider`: Fast lookup by provider
- `idx_api_keys_health_status`: Fast lookup by health status

**Example Data**:
```sql
INSERT INTO api_keys (tenant_id, provider_id, key_value_encrypted, email_address, label, active, health_status)
VALUES 
  ('tenant-1', 'provider-groq-id', 'encrypted-key-value', 'admin@example.com', 'Production Key', true, 'active'),
  ('tenant-1', 'provider-groq-id', 'encrypted-key-value-2', 'billing@example.com', 'Backup Key', true, 'active');
```

---

### 5. `key_sharing`

Tracks which tenants have access to shared API keys (Super Admin feature).

**Purpose**: Enable multi-tenant key sharing while maintaining audit trail and ownership

**Columns**:
- `id` (UUID, PK): Unique sharing record identifier
- `key_id` (UUID, FK): Reference to api_keys table
- `primary_tenant_id` (UUID): Tenant that owns the key
- `shared_tenant_id` (UUID): Tenant that has access to the key
- `shared_by_user_id` (UUID): User who created the sharing (references external users table)
- `shared_at` (TIMESTAMP): When sharing was created
- `revoked_at` (TIMESTAMP): When sharing was revoked (NULL if active)
- `revoked_by_user_id` (UUID): User who revoked the sharing

**Constraints**:
- UNIQUE(key_id, shared_tenant_id): Prevent duplicate sharing
- CHECK(primary_tenant_id != shared_tenant_id): Prevent sharing with self
- Foreign key on key_id with CASCADE delete

**Indexes**:
- `idx_key_sharing_key`: Fast lookup by key
- `idx_key_sharing_shared_tenant`: Fast lookup by shared tenant
- `idx_key_sharing_primary_tenant`: Fast lookup by primary tenant
- `idx_key_sharing_active`: Fast lookup of active sharing (WHERE revoked_at IS NULL)

**Example Data**:
```sql
INSERT INTO key_sharing (key_id, primary_tenant_id, shared_tenant_id, shared_by_user_id)
VALUES 
  ('key-1', 'tenant-1', 'tenant-2', 'super-admin-user-id');
```

---

### 6. `tenant_rotation_strategy`

Stores the key rotation strategy for each provider per tenant.

**Purpose**: Configure how keys are rotated for each provider (round_robin, fallback, least_used)

**Columns**:
- `id` (UUID, PK): Unique strategy record identifier
- `tenant_id` (UUID): Tenant that owns this strategy
- `provider_id` (UUID, FK): Reference to providers table
- `strategy` (VARCHAR(50)): Rotation strategy (round_robin, fallback, least_used)
- `created_at` (TIMESTAMP): Record creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp (auto-updated by trigger)

**Constraints**:
- UNIQUE(tenant_id, provider_id): One strategy per tenant/provider combination

**Indexes**:
- `idx_tenant_rotation_strategy_tenant`: Fast lookup by tenant
- `idx_tenant_rotation_strategy_provider`: Fast lookup by provider

**Example Data**:
```sql
INSERT INTO tenant_rotation_strategy (tenant_id, provider_id, strategy)
VALUES 
  ('tenant-1', 'provider-groq-id', 'round_robin'),
  ('tenant-1', 'provider-elevenlabs-id', 'fallback');
```

---

### 7. `tenant_voice_config`

Stores voice configuration for each tenant (language slots and conversation modes).

**Purpose**: Track which voices are assigned to language slots and conversation modes

**Columns**:
- `id` (UUID, PK): Unique configuration record identifier
- `tenant_id` (UUID): Tenant that owns this configuration
- `language` (VARCHAR(10)): Language code (en, ur)
- `voice_id` (UUID, FK): Reference to provider_voices table
- `speed` (DECIMAL(3,2)): Speech speed (0.5 - 2.0, default 1.0)
- `pitch` (INT): Pitch adjustment (-20 to +20, default 0)
- `stability` (DECIMAL(3,2)): Voice stability (0.0 - 1.0, ElevenLabs only)
- `similarity` (DECIMAL(3,2)): Voice similarity (0.0 - 1.0, ElevenLabs only)
- `style` (DECIMAL(3,2)): Voice style (0.0 - 1.0, ElevenLabs only)
- `conversation_mode` (VARCHAR(50)): Conversation mode (greeting, information, alert, validation, farewell, error, transfer)
- `created_at` (TIMESTAMP): Record creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp (auto-updated by trigger)

**Constraints**:
- UNIQUE(tenant_id, language, conversation_mode): One voice per tenant/language/mode combination

**Indexes**:
- `idx_tenant_voice_config_tenant`: Fast lookup by tenant
- `idx_tenant_voice_config_voice`: Fast lookup by voice

**Example Data**:
```sql
INSERT INTO tenant_voice_config (tenant_id, language, voice_id, speed, pitch, conversation_mode)
VALUES 
  ('tenant-1', 'en', 'voice-rachel-id', 1.0, 0, 'greeting'),
  ('tenant-1', 'ur', 'voice-aisha-id', 1.0, 0, 'greeting');
```

---

### 8. `activity_log`

Immutable append-only audit trail for all API key operations.

**Purpose**: Track all operations for compliance, debugging, and audit purposes

**CRITICAL SECURITY NOTES**:
- This table is IMMUTABLE - no UPDATE or DELETE operations allowed
- Enforced by trigger `activity_log_immutable`
- All operations are INSERT-only
- Never includes full API key values, only key_id and label

**Columns**:
- `id` (UUID, PK): Unique log entry identifier
- `tenant_id` (UUID): Tenant that performed the operation
- `key_id` (UUID, FK): Reference to api_keys table (nullable for non-key operations)
- `action_type` (VARCHAR(50)): Operation type (add, delete, test, rotate, enable, disable, use, share, unshare)
- `action_details` (JSONB): Additional context (e.g., old_email, new_email, shared_tenants)
- `tokens_used` (BIGINT): Tokens consumed by operation
- `cost_usd` (DECIMAL(10,4)): Cost in USD
- `cost_pkr` (DECIMAL(12,2)): Cost in PKR
- `status` (VARCHAR(50)): Operation status (success, failed, rate_limited, invalid)
- `error_message` (TEXT): Error details if operation failed
- `user_id` (UUID): User who performed the operation
- `user_role` (VARCHAR(50)): User's role (Tenant Admin, Super Admin, etc.)
- `primary_tenant_id` (UUID): Primary tenant for shared key operations
- `affected_tenants` (TEXT[]): Array of affected tenant IDs for shared key operations
- `created_at` (TIMESTAMP): Operation timestamp

**Indexes**:
- `idx_activity_log_tenant`: Fast lookup by tenant
- `idx_activity_log_created_at`: Fast lookup by date range
- `idx_activity_log_key`: Fast lookup by key
- `idx_activity_log_action_type`: Fast lookup by action type
- `idx_activity_log_user`: Fast lookup by user

**Triggers**:
- `activity_log_immutable`: Prevents UPDATE and DELETE operations

**Example Data**:
```sql
INSERT INTO activity_log (tenant_id, key_id, action_type, status, user_id, user_role, created_at)
VALUES 
  ('tenant-1', 'key-1', 'add', 'success', 'user-1', 'Tenant Admin', CURRENT_TIMESTAMP),
  ('tenant-1', 'key-1', 'test', 'success', 'user-1', 'Tenant Admin', CURRENT_TIMESTAMP);
```

---

### 9. `cost_records`

Tracks costs for each AI call, used for cost intelligence and billing.

**Purpose**: Record financial data for cost analysis, billing, and optimization

**Columns**:
- `id` (UUID, PK): Unique cost record identifier
- `tenant_id` (UUID): Tenant that incurred the cost
- `provider_id` (UUID, FK): Reference to providers table
- `key_id` (UUID, FK): Reference to api_keys table (nullable)
- `gate_number` (INT): Gate number (1, 2, 3, 4)
- `topic_id` (UUID): Topic that generated the cost
- `tokens_used` (BIGINT): Number of tokens consumed
- `cost_usd` (DECIMAL(10,4)): Cost in USD (accurate to 4 decimal places)
- `cost_pkr` (DECIMAL(12,2)): Cost in PKR (accurate to 2 decimal places)
- `conversation_id` (UUID): Conversation that generated the cost
- `created_at` (TIMESTAMP): Record creation timestamp

**Indexes**:
- `idx_cost_records_tenant_date`: Fast lookup by tenant and date range
- `idx_cost_records_provider`: Fast lookup by provider
- `idx_cost_records_gate`: Fast lookup by gate
- `idx_cost_records_conversation`: Fast lookup by conversation

**Example Data**:
```sql
INSERT INTO cost_records (tenant_id, provider_id, key_id, gate_number, tokens_used, cost_usd, cost_pkr, created_at)
VALUES 
  ('tenant-1', 'provider-groq-id', 'key-1', 4, 150, 0.0150, 4.95, CURRENT_TIMESTAMP);
```

---

## Indexes

### Index Strategy

Indexes are designed to optimize common query patterns:

1. **Tenant Isolation**: `idx_api_keys_tenant_*` indexes enable fast filtering by tenant
2. **Provider Lookup**: `idx_*_provider` indexes enable fast filtering by provider
3. **Time-Range Queries**: `idx_activity_log_created_at` and `idx_cost_records_tenant_date` enable fast date filtering
4. **Status Lookups**: `idx_api_keys_health_status` enables fast filtering by key health

### Index Performance

- All indexes use B-tree (default) for efficient range queries
- Composite indexes (e.g., `idx_api_keys_tenant_provider`) enable efficient multi-column filtering
- Partial indexes (e.g., `idx_key_sharing_active`) reduce index size for common queries

---

## Constraints

### Primary Keys

All tables have UUID primary keys for:
- Distributed system compatibility
- Security (non-sequential IDs)
- Easier data migration

### Foreign Keys

Foreign keys enforce referential integrity:
- `provider_models.provider_id` → `providers.id` (CASCADE delete)
- `provider_voices.provider_id` → `providers.id` (CASCADE delete)
- `api_keys.provider_id` → `providers.id` (CASCADE delete)
- `key_sharing.key_id` → `api_keys.id` (CASCADE delete)
- `tenant_rotation_strategy.provider_id` → `providers.id` (CASCADE delete)
- `tenant_voice_config.voice_id` → `provider_voices.id` (CASCADE delete)
- `activity_log.key_id` → `api_keys.id` (SET NULL on delete)
- `cost_records.provider_id` → `providers.id` (CASCADE delete)
- `cost_records.key_id` → `api_keys.id` (SET NULL on delete)

### Unique Constraints

Unique constraints prevent duplicates:
- `providers.name`: One provider per name
- `provider_models(provider_id, model_id)`: One model per provider
- `provider_voices(provider_id, voice_id)`: One voice per provider
- `api_keys(tenant_id, provider_id, email_address)`: One key per tenant/provider/email
- `key_sharing(key_id, shared_tenant_id)`: One sharing per key/tenant
- `tenant_rotation_strategy(tenant_id, provider_id)`: One strategy per tenant/provider
- `tenant_voice_config(tenant_id, language, conversation_mode)`: One voice per tenant/language/mode

### Check Constraints

Check constraints enforce business rules:
- `key_sharing.primary_tenant_id != shared_tenant_id`: Prevent sharing with self

---

## Triggers

### Timestamp Triggers

Auto-update `updated_at` timestamps on record modification:

1. `providers_update_timestamp`: Updates `providers.updated_at`
2. `api_keys_update_timestamp`: Updates `api_keys.updated_at`
3. `tenant_rotation_strategy_update_timestamp`: Updates `tenant_rotation_strategy.updated_at`
4. `tenant_voice_config_update_timestamp`: Updates `tenant_voice_config.updated_at`

### Immutability Trigger

1. `activity_log_immutable`: Prevents UPDATE and DELETE on `activity_log` table

---

## Data Types

### UUID

Used for all primary keys and foreign keys:
- Generated by `gen_random_uuid()` function
- Provides distributed system compatibility
- Non-sequential for security

### VARCHAR

Used for string fields with known maximum lengths:
- `name` (100): Provider names
- `model_name` (255): Model names
- `voice_name` (255): Voice names
- `email_address` (255): Email addresses
- `label` (255): User-friendly labels
- `provider_type` (50): LLM, STT, TTS
- `strategy` (50): round_robin, fallback, least_used
- `health_status` (50): active, rate_limited, invalid, expired
- `action_type` (50): add, delete, test, rotate, enable, disable, use, share, unshare
- `status` (50): success, failed, rate_limited, invalid
- `user_role` (50): Tenant Admin, Super Admin, Flow Designer

### TEXT

Used for variable-length strings:
- `key_value_encrypted`: Encrypted API key (base64 encoded)
- `api_endpoint`: API endpoint URLs
- `sample_audio_url`: Audio file URLs
- `error_message`: Error details

### JSONB

Used for semi-structured data:
- `action_details`: Additional context for audit log entries

### DECIMAL

Used for precise financial calculations:
- `pricing_per_1k_tokens` (10,6): USD pricing (up to 9,999,999.999999)
- `cost_usd` (10,4): USD costs (up to 999,999.9999)
- `cost_pkr` (12,2): PKR costs (up to 9,999,999.99)
- `speed` (3,2): Speed multiplier (0.50 - 2.00)
- `stability` (3,2): Stability value (0.00 - 1.00)
- `similarity` (3,2): Similarity value (0.00 - 1.00)
- `style` (3,2): Style value (0.00 - 1.00)

### BIGINT

Used for large integer values:
- `daily_usage_tokens`: Daily token count
- `monthly_usage_tokens`: Monthly token count
- `tokens_used`: Tokens used in operation

### INT

Used for smaller integer values:
- `pitch`: Pitch adjustment (-20 to +20)
- `context_window`: Context window size
- `gate_number`: Gate number (1-4)

### TIMESTAMP

Used for all timestamps:
- Default: `CURRENT_TIMESTAMP`
- Timezone: UTC (recommended)
- Precision: Microseconds

### BOOLEAN

Used for binary flags:
- `active`: Whether key is active

### TEXT[]

Used for arrays:
- `affected_tenants`: Array of tenant IDs

---

## Security Considerations

### Encryption

1. **API Keys**: AES-256-GCM encrypted at rest
   - Master key stored in environment variable
   - Never logged in plaintext
   - Never exposed in API responses

2. **Email Addresses**: Stored in plaintext
   - Required for billing system integration
   - Not encrypted to enable billing queries

3. **Database Connection**: SSL/TLS encryption
   - All connections use encrypted transport
   - Connection pooling for efficiency

### Multi-Tenant Isolation

1. **Database Level**: Every query filters by `tenant_id`
   - Enforced at query level, not application level
   - Prevents accidental cross-tenant data access

2. **API Level**: All endpoints verify tenant ownership
   - Authorization checks before returning data
   - 403 Forbidden for unauthorized access

3. **Audit Trail**: All operations logged with tenant_id
   - Enables compliance verification
   - Tracks cross-tenant operations

### Key Masking

1. **UI Display**: Show only last 4 characters
   - Format: "prefix_...XXXX"
   - Full key never exposed

2. **API Responses**: Never return full key value
   - Only return masked key in list/detail endpoints
   - Decryption only for internal operations

3. **Logs**: Never log full key value
   - Only log key_id and label
   - Full key never appears in logs

### Automatic Disabling

1. **Invalid Keys**: Automatically disabled on HTTP 401
   - Prevents cascading failures
   - Logged to activity log

2. **Rate-Limited Keys**: Marked but not disabled
   - Can recover when quota resets
   - Logged to activity log

---

## Query Examples

### Find All Active Keys for a Tenant

```sql
SELECT * FROM api_keys
WHERE tenant_id = $1 AND active = true
ORDER BY created_at DESC;
```

### Find Keys Shared with a Tenant

```sql
SELECT ak.* FROM api_keys ak
INNER JOIN key_sharing ks ON ak.id = ks.key_id
WHERE ks.shared_tenant_id = $1 AND ks.revoked_at IS NULL;
```

### Get Cost Summary for Current Month

```sql
SELECT 
  provider_id,
  SUM(cost_usd) as total_cost_usd,
  SUM(cost_pkr) as total_cost_pkr,
  COUNT(*) as call_count
FROM cost_records
WHERE tenant_id = $1 
  AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
GROUP BY provider_id
ORDER BY total_cost_usd DESC;
```

### Get Activity Log for Date Range

```sql
SELECT * FROM activity_log
WHERE tenant_id = $1 
  AND created_at >= $2 
  AND created_at < $3
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;
```

### Find Keys with Health Issues

```sql
SELECT * FROM api_keys
WHERE tenant_id = $1 
  AND health_status IN ('rate_limited', 'invalid', 'expired')
ORDER BY updated_at DESC;
```

### Get Rotation Strategy for Provider

```sql
SELECT strategy FROM tenant_rotation_strategy
WHERE tenant_id = $1 AND provider_id = $2;
```

### Get Voice Configuration for Language

```sql
SELECT tvc.*, pv.voice_name, pv.gender, pv.tone
FROM tenant_voice_config tvc
INNER JOIN provider_voices pv ON tvc.voice_id = pv.id
WHERE tvc.tenant_id = $1 AND tvc.language = $2;
```

---

## Migration and Deployment

### Running Migrations

```bash
# Using TypeScript
npx ts-node lib/db/migrate.ts

# Using Node.js
node -r ts-node/register lib/db/migrate.ts
```

### Verifying Schema

```bash
# Connect to database
psql $DATABASE_URL

# List all tables
\dt

# Describe table structure
\d api_keys

# List indexes
\di
```

### Backup and Recovery

```bash
# Backup database
pg_dump $DATABASE_URL > backup.sql

# Restore database
psql $DATABASE_URL < backup.sql
```

---

## Performance Tuning

### Query Optimization

1. Always filter by `tenant_id` first
2. Use indexes for WHERE clauses
3. Use EXPLAIN ANALYZE for complex queries
4. Consider materialized views for aggregations

### Connection Pooling

- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

### Monitoring

- Monitor slow queries (>1 second)
- Monitor connection pool utilization
- Monitor table sizes and index bloat
- Monitor replication lag (if applicable)

---

## Maintenance

### Regular Tasks

1. **Vacuum**: Remove dead tuples
   ```sql
   VACUUM ANALYZE;
   ```

2. **Reindex**: Rebuild indexes
   ```sql
   REINDEX DATABASE database_name;
   ```

3. **Analyze**: Update statistics
   ```sql
   ANALYZE;
   ```

### Monitoring Queries

```sql
-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index sizes
SELECT schemaname, indexname, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check slow queries
SELECT query, calls, mean_time, max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [UUID Type](https://www.postgresql.org/docs/current/datatype-uuid.html)
- [JSONB Type](https://www.postgresql.org/docs/current/datatype-json.html)
- [Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [Triggers](https://www.postgresql.org/docs/current/triggers.html)
