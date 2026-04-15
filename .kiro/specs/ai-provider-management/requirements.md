# AI Provider Management — Requirements Document

## Introduction

The AI Provider Management system enables Tenant Admins to configure and manage multiple AI service providers (LLM, STT, TTS) with support for multiple API keys per provider. Each API key must be associated with an email address for billing, notifications, and account recovery. The system supports key rotation strategies (round_robin, fallback, least_used) and provides comprehensive monitoring, cost tracking, and voice management capabilities.

This feature is critical for multi-tenant isolation, cost control, and operational flexibility — allowing each tenant to independently configure their AI provider stack without code changes.

---

## Glossary

- **API_Key**: A credential string used to authenticate requests to an external AI provider's API
- **Provider**: An external AI service company (Groq, Claude, OpenAI, ElevenLabs, Uplift AI, Google Cloud, Amazon Polly)
- **LLM**: Large Language Model — used for Gate 4 AI fallback responses
- **STT**: Speech-to-Text — converts audio to text (Phase 2 IVR)
- **TTS**: Text-to-Speech — converts text to audio for IVR responses
- **Key_Rotation_Strategy**: Algorithm for selecting which API key to use (round_robin, fallback, least_used)
- **Voice_ID**: Unique identifier for a specific voice within a TTS provider
- **Tenant_Admin**: User role with permission to manage AI providers and keys for their tenant
- **Flow_Designer**: User role with permission to view (but not edit) AI provider configuration
- **Email_Association**: Required email address linked to each API key for billing and notifications
- **Key_Health**: Status of an API key (active, rate_limited, invalid, expired)
- **Cost_Intelligence**: Financial tracking and analysis of AI service consumption
- **Voice_Studio**: Admin interface for selecting, previewing, and configuring TTS voices
- **Key_Manager**: Admin interface for adding, testing, and managing API keys
- **Key_Activity_Log**: Immutable audit trail of all API key interactions
- **Provider_Agnostic**: System design that supports multiple providers without code changes
- **Multi_Key_Architecture**: Support for multiple API keys per provider in rotation
- **Tenant_Isolation**: Guarantee that one tenant's keys cannot be accessed by another tenant

---

## Requirements

### Requirement 1: Multi-Key Architecture & Provider Configuration

**User Story:** As a Tenant Admin, I want to configure multiple API keys per provider so that I can distribute load across keys and avoid rate limiting.

#### Acceptance Criteria

1. WHEN a Tenant Admin accesses the Key Manager, THE System SHALL display all configured providers (LLM, STT, TTS) with their current keys
2. WHEN a Tenant Admin adds a new API key, THE System SHALL require: provider selection, API key value, email address, and optional label
3. WHEN a Tenant Admin saves an API key, THE System SHALL encrypt the key at rest using AES-256 encryption
4. WHEN a Tenant Admin views a stored API key, THE System SHALL display only the last 4 characters of the key (e.g., "gsk_...a3b9") and mask the full value
5. WHEN a Tenant Admin configures multiple keys for the same provider, THE System SHALL allow selection of a rotation strategy (round_robin, fallback, least_used)
6. WHEN a Tenant Admin enables or disables a key, THE System SHALL immediately update the active key pool without requiring a system restart
7. WHEN the system processes an AI request, THE System SHALL select the next key according to the configured rotation strategy
8. WHEN a key is rate-limited (HTTP 429), THE System SHALL automatically fall over to the next active key in the pool
9. WHEN all keys for a provider are exhausted or rate-limited, THE System SHALL log the event and return a graceful fallback response to the customer

#### Constraints

- API keys must never be logged in plaintext to any log file or console
- Key rotation must be transparent to the conversation flow — no customer-facing delays or errors
- Fallback behavior must complete within 500ms to maintain real-time IVR responsiveness

---

### Requirement 2: Email Association & Validation

**User Story:** As a Tenant Admin, I want to associate an email address with each API key so that I can track billing, receive notifications, and manage account recovery.

#### Acceptance Criteria

1. WHEN a Tenant Admin adds an API key, THE System SHALL require an email address field (mandatory)
2. WHEN a Tenant Admin enters an email address, THE System SHALL validate the format using RFC 5322 standard email validation
3. IF an invalid email format is provided, THEN THE System SHALL display an error message and prevent key creation
4. WHEN a Tenant Admin saves a key with a valid email, THE System SHALL store the email address in plaintext (not encrypted) for billing system integration
5. WHEN a Tenant Admin views the Key Manager, THE System SHALL display the email address associated with each key
6. WHEN a Tenant Admin edits a key, THE System SHALL allow changing the email address and log the change to the activity log
7. WHEN multiple keys share the same email address, THE System SHALL allow this configuration without restriction
8. WHEN a key is deleted, THE System SHALL preserve the email address in the activity log for audit purposes

#### Constraints

- Email addresses are used for: billing notifications, account recovery, support contact — must be accurate
- Email validation is format-only; optional verification (sending confirmation email) is out of scope for this feature
- Email addresses must be stored in a format compatible with the billing system integration

---

### Requirement 3: Provider Configuration & Model/Voice Selection

**User Story:** As a Tenant Admin, I want to select specific models and voices per provider so that I can optimize for quality, cost, and language support.

#### Acceptance Criteria

1. WHEN a Tenant Admin configures an LLM provider, THE System SHALL allow selection from: Groq, Claude, OpenAI
2. WHEN a Tenant Admin selects Groq as the LLM provider, THE System SHALL display available models: llama-3.3-70b-versatile, llama-3.1-8b-instant, openai/gpt-oss-120b, qwen/qwen3-32b
3. WHEN a Tenant Admin selects Claude as the LLM provider, THE System SHALL display available models: claude-sonnet-4-20250514, claude-opus-4-1-20250805
4. WHEN a Tenant Admin selects OpenAI as the LLM provider, THE System SHALL display available models: gpt-4o-mini, gpt-4o
5. WHEN a Tenant Admin configures an STT provider, THE System SHALL allow selection from: Groq Whisper, Google Cloud STT, ElevenLabs STT
6. WHEN a Tenant Admin selects Groq Whisper as the STT provider, THE System SHALL display available models: whisper-large-v3-turbo, whisper-large-v3
7. WHEN a Tenant Admin configures a TTS provider, THE System SHALL allow selection from: Uplift AI, ElevenLabs, Google Cloud TTS, OpenAI, Amazon Polly
8. WHEN a Tenant Admin selects a TTS provider, THE System SHALL fetch available voices from that provider's API using the stored API key
9. WHEN a Tenant Admin selects a voice, THE System SHALL display voice metadata: name, gender, tone/style, language, sample audio
10. WHEN a Tenant Admin clicks "Preview" on a voice, THE System SHALL play a sample sentence in that voice within 2 seconds
11. WHEN a Tenant Admin enters custom text in the preview field, THE System SHALL play that text in the selected voice (supporting both English and Urdu)
12. WHEN a Tenant Admin assigns a voice to a language slot (EN or UR), THE System SHALL save the assignment and use that voice for all TTS calls in that language

#### Constraints

- Model and voice lists must be fetched from provider APIs to ensure accuracy
- Voice preview must complete within 2 seconds to maintain responsive UI
- Custom preview text must support Urdu Unicode characters (UTF-8)

---

### Requirement 4: Key Rotation Strategies

**User Story:** As a Tenant Admin, I want to configure how API keys are rotated so that I can optimize for either cost, reliability, or even load distribution.

#### Acceptance Criteria

1. WHEN a Tenant Admin configures multiple keys for a provider, THE System SHALL allow selection of rotation strategy: round_robin, fallback, or least_used
2. WHEN round_robin strategy is selected, THE System SHALL distribute requests evenly across all active keys in sequence
3. WHEN fallback strategy is selected, THE System SHALL use the first key until it is rate-limited, then switch to the second key, and so on
4. WHEN least_used strategy is selected, THE System SHALL track remaining quota for each key and always select the key with the most remaining quota
5. WHEN a key is rate-limited, THE System SHALL log the rate limit event with timestamp and automatically switch to the next available key
6. WHEN all keys are rate-limited, THE System SHALL wait 60 seconds before retrying the first key (exponential backoff)
7. WHEN a key recovers from rate limiting (quota resets), THE System SHALL automatically include it back in the rotation pool

#### Constraints

- Rotation strategy changes must take effect immediately for new requests
- Rate limit detection must be based on HTTP 429 responses from the provider
- Quota tracking for least_used strategy must be updated in real-time

---

### Requirement 5: Key Testing & Validation

**User Story:** As a Tenant Admin, I want to test API keys before deploying them so that I can verify they are valid and working.

#### Acceptance Criteria

1. WHEN a Tenant Admin clicks [Test] on an API key, THE System SHALL send a minimal test request to the provider API
2. WHEN the test request completes, THE System SHALL display the result within 3 seconds: ✅ Valid, ❌ Invalid, or ⚠️ Rate Limited
3. IF the key is valid, THE System SHALL display: response time (ms), provider name, and model/voice name
4. IF the key is invalid, THE System SHALL display: error code and error message from the provider
5. IF the key is rate-limited, THE System SHALL display: rate limit error and time until quota resets
6. WHEN a key test completes, THE System SHALL log the test event to the Key Activity Log with result status
7. WHEN a Tenant Admin tests a key, THE System SHALL NOT consume quota from the customer's monthly budget (test calls must be minimal)

#### Constraints

- Test requests must be minimal (10 tokens for LLM, 1 second silence for STT, 3 words for TTS)
- Test results must complete within 3 seconds or timeout gracefully
- Test calls must not be counted against the tenant's token budget

---

### Requirement 6: Key Activity & Audit Logging

**User Story:** As a Tenant Admin, I want to see a complete audit trail of all API key operations so that I can track usage, debug issues, and verify compliance.

#### Acceptance Criteria

1. WHEN any API key operation occurs (add, delete, test, rotate, enable, disable), THE System SHALL log the event to the Key Activity Log
2. WHEN an AI call is made using an API key, THE System SHALL log: timestamp, provider, key_id, model, tokens/characters used, response time, status, cost
3. WHEN a key is rate-limited, THE System SHALL log: timestamp, provider, key_id, rate limit error, time until reset
4. WHEN a key is rotated (switched due to rate limiting), THE System SHALL log: timestamp, previous key, new key, reason (rate_limited | quota_exhausted)
5. WHEN a Tenant Admin views the Key Activity Log, THE System SHALL display: time, provider, key label, action type, tokens/characters, cost, status
6. WHEN a Tenant Admin filters the Key Activity Log, THE System SHALL support filtering by: provider, key, date range, action type, status
7. WHEN a Tenant Admin exports the Key Activity Log, THE System SHALL generate a CSV file with all log entries for the selected date range
8. WHEN a log entry is created, THE System SHALL include: tenant_id, timestamp, user_id (if admin action), provider, key_id, action_type, status, cost_usd, cost_pkr
9. WHEN a log entry is stored, THE System SHALL ensure it is immutable — no editing or deletion of historical logs

#### Constraints

- Log entries must be immutable for audit compliance
- Logs must include cost in both USD and PKR (converted at current exchange rate)
- Log retention must be at least 12 months
- Logs must not include the full API key value (only key_id and label)

---

### Requirement 7: Voice Studio — Voice Selection & Configuration

**User Story:** As a Tenant Admin, I want to select and configure TTS voices so that I can customize the voice personality for my tenant's conversations.

#### Acceptance Criteria

1. WHEN a Tenant Admin opens Voice Studio, THE System SHALL display available TTS providers: Uplift AI, ElevenLabs, Google Cloud, OpenAI, Amazon Polly
2. WHEN a Tenant Admin selects a provider, THE System SHALL fetch available voices from that provider's API using the stored API key
3. WHEN voices are fetched, THE System SHALL display: voice name, gender, tone/style, language, sample audio preview
4. WHEN a Tenant Admin filters voices by language, THE System SHALL display only voices that support that language
5. WHEN a Tenant Admin filters voices by gender, THE System SHALL display only voices matching the selected gender
6. WHEN a Tenant Admin filters voices by tone, THE System SHALL display only voices matching the selected tone (e.g., professional, warm, neutral)
7. WHEN a Tenant Admin clicks [Play Sample] on a voice, THE System SHALL play a pre-recorded sample sentence in that voice within 2 seconds
8. WHEN a Tenant Admin enters custom text in the preview field, THE System SHALL play that text in the selected voice (supporting English and Urdu)
9. WHEN a Tenant Admin configures voice parameters, THE System SHALL allow adjustment of: speed (0.5x – 2.0x), pitch (-20 to +20), stability (0.0 – 1.0), similarity (0.0 – 1.0), style (0.0 – 1.0)
10. WHEN a Tenant Admin assigns a voice to a language slot (EN or UR), THE System SHALL save the assignment and use that voice for all TTS calls in that language
11. WHEN a Tenant Admin assigns a voice to a conversation mode (greeting, information, alert, validation, farewell, error, transfer), THE System SHALL save the assignment and use that voice for calls in that mode
12. WHEN a Tenant Admin saves voice configuration, THE System SHALL validate that both EN and UR language slots have assigned voices (or allow fallback to EN if UR is missing)

#### Constraints

- Voice preview must complete within 2 seconds
- Custom preview text must support Urdu Unicode (UTF-8)
- Voice parameters must be provider-specific (not all providers support all parameters)
- Both EN and UR language slots must have assigned voices before configuration can be saved

---

### Requirement 8: Key Manager Interface

**User Story:** As a Tenant Admin, I want a centralized interface to manage all API keys so that I can add, test, enable, disable, and monitor keys without leaving the admin portal.

#### Acceptance Criteria

1. WHEN a Tenant Admin opens Key Manager, THE System SHALL display all configured providers (LLM, STT, TTS) as separate sections
2. WHEN a Tenant Admin views a provider section, THE System SHALL display all keys for that provider with: key label, last 4 characters, active status, last used time, daily/monthly usage, usage percentage bar
3. WHEN a Tenant Admin clicks [+ Add Key], THE System SHALL open a form with fields: provider, API key value, email address, optional label
4. WHEN a Tenant Admin fills the form and clicks [Save], THE System SHALL validate the email format and encrypt the API key
5. WHEN a Tenant Admin clicks [Test] on a key, THE System SHALL send a test request and display the result within 3 seconds
6. WHEN a Tenant Admin clicks [Disable] on a key, THE System SHALL immediately remove it from the active key pool
7. WHEN a Tenant Admin clicks [Enable] on a disabled key, THE System SHALL immediately add it back to the active key pool
8. WHEN a Tenant Admin clicks [Delete] on a key, THE System SHALL remove the key and log the deletion event (key value is not recoverable)
9. WHEN a Tenant Admin views a provider section, THE System SHALL display the current rotation strategy and allow changing it
10. WHEN a Tenant Admin changes the rotation strategy, THE System SHALL apply it immediately to new requests

#### Constraints

- Key deletion is permanent and non-recoverable
- Disabling a key must not affect in-flight requests using that key
- Enabling/disabling must take effect within 1 second

---

### Requirement 9: Cost Intelligence & Financial Tracking

**User Story:** As a Tenant Admin, I want to track AI service costs so that I can understand spending, optimize provider selection, and forecast monthly expenses.

#### Acceptance Criteria

1. WHEN a Tenant Admin views Cost Intelligence, THE System SHALL display: total spend this month, comparison to last month, trend indicator (↑ or ↓)
2. WHEN a Tenant Admin views Cost Intelligence, THE System SHALL display cost breakdown by provider: provider name, cost, percentage, visual bar chart
3. WHEN a Tenant Admin views Cost Intelligence, THE System SHALL display cost breakdown by gate: Gate 1–4, cost, percentage, visual bar chart
4. WHEN a Tenant Admin views Cost Intelligence, THE System SHALL display cost breakdown by topic: topic name, cost, percentage, visual bar chart
5. WHEN a Tenant Admin views Cost Intelligence, THE System SHALL display: cost per conversation (average), AI call rate (%), cache hit rate (%)
6. WHEN a Tenant Admin views Cost Intelligence, THE System SHALL display projected month-end cost based on current burn rate
7. WHEN a Tenant Admin views Cost Intelligence, THE System SHALL display quality vs cost analysis: provider, QA score, cost per 1K calls, quality/$ ratio
8. WHEN a Tenant Admin views Cost Intelligence, THE System SHALL display recommendations: "Use Groq 70B for Gate 4 (best value LLM)" or "Add 20 more FAQs to cache to reduce AI calls"
9. WHEN a Tenant Admin exports Cost Intelligence, THE System SHALL generate a CSV or PDF report with all cost data for the selected date range
10. WHEN cost data is calculated, THE System SHALL use current provider pricing tables (maintained by platform) and convert costs to both USD and PKR

#### Constraints

- Cost calculations must be accurate to 4 decimal places (USD) and 2 decimal places (PKR)
- Exchange rate conversion must use current market rate (updated daily)
- Projections must be based on actual burn rate from the current month
- Quality scores must come from QA supervisor reviews (not estimated)

---

### Requirement 10: Key Health Monitoring & Alerts

**User Story:** As a Tenant Admin, I want to be alerted when API keys are approaching rate limits or becoming invalid so that I can take action before service is disrupted.

#### Acceptance Criteria

1. WHEN a key reaches 90% of its daily/monthly quota, THE System SHALL display a warning indicator on that key in Key Manager
2. WHEN a key is rate-limited (HTTP 429), THE System SHALL log the event and display a rate-limited status on that key
3. WHEN a key becomes invalid (HTTP 401), THE System SHALL log the event and display an invalid status on that key
4. WHEN a key is invalid, THE System SHALL automatically disable it and remove it from the active key pool
5. WHEN a key is rate-limited, THE System SHALL automatically fall over to the next active key (no manual intervention required)
6. WHEN a key's quota resets (daily or monthly), THE System SHALL automatically re-enable it if it was previously rate-limited
7. WHEN a key health status changes, THE System SHALL log the event to the Key Activity Log with timestamp and reason
8. WHEN a Tenant Admin views Key Manager, THE System SHALL display health percentage for each key (% of quota remaining)

#### Constraints

- Health status updates must be real-time (within 1 second of detection)
- Invalid keys must be automatically disabled to prevent cascading failures
- Rate-limited keys must automatically fall over without customer-facing delays

---

### Requirement 11: Multi-Tenant Isolation & Security

**User Story:** As a Platform Admin, I want to ensure that each tenant's API keys are completely isolated so that no tenant can access another tenant's keys or configuration.

#### Acceptance Criteria

1. WHEN a Tenant Admin logs in, THE System SHALL scope all API key operations to their tenant only
2. WHEN a Tenant Admin queries the Key Manager, THE System SHALL return only keys belonging to their tenant
3. WHEN a Tenant Admin attempts to access another tenant's keys via API, THE System SHALL return 403 Forbidden
4. WHEN API keys are stored in the database, THE System SHALL include tenant_id in every key record
5. WHEN API keys are queried, THE System SHALL filter by tenant_id to prevent cross-tenant access
6. WHEN an API key is used in a conversation, THE System SHALL verify that the key belongs to the conversation's tenant
7. WHEN a Tenant Admin views the Key Activity Log, THE System SHALL display only logs for their tenant's keys
8. WHEN a Platform Admin views cross-tenant analytics, THE System SHALL aggregate data without exposing individual tenant keys

#### Constraints

- Tenant isolation must be enforced at the database query level (not just UI level)
- API keys must never be shared across tenants
- Audit logs must include tenant_id for every operation

---

### Requirement 12: Email Association for Billing & Notifications

**User Story:** As a Billing System, I want to receive email addresses associated with each API key so that I can send billing notifications and account recovery emails to the correct contact.

#### Acceptance Criteria

1. WHEN an API key is created, THE System SHALL store the associated email address in plaintext (not encrypted)
2. WHEN the Billing System queries for key information, THE System SHALL return: key_id, provider, email_address, monthly_cost, usage_tokens
3. WHEN a key's email address is updated, THE System SHALL log the change to the Key Activity Log with old and new email values
4. WHEN a key is deleted, THE System SHALL preserve the email address in the activity log for audit purposes
5. WHEN multiple keys share the same email, THE System SHALL allow this configuration and send notifications to that email for all keys
6. WHEN a key reaches 80% of monthly quota, THE System SHALL trigger a notification to the associated email address
7. WHEN a key is rate-limited, THE System SHALL trigger a notification to the associated email address
8. WHEN a key becomes invalid, THE System SHALL trigger a notification to the associated email address

#### Constraints

- Email addresses must be stored in plaintext for billing system integration
- Email validation is format-only (RFC 5322)
- Notifications must be sent within 5 minutes of the triggering event

---

### Requirement 13: Provider-Agnostic Architecture

**User Story:** As a Developer, I want the system to support multiple providers without code changes so that adding a new provider requires only configuration, not development.

#### Acceptance Criteria

1. WHEN a new LLM provider is added to the system, THE System SHALL support it through configuration only (no code changes required)
2. WHEN a new STT provider is added, THE System SHALL support it through configuration only
3. WHEN a new TTS provider is added, THE System SHALL support it through configuration only
4. WHEN a provider's API changes, THE System SHALL allow updating the provider configuration without redeploying code
5. WHEN a provider's model list changes, THE System SHALL fetch the updated list from the provider's API automatically
6. WHEN a provider's voice list changes, THE System SHALL fetch the updated list from the provider's API automatically
7. WHEN a Tenant Admin switches providers, THE System SHALL allow seamless switching without affecting in-flight conversations

#### Constraints

- Provider configuration must be stored in a database (not hardcoded)
- Provider API endpoints must be configurable
- Provider pricing tables must be configurable and updateable

---

### Requirement 14: Graceful Fallback & Error Handling

**User Story:** As a Customer, I want the system to gracefully handle API key failures so that I never experience a broken conversation due to provider issues.

#### Acceptance Criteria

1. WHEN all keys for a provider are exhausted or invalid, THE System SHALL return a graceful fallback response to the customer
2. WHEN a provider API is unreachable, THE System SHALL log the error and fall back to the next available key or provider
3. WHEN a provider API returns an error, THE System SHALL log the error with full details (status code, error message, timestamp)
4. WHEN a key rotation fails, THE System SHALL attempt the next key in the pool automatically
5. WHEN all keys fail, THE System SHALL return a pre-recorded fallback message: "Let me connect you with our team"
6. WHEN a fallback occurs, THE System SHALL log the event to the Key Activity Log with reason and timestamp
7. WHEN a customer's conversation is affected by a provider failure, THE System SHALL NOT charge tokens for that failed attempt

#### Constraints

- Fallback responses must be returned within 500ms
- Errors must be logged with full context for debugging
- Failed attempts must not be charged to the tenant's budget

---

### Requirement 15: Parser & Serializer for Provider Configuration

**User Story:** As a Developer, I want to parse and serialize provider configuration so that I can load, validate, and persist configuration reliably.

#### Acceptance Criteria

1. WHEN provider configuration is loaded from the database, THE System SHALL parse it into a Configuration object
2. WHEN provider configuration is invalid, THE System SHALL return a descriptive error message indicating which field is invalid
3. WHEN provider configuration is serialized, THE System SHALL format it into valid JSON that can be stored in the database
4. WHEN provider configuration is pretty-printed, THE System SHALL format it with proper indentation and line breaks for readability
5. FOR ALL valid provider configurations, parsing then serializing then parsing SHALL produce an equivalent object (round-trip property)
6. WHEN a provider configuration is updated, THE System SHALL validate the new configuration before persisting
7. WHEN a provider configuration is loaded, THE System SHALL validate all required fields are present

#### Constraints

- Configuration must be stored as JSON in the database
- Parsing must handle both valid and invalid JSON gracefully
- Round-trip serialization must preserve all data without loss

---

## Acceptance Criteria Testing Strategy

### Property-Based Testing Candidates

1. **Round-Trip Serialization (Requirement 15)**
   - Property: `parse(serialize(config)) == config` for all valid configurations
   - Generates random valid configurations and verifies they survive serialization/deserialization
   - Catches data loss bugs in parsing logic

2. **Key Rotation Distribution (Requirement 4)**
   - Property: `round_robin` strategy distributes requests evenly across all keys
   - Generates 1000 requests and verifies each key is selected approximately equally
   - Catches bias in rotation algorithm

3. **Cost Calculation Accuracy (Requirement 9)**
   - Property: `cost_usd * exchange_rate ≈ cost_pkr` for all costs
   - Generates random token counts and verifies cost calculations are consistent
   - Catches rounding errors in currency conversion

4. **Email Validation (Requirement 2)**
   - Property: All valid RFC 5322 emails are accepted, all invalid emails are rejected
   - Generates random email strings and verifies validation is correct
   - Catches edge cases in email validation regex

5. **Tenant Isolation (Requirement 11)**
   - Property: No tenant can access another tenant's keys
   - Generates random tenant IDs and key queries, verifies isolation is maintained
   - Catches authorization bypass bugs

### Integration Testing Candidates

1. **Key Testing & Validation (Requirement 5)**
   - Test with real Groq API key: verify test completes within 3 seconds
   - Test with invalid key: verify error message is displayed
   - Test with rate-limited key: verify rate limit message is displayed

2. **Voice Preview (Requirement 7)**
   - Test with Uplift AI Urdu voice: verify preview plays within 2 seconds
   - Test with ElevenLabs English voice: verify preview plays within 2 seconds
   - Test with custom Urdu text: verify pronunciation is correct

3. **Cost Intelligence (Requirement 9)**
   - Test with 100 AI calls: verify cost breakdown is accurate
   - Test with mixed providers: verify cost per provider is calculated correctly
   - Test with currency conversion: verify USD to PKR conversion is accurate

4. **Multi-Tenant Isolation (Requirement 11)**
   - Test with two tenants: verify each tenant sees only their own keys
   - Test with cross-tenant API call: verify 403 Forbidden is returned
   - Test with database query: verify tenant_id filter is applied

---

## Constraints & Dependencies

### Technical Constraints

- API keys must be encrypted at rest using AES-256
- Key values must be masked in UI (show only last 4 characters)
- Voice preview must complete within 2 seconds
- Key testing must complete within 3 seconds
- Fallback responses must be returned within 500ms
- Health status updates must be real-time (within 1 second)

### Data Constraints

- Email addresses must be stored in plaintext (for billing system integration)
- API keys must be encrypted at rest
- Logs must be immutable (no editing or deletion)
- Log retention must be at least 12 months
- Cost calculations must be accurate to 4 decimal places (USD) and 2 decimal places (PKR)

### Security Constraints

- API keys must never be logged in plaintext
- Tenant isolation must be enforced at database query level
- Invalid keys must be automatically disabled
- Rate-limited keys must automatically fall over

### Operational Constraints

- Provider pricing tables must be maintained and updated regularly
- Exchange rates must be updated daily for PKR conversion
- Voice lists must be fetched from provider APIs (not hardcoded)
- Model lists must be fetched from provider APIs (not hardcoded)

### Dependencies

- **External**: Groq API, Claude API, OpenAI API, ElevenLabs API, Uplift AI API, Google Cloud API, Amazon Polly API
- **Internal**: Tenant configuration system, billing system, analytics system, conversation engine
- **Database**: MongoDB for storing keys, configuration, logs
- **Encryption**: AES-256 for key encryption at rest

---

## Out of Scope

- Email verification (sending confirmation emails to verify email ownership)
- Provider API documentation or support
- Custom provider integration (only pre-defined providers supported)
- Key rotation scheduling (rotation happens automatically based on strategy)
- Automatic key generation or provisioning from providers
- Provider account management (creating accounts, managing billing)

---

## Success Metrics

1. **Tenant Adoption**: 100% of tenants can configure at least one AI provider without developer assistance
2. **Key Reliability**: 99.9% uptime for AI calls (measured by successful key selection and fallback)
3. **Cost Optimization**: Average tenant reduces AI costs by 20% through multi-key rotation and provider switching
4. **Security**: Zero instances of cross-tenant key access or data leakage
5. **User Experience**: Tenant Admins can add and test a new API key in under 2 minutes
6. **Audit Compliance**: 100% of key operations logged and immutable for 12+ months

