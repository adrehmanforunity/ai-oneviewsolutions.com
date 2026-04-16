# Provider Configuration Parser and Serializer

## Overview

The Provider Configuration Parser and Serializer module handles loading, parsing, validating, and serializing provider configurations for the AI Provider Management system. It ensures data integrity and consistency through comprehensive validation and round-trip serialization support.

## Features

- **Load from Database**: Fetch provider configuration from database with models and voices
- **Parse JSON**: Parse provider configuration from JSON strings with error handling
- **Serialize to JSON**: Convert configuration objects to JSON with optional pretty-printing
- **Validate Configuration**: Comprehensive validation of configuration structure and required fields
- **Error Handling**: Graceful handling of invalid JSON with descriptive error messages
- **Round-Trip Support**: Serialize → Parse → Serialize produces equivalent results
- **Data Integrity**: Maintains all fields and data types through serialization cycles

## Installation

The module is part of the AI Provider Management system and is located at `lib/provider-config/`.

## Usage

### Basic Parsing

```typescript
import { parseProviderConfig } from 'lib/provider-config';

const jsonString = `{
  "providerId": "provider-1",
  "providerName": "Groq",
  "providerType": "LLM",
  "rotationStrategy": "round_robin",
  "activeKeys": 2,
  "totalKeys": 3
}`;

const result = parseProviderConfig(jsonString);
if (result.success) {
  console.log('Configuration:', result.data);
} else {
  console.error('Parse error:', result.error);
}
```

### Serialization

```typescript
import { serializeProviderConfig } from 'lib/provider-config';

const config = {
  providerId: 'provider-1',
  providerName: 'Groq',
  providerType: 'LLM',
  rotationStrategy: 'round_robin',
  activeKeys: 2,
  totalKeys: 3,
};

// Compact JSON
const result = serializeProviderConfig(config);
console.log(result.json);

// Pretty-printed JSON
const prettyResult = serializeProviderConfig(config, true);
console.log(prettyResult.json);
```

### Validation

```typescript
import { validateProviderConfig, getValidationErrors } from 'lib/provider-config';

const config = { providerId: 'test' }; // Incomplete

const validation = validateProviderConfig(config);
if (!validation.valid) {
  const errors = getValidationErrors(config);
  console.error('Validation errors:', errors);
}
```

### Loading from Database

```typescript
import { loadProviderConfig, getProviderConfigByName } from 'lib/provider-config';

// Load by provider ID
const config = await loadProviderConfig('provider-1');

// Load by provider name
const groqConfig = await getProviderConfigByName('Groq');

// Load all providers
const allConfigs = await getAllProviderConfigs();
```

### Export/Import

```typescript
import { exportProviderConfig, importProviderConfig } from 'lib/provider-config';

// Export configuration as JSON
const json = await exportProviderConfig('provider-1');

// Import configuration from JSON
const result = importProviderConfig(json);
if (result.success) {
  console.log('Imported configuration:', result.data);
}
```

## Configuration Structure

```typescript
interface ProviderConfiguration {
  providerId: string;              // Unique provider identifier
  providerName: string;            // Human-readable provider name
  providerType: 'LLM' | 'STT' | 'TTS';  // Provider type
  rotationStrategy: 'round_robin' | 'fallback' | 'least_used';  // Key rotation strategy
  activeKeys: number;              // Number of active API keys
  totalKeys: number;               // Total number of API keys
  models?: ProviderModel[];        // Available models (optional)
  voices?: ProviderVoice[];        // Available voices (optional)
}
```

## Validation Rules

### Required Fields

All of the following fields are required:
- `providerId`: Non-empty string
- `providerName`: Non-empty string
- `providerType`: One of 'LLM', 'STT', 'TTS'
- `rotationStrategy`: One of 'round_robin', 'fallback', 'least_used'
- `activeKeys`: Non-negative integer
- `totalKeys`: Non-negative integer

### Field Constraints

- `activeKeys` must be ≤ `totalKeys`
- `models` (if provided) must be an array of valid model objects
- `voices` (if provided) must be an array of valid voice objects
- Each model must have: `id`, `modelName`, `modelId`
- Each voice must have: `id`, `voiceId`, `voiceName`

### Valid Values

**Provider Types:**
- `LLM` - Large Language Model
- `STT` - Speech-to-Text
- `TTS` - Text-to-Speech

**Rotation Strategies:**
- `round_robin` - Distribute requests evenly across keys
- `fallback` - Use first key until rate-limited, then switch
- `least_used` - Select key with highest remaining quota

## Error Handling

### Parse Errors

```typescript
const result = parseProviderConfig('{ invalid json }');
// result.success === false
// result.error.code === 'INVALID_JSON'
// result.error.message contains details
```

### Validation Errors

```typescript
const result = parseProviderConfig('{"providerId": "test"}');
// result.success === false
// result.error.code === 'VALIDATION_ERROR'
// result.error.details.errors contains array of ValidationError objects
```

### Serialization Errors

```typescript
const result = serializeProviderConfig({ providerId: 'test' });
// result.success === false
// result.error.code === 'VALIDATION_ERROR'
```

## API Reference

### Validation Functions

#### `validateProviderConfig(config: any): ValidationResult`

Validates a configuration object against the schema.

**Returns:**
- `valid`: boolean - Whether configuration is valid
- `errors`: ValidationError[] - Array of validation errors

#### `getValidationErrors(config: any): ValidationError[]`

Gets validation errors for a configuration.

#### `formatValidationErrors(errors: ValidationError[]): string`

Formats validation errors as a human-readable string.

### Parsing Functions

#### `parseProviderConfig(jsonString: string): ParseResult`

Parses a JSON string into a configuration object.

**Returns:**
- `success`: boolean - Whether parsing succeeded
- `data`: ProviderConfiguration - Parsed configuration (if successful)
- `error`: ParseError - Error details (if failed)

#### `importProviderConfig(jsonString: string): ParseResult`

Alias for `parseProviderConfig()`.

### Serialization Functions

#### `serializeProviderConfig(config: ProviderConfiguration, pretty?: boolean): SerializationResult`

Serializes a configuration object to JSON.

**Parameters:**
- `config`: Configuration object to serialize
- `pretty`: Whether to pretty-print JSON (default: false)

**Returns:**
- `success`: boolean - Whether serialization succeeded
- `json`: string - Serialized JSON (if successful)
- `error`: SerializationError - Error details (if failed)

#### `formatProviderConfig(config: ProviderConfiguration): string`

Pretty-prints a configuration object to formatted JSON.

#### `exportProviderConfig(providerId: string): Promise<string | null>`

Exports a provider configuration from the database as JSON.

### Database Functions

#### `loadProviderConfig(providerId: string): Promise<ProviderConfiguration | null>`

Loads a provider configuration from the database.

#### `getProviderConfigByName(providerName: string): Promise<ProviderConfiguration | null>`

Gets a provider configuration by provider name.

#### `getAllProviderConfigs(): Promise<ProviderConfiguration[]>`

Gets all provider configurations from the database.

### Utility Functions

#### `isValidConfiguration(config: any): boolean`

Checks if a configuration is valid.

#### `mergeProviderConfigs(base: ProviderConfiguration, updates: Partial<ProviderConfiguration>): ProviderConfiguration`

Merges a base configuration with partial updates.

#### `createMinimalConfig(overrides?: Partial<ProviderConfiguration>): ProviderConfiguration`

Creates a minimal valid configuration for testing.

## Examples

### Complete Workflow

```typescript
import {
  loadProviderConfig,
  serializeProviderConfig,
  parseProviderConfig,
  validateProviderConfig,
} from 'lib/provider-config';

// 1. Load from database
const config = await loadProviderConfig('provider-1');

// 2. Serialize to JSON
const serializeResult = serializeProviderConfig(config, true);
console.log('Exported JSON:', serializeResult.json);

// 3. Parse back from JSON
const parseResult = parseProviderConfig(serializeResult.json);

// 4. Validate
const validation = validateProviderConfig(parseResult.data);
console.log('Valid:', validation.valid);
```

### Error Handling

```typescript
import { parseProviderConfig, formatValidationErrors } from 'lib/provider-config';

const result = parseProviderConfig(userInput);

if (!result.success) {
  if (result.error.code === 'INVALID_JSON') {
    console.error('Invalid JSON format:', result.error.message);
  } else if (result.error.code === 'VALIDATION_ERROR') {
    const errorMessage = formatValidationErrors(result.error.details.errors);
    console.error(errorMessage);
  }
}
```

### Configuration Updates

```typescript
import { loadProviderConfig, mergeProviderConfigs } from 'lib/provider-config';

const config = await loadProviderConfig('provider-1');

// Update rotation strategy
const updated = mergeProviderConfigs(config, {
  rotationStrategy: 'least_used',
});

console.log('Updated strategy:', updated.rotationStrategy);
```

## Testing

### Unit Tests

Run unit tests:
```bash
npm test lib/provider-config/index.test.ts
```

Tests cover:
- Configuration validation (valid and invalid cases)
- JSON parsing (valid and invalid JSON)
- Serialization (compact and pretty-printed)
- Round-trip serialization
- Utility functions
- Database operations (mocked)

### Property-Based Tests

Run property-based tests:
```bash
npm test lib/provider-config/provider-config-roundtrip.test.ts
```

Property-based tests verify:
- Round-trip serialization preserves all data (100+ iterations)
- Multiple round-trips maintain equivalence
- Numeric fields maintain precision
- String fields are not modified
- Unicode characters are preserved
- Configuration remains valid after round-trip

## Performance Considerations

- **Parsing**: O(n) where n is JSON string length
- **Serialization**: O(n) where n is configuration object size
- **Validation**: O(m) where m is number of models + voices
- **Database Loading**: O(1) for provider, O(m) for models/voices

## Security Considerations

- Configuration does not contain sensitive data (API keys are stored separately)
- All input is validated before processing
- JSON parsing uses safe `JSON.parse()` (no `eval()`)
- No code execution from configuration data

## Troubleshooting

### "Configuration must be an object"

The input is not a valid object. Ensure you're passing a JavaScript object or valid JSON string.

### "Required field 'X' is missing"

The configuration is missing a required field. Check the Configuration Structure section for all required fields.

### "Invalid JSON: Unexpected token"

The JSON string has syntax errors. Use a JSON validator to check the syntax.

### "activeKeys cannot be greater than totalKeys"

The number of active keys exceeds the total number of keys. Ensure `activeKeys ≤ totalKeys`.

## Related Modules

- `lib/db/` - Database access and query utilities
- `lib/encryption/` - API key encryption/decryption
- `lib/activity-logging/` - Activity log tracking
- `lib/cost-tracking/` - Cost calculation and tracking

## Requirements

This module implements the following requirements:
- **15.1**: Load provider configuration from database
- **15.2**: Parse provider configuration JSON
- **15.3**: Validate configuration on load (all required fields present)
- **15.4**: Handle invalid JSON gracefully with descriptive errors
- **15.5**: Support round-trip serialization (load → serialize → load)
- **15.6**: Serialize provider configuration to JSON
- **15.7**: Maintain data integrity and consistency

## License

Part of the AI Provider Management system.
