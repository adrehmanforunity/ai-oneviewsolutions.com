# AI Provider Management — Design Document

## Overview

The AI Provider Management system is a multi-tenant platform feature that enables Tenant Admins to configure, manage, and monitor multiple AI service providers (LLM, STT, TTS) with support for multiple API keys per provider. The system provides:

- **Multi-Key Architecture**: Support for multiple API keys per provider with configurable rotation strategies (round_robin, fallback, least_used)
- **Provider Agnostic Design**: Support for multiple providers (Groq, Claude, OpenAI, ElevenLabs, Uplift AI, Google Cloud, Amazon Polly) through configuration
- **Key Health Monitoring**: Real-time tracking of key status, quota usage, and automatic fallback on rate limiting
- **Cost Intelligence**: Financial tracking and analysis of AI service consumption with USD/PKR conversion
- **Voice Studio**: Centralized interface for selecting, previewing, and configuring TTS voices
- **Audit Logging**: Immutable activity logs for compliance and debugging
- **Multi-Tenant Isolation**: Complete isolation of keys and configuration between tenants

The system is built on Next.js 14 with TypeScript, PostgreSQL (Neon) for persistence, and integrates with external AI provider APIs.

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Tenant Admin UI Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Key Manager  │  │ Voice Studio │  │ Cost Intel   │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js Routes)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Key Routes   │  │ Voice Routes │  │ Cost Routes  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Key Service  │  │ Voice Service│  │ Cost Service │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Rotation Eng │  │ Health Mon   │  │ Audit Logger │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Data Access Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Key Repo     │  │ Voice Repo   │  │ Log Repo     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ api_keys     │  │ voices       │  │ activity_log │           │
│  │ providers    │  │ voice_config │  │ cost_records │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              External AI Provider APIs                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Groq API     │  │ Claude API   │  │ ElevenLabs   │           │
│  │ OpenAI API   │  │ Google Cloud │  │ Uplift AI    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### Key Flows

#### 1. Key Rotation Flow

```
AI Request
    ↓
Select Key (based on rotation strategy)
    ↓
Is key active? → No → Try next key
    ↓ Yes
Send request to provider
    ↓
HTTP 429 (Rate Limited)?
    ↓ Yes → Mark key as rate-limited → Try next key
    ↓ No
HTTP 401 (Invalid)?
    ↓ Yes → Disable key → Try next key
    ↓ No
Success → Log usage → Return response
    ↓
All keys exhausted? → Return graceful fallback
```

#### 2. Key Testing Flow

```
Admin clicks [Test]
    ↓
Send minimal test request (10 tokens for LLM, 1s silence for STT, 3 words for TTS)
    ↓
Wait for response (max 3 seconds)
    ↓
Parse response
    ↓
Display result: ✅ Valid | ❌ Invalid | ⚠️ Rate Limited
    ↓
Log test event to activity log
```

#### 3. Voice Preview Flow

```
Admin selects voice
    ↓
Admin clicks [Play Sample] or enters custom text
    ↓
Fetch voice metadata from provider API
    ↓
Generate TTS request (sample or custom text)
    ↓
Stream audio to browser
    ↓
Display in player (max 2 seconds)
```

#### 4. Key Sharing Flow (Super Admin Only)

```
Super Admin clicks [Share] on a key
    ↓
Form opens with list of available tenants
    ↓
Super Admin selects tenants to share with
    ↓
System validates:
    - User is Super Admin
    - Key exists and is owned by primary tenant
    - Selected tenants are not already sharing this key
    - Primary tenant is not in selected list
    ↓
System creates key_sharing records for each tenant
    ↓
System logs action: user_id, role, key_id, primary_tenant_id, shared_tenants, action (share)
    ↓
Success message displayed
    ↓
Shared tenants can now use this key
```

#### 5. Key Disable/Enable Flow (Super Admin for Shared Keys)

```
Super Admin clicks [Disable] on a shared key
    ↓
System validates:
    - User is Super Admin
    - Key exists
    ↓
System sets key.active = false
    ↓
System logs action: user_id, role, key_id, primary_tenant_id, affected_tenants (all sharing tenants), action (disable)
    ↓
Key is disabled for ALL tenants (primary + shared)
    ↓
System automatically falls back to next available key for all affected tenants
```

---

## Components and Interfaces

### Database Schema

#### api_keys Table
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  provider_id UUID NOT NULL REFERENCES providers(id),
  key_value_encrypted TEXT NOT NULL,  -- AES-256 encrypted
  email_address VARCHAR(255) NOT NULL,  -- plaintext for billing
  label VARCHAR(255),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  daily_usage_tokens BIGINT DEFAULT 0,
  monthly_usage_tokens BIGINT DEFAULT 0,
  health_status VARCHAR(50) DEFAULT 'active',  -- active, rate_limited, invalid, expired
  UNIQUE(tenant_id, provider_id, email_address)
);

CREATE INDEX idx_api_keys_tenant_provider ON api_keys(tenant_id, provider_id);
CREATE INDEX idx_api_keys_tenant_active ON api_keys(tenant_id, active);
```

#### providers Table
```sql
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,  -- Groq, Claude, OpenAI, etc.
  provider_type VARCHAR(50) NOT NULL,  -- LLM, STT, TTS
  api_endpoint VARCHAR(500) NOT NULL,
  api_version VARCHAR(50),
  pricing_per_1k_tokens DECIMAL(10, 6),  -- USD
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### provider_models Table
```sql
CREATE TABLE provider_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  model_name VARCHAR(255) NOT NULL,
  model_id VARCHAR(255) NOT NULL,
  pricing_per_1k_tokens DECIMAL(10, 6),  -- USD
  context_window INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, model_id)
);
```

#### provider_voices Table
```sql
CREATE TABLE provider_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  voice_id VARCHAR(255) NOT NULL,
  voice_name VARCHAR(255) NOT NULL,
  gender VARCHAR(50),  -- male, female, neutral
  tone VARCHAR(100),  -- professional, warm, neutral, etc.
  language VARCHAR(10),  -- en, ur, etc.
  sample_audio_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, voice_id)
);
```

#### tenant_voice_config Table
```sql
CREATE TABLE tenant_voice_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  language VARCHAR(10) NOT NULL,  -- en, ur
  voice_id UUID NOT NULL REFERENCES provider_voices(id),
  speed DECIMAL(3, 2) DEFAULT 1.0,  -- 0.5 - 2.0
  pitch INT DEFAULT 0,  -- -20 to +20
  stability DECIMAL(3, 2),  -- 0.0 - 1.0 (ElevenLabs)
  similarity DECIMAL(3, 2),  -- 0.0 - 1.0 (ElevenLabs)
  style DECIMAL(3, 2),  -- 0.0 - 1.0 (ElevenLabs)
  conversation_mode VARCHAR(50),  -- greeting, information, alert, validation, farewell, error, transfer
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, language, conversation_mode)
);
```

#### activity_log Table
```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  key_id UUID REFERENCES api_keys(id),
  action_type VARCHAR(50) NOT NULL,  -- add, delete, test, rotate, enable, disable, use
  action_details JSONB,
  tokens_used BIGINT,
  cost_usd DECIMAL(10, 4),
  cost_pkr DECIMAL(12, 2),
  status VARCHAR(50),  -- success, failed, rate_limited, invalid
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id UUID REFERENCES users(id)
);

CREATE INDEX idx_activity_log_tenant ON activity_log(tenant_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);
```

#### cost_records Table
```sql
CREATE TABLE cost_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  provider_id UUID NOT NULL REFERENCES providers(id),
  gate_number INT,  -- 1, 2, 3, 4
  topic_id UUID,
  tokens_used BIGINT,
  cost_usd DECIMAL(10, 4),
  cost_pkr DECIMAL(12, 2),
  conversation_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cost_records_tenant_date ON cost_records(tenant_id, created_at);
```

#### tenant_rotation_strategy Table
```sql
CREATE TABLE tenant_rotation_strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  provider_id UUID NOT NULL REFERENCES providers(id),
  strategy VARCHAR(50) NOT NULL,  -- round_robin, fallback, least_used
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, provider_id)
);
```

#### key_sharing Table
```sql
CREATE TABLE key_sharing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  primary_tenant_id UUID NOT NULL REFERENCES tenants(id),
  shared_tenant_id UUID NOT NULL REFERENCES tenants(id),
  shared_by_user_id UUID NOT NULL REFERENCES users(id),
  shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by_user_id UUID REFERENCES users(id),
  UNIQUE(key_id, shared_tenant_id),
  CHECK (primary_tenant_id != shared_tenant_id)
);

CREATE INDEX idx_key_sharing_key ON key_sharing(key_id);
CREATE INDEX idx_key_sharing_shared_tenant ON key_sharing(shared_tenant_id);
CREATE INDEX idx_key_sharing_primary_tenant ON key_sharing(primary_tenant_id);
```

---

## Data Models (TypeScript Interfaces)

```typescript
// API Key Models
interface ApiKey {
  id: string;
  tenantId: string;
  providerId: string;
  keyValueEncrypted: string;  // Never exposed in API responses
  emailAddress: string;
  label?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  dailyUsageTokens: number;
  monthlyUsageTokens: number;
  healthStatus: 'active' | 'rate_limited' | 'invalid' | 'expired';
}

interface ApiKeyResponse {
  id: string;
  tenantId: string;
  providerId: string;
  maskedKey: string;  // Last 4 characters only, e.g., "gsk_...a3b9"
  emailAddress: string;
  label?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  dailyUsageTokens: number;
  monthlyUsageTokens: number;
  healthStatus: 'active' | 'rate_limited' | 'invalid' | 'expired';
  usagePercentage: number;  // 0-100
}

interface CreateApiKeyRequest {
  providerId: string;
  keyValue: string;
  emailAddress: string;
  label?: string;
}

interface TestKeyResponse {
  status: 'valid' | 'invalid' | 'rate_limited';
  responseTimeMs: number;
  providerName: string;
  modelName?: string;
  errorCode?: string;
  errorMessage?: string;
  rateLimitResetTime?: Date;
}

// Provider Models
interface Provider {
  id: string;
  name: string;  // Groq, Claude, OpenAI, etc.
  providerType: 'LLM' | 'STT' | 'TTS';
  apiEndpoint: string;
  apiVersion?: string;
  pricingPer1kTokens?: number;  // USD
  createdAt: Date;
  updatedAt: Date;
}

interface ProviderModel {
  id: string;
  providerId: string;
  modelName: string;
  modelId: string;
  pricingPer1kTokens?: number;  // USD
  contextWindow?: number;
}

interface ProviderVoice {
  id: string;
  providerId: string;
  voiceId: string;
  voiceName: string;
  gender?: 'male' | 'female' | 'neutral';
  tone?: string;  // professional, warm, neutral, etc.
  language: string;  // en, ur
  sampleAudioUrl?: string;
}

// Voice Configuration
interface TenantVoiceConfig {
  id: string;
  tenantId: string;
  language: 'en' | 'ur';
  voiceId: string;
  speed: number;  // 0.5 - 2.0
  pitch: number;  // -20 to +20
  stability?: number;  // 0.0 - 1.0
  similarity?: number;  // 0.0 - 1.0
  style?: number;  // 0.0 - 1.0
  conversationMode?: string;  // greeting, information, alert, etc.
  createdAt: Date;
  updatedAt: Date;
}

// Rotation Strategy
interface RotationStrategy {
  id: string;
  tenantId: string;
  providerId: string;
  strategy: 'round_robin' | 'fallback' | 'least_used';
  createdAt: Date;
  updatedAt: Date;
}

// Activity Log
interface ActivityLogEntry {
  id: string;
  tenantId: string;
  keyId?: string;
  actionType: 'add' | 'delete' | 'test' | 'rotate' | 'enable' | 'disable' | 'use';
  actionDetails?: Record<string, any>;
  tokensUsed?: number;
  costUsd?: number;
  costPkr?: number;
  status: 'success' | 'failed' | 'rate_limited' | 'invalid';
  errorMessage?: string;
  createdAt: Date;
  userId?: string;
}

// Cost Intelligence
interface CostRecord {
  id: string;
  tenantId: string;
  providerId: string;
  gateNumber?: number;
  topicId?: string;
  tokensUsed: number;
  costUsd: number;
  costPkr: number;
  conversationId?: string;
  createdAt: Date;
}

interface CostSummary {
  totalSpendThisMonth: number;  // USD
  totalSpendLastMonth: number;  // USD
  trendIndicator: 'up' | 'down' | 'stable';
  costByProvider: Array<{
    providerName: string;
    costUsd: number;
    percentage: number;
  }>;
  costByGate: Array<{
    gateNumber: number;
    costUsd: number;
    percentage: number;
  }>;
  costByTopic: Array<{
    topicName: string;
    costUsd: number;
    percentage: number;
  }>;
  costPerConversation: number;  // Average USD
  aiCallRate: number;  // Percentage
  cacheHitRate: number;  // Percentage
  projectedMonthEndCost: number;  // USD
  qualityVsCostAnalysis: Array<{
    providerName: string;
    qaScore: number;
    costPer1kCalls: number;
    qualityPerDollar: number;
  }>;
  recommendations: string[];
}

// Configuration (for serialization)
interface ProviderConfiguration {
  providerId: string;
  providerName: string;
  providerType: 'LLM' | 'STT' | 'TTS';
  models?: ProviderModel[];
  voices?: ProviderVoice[];
  rotationStrategy: 'round_robin' | 'fallback' | 'least_used';
  activeKeys: number;
  totalKeys: number;
}
```

---

## Key Flows

### 1. Add API Key Flow

```
1. Admin opens Key Manager
2. Clicks [+ Add Key]
3. Form opens with fields:
   - Provider (dropdown)
   - API Key Value (password field)
   - Email Address (text field)
   - Label (optional text field)
4. Admin fills form
5. System validates:
   - Email format (RFC 5322)
   - API key not empty
6. System encrypts key using AES-256
7. System stores in database with tenant_id
8. System logs action to activity log
9. Success message displayed
10. Form clears
```

### 2. Test API Key Flow

```
1. Admin clicks [Test] on a key
2. System retrieves decrypted key
3. System sends minimal test request:
   - LLM: 10 tokens
   - STT: 1 second silence
   - TTS: 3 words
4. System waits max 3 seconds
5. System parses response:
   - HTTP 200 → Valid
   - HTTP 401 → Invalid
   - HTTP 429 → Rate Limited
6. System displays result with:
   - Status badge
   - Response time
   - Error details (if applicable)
7. System logs test event to activity log
8. Test does NOT consume quota
```

### 3. Key Rotation Flow (During AI Request)

```
1. AI request arrives
2. System retrieves active keys for provider
3. System applies rotation strategy:
   - round_robin: Select next key in sequence
   - fallback: Use first key until rate-limited
   - least_used: Select key with most remaining quota
4. System retrieves decrypted key
5. System sends request to provider
6. Provider responds:
   - HTTP 200 → Success
     - Log usage
     - Update daily/monthly tokens
     - Return response
   - HTTP 429 → Rate Limited
     - Mark key as rate_limited
     - Log event
     - Try next key (recursive)
   - HTTP 401 → Invalid
     - Disable key
     - Mark as invalid
     - Log event
     - Try next key (recursive)
7. If all keys exhausted:
   - Log fallback event
   - Return graceful fallback message
   - Do NOT charge tokens
```

### 4. Voice Preview Flow

```
1. Admin opens Voice Studio
2. Selects TTS provider
3. System fetches voices from provider API
4. Admin selects voice
5. Admin clicks [Play Sample] or enters custom text
6. System generates TTS request:
   - Sample: Pre-defined sentence
   - Custom: Admin-provided text (UTF-8 Urdu support)
7. System sends request to provider
8. System streams audio to browser
9. Browser plays audio in player
10. System logs preview event (not charged)
```

### 5. Cost Intelligence Flow

```
1. Admin opens Cost Intelligence
2. System queries cost_records table for current month
3. System calculates:
   - Total spend (USD and PKR)
   - Comparison to last month
   - Trend indicator
   - Cost by provider
   - Cost by gate
   - Cost by topic
   - Average cost per conversation
   - AI call rate
   - Cache hit rate
   - Projected month-end cost
4. System fetches QA scores from QA system
5. System calculates quality vs cost analysis
6. System generates recommendations
7. System displays dashboard with charts
8. Admin can export as CSV or PDF
```

---

## Security Considerations

### Encryption

- **API Keys at Rest**: AES-256 encryption using a master key stored in environment variables
- **Email Addresses**: Stored in plaintext (required for billing system integration)
- **Database Connection**: SSL/TLS encryption for all database connections
- **API Responses**: HTTPS only, no plaintext keys in responses

### Multi-Tenant Isolation

- **Database Level**: Every query filters by `tenant_id`
- **API Level**: All endpoints verify tenant ownership before returning data
- **Authorization**: Tenant Admins can only access their own tenant's keys
- **Audit Trail**: All operations logged with tenant_id for compliance

### Key Masking

- **UI Display**: Show only last 4 characters (e.g., "gsk_...a3b9")
- **API Responses**: Never return full key value
- **Logs**: Never log full key value, only key_id and label

### Automatic Disabling

- **Invalid Keys**: Automatically disabled on HTTP 401
- **Rate-Limited Keys**: Automatically marked but not disabled (can recover)
- **Expired Keys**: Automatically disabled based on provider signals

---

## Integration Points

### External AI Provider APIs

1. **Groq API**
   - LLM: llama-3.3-70b-versatile, llama-3.1-8b-instant, openai/gpt-oss-120b, qwen/qwen3-32b
   - STT: whisper-large-v3-turbo, whisper-large-v3
   - Endpoint: https://api.groq.com/openai/v1/

2. **Claude API**
   - LLM: claude-sonnet-4-20250514, claude-opus-4-1-20250805
   - Endpoint: https://api.anthropic.com/v1/

3. **OpenAI API**
   - LLM: gpt-4o-mini, gpt-4o
   - TTS: tts-1, tts-1-hd
   - Endpoint: https://api.openai.com/v1/

4. **ElevenLabs API**
   - TTS: Multiple voices with customizable parameters
   - STT: Speech-to-text capabilities
   - Endpoint: https://api.elevenlabs.io/v1/

5. **Uplift AI API**
   - TTS: Urdu-optimized voices
   - Endpoint: https://api.upliftai.com/v1/

6. **Google Cloud API**
   - STT: Speech-to-Text
   - TTS: Text-to-Speech
   - Endpoint: https://speech.googleapis.com/

7. **Amazon Polly API**
   - TTS: Multiple voices and languages
   - Endpoint: https://polly.amazonaws.com/

### Internal System Integration

- **Tenant Configuration System**: Retrieve tenant settings
- **Billing System**: Send cost records and email addresses
- **Analytics System**: Query cost and usage data
- **Conversation Engine**: Select and use API keys during AI calls
- **QA System**: Retrieve quality scores for cost analysis

---

## Error Handling

### Key-Related Errors

| Error | Handling |
|-------|----------|
| Invalid email format | Display validation error, prevent save |
| Key already exists | Display warning, allow duplicate |
| Key not found | Return 404, log event |
| Key decryption failed | Log security event, return 500 |
| Unauthorized access | Return 403, log security event |

### Provider API Errors

| Error | Handling |
|-------|----------|
| HTTP 401 (Invalid key) | Disable key, try next key, log event |
| HTTP 429 (Rate limited) | Mark key as rate-limited, try next key, log event |
| HTTP 500 (Server error) | Try next key, log event, return fallback |
| Timeout (>3s) | Try next key, log event, return fallback |
| Network error | Try next key, log event, return fallback |

### Fallback Responses

When all keys are exhausted:
- **LLM**: Return pre-recorded message: "Let me connect you with our team"
- **STT**: Return empty transcription
- **TTS**: Return pre-recorded audio

---

## Testing Strategy

### Unit Tests

**Key Management**
- Test email validation (valid, invalid, edge cases)
- Test key encryption/decryption
- Test key masking (show only last 4 characters)
- Test key enable/disable logic
- Test tenant isolation (verify tenant_id filtering)

**Rotation Strategies**
- Test round_robin distribution (verify even distribution)
- Test fallback strategy (verify sequential fallback)
- Test least_used strategy (verify quota-based selection)

**Cost Calculations**
- Test cost calculation accuracy (4 decimal places USD, 2 decimal places PKR)
- Test currency conversion (USD to PKR)
- Test cost aggregation by provider, gate, topic

**Voice Configuration**
- Test voice parameter validation (speed, pitch, stability, etc.)
- Test language slot assignment (EN, UR)
- Test conversation mode assignment

**Activity Logging**
- Test log entry creation
- Test log immutability (no editing/deletion)
- Test log filtering by tenant, provider, date range

### Integration Tests

**Key Testing**
- Test with real Groq API key (verify 3-second timeout)
- Test with invalid key (verify error message)
- Test with rate-limited key (verify rate limit message)

**Voice Preview**
- Test with Uplift AI Urdu voice (verify 2-second timeout)
- Test with ElevenLabs English voice (verify audio playback)
- Test with custom Urdu text (verify UTF-8 support)

**Cost Intelligence**
- Test with 100 AI calls (verify cost accuracy)
- Test with mixed providers (verify cost breakdown)
- Test with currency conversion (verify USD/PKR conversion)

**Multi-Tenant Isolation**
- Test with two tenants (verify isolation)
- Test cross-tenant API call (verify 403 Forbidden)
- Test database query (verify tenant_id filter)

### Property-Based Testing

Property-based testing is applicable to this feature for several acceptance criteria. The following properties should be tested with 100+ iterations:


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Key Encryption Round-Trip

*For any* valid API key string, encrypting it with AES-256 and then decrypting it SHALL produce the original key value unchanged.

**Validates: Requirements 1.3**

### Property 2: Key Masking Correctness

*For any* API key string with length ≥ 4, the masking function SHALL return exactly the last 4 characters of the key, formatted as "prefix_...XXXX" where XXXX are the last 4 characters.

**Validates: Requirements 1.4**

### Property 3: Round-Robin Distribution Fairness

*For any* set of N active keys and M requests (where M ≥ 100), the round-robin rotation strategy SHALL distribute requests such that each key is selected approximately M/N times (within ±10% variance).

**Validates: Requirements 4.2**

### Property 4: Fallback Strategy Sequential Selection

*For any* set of N active keys, the fallback rotation strategy SHALL select keys in sequential order (key 1, then key 2, then key 3, etc.) until a key succeeds or all keys are exhausted.

**Validates: Requirements 4.3**

### Property 5: Least-Used Strategy Quota Selection

*For any* set of N active keys with varying remaining quotas, the least_used rotation strategy SHALL always select the key with the highest remaining quota (or any key with the maximum quota if there are ties).

**Validates: Requirements 4.4**

### Property 6: Email Validation Correctness

*For any* email string, the RFC 5322 email validation function SHALL accept all valid RFC 5322 formatted emails and reject all invalid emails.

**Validates: Requirements 2.2**

### Property 7: Cost Calculation Accuracy

*For any* set of token counts and provider pricing rates, the cost calculation function SHALL produce results accurate to 4 decimal places in USD and 2 decimal places in PKR, with no rounding errors exceeding 0.01 USD or 1 PKR.

**Validates: Requirements 9.10**

### Property 8: Configuration Round-Trip Serialization

*For any* valid provider configuration object, serializing it to JSON and then parsing it back SHALL produce an equivalent configuration object with all fields preserved and no data loss.

**Validates: Requirements 15.5**

### Property 9: Tenant Isolation in Queries

*For any* tenant ID and key query, the system SHALL return only keys belonging to that tenant, and SHALL never return keys from other tenants regardless of the query parameters.

**Validates: Requirements 11.1, 11.2, 11.5**

### Property 10: Currency Conversion Consistency

*For any* cost amount in USD, converting to PKR and back to USD (using the same exchange rate) SHALL produce a result within 0.01 USD of the original amount (accounting for rounding).

**Validates: Requirements 9.10**

---

## Testing Strategy

### Unit Tests

**Key Management**
- Email validation: test valid emails (simple, complex, edge cases), invalid emails (missing @, invalid domain, etc.)
- Key encryption/decryption: test with various key lengths and special characters
- Key masking: test with keys of different lengths, verify last 4 characters are shown
- Key enable/disable: test state transitions and active pool updates
- Tenant isolation: test that queries filter by tenant_id

**Rotation Strategies**
- Round-robin: test with 2, 3, 5 keys; verify even distribution over 100+ requests
- Fallback: test sequential selection; verify fallback on simulated failures
- Least-used: test with varying quotas; verify highest-quota key is selected

**Cost Calculations**
- Cost accuracy: test with various token counts; verify 4 decimal place precision in USD
- Currency conversion: test USD to PKR conversion; verify accuracy within 0.01 USD
- Cost aggregation: test grouping by provider, gate, topic

**Voice Configuration**
- Parameter validation: test speed (0.5-2.0), pitch (-20 to +20), stability (0.0-1.0)
- Language slot assignment: test EN and UR slots
- Conversation mode assignment: test all modes (greeting, information, alert, etc.)

**Activity Logging**
- Log entry creation: test that logs are created for all operations
- Log immutability: test that logs cannot be edited or deleted
- Log filtering: test filtering by tenant, provider, date range

**Configuration Parsing**
- Valid configuration parsing: test with complete, valid configurations
- Invalid configuration handling: test with missing fields, invalid types
- Configuration serialization: test that serialized JSON is valid and parseable

### Property-Based Tests

**Property 1: Key Encryption Round-Trip** (100+ iterations)
- Generate random key strings (various lengths, special characters)
- Encrypt each key
- Decrypt each key
- Verify decrypted key equals original key
- Tag: `Feature: ai-provider-management, Property 1: Key Encryption Round-Trip`

**Property 2: Key Masking Correctness** (100+ iterations)
- Generate random key strings (length ≥ 4)
- Apply masking function
- Verify result contains last 4 characters
- Verify result format is "prefix_...XXXX"
- Tag: `Feature: ai-provider-management, Property 2: Key Masking Correctness`

**Property 3: Round-Robin Distribution Fairness** (100+ iterations)
- Generate random sets of 2-5 active keys
- Simulate 100+ requests with round-robin strategy
- Verify each key is selected approximately equally (±10% variance)
- Tag: `Feature: ai-provider-management, Property 3: Round-Robin Distribution Fairness`

**Property 4: Fallback Strategy Sequential Selection** (100+ iterations)
- Generate random sets of 2-5 active keys
- Simulate requests with fallback strategy
- Verify keys are selected in sequential order
- Tag: `Feature: ai-provider-management, Property 4: Fallback Strategy Sequential Selection`

**Property 5: Least-Used Strategy Quota Selection** (100+ iterations)
- Generate random sets of 2-5 keys with varying quotas
- Simulate requests with least_used strategy
- Verify key with highest quota is always selected
- Tag: `Feature: ai-provider-management, Property 5: Least-Used Strategy Quota Selection`

**Property 6: Email Validation Correctness** (100+ iterations)
- Generate random valid RFC 5322 emails
- Generate random invalid emails
- Verify validation function accepts all valid emails
- Verify validation function rejects all invalid emails
- Tag: `Feature: ai-provider-management, Property 6: Email Validation Correctness`

**Property 7: Cost Calculation Accuracy** (100+ iterations)
- Generate random token counts (1-1,000,000)
- Generate random pricing rates
- Calculate costs
- Verify accuracy to 4 decimal places USD, 2 decimal places PKR
- Tag: `Feature: ai-provider-management, Property 7: Cost Calculation Accuracy`

**Property 8: Configuration Round-Trip Serialization** (100+ iterations)
- Generate random valid provider configurations
- Serialize to JSON
- Parse back to object
- Verify parsed object equals original
- Tag: `Feature: ai-provider-management, Property 8: Configuration Round-Trip Serialization`

**Property 9: Tenant Isolation in Queries** (100+ iterations)
- Generate random tenant IDs and key queries
- Execute queries with tenant filter
- Verify only keys for that tenant are returned
- Verify no keys from other tenants are returned
- Tag: `Feature: ai-provider-management, Property 9: Tenant Isolation in Queries`

**Property 10: Currency Conversion Consistency** (100+ iterations)
- Generate random USD amounts
- Convert to PKR
- Convert back to USD
- Verify result within 0.01 USD of original
- Tag: `Feature: ai-provider-management, Property 10: Currency Conversion Consistency`

### Integration Tests

**Key Testing**
- Test with real Groq API key: verify test completes within 3 seconds and returns valid status
- Test with invalid key: verify error message is displayed
- Test with rate-limited key: verify rate limit message is displayed

**Voice Preview**
- Test with Uplift AI Urdu voice: verify preview plays within 2 seconds
- Test with ElevenLabs English voice: verify preview plays within 2 seconds
- Test with custom Urdu text: verify UTF-8 support and correct pronunciation

**Cost Intelligence**
- Test with 100 AI calls: verify cost breakdown is accurate
- Test with mixed providers: verify cost per provider is calculated correctly
- Test with currency conversion: verify USD to PKR conversion is accurate

**Multi-Tenant Isolation**
- Test with two tenants: verify each tenant sees only their own keys
- Test cross-tenant API call: verify 403 Forbidden is returned
- Test database query: verify tenant_id filter is applied

**Key Rotation**
- Test round-robin with 3 keys: verify requests are distributed evenly
- Test fallback with rate-limited key: verify system switches to next key
- Test least-used with varying quotas: verify highest-quota key is selected

**Fallback Behavior**
- Test with all keys disabled: verify graceful fallback message is returned
- Test with all keys rate-limited: verify system waits 60 seconds before retry
- Test with provider API unreachable: verify fallback is triggered

---

## Implementation Notes

### Technology Stack

- **Frontend**: Next.js 14 with React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes with TypeScript
- **Database**: PostgreSQL (Neon) with connection pooling
- **Encryption**: crypto module (Node.js built-in) for AES-256
- **External APIs**: Groq, Claude, OpenAI, ElevenLabs, Uplift AI, Google Cloud, Amazon Polly

### Key Implementation Decisions

1. **Encryption**: Use Node.js crypto module with AES-256-GCM for authenticated encryption
2. **Key Masking**: Store full key encrypted, display only last 4 characters in UI
3. **Rotation Strategy**: Implement as pluggable strategy pattern for extensibility
4. **Cost Tracking**: Log every AI call with tokens used and cost in both USD and PKR
5. **Activity Logging**: Use immutable append-only log with no update/delete capability
6. **Multi-Tenant**: Filter all queries by tenant_id at database level, not application level

### Database Indexes

- `idx_api_keys_tenant_provider`: For fast key lookup by tenant and provider
- `idx_api_keys_tenant_active`: For fast active key lookup
- `idx_activity_log_tenant`: For fast activity log lookup by tenant
- `idx_activity_log_created_at`: For fast time-range queries
- `idx_cost_records_tenant_date`: For fast cost report generation

### API Rate Limiting

- Key testing: 10 requests per minute per tenant
- Voice preview: 20 requests per minute per tenant
- Cost intelligence: 5 requests per minute per tenant

### Monitoring & Alerts

- Alert when key reaches 90% quota
- Alert when key becomes invalid
- Alert when all keys for a provider are exhausted
- Alert when cost exceeds monthly budget threshold

