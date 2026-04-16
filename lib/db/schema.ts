/**
 * Database Schema Types
 * TypeScript interfaces for all database tables in the AI Provider Management system
 */

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export type ProviderType = 'LLM' | 'STT' | 'TTS';

export interface Provider {
  id: string;
  name: string;  // Groq, Claude, OpenAI, ElevenLabs, Uplift AI, Google Cloud, Amazon Polly
  providerType: ProviderType;
  apiEndpoint: string;
  apiVersion?: string;
  pricingPer1kTokens?: number;  // USD
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderModel {
  id: string;
  providerId: string;
  modelName: string;
  modelId: string;
  pricingPer1kTokens?: number;  // USD
  contextWindow?: number;
  createdAt: Date;
}

export interface ProviderVoice {
  id: string;
  providerId: string;
  voiceId: string;
  voiceName: string;
  gender?: 'male' | 'female' | 'neutral';
  tone?: string;  // professional, warm, neutral, etc.
  language: string;  // en, ur, etc.
  sampleAudioUrl?: string;
  createdAt: Date;
}

// ============================================================================
// API KEY TYPES
// ============================================================================

export type KeyHealthStatus = 'active' | 'rate_limited' | 'invalid' | 'expired';

export interface ApiKey {
  id: string;
  tenantId: string;
  providerId: string;
  keyValueEncrypted: string;  // AES-256-GCM encrypted - NEVER exposed in API responses
  emailAddress: string;  // plaintext for billing system
  label?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  dailyUsageTokens: number;
  monthlyUsageTokens: number;
  healthStatus: KeyHealthStatus;
}

/**
 * API Key Response - Safe version for API responses
 * Never includes the encrypted key value, only the last 4 characters
 */
export interface ApiKeyResponse {
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
  healthStatus: KeyHealthStatus;
  usagePercentage: number;  // 0-100
}

export interface CreateApiKeyRequest {
  providerId: string;
  keyValue: string;
  emailAddress: string;
  label?: string;
}

export interface UpdateApiKeyRequest {
  label?: string;
  emailAddress?: string;
  active?: boolean;
}

export type TestKeyStatus = 'valid' | 'invalid' | 'rate_limited';

export interface TestKeyResponse {
  status: TestKeyStatus;
  responseTimeMs: number;
  providerName: string;
  modelName?: string;
  errorCode?: string;
  errorMessage?: string;
  rateLimitResetTime?: Date;
}

// ============================================================================
// KEY SHARING TYPES
// ============================================================================

export interface KeySharing {
  id: string;
  keyId: string;
  primaryTenantId: string;
  sharedTenantId: string;
  sharedByUserId: string;
  sharedAt: Date;
  revokedAt?: Date;
  revokedByUserId?: string;
}

export interface ShareKeyRequest {
  tenantIds: string[];  // List of tenant IDs to share with
}

export interface UnshareKeyRequest {
  tenantIds: string[];  // List of tenant IDs to revoke access from
}

// ============================================================================
// ROTATION STRATEGY TYPES
// ============================================================================

export type RotationStrategyType = 'round_robin' | 'fallback' | 'least_used';

export interface RotationStrategy {
  id: string;
  tenantId: string;
  providerId: string;
  strategy: RotationStrategyType;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateRotationStrategyRequest {
  strategy: RotationStrategyType;
}

// ============================================================================
// VOICE CONFIGURATION TYPES
// ============================================================================

export type ConversationMode = 'greeting' | 'information' | 'alert' | 'validation' | 'farewell' | 'error' | 'transfer';
export type LanguageCode = 'en' | 'ur';

export interface TenantVoiceConfig {
  id: string;
  tenantId: string;
  language: LanguageCode;
  voiceId: string;
  speed: number;  // 0.5 - 2.0
  pitch: number;  // -20 to +20
  stability?: number;  // 0.0 - 1.0 (ElevenLabs)
  similarity?: number;  // 0.0 - 1.0 (ElevenLabs)
  style?: number;  // 0.0 - 1.0 (ElevenLabs)
  conversationMode?: ConversationMode;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateVoiceConfigRequest {
  voiceId: string;
  speed?: number;
  pitch?: number;
  stability?: number;
  similarity?: number;
  style?: number;
}

export interface VoicePreviewRequest {
  voiceId: string;
  text?: string;  // If not provided, use sample text
  language?: LanguageCode;
}

// ============================================================================
// ACTIVITY LOG TYPES
// ============================================================================

export type ActivityActionType = 'add' | 'delete' | 'test' | 'rotate' | 'enable' | 'disable' | 'use' | 'share' | 'unshare';
export type ActivityStatus = 'success' | 'failed' | 'rate_limited' | 'invalid';
export type UserRole = 'Tenant Admin' | 'Super Admin' | 'Flow Designer';

export interface ActivityLogEntry {
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

export interface ActivityLogFilter {
  providerId?: string;
  keyId?: string;
  actionType?: ActivityActionType;
  status?: ActivityStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ActivityLogExportRequest {
  startDate: Date;
  endDate: Date;
  format: 'csv' | 'json';
}

// ============================================================================
// COST TRACKING TYPES
// ============================================================================

export interface CostRecord {
  id: string;
  tenantId: string;
  providerId: string;
  keyId?: string;
  gateNumber?: number;
  topicId?: string;
  tokensUsed: number;
  costUsd: number;
  costPkr: number;
  conversationId?: string;
  createdAt: Date;
}

export interface CostSummary {
  totalSpendThisMonth: number;  // USD
  totalSpendLastMonth: number;  // USD
  trendIndicator: 'up' | 'down' | 'stable';
  costByProvider: Array<{
    providerId: string;
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
    topicId: string;
    topicName: string;
    costUsd: number;
    percentage: number;
  }>;
  costPerConversation: number;  // Average USD
  aiCallRate: number;  // Percentage
  cacheHitRate: number;  // Percentage
  projectedMonthEndCost: number;  // USD
  qualityVsCostAnalysis: Array<{
    providerId: string;
    providerName: string;
    qaScore: number;
    costPer1kCalls: number;
    qualityPerDollar: number;
  }>;
  recommendations: string[];
}

export interface CostRecordFilter {
  providerId?: string;
  gateNumber?: number;
  topicId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface CostExportRequest {
  startDate: Date;
  endDate: Date;
  format: 'csv' | 'pdf';
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface ProviderConfiguration {
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  models?: ProviderModel[];
  voices?: ProviderVoice[];
  rotationStrategy: RotationStrategyType;
  activeKeys: number;
  totalKeys: number;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// DATABASE QUERY RESULT TYPES
// ============================================================================

/**
 * Raw database row types (as returned from PostgreSQL)
 * These use snake_case to match database column names
 */

export interface ApiKeyRow {
  id: string;
  tenant_id: string;
  provider_id: string;
  key_value_encrypted: string;
  email_address: string;
  label?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
  last_used_at?: Date;
  daily_usage_tokens: number;
  monthly_usage_tokens: number;
  health_status: KeyHealthStatus;
}

export interface ProviderRow {
  id: string;
  name: string;
  provider_type: ProviderType;
  api_endpoint: string;
  api_version?: string;
  pricing_per_1k_tokens?: number;
  created_at: Date;
  updated_at: Date;
}

export interface ProviderModelRow {
  id: string;
  provider_id: string;
  model_name: string;
  model_id: string;
  pricing_per_1k_tokens?: number;
  context_window?: number;
  created_at: Date;
}

export interface ProviderVoiceRow {
  id: string;
  provider_id: string;
  voice_id: string;
  voice_name: string;
  gender?: string;
  tone?: string;
  language: string;
  sample_audio_url?: string;
  created_at: Date;
}

export interface ActivityLogRow {
  id: string;
  tenant_id: string;
  key_id?: string;
  action_type: ActivityActionType;
  action_details?: Record<string, any>;
  tokens_used?: number;
  cost_usd?: number;
  cost_pkr?: number;
  status: ActivityStatus;
  error_message?: string;
  user_id?: string;
  user_role?: UserRole;
  primary_tenant_id?: string;
  affected_tenants?: string[];
  created_at: Date;
}

export interface CostRecordRow {
  id: string;
  tenant_id: string;
  provider_id: string;
  key_id?: string;
  gate_number?: number;
  topic_id?: string;
  tokens_used: number;
  cost_usd: number;
  cost_pkr: number;
  conversation_id?: string;
  created_at: Date;
}

export interface RotationStrategyRow {
  id: string;
  tenant_id: string;
  provider_id: string;
  strategy: RotationStrategyType;
  created_at: Date;
  updated_at: Date;
}

export interface TenantVoiceConfigRow {
  id: string;
  tenant_id: string;
  language: LanguageCode;
  voice_id: string;
  speed: number;
  pitch: number;
  stability?: number;
  similarity?: number;
  style?: number;
  conversation_mode?: ConversationMode;
  created_at: Date;
  updated_at: Date;
}

export interface KeySharingRow {
  id: string;
  key_id: string;
  primary_tenant_id: string;
  shared_tenant_id: string;
  shared_by_user_id: string;
  shared_at: Date;
  revoked_at?: Date;
  revoked_by_user_id?: string;
}
