# Implementation Plan: AI Provider Management

## Overview

This implementation plan breaks down the AI Provider Management feature into discrete, actionable coding tasks. The system enables Tenant Admins to configure, manage, and monitor multiple AI service providers (LLM, STT, TTS) with support for multiple API keys per provider, key rotation strategies, cost tracking, and voice management.

The implementation follows a layered architecture: Database → Services → API Routes → UI Components → Integration → Testing.

---

## Phase 1: Database Setup & Migrations

- [ ] 1. Create database schema and migrations
  - Create `api_keys` table with encryption support, indexes, and constraints
  - Create `providers` table with provider metadata
  - Create `provider_models` table for LLM models
  - Create `provider_voices` table for TTS voices
  - Create `tenant_voice_config` table for voice assignments
  - Create `activity_log` table for immutable audit trail
  - Create `cost_records` table for financial tracking
  - Create `tenant_rotation_strategy` table for rotation configuration
  - Create `key_sharing` table for multi-tenant key sharing
  - Create all required indexes for query performance
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 6.1, 9.1, 11.4, 11.5, 16.1, 16.7_

- [ ] 2. Seed provider data
  - Insert Groq provider with models (llama-3.3-70b-versatile, llama-3.1-8b-instant, openai/gpt-oss-120b, qwen/qwen3-32b)
  - Insert Claude provider with models (claude-sonnet-4-20250514, claude-opus-4-1-20250805)
  - Insert OpenAI provider with models (gpt-4o-mini, gpt-4o) and TTS models (tts-1, tts-1-hd)
  - Insert ElevenLabs provider with TTS and STT capabilities
  - Insert Uplift AI provider with Urdu-optimized TTS voices
  - Insert Google Cloud provider with STT and TTS capabilities
  - Insert Amazon Polly provider with TTS capabilities
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 3. Create database connection pool and utilities
  - Set up PostgreSQL connection pooling with Neon
  - Create database query utilities with tenant_id filtering
  - Create transaction management utilities
  - _Requirements: 11.4, 11.5_

---

## Phase 2: Core Services & Business Logic

- [ ] 4. Implement encryption/decryption service
  - Create AES-256-GCM encryption utility for API keys
  - Implement key encryption on save
  - Implement key decryption on retrieval
  - Ensure master key is loaded from environment variables
  - _Requirements: 1.3, 11.1_

- [ ]* 4.1 Write property test for key encryption round-trip
  - **Property 1: Key Encryption Round-Trip**
  - **Validates: Requirements 1.3**

- [ ] 5. Implement key masking utility
  - Create function to mask API keys (show only last 4 characters)
  - Format as "prefix_...XXXX" pattern
  - Ensure full key is never exposed in API responses
  - _Requirements: 1.4, 8.2_

- [ ]* 5.1 Write property test for key masking correctness
  - **Property 2: Key Masking Correctness**
  - **Validates: Requirements 1.4**

- [ ] 6. Implement email validation service
  - Create RFC 5322 email validation function
  - Validate email format on key creation and update
  - Return descriptive error messages for invalid emails
  - _Requirements: 2.1, 2.2, 2.3_

- [ ]* 6.1 Write property test for email validation
  - **Property 6: Email Validation Correctness**
  - **Validates: Requirements 2.2**

- [ ] 7. Implement key rotation engine
  - Create round-robin rotation strategy (distribute evenly across keys)
  - Create fallback rotation strategy (sequential selection)
  - Create least-used rotation strategy (select key with highest remaining quota)
  - Implement strategy selection based on tenant configuration
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ]* 7.1 Write property test for round-robin distribution fairness
  - **Property 3: Round-Robin Distribution Fairness**
  - **Validates: Requirements 4.2**

- [ ]* 7.2 Write property test for fallback strategy sequential selection
  - **Property 4: Fallback Strategy Sequential Selection**
  - **Validates: Requirements 4.3**

- [ ]* 7.3 Write property test for least-used strategy quota selection
  - **Property 5: Least-Used Strategy Quota Selection**
  - **Validates: Requirements 4.4**

- [ ] 8. Implement key health monitoring service
  - Track key status (active, rate_limited, invalid, expired)
  - Detect HTTP 429 responses and mark keys as rate-limited
  - Detect HTTP 401 responses and disable keys
  - Implement automatic re-enabling when quota resets
  - Update health status in real-time (within 1 second)
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 9. Implement activity logging service
  - Create immutable append-only activity log
  - Log all key operations (add, delete, test, rotate, enable, disable, use)
  - Include tenant_id, timestamp, user_id, provider, key_id, action_type, status, cost
  - Ensure logs cannot be edited or deleted
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.8, 6.9_

- [ ] 10. Implement cost calculation and tracking service
  - Create cost calculation function (tokens × pricing_per_1k_tokens)
  - Implement USD to PKR currency conversion
  - Track daily and monthly usage tokens per key
  - Calculate cost per conversation, AI call rate, cache hit rate
  - Ensure accuracy to 4 decimal places USD, 2 decimal places PKR
  - _Requirements: 9.1, 9.10, 12.2_

- [ ]* 10.1 Write property test for cost calculation accuracy
  - **Property 7: Cost Calculation Accuracy**
  - **Validates: Requirements 9.10**

- [ ]* 10.2 Write property test for currency conversion consistency
  - **Property 10: Currency Conversion Consistency**
  - **Validates: Requirements 9.10**

- [ ] 11. Implement provider configuration parser and serializer
  - Create parser to load provider configuration from database
  - Create serializer to save provider configuration to JSON
  - Validate configuration on load (all required fields present)
  - Handle invalid JSON gracefully with descriptive errors
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.6, 15.7_

- [ ]* 11.1 Write property test for configuration round-trip serialization
  - **Property 8: Configuration Round-Trip Serialization**
  - **Validates: Requirements 15.5**

- [ ] 12. Implement tenant isolation utilities
  - Create middleware to verify tenant ownership of keys
  - Create query builder to automatically filter by tenant_id
  - Implement authorization checks for all key operations
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ]* 12.1 Write property test for tenant isolation in queries
  - **Property 9: Tenant Isolation in Queries**
  - **Validates: Requirements 11.1, 11.2, 11.5**

- [ ] 13. Implement role-based key management service
  - Create role detection utility (Tenant Admin vs Super Admin)
  - Implement Tenant Admin key creation (auto-assign to their tenant)
  - Implement Super Admin key creation (select primary tenant, optional sharing)
  - Implement key sharing logic (create key_sharing records)
  - Implement key unsharing logic (revoke access from tenants)
  - Implement authorization checks (Tenant Admin can only manage own keys, Super Admin can manage all)
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10, 16.11, 16.12, 16.13, 16.14, 16.15_

- [ ] 14. Implement activity logging with role tracking
  - Extend activity_log to include: user_id, user_role, primary_tenant_id, affected_tenants
  - Log all key operations with role information
  - Log key sharing/unsharing operations
  - Log enable/disable operations with affected tenants
  - _Requirements: 16.2, 16.6, 16.15_

---

## Phase 3: API Endpoints

- [ ] 15. Implement key management API endpoints
  - POST `/api/keys` - Create new API key (validate email, encrypt key, log action with role)
  - GET `/api/keys` - List all keys for tenant (owned + shared keys, filter by provider, active status)
  - GET `/api/keys/:id` - Get single key (mask full value, show last 4 chars)
  - PUT `/api/keys/:id` - Update key (label, email, active status) - Super Admin only for shared keys
  - DELETE `/api/keys/:id` - Delete key (log deletion, preserve email in audit log) - Super Admin only for shared keys
  - POST `/api/keys/:id/test` - Test key validity (send minimal request, return result within 3s)
  - POST `/api/keys/:id/enable` - Enable key (add to active pool, log with affected tenants)
  - POST `/api/keys/:id/disable` - Disable key (remove from active pool, log with affected tenants)
  - POST `/api/keys/:id/share` - Share key with tenants (Super Admin only, create key_sharing records)
  - POST `/api/keys/:id/unshare` - Revoke key from tenants (Super Admin only, revoke key_sharing records)
  - GET `/api/keys/:id/sharing` - Get list of tenants sharing this key (Super Admin only)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10, 16.11, 16.12, 16.13, 16.14, 16.15_

- [ ] 14. Implement voice management API endpoints
  - GET `/api/voices` - List available voices for provider (fetch from provider API)
  - GET `/api/voices/:id` - Get voice metadata (name, gender, tone, language, sample audio)
  - POST `/api/voices/preview` - Preview voice with sample or custom text (return audio within 2s)
  - PUT `/api/voice-config/:language` - Configure voice for language slot (EN or UR)
  - PUT `/api/voice-config/:language/:mode` - Configure voice for conversation mode
  - GET `/api/voice-config` - Get current voice configuration
  - _Requirements: 3.8, 3.9, 3.10, 3.11, 3.12, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12_

- [ ] 15. Implement cost intelligence API endpoints
  - GET `/api/cost/summary` - Get cost summary (total spend, comparison, trend, breakdown by provider/gate/topic)
  - GET `/api/cost/records` - Get cost records (filterable by date range, provider, gate, topic)
  - GET `/api/cost/projection` - Get projected month-end cost
  - GET `/api/cost/quality-analysis` - Get quality vs cost analysis (QA scores, cost per 1K calls)
  - GET `/api/cost/recommendations` - Get cost optimization recommendations
  - POST `/api/cost/export` - Export cost data as CSV or PDF
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

- [ ] 16. Implement activity log API endpoints
  - GET `/api/activity-log` - List activity log entries (filterable by provider, key, date range, action type, status)
  - GET `/api/activity-log/:id` - Get single log entry
  - POST `/api/activity-log/export` - Export activity log as CSV
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

- [ ] 17. Implement rotation strategy configuration endpoints
  - GET `/api/rotation-strategy/:provider` - Get current rotation strategy for provider
  - PUT `/api/rotation-strategy/:provider` - Update rotation strategy (round_robin, fallback, least_used)
  - _Requirements: 4.1, 4.5, 4.6, 4.7, 8.9, 8.10_

- [ ] 18. Implement provider configuration endpoints
  - GET `/api/providers` - List all providers with models and voices
  - GET `/api/providers/:id` - Get provider details
  - GET `/api/providers/:id/models` - Get available models for provider
  - GET `/api/providers/:id/voices` - Get available voices for provider (fetch from API)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

---

## Phase 4: UI Components

- [ ] 19. Implement Key Manager interface
  - Create provider section layout (LLM, STT, TTS tabs)
  - Create key list component (display label, last 4 chars, active status, last used, usage %, health status)
  - Create [+ Add Key] button and form modal (provider, key value, email, label)
  - Create [Test] button with result display (status badge, response time, error details)
  - Create [Enable/Disable] buttons with immediate UI update
  - Create [Delete] button with confirmation dialog
  - Create rotation strategy selector (round_robin, fallback, least_used)
  - Create usage percentage bar with color coding (green <80%, yellow 80-90%, red >90%)
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 10.1, 10.8_

- [ ] 20. Implement Voice Studio interface
  - Create provider selector (Uplift AI, ElevenLabs, Google Cloud, OpenAI, Amazon Polly)
  - Create voice list with filters (language, gender, tone)
  - Create voice preview player with [Play Sample] button
  - Create custom text input for preview (support Urdu UTF-8)
  - Create voice parameter controls (speed 0.5-2.0, pitch -20 to +20, stability 0.0-1.0, similarity, style)
  - Create language slot assignment (EN, UR)
  - Create conversation mode assignment (greeting, information, alert, validation, farewell, error, transfer)
  - Create save button with validation (both EN and UR slots must have voices)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12_

- [ ] 21. Implement Cost Intelligence dashboard
  - Create summary cards (total spend this month, comparison to last month, trend indicator)
  - Create cost breakdown charts (by provider, by gate, by topic)
  - Create metrics display (cost per conversation, AI call rate, cache hit rate, projected month-end)
  - Create quality vs cost analysis table (provider, QA score, cost per 1K calls, quality/$ ratio)
  - Create recommendations section (display optimization suggestions)
  - Create export button (CSV or PDF)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

- [ ] 22. Implement Activity Log viewer
  - Create log entry table (time, provider, key label, action type, tokens/characters, cost, status)
  - Create filter controls (provider, key, date range, action type, status)
  - Create export button (CSV)
  - Create pagination for large datasets
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

---

## Phase 5: Provider API Integration

- [ ] 23. Implement Groq API integration
  - Create Groq API client (authenticate with API key)
  - Implement LLM request handler (send prompt, parse response, extract tokens)
  - Implement STT request handler (send audio, parse response, extract text)
  - Implement key testing (send minimal 10-token request, detect errors)
  - Implement error handling (HTTP 401, 429, 500, timeouts)
  - _Requirements: 1.7, 1.8, 1.9, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3_

- [ ] 24. Implement Claude API integration
  - Create Claude API client (authenticate with API key)
  - Implement LLM request handler (send prompt, parse response, extract tokens)
  - Implement key testing (send minimal 10-token request, detect errors)
  - Implement error handling (HTTP 401, 429, 500, timeouts)
  - _Requirements: 1.7, 1.8, 1.9, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3_

- [ ] 25. Implement OpenAI API integration
  - Create OpenAI API client (authenticate with API key)
  - Implement LLM request handler (send prompt, parse response, extract tokens)
  - Implement TTS request handler (send text, parse response, stream audio)
  - Implement key testing (send minimal 10-token LLM request or 3-word TTS request)
  - Implement error handling (HTTP 401, 429, 500, timeouts)
  - _Requirements: 1.7, 1.8, 1.9, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3_

- [ ] 26. Implement ElevenLabs API integration
  - Create ElevenLabs API client (authenticate with API key)
  - Implement TTS request handler (send text, parse response, stream audio)
  - Implement STT request handler (send audio, parse response, extract text)
  - Implement voice list fetching (retrieve available voices with metadata)
  - Implement key testing (send minimal 3-word TTS request or 1s silence STT request)
  - Implement error handling (HTTP 401, 429, 500, timeouts)
  - _Requirements: 1.7, 1.8, 1.9, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3_

- [ ] 27. Implement Uplift AI API integration
  - Create Uplift AI API client (authenticate with API key)
  - Implement TTS request handler with Urdu support (send text, parse response, stream audio)
  - Implement voice list fetching (retrieve Urdu-optimized voices)
  - Implement key testing (send minimal 3-word Urdu TTS request)
  - Implement error handling (HTTP 401, 429, 500, timeouts)
  - _Requirements: 1.7, 1.8, 1.9, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3_

- [ ] 28. Implement Google Cloud API integration
  - Create Google Cloud API client (authenticate with API key)
  - Implement STT request handler (send audio, parse response, extract text)
  - Implement TTS request handler (send text, parse response, stream audio)
  - Implement voice list fetching (retrieve available voices)
  - Implement key testing (send minimal 1s silence STT request or 3-word TTS request)
  - Implement error handling (HTTP 401, 429, 500, timeouts)
  - _Requirements: 1.7, 1.8, 1.9, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3_

- [ ] 29. Implement Amazon Polly API integration
  - Create Amazon Polly API client (authenticate with API key)
  - Implement TTS request handler (send text, parse response, stream audio)
  - Implement voice list fetching (retrieve available voices)
  - Implement key testing (send minimal 3-word TTS request)
  - Implement error handling (HTTP 401, 429, 500, timeouts)
  - _Requirements: 1.7, 1.8, 1.9, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3_

---

## Phase 6: Testing

- [ ] 30. Write unit tests for key management service
  - Test email validation (valid emails, invalid emails, edge cases)
  - Test key encryption/decryption (various key lengths, special characters)
  - Test key masking (verify last 4 characters shown)
  - Test key enable/disable (state transitions, active pool updates)
  - Test tenant isolation (verify tenant_id filtering)
  - _Requirements: 1.3, 1.4, 2.2, 11.1, 11.2, 11.5_

- [ ] 31. Write unit tests for rotation strategies
  - Test round-robin distribution (2, 3, 5 keys; verify even distribution)
  - Test fallback strategy (verify sequential selection)
  - Test least-used strategy (verify highest-quota key selected)
  - _Requirements: 4.2, 4.3, 4.4_

- [ ] 32. Write unit tests for cost calculations
  - Test cost accuracy (various token counts; verify 4 decimal place precision)
  - Test currency conversion (USD to PKR; verify accuracy within 0.01 USD)
  - Test cost aggregation (by provider, gate, topic)
  - _Requirements: 9.10_

- [ ] 33. Write unit tests for voice configuration
  - Test parameter validation (speed, pitch, stability, similarity, style)
  - Test language slot assignment (EN, UR)
  - Test conversation mode assignment (all modes)
  - _Requirements: 7.9, 7.10, 7.11, 7.12_

- [ ] 34. Write unit tests for activity logging
  - Test log entry creation (all operation types)
  - Test log immutability (verify no editing/deletion)
  - Test log filtering (by tenant, provider, date range)
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.8, 6.9_

- [ ] 35. Write unit tests for configuration parsing
  - Test valid configuration parsing (complete, valid configs)
  - Test invalid configuration handling (missing fields, invalid types)
  - Test configuration serialization (JSON validity)
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.6, 15.7_

- [ ] 36. Write integration tests for key testing
  - Test with real Groq API key (verify 3-second timeout, valid status)
  - Test with invalid key (verify error message)
  - Test with rate-limited key (verify rate limit message)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 37. Write integration tests for voice preview
  - Test with Uplift AI Urdu voice (verify 2-second timeout, audio playback)
  - Test with ElevenLabs English voice (verify 2-second timeout, audio playback)
  - Test with custom Urdu text (verify UTF-8 support)
  - _Requirements: 7.7, 7.8, 7.9, 7.10, 7.11_

- [ ] 38. Write integration tests for cost intelligence
  - Test with 100 AI calls (verify cost breakdown accuracy)
  - Test with mixed providers (verify cost per provider calculation)
  - Test with currency conversion (verify USD to PKR conversion)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

- [ ] 39. Write integration tests for multi-tenant isolation
  - Test with two tenants (verify each tenant sees only their keys)
  - Test cross-tenant API call (verify 403 Forbidden)
  - Test database query (verify tenant_id filter applied)
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

- [ ] 40. Write integration tests for key rotation
  - Test round-robin with 3 keys (verify even distribution over 100+ requests)
  - Test fallback with rate-limited key (verify system switches to next key)
  - Test least-used with varying quotas (verify highest-quota key selected)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 41. Write integration tests for fallback behavior
  - Test with all keys disabled (verify graceful fallback message)
  - Test with all keys rate-limited (verify 60-second retry backoff)
  - Test with provider API unreachable (verify fallback triggered)
  - _Requirements: 1.9, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

- [ ] 42. Checkpoint - Ensure all unit and integration tests pass
  - Run full test suite
  - Verify all tests pass
  - Check code coverage (target: >80%)
  - Ask the user if questions arise

---

## Phase 7: End-to-End Testing & Deployment

- [ ] 43. Write end-to-end tests for complete workflows
  - Test complete key management workflow (add, test, enable, disable, delete)
  - Test complete voice configuration workflow (select provider, preview voice, configure, save)
  - Test complete cost intelligence workflow (generate costs, view dashboard, export)
  - Test complete activity log workflow (perform operations, view log, filter, export)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

- [ ] 44. Set up environment configuration for Vercel
  - Create `.env.local` with database connection string (Neon PostgreSQL)
  - Create `.env.local` with encryption master key
  - Create `.env.local` with provider API endpoints
  - Create `.env.production` with production database and keys
  - Verify all environment variables are set correctly
  - _Requirements: 1.3, 11.1_

- [ ] 45. Deploy database migrations to Vercel
  - Run migrations on production database (Neon)
  - Verify all tables created successfully
  - Verify all indexes created successfully
  - Seed production provider data
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 46. Configure custom domain (aidemo.oneviewsolutions.com)
  - Add custom domain to Vercel project
  - Configure DNS records (CNAME or A record)
  - Verify SSL certificate is issued
  - Test domain accessibility
  - _Requirements: 1.1_

- [ ] 47. Set up monitoring and alerts
  - Configure error tracking (Sentry or similar)
  - Set up key health monitoring alerts (90% quota, invalid keys, rate-limited keys)
  - Set up cost monitoring alerts (monthly budget threshold)
  - Set up API performance monitoring (response times, error rates)
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 48. Final checkpoint - Ensure all tests pass and system is ready for production
  - Run full test suite on production environment
  - Verify all endpoints are accessible
  - Verify database connectivity
  - Verify encryption/decryption working correctly
  - Verify multi-tenant isolation
  - Ask the user if questions arise

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties (100+ iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- All code must follow TypeScript best practices and Next.js conventions
- All API endpoints must include proper error handling and validation
- All database queries must filter by tenant_id for multi-tenant isolation
- All API keys must be encrypted at rest and masked in UI
- All operations must be logged to activity log for audit compliance
