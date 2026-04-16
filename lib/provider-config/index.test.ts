/**
 * Unit Tests for Provider Configuration Parser and Serializer
 * Tests configuration loading, parsing, validation, and serialization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as db from '../db/index';
import {
  validateProviderConfig,
  parseProviderConfig,
  serializeProviderConfig,
  formatProviderConfig,
  loadProviderConfig,
  getProviderConfigByName,
  getAllProviderConfigs,
  exportProviderConfig,
  importProviderConfig,
  isValidConfiguration,
  getValidationErrors,
  formatValidationErrors,
  mergeProviderConfigs,
  createMinimalConfig,
  ProviderConfiguration,
  ValidationError,
} from './index';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const validConfig: ProviderConfiguration = {
  providerId: 'provider-1',
  providerName: 'Groq',
  providerType: 'LLM',
  rotationStrategy: 'round_robin',
  activeKeys: 2,
  totalKeys: 3,
  models: [
    {
      id: 'model-1',
      providerId: 'provider-1',
      modelName: 'Llama 3.3 70B',
      modelId: 'llama-3.3-70b-versatile',
      pricingPer1kTokens: 0.0005,
      contextWindow: 8192,
      createdAt: new Date(),
    },
  ],
  voices: [],
};

const validConfigWithVoices: ProviderConfiguration = {
  providerId: 'provider-2',
  providerName: 'ElevenLabs',
  providerType: 'TTS',
  rotationStrategy: 'fallback',
  activeKeys: 1,
  totalKeys: 2,
  models: [],
  voices: [
    {
      id: 'voice-1',
      providerId: 'provider-2',
      voiceId: 'rachel',
      voiceName: 'Rachel',
      gender: 'female',
      tone: 'warm',
      language: 'en',
      sampleAudioUrl: 'https://example.com/rachel.mp3',
      createdAt: new Date(),
    },
  ],
};

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('validateProviderConfig', () => {
  it('should validate a complete valid configuration', () => {
    const result = validateProviderConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate configuration with models', () => {
    const result = validateProviderConfig(validConfig);
    expect(result.valid).toBe(true);
  });

  it('should validate configuration with voices', () => {
    const result = validateProviderConfig(validConfigWithVoices);
    expect(result.valid).toBe(true);
  });

  it('should reject non-object configuration', () => {
    const result = validateProviderConfig('not an object');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('root');
  });

  it('should reject null configuration', () => {
    const result = validateProviderConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('should reject configuration with missing required fields', () => {
    const incomplete = { providerId: 'test' };
    const result = validateProviderConfig(incomplete);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.field === 'providerName')).toBe(true);
  });

  it('should reject configuration with empty providerId', () => {
    const config = { ...validConfig, providerId: '' };
    const result = validateProviderConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'providerId')).toBe(true);
  });

  it('should reject configuration with invalid providerType', () => {
    const config = { ...validConfig, providerType: 'INVALID' };
    const result = validateProviderConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'providerType')).toBe(true);
  });

  it('should reject configuration with invalid rotationStrategy', () => {
    const config = { ...validConfig, rotationStrategy: 'invalid_strategy' };
    const result = validateProviderConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'rotationStrategy')).toBe(true);
  });

  it('should reject configuration with negative activeKeys', () => {
    const config = { ...validConfig, activeKeys: -1 };
    const result = validateProviderConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'activeKeys')).toBe(true);
  });

  it('should reject configuration with non-integer activeKeys', () => {
    const config = { ...validConfig, activeKeys: 1.5 };
    const result = validateProviderConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'activeKeys')).toBe(true);
  });

  it('should reject configuration with activeKeys > totalKeys', () => {
    const config = { ...validConfig, activeKeys: 5, totalKeys: 3 };
    const result = validateProviderConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'activeKeys')).toBe(true);
  });

  it('should reject configuration with invalid models array', () => {
    const config = { ...validConfig, models: 'not an array' };
    const result = validateProviderConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'models')).toBe(true);
  });

  it('should reject configuration with incomplete model', () => {
    const config = {
      ...validConfig,
      models: [{ id: 'model-1' }], // Missing modelName and modelId
    };
    const result = validateProviderConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('models'))).toBe(true);
  });

  it('should reject configuration with invalid voices array', () => {
    const config = { ...validConfig, voices: 'not an array' };
    const result = validateProviderConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'voices')).toBe(true);
  });

  it('should reject configuration with incomplete voice', () => {
    const config = {
      ...validConfig,
      voices: [{ id: 'voice-1' }], // Missing voiceId and voiceName
    };
    const result = validateProviderConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('voices'))).toBe(true);
  });

  it('should accept all valid provider types', () => {
    const types: Array<'LLM' | 'STT' | 'TTS'> = ['LLM', 'STT', 'TTS'];
    for (const type of types) {
      const config = { ...validConfig, providerType: type };
      const result = validateProviderConfig(config);
      expect(result.valid).toBe(true);
    }
  });

  it('should accept all valid rotation strategies', () => {
    const strategies: Array<'round_robin' | 'fallback' | 'least_used'> = [
      'round_robin',
      'fallback',
      'least_used',
    ];
    for (const strategy of strategies) {
      const config = { ...validConfig, rotationStrategy: strategy };
      const result = validateProviderConfig(config);
      expect(result.valid).toBe(true);
    }
  });
});

// ============================================================================
// PARSING TESTS
// ============================================================================

describe('parseProviderConfig', () => {
  it('should parse valid JSON configuration', () => {
    const json = JSON.stringify(validConfig);
    const result = parseProviderConfig(json);
    expect(result.success).toBe(true);
    expect(result.data?.providerId).toBe(validConfig.providerId);
    expect(result.data?.providerName).toBe(validConfig.providerName);
    expect(result.error).toBeUndefined();
  });

  it('should parse configuration with models', () => {
    const json = JSON.stringify(validConfig);
    const result = parseProviderConfig(json);
    expect(result.success).toBe(true);
    expect(result.data?.models).toHaveLength(1);
  });

  it('should parse configuration with voices', () => {
    const json = JSON.stringify(validConfigWithVoices);
    const result = parseProviderConfig(json);
    expect(result.success).toBe(true);
    expect(result.data?.voices).toHaveLength(1);
  });

  it('should reject invalid JSON', () => {
    const result = parseProviderConfig('{ invalid json }');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_JSON');
    expect(result.data).toBeUndefined();
  });

  it('should reject empty string', () => {
    const result = parseProviderConfig('');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_INPUT');
  });

  it('should reject null input', () => {
    const result = parseProviderConfig(null as any);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_INPUT');
  });

  it('should reject configuration with missing required fields', () => {
    const incomplete = { providerId: 'test' };
    const json = JSON.stringify(incomplete);
    const result = parseProviderConfig(json);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(result.data).toBeUndefined();
  });

  it('should include validation errors in parse result', () => {
    const incomplete = { providerId: 'test' };
    const json = JSON.stringify(incomplete);
    const result = parseProviderConfig(json);
    expect(result.error?.details?.errors).toBeDefined();
    expect(Array.isArray(result.error?.details?.errors)).toBe(true);
  });

  it('should handle JSON with extra whitespace', () => {
    const json = `
      {
        "providerId": "provider-1",
        "providerName": "Groq",
        "providerType": "LLM",
        "rotationStrategy": "round_robin",
        "activeKeys": 2,
        "totalKeys": 3
      }
    `;
    const result = parseProviderConfig(json);
    expect(result.success).toBe(true);
    expect(result.data?.providerId).toBe('provider-1');
  });

  it('should handle JSON with unicode characters', () => {
    const config = {
      ...validConfig,
      providerName: 'Groq (Urdu: گروق)',
    };
    const json = JSON.stringify(config);
    const result = parseProviderConfig(json);
    expect(result.success).toBe(true);
    expect(result.data?.providerName).toContain('Urdu');
  });
});

// ============================================================================
// SERIALIZATION TESTS
// ============================================================================

describe('serializeProviderConfig', () => {
  it('should serialize valid configuration to JSON', () => {
    const result = serializeProviderConfig(validConfig);
    expect(result.success).toBe(true);
    expect(result.json).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should serialize configuration without pretty-printing by default', () => {
    const result = serializeProviderConfig(validConfig, false);
    expect(result.success).toBe(true);
    expect(result.json).not.toContain('\n');
  });

  it('should serialize configuration with pretty-printing when requested', () => {
    const result = serializeProviderConfig(validConfig, true);
    expect(result.success).toBe(true);
    expect(result.json).toContain('\n');
    expect(result.json).toContain('  ');
  });

  it('should serialize configuration with models', () => {
    const result = serializeProviderConfig(validConfig);
    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.json!);
    expect(parsed.models).toHaveLength(1);
  });

  it('should serialize configuration with voices', () => {
    const result = serializeProviderConfig(validConfigWithVoices);
    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.json!);
    expect(parsed.voices).toHaveLength(1);
  });

  it('should reject invalid configuration during serialization', () => {
    const invalid = { providerId: 'test' };
    const result = serializeProviderConfig(invalid as any);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(result.json).toBeUndefined();
  });

  it('should produce valid JSON that can be parsed', () => {
    const result = serializeProviderConfig(validConfig);
    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.json!);
    expect(parsed.providerId).toBe(validConfig.providerId);
    expect(parsed.providerName).toBe(validConfig.providerName);
  });
});

// ============================================================================
// FORMATTING TESTS
// ============================================================================

describe('formatProviderConfig', () => {
  it('should format configuration with indentation', () => {
    const formatted = formatProviderConfig(validConfig);
    expect(formatted).toContain('\n');
    expect(formatted).toContain('  ');
  });

  it('should produce valid JSON', () => {
    const formatted = formatProviderConfig(validConfig);
    const parsed = JSON.parse(formatted);
    expect(parsed.providerId).toBe(validConfig.providerId);
  });

  it('should throw error for invalid configuration', () => {
    const invalid = { providerId: 'test' };
    expect(() => formatProviderConfig(invalid as any)).toThrow();
  });
});

// ============================================================================
// ROUND-TRIP SERIALIZATION TESTS
// ============================================================================

describe('Round-trip serialization', () => {
  it('should preserve configuration through serialize-parse cycle', () => {
    const serialized = serializeProviderConfig(validConfig);
    expect(serialized.success).toBe(true);

    const parsed = parseProviderConfig(serialized.json!);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.providerId).toBe(validConfig.providerId);
    expect(parsed.data?.providerName).toBe(validConfig.providerName);
    expect(parsed.data?.providerType).toBe(validConfig.providerType);
  });

  it('should preserve configuration with models through round-trip', () => {
    const serialized = serializeProviderConfig(validConfig);
    const parsed = parseProviderConfig(serialized.json!);
    expect(parsed.data?.models).toHaveLength(validConfig.models?.length || 0);
    if (validConfig.models && parsed.data?.models) {
      expect(parsed.data.models[0].modelName).toBe(validConfig.models[0].modelName);
    }
  });

  it('should preserve configuration with voices through round-trip', () => {
    const serialized = serializeProviderConfig(validConfigWithVoices);
    const parsed = parseProviderConfig(serialized.json!);
    expect(parsed.data?.voices).toHaveLength(validConfigWithVoices.voices?.length || 0);
    if (validConfigWithVoices.voices && parsed.data?.voices) {
      expect(parsed.data.voices[0].voiceName).toBe(validConfigWithVoices.voices[0].voiceName);
    }
  });

  it('should preserve all fields through multiple round-trips', () => {
    let current = validConfig;
    for (let i = 0; i < 3; i++) {
      const serialized = serializeProviderConfig(current);
      const parsed = parseProviderConfig(serialized.json!);
      current = parsed.data!;
    }
    expect(current.providerId).toBe(validConfig.providerId);
    expect(current.providerName).toBe(validConfig.providerName);
    expect(current.providerType).toBe(validConfig.providerType);
  });

  it('should preserve unicode characters through round-trip', () => {
    const config = {
      ...validConfig,
      providerName: 'Groq (گروق)',
    };
    const serialized = serializeProviderConfig(config);
    const parsed = parseProviderConfig(serialized.json!);
    expect(parsed.data?.providerName).toBe('Groq (گروق)');
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('isValidConfiguration', () => {
  it('should return true for valid configuration', () => {
    expect(isValidConfiguration(validConfig)).toBe(true);
  });

  it('should return false for invalid configuration', () => {
    expect(isValidConfiguration({ providerId: 'test' })).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isValidConfiguration('not an object')).toBe(false);
  });
});

describe('getValidationErrors', () => {
  it('should return empty array for valid configuration', () => {
    const errors = getValidationErrors(validConfig);
    expect(errors).toHaveLength(0);
  });

  it('should return errors for invalid configuration', () => {
    const errors = getValidationErrors({ providerId: 'test' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should include field names in errors', () => {
    const errors = getValidationErrors({ providerId: 'test' });
    expect(errors.some((e) => e.field === 'providerName')).toBe(true);
  });
});

describe('formatValidationErrors', () => {
  it('should format empty error array', () => {
    const message = formatValidationErrors([]);
    expect(message).toBe('No validation errors');
  });

  it('should format single error', () => {
    const errors: ValidationError[] = [
      {
        field: 'providerId',
        message: 'Required field is missing',
      },
    ];
    const message = formatValidationErrors(errors);
    expect(message).toContain('providerId');
    expect(message).toContain('Required field is missing');
  });

  it('should format multiple errors', () => {
    const errors: ValidationError[] = [
      {
        field: 'providerId',
        message: 'Required field is missing',
      },
      {
        field: 'providerName',
        message: 'Required field is missing',
      },
    ];
    const message = formatValidationErrors(errors);
    expect(message).toContain('providerId');
    expect(message).toContain('providerName');
  });
});

describe('mergeProviderConfigs', () => {
  it('should merge configurations', () => {
    const updates = { activeKeys: 5 };
    const merged = mergeProviderConfigs(validConfig, updates);
    expect(merged.activeKeys).toBe(5);
    expect(merged.providerId).toBe(validConfig.providerId);
  });

  it('should preserve required fields', () => {
    const updates = { activeKeys: 5 };
    const merged = mergeProviderConfigs(validConfig, updates);
    expect(merged.providerId).toBe(validConfig.providerId);
    expect(merged.providerName).toBe(validConfig.providerName);
    expect(merged.providerType).toBe(validConfig.providerType);
  });

  it('should allow updating all fields', () => {
    const updates: Partial<ProviderConfiguration> = {
      activeKeys: 10,
      totalKeys: 15,
      rotationStrategy: 'fallback',
    };
    const merged = mergeProviderConfigs(validConfig, updates);
    expect(merged.activeKeys).toBe(10);
    expect(merged.totalKeys).toBe(15);
    expect(merged.rotationStrategy).toBe('fallback');
  });
});

describe('createMinimalConfig', () => {
  it('should create minimal valid configuration', () => {
    const config = createMinimalConfig();
    const validation = validateProviderConfig(config);
    expect(validation.valid).toBe(true);
  });

  it('should allow overrides', () => {
    const config = createMinimalConfig({
      providerName: 'Custom Provider',
      providerType: 'TTS',
    });
    expect(config.providerName).toBe('Custom Provider');
    expect(config.providerType).toBe('TTS');
  });

  it('should have all required fields', () => {
    const config = createMinimalConfig();
    expect(config.providerId).toBeDefined();
    expect(config.providerName).toBeDefined();
    expect(config.providerType).toBeDefined();
    expect(config.rotationStrategy).toBeDefined();
    expect(config.activeKeys).toBeDefined();
    expect(config.totalKeys).toBeDefined();
  });
});

// ============================================================================
// DATABASE LOADING TESTS (MOCKED)
// ============================================================================

describe('loadProviderConfig (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load provider configuration from database', async () => {
    const mockProvider = {
      id: 'provider-1',
      name: 'Groq',
      providerType: 'LLM' as const,
      apiEndpoint: 'https://api.groq.com',
      apiVersion: 'v1',
      pricingPer1kTokens: 0.0005,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(db, 'queryOne')
      .mockResolvedValueOnce(mockProvider)
      .mockResolvedValueOnce({ active: 2, total: 3 });
    vi.spyOn(db, 'queryMany')
      .mockResolvedValueOnce([]) // models
      .mockResolvedValueOnce([]); // voices

    const config = await loadProviderConfig('provider-1');
    expect(config).toBeDefined();
    expect(config?.providerId).toBe('provider-1');
    expect(config?.providerName).toBe('Groq');
  });

  it('should return null for non-existent provider', async () => {
    vi.spyOn(db, 'queryOne').mockResolvedValueOnce(null);

    const config = await loadProviderConfig('non-existent');
    expect(config).toBeNull();
  });

  it('should load models and voices', async () => {
    const mockProvider = {
      id: 'provider-1',
      name: 'Groq',
      providerType: 'LLM' as const,
      apiEndpoint: 'https://api.groq.com',
      apiVersion: 'v1',
      pricingPer1kTokens: 0.0005,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockModels = [
      {
        id: 'model-1',
        providerId: 'provider-1',
        modelName: 'Llama 3.3 70B',
        modelId: 'llama-3.3-70b-versatile',
        pricingPer1kTokens: 0.0005,
        contextWindow: 8192,
        createdAt: new Date(),
      },
    ];

    vi.spyOn(db, 'queryOne')
      .mockResolvedValueOnce(mockProvider)
      .mockResolvedValueOnce({ active: 1, total: 1 });
    vi.spyOn(db, 'queryMany')
      .mockResolvedValueOnce(mockModels)
      .mockResolvedValueOnce([]);

    const config = await loadProviderConfig('provider-1');
    expect(config?.models).toHaveLength(1);
    expect(config?.models?.[0].modelName).toBe('Llama 3.3 70B');
  });
});

describe('getProviderConfigByName (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null for non-existent provider name', async () => {
    vi.spyOn(db, 'queryOne').mockResolvedValueOnce(null);

    const config = await getProviderConfigByName('NonExistent');
    expect(config).toBeNull();
  });
});

describe('getAllProviderConfigs (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle empty provider list', async () => {
    vi.spyOn(db, 'queryMany').mockResolvedValueOnce([]);

    const configs = await getAllProviderConfigs();
    expect(configs).toEqual([]);
  });
});

describe('exportProviderConfig (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export provider configuration as JSON', async () => {
    const mockProvider = {
      id: 'provider-1',
      name: 'Groq',
      providerType: 'LLM' as const,
      apiEndpoint: 'https://api.groq.com',
      apiVersion: 'v1',
      pricingPer1kTokens: 0.0005,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(db, 'queryOne')
      .mockResolvedValueOnce(mockProvider)
      .mockResolvedValueOnce({ active: 1, total: 1 });
    vi.spyOn(db, 'queryMany')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const json = await exportProviderConfig('provider-1');
    expect(json).toBeDefined();
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json!);
    expect(parsed.providerId).toBe('provider-1');
  });

  it('should return null for non-existent provider', async () => {
    vi.spyOn(db, 'queryOne').mockResolvedValueOnce(null);

    const json = await exportProviderConfig('non-existent');
    expect(json).toBeNull();
  });
});

describe('importProviderConfig', () => {
  it('should import valid configuration from JSON', () => {
    const json = JSON.stringify(validConfig);
    const result = importProviderConfig(json);
    expect(result.success).toBe(true);
    expect(result.data?.providerId).toBe(validConfig.providerId);
    expect(result.data?.providerName).toBe(validConfig.providerName);
  });

  it('should reject invalid JSON during import', () => {
    const result = importProviderConfig('{ invalid }');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_JSON');
  });
});
