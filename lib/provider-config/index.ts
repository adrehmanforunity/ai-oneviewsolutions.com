/**
 * Provider Configuration Parser and Serializer
 * Handles loading, parsing, validating, and serializing provider configurations
 * 
 * Features:
 * - Load provider configuration from database
 * - Parse provider configuration JSON
 * - Serialize provider configuration to JSON
 * - Validate configuration structure and required fields
 * - Handle invalid JSON gracefully with descriptive errors
 * - Support round-trip serialization (load → serialize → load)
 * - Maintain data integrity and consistency
 */

import { queryMany, queryOne } from '../db/index';
import {
  Provider,
  ProviderModel,
  ProviderVoice,
  ProviderConfiguration,
  RotationStrategyType,
  ProviderType,
} from '../db/schema';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Configuration validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Configuration parsing result
 */
export interface ParseResult {
  success: boolean;
  data?: ProviderConfiguration;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * Configuration serialization result
 */
export interface SerializationResult {
  success: boolean;
  json?: string;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REQUIRED_FIELDS = [
  'providerId',
  'providerName',
  'providerType',
  'rotationStrategy',
  'activeKeys',
  'totalKeys',
];

const VALID_PROVIDER_TYPES: ProviderType[] = ['LLM', 'STT', 'TTS'];
const VALID_ROTATION_STRATEGIES: RotationStrategyType[] = [
  'round_robin',
  'fallback',
  'least_used',
];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate provider configuration structure
 * Checks for required fields, correct types, and valid values
 * 
 * @param config Configuration object to validate
 * @returns Validation result with errors if any
 */
export function validateProviderConfig(
  config: any
): ValidationResult {
  const errors: ValidationError[] = [];

  // Check if config is an object
  if (!config || typeof config !== 'object') {
    return {
      valid: false,
      errors: [
        {
          field: 'root',
          message: 'Configuration must be an object',
          value: config,
        },
      ],
    };
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in config)) {
      errors.push({
        field,
        message: `Required field "${field}" is missing`,
      });
    }
  }

  // Validate providerId
  if (config.providerId !== undefined) {
    if (typeof config.providerId !== 'string' || !config.providerId.trim()) {
      errors.push({
        field: 'providerId',
        message: 'providerId must be a non-empty string',
        value: config.providerId,
      });
    }
  }

  // Validate providerName
  if (config.providerName !== undefined) {
    if (typeof config.providerName !== 'string' || !config.providerName.trim()) {
      errors.push({
        field: 'providerName',
        message: 'providerName must be a non-empty string',
        value: config.providerName,
      });
    }
  }

  // Validate providerType
  if (config.providerType !== undefined) {
    if (!VALID_PROVIDER_TYPES.includes(config.providerType)) {
      errors.push({
        field: 'providerType',
        message: `providerType must be one of: ${VALID_PROVIDER_TYPES.join(', ')}`,
        value: config.providerType,
      });
    }
  }

  // Validate rotationStrategy
  if (config.rotationStrategy !== undefined) {
    if (!VALID_ROTATION_STRATEGIES.includes(config.rotationStrategy)) {
      errors.push({
        field: 'rotationStrategy',
        message: `rotationStrategy must be one of: ${VALID_ROTATION_STRATEGIES.join(', ')}`,
        value: config.rotationStrategy,
      });
    }
  }

  // Validate activeKeys
  if (config.activeKeys !== undefined) {
    if (!Number.isInteger(config.activeKeys) || config.activeKeys < 0) {
      errors.push({
        field: 'activeKeys',
        message: 'activeKeys must be a non-negative integer',
        value: config.activeKeys,
      });
    }
  }

  // Validate totalKeys
  if (config.totalKeys !== undefined) {
    if (!Number.isInteger(config.totalKeys) || config.totalKeys < 0) {
      errors.push({
        field: 'totalKeys',
        message: 'totalKeys must be a non-negative integer',
        value: config.totalKeys,
      });
    }
  }

  // Validate activeKeys <= totalKeys
  if (
    config.activeKeys !== undefined &&
    config.totalKeys !== undefined &&
    config.activeKeys > config.totalKeys
  ) {
    errors.push({
      field: 'activeKeys',
      message: 'activeKeys cannot be greater than totalKeys',
      value: config.activeKeys,
    });
  }

  // Validate models (optional)
  if (config.models !== undefined) {
    if (!Array.isArray(config.models)) {
      errors.push({
        field: 'models',
        message: 'models must be an array',
        value: config.models,
      });
    } else {
      config.models.forEach((model: any, index: number) => {
        if (!model.id || !model.modelName || !model.modelId) {
          errors.push({
            field: `models[${index}]`,
            message: 'Each model must have id, modelName, and modelId',
            value: model,
          });
        }
      });
    }
  }

  // Validate voices (optional)
  if (config.voices !== undefined) {
    if (!Array.isArray(config.voices)) {
      errors.push({
        field: 'voices',
        message: 'voices must be an array',
        value: config.voices,
      });
    } else {
      config.voices.forEach((voice: any, index: number) => {
        if (!voice.id || !voice.voiceId || !voice.voiceName) {
          errors.push({
            field: `voices[${index}]`,
            message: 'Each voice must have id, voiceId, and voiceName',
            value: voice,
          });
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

/**
 * Parse provider configuration from JSON string
 * Validates JSON syntax and configuration structure
 * 
 * @param jsonString JSON string to parse
 * @returns Parse result with configuration or error
 */
export function parseProviderConfig(jsonString: string): ParseResult {
  try {
    // Validate input
    if (!jsonString || typeof jsonString !== 'string') {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Configuration must be a non-empty string',
        },
      };
    }

    // Parse JSON
    let config: any;
    try {
      config = JSON.parse(jsonString);
    } catch (parseError) {
      const error = parseError instanceof Error ? parseError : new Error(String(parseError));
      return {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: `Invalid JSON: ${error.message}`,
          details: {
            originalError: error.message,
          },
        },
      };
    }

    // Validate configuration structure
    const validation = validateProviderConfig(config);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Configuration validation failed',
          details: {
            errors: validation.errors,
          },
        },
      };
    }

    return {
      success: true,
      data: config as ProviderConfiguration,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'PARSE_ERROR',
        message: `Failed to parse configuration: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

// ============================================================================
// SERIALIZATION FUNCTIONS
// ============================================================================

/**
 * Serialize provider configuration to JSON string
 * Validates configuration before serialization
 * 
 * @param config Configuration object to serialize
 * @param pretty Whether to pretty-print JSON (default: false)
 * @returns Serialization result with JSON or error
 */
export function serializeProviderConfig(
  config: ProviderConfiguration,
  pretty: boolean = false
): SerializationResult {
  try {
    // Validate configuration
    const validation = validateProviderConfig(config);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Configuration validation failed before serialization',
        },
      };
    }

    // Serialize to JSON
    const json = JSON.stringify(
      config,
      null,
      pretty ? 2 : undefined
    );

    return {
      success: true,
      json,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SERIALIZATION_ERROR',
        message: `Failed to serialize configuration: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

/**
 * Pretty-print provider configuration to formatted JSON string
 * 
 * @param config Configuration object to format
 * @returns Formatted JSON string or error message
 */
export function formatProviderConfig(config: ProviderConfiguration): string {
  const result = serializeProviderConfig(config, true);
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to format configuration');
  }
  return result.json || '';
}

// ============================================================================
// DATABASE LOADING FUNCTIONS
// ============================================================================

/**
 * Load provider configuration from database
 * Fetches provider, models, and voices from database
 * 
 * @param providerId Provider ID to load
 * @returns Configuration object or null if not found
 */
export async function loadProviderConfig(
  providerId: string
): Promise<ProviderConfiguration | null> {
  try {
    // Load provider
    const provider = await queryOne<Provider>(
      'SELECT * FROM providers WHERE id = $1',
      [providerId]
    );

    if (!provider) {
      return null;
    }

    // Load models
    const models = await queryMany<ProviderModel>(
      'SELECT * FROM provider_models WHERE provider_id = $1 ORDER BY created_at ASC',
      [providerId]
    );

    // Load voices
    const voices = await queryMany<ProviderVoice>(
      'SELECT * FROM provider_voices WHERE provider_id = $1 ORDER BY created_at ASC',
      [providerId]
    );

    // Load active and total keys for this provider
    const keyStats = await queryOne<{ active: number; total: number }>(
      `SELECT 
        COUNT(CASE WHEN active = true THEN 1 END) as active,
        COUNT(*) as total
      FROM api_keys
      WHERE provider_id = $1`,
      [providerId]
    );

    const config: ProviderConfiguration = {
      providerId: provider.id,
      providerName: provider.name,
      providerType: provider.providerType,
      models: models.length > 0 ? models : undefined,
      voices: voices.length > 0 ? voices : undefined,
      rotationStrategy: 'round_robin', // Default strategy
      activeKeys: keyStats?.active || 0,
      totalKeys: keyStats?.total || 0,
    };

    return config;
  } catch (error) {
    throw new Error(
      `Failed to load provider configuration: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get provider configuration by provider name
 * 
 * @param providerName Provider name (e.g., "Groq", "Claude")
 * @returns Configuration object or null if not found
 */
export async function getProviderConfigByName(
  providerName: string
): Promise<ProviderConfiguration | null> {
  try {
    const provider = await queryOne<Provider>(
      'SELECT * FROM providers WHERE name = $1',
      [providerName]
    );

    if (!provider) {
      return null;
    }

    return loadProviderConfig(provider.id);
  } catch (error) {
    throw new Error(
      `Failed to get provider configuration by name: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get all provider configurations
 * 
 * @returns Array of configuration objects
 */
export async function getAllProviderConfigs(): Promise<ProviderConfiguration[]> {
  try {
    const providers = await queryMany<Provider>(
      'SELECT * FROM providers ORDER BY name ASC'
    );

    const configs: ProviderConfiguration[] = [];
    for (const provider of providers) {
      const config = await loadProviderConfig(provider.id);
      if (config) {
        configs.push(config);
      }
    }

    return configs;
  } catch (error) {
    throw new Error(
      `Failed to get all provider configurations: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ============================================================================
// FILE EXPORT/IMPORT FUNCTIONS
// ============================================================================

/**
 * Export provider configuration as JSON file content
 * 
 * @param providerId Provider ID to export
 * @returns JSON string or null if provider not found
 */
export async function exportProviderConfig(
  providerId: string
): Promise<string | null> {
  try {
    const config = await loadProviderConfig(providerId);
    if (!config) {
      return null;
    }

    const result = serializeProviderConfig(config, true);
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to serialize configuration');
    }

    return result.json || null;
  } catch (error) {
    throw new Error(
      `Failed to export provider configuration: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Import provider configuration from JSON string
 * Validates configuration before importing
 * 
 * @param jsonString JSON string to import
 * @returns Parsed configuration or error
 */
export function importProviderConfig(jsonString: string): ParseResult {
  return parseProviderConfig(jsonString);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if configuration is valid
 * 
 * @param config Configuration object to check
 * @returns true if valid, false otherwise
 */
export function isValidConfiguration(config: any): boolean {
  const validation = validateProviderConfig(config);
  return validation.valid;
}

/**
 * Get validation errors for configuration
 * 
 * @param config Configuration object to validate
 * @returns Array of validation errors
 */
export function getValidationErrors(config: any): ValidationError[] {
  const validation = validateProviderConfig(config);
  return validation.errors;
}

/**
 * Get human-readable validation error message
 * 
 * @param errors Array of validation errors
 * @returns Formatted error message
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return 'No validation errors';
  }

  const messages = errors.map(
    (error) => `- ${error.field}: ${error.message}`
  );

  return `Configuration validation failed:\n${messages.join('\n')}`;
}

/**
 * Merge two provider configurations
 * Useful for updating configuration with partial data
 * 
 * @param base Base configuration
 * @param updates Partial configuration with updates
 * @returns Merged configuration
 */
export function mergeProviderConfigs(
  base: ProviderConfiguration,
  updates: Partial<ProviderConfiguration>
): ProviderConfiguration {
  return {
    ...base,
    ...updates,
    // Ensure required fields are not removed
    providerId: updates.providerId || base.providerId,
    providerName: updates.providerName || base.providerName,
    providerType: updates.providerType || base.providerType,
    rotationStrategy: updates.rotationStrategy || base.rotationStrategy,
    activeKeys: updates.activeKeys !== undefined ? updates.activeKeys : base.activeKeys,
    totalKeys: updates.totalKeys !== undefined ? updates.totalKeys : base.totalKeys,
  };
}

/**
 * Create a minimal valid configuration for testing
 * 
 * @param overrides Optional field overrides
 * @returns Minimal valid configuration
 */
export function createMinimalConfig(
  overrides?: Partial<ProviderConfiguration>
): ProviderConfiguration {
  return {
    providerId: 'test-provider-1',
    providerName: 'Test Provider',
    providerType: 'LLM',
    rotationStrategy: 'round_robin',
    activeKeys: 1,
    totalKeys: 1,
    ...overrides,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
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
};
