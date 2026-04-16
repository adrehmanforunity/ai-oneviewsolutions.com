-- AI Provider Management - Initial Schema
-- This migration creates all tables for the AI Provider Management system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROVIDERS TABLE
-- ============================================================================
-- Stores information about external AI service providers (Groq, Claude, OpenAI, etc.)
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  provider_type VARCHAR(50) NOT NULL,  -- LLM, STT, TTS
  api_endpoint VARCHAR(500) NOT NULL,
  api_version VARCHAR(50),
  pricing_per_1k_tokens DECIMAL(10, 6),  -- USD
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_providers_name ON providers(name);
CREATE INDEX idx_providers_type ON providers(provider_type);

-- ============================================================================
-- PROVIDER_MODELS TABLE
-- ============================================================================
-- Stores available models for each provider (e.g., llama-3.3-70b for Groq)
CREATE TABLE IF NOT EXISTS provider_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model_name VARCHAR(255) NOT NULL,
  model_id VARCHAR(255) NOT NULL,
  pricing_per_1k_tokens DECIMAL(10, 6),  -- USD
  context_window INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, model_id)
);

CREATE INDEX idx_provider_models_provider ON provider_models(provider_id);

-- ============================================================================
-- PROVIDER_VOICES TABLE
-- ============================================================================
-- Stores available voices for TTS providers
CREATE TABLE IF NOT EXISTS provider_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  voice_id VARCHAR(255) NOT NULL,
  voice_name VARCHAR(255) NOT NULL,
  gender VARCHAR(50),  -- male, female, neutral
  tone VARCHAR(100),  -- professional, warm, neutral, etc.
  language VARCHAR(10),  -- en, ur, etc.
  sample_audio_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, voice_id)
);

CREATE INDEX idx_provider_voices_provider ON provider_voices(provider_id);
CREATE INDEX idx_provider_voices_language ON provider_voices(language);

-- ============================================================================
-- API_KEYS TABLE
-- ============================================================================
-- Stores encrypted API keys for each provider, with tenant isolation
-- CRITICAL: key_value_encrypted is AES-256 encrypted and never exposed in API responses
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,  -- References tenants table (external)
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  key_value_encrypted TEXT NOT NULL,  -- AES-256-GCM encrypted
  email_address VARCHAR(255) NOT NULL,  -- plaintext for billing system
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
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_provider ON api_keys(provider_id);
CREATE INDEX idx_api_keys_health_status ON api_keys(health_status);

-- ============================================================================
-- KEY_SHARING TABLE
-- ============================================================================
-- Tracks which tenants have access to shared API keys (Super Admin feature)
-- Enables multi-tenant key sharing while maintaining audit trail
CREATE TABLE IF NOT EXISTS key_sharing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  primary_tenant_id UUID NOT NULL,  -- References tenants table (external)
  shared_tenant_id UUID NOT NULL,  -- References tenants table (external)
  shared_by_user_id UUID NOT NULL,  -- References users table (external)
  shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by_user_id UUID,  -- References users table (external)
  UNIQUE(key_id, shared_tenant_id),
  CHECK (primary_tenant_id != shared_tenant_id)
);

CREATE INDEX idx_key_sharing_key ON key_sharing(key_id);
CREATE INDEX idx_key_sharing_shared_tenant ON key_sharing(shared_tenant_id);
CREATE INDEX idx_key_sharing_primary_tenant ON key_sharing(primary_tenant_id);
CREATE INDEX idx_key_sharing_active ON key_sharing(revoked_at) WHERE revoked_at IS NULL;

-- ============================================================================
-- TENANT_ROTATION_STRATEGY TABLE
-- ============================================================================
-- Stores the key rotation strategy for each provider per tenant
-- Strategies: round_robin, fallback, least_used
CREATE TABLE IF NOT EXISTS tenant_rotation_strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,  -- References tenants table (external)
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  strategy VARCHAR(50) NOT NULL DEFAULT 'round_robin',  -- round_robin, fallback, least_used
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, provider_id)
);

CREATE INDEX idx_tenant_rotation_strategy_tenant ON tenant_rotation_strategy(tenant_id);
CREATE INDEX idx_tenant_rotation_strategy_provider ON tenant_rotation_strategy(provider_id);

-- ============================================================================
-- TENANT_VOICE_CONFIG TABLE
-- ============================================================================
-- Stores voice configuration for each tenant (language slots and conversation modes)
CREATE TABLE IF NOT EXISTS tenant_voice_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,  -- References tenants table (external)
  language VARCHAR(10) NOT NULL,  -- en, ur
  voice_id UUID NOT NULL REFERENCES provider_voices(id) ON DELETE CASCADE,
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

CREATE INDEX idx_tenant_voice_config_tenant ON tenant_voice_config(tenant_id);
CREATE INDEX idx_tenant_voice_config_voice ON tenant_voice_config(voice_id);

-- ============================================================================
-- ACTIVITY_LOG TABLE
-- ============================================================================
-- Immutable append-only audit trail for all API key operations
-- CRITICAL: This table must never have UPDATE or DELETE operations
-- All operations are INSERT-only for compliance and audit purposes
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,  -- References tenants table (external)
  key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,  -- add, delete, test, rotate, enable, disable, use, share, unshare
  action_details JSONB,  -- Additional context (e.g., old_email, new_email, shared_tenants)
  tokens_used BIGINT,
  cost_usd DECIMAL(10, 4),
  cost_pkr DECIMAL(12, 2),
  status VARCHAR(50),  -- success, failed, rate_limited, invalid
  error_message TEXT,
  user_id UUID,  -- References users table (external)
  user_role VARCHAR(50),  -- Tenant Admin, Super Admin, etc.
  primary_tenant_id UUID,  -- For shared key operations
  affected_tenants TEXT[],  -- Array of affected tenant IDs for shared key operations
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_log_tenant ON activity_log(tenant_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX idx_activity_log_key ON activity_log(key_id);
CREATE INDEX idx_activity_log_action_type ON activity_log(action_type);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);

-- ============================================================================
-- COST_RECORDS TABLE
-- ============================================================================
-- Tracks costs for each AI call, used for cost intelligence and billing
CREATE TABLE IF NOT EXISTS cost_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,  -- References tenants table (external)
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  gate_number INT,  -- 1, 2, 3, 4
  topic_id UUID,
  tokens_used BIGINT,
  cost_usd DECIMAL(10, 4),
  cost_pkr DECIMAL(12, 2),
  conversation_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cost_records_tenant_date ON cost_records(tenant_id, created_at);
CREATE INDEX idx_cost_records_provider ON cost_records(provider_id);
CREATE INDEX idx_cost_records_gate ON cost_records(gate_number);
CREATE INDEX idx_cost_records_conversation ON cost_records(conversation_id);

-- ============================================================================
-- CONSTRAINTS AND TRIGGERS
-- ============================================================================

-- Prevent updates to activity_log (immutable audit trail)
CREATE OR REPLACE FUNCTION prevent_activity_log_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Activity log entries cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_log_immutable
BEFORE UPDATE OR DELETE ON activity_log
FOR EACH ROW
EXECUTE FUNCTION prevent_activity_log_update();

-- Auto-update updated_at timestamp for providers
CREATE OR REPLACE FUNCTION update_providers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER providers_update_timestamp
BEFORE UPDATE ON providers
FOR EACH ROW
EXECUTE FUNCTION update_providers_timestamp();

-- Auto-update updated_at timestamp for api_keys
CREATE OR REPLACE FUNCTION update_api_keys_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_keys_update_timestamp
BEFORE UPDATE ON api_keys
FOR EACH ROW
EXECUTE FUNCTION update_api_keys_timestamp();

-- Auto-update updated_at timestamp for tenant_rotation_strategy
CREATE OR REPLACE FUNCTION update_tenant_rotation_strategy_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_rotation_strategy_update_timestamp
BEFORE UPDATE ON tenant_rotation_strategy
FOR EACH ROW
EXECUTE FUNCTION update_tenant_rotation_strategy_timestamp();

-- Auto-update updated_at timestamp for tenant_voice_config
CREATE OR REPLACE FUNCTION update_tenant_voice_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_voice_config_update_timestamp
BEFORE UPDATE ON tenant_voice_config
FOR EACH ROW
EXECUTE FUNCTION update_tenant_voice_config_timestamp();
