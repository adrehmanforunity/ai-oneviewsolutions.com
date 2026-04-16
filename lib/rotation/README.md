# Key Rotation Engine

The Key Rotation Engine implements multiple strategies for selecting which API key to use when making requests to external AI providers. This enables load distribution, fallback handling, and quota-aware key selection.

## Overview

The rotation engine provides three distinct strategies for selecting API keys:

1. **Round-Robin**: Distributes requests evenly across all active keys in sequence
2. **Fallback**: Uses the first key until it fails, then tries the next key sequentially
3. **Least-Used**: Selects the key with the highest remaining quota

## Strategies

### Round-Robin Strategy

Distributes requests evenly across all active keys in a cyclic pattern.

**Use Case**: When you want to balance load equally across multiple keys.

**Behavior**:
- Maintains a rotation state (current index)
- Cycles through active keys in order: key1 → key2 → key3 → key1 → ...
- Skips inactive keys
- Wraps around to the beginning after reaching the last key

**Example**:
```typescript
const keys = [key1, key2, key3];
const state = { currentIndex: 0, lastUpdated: new Date() };

selectKeyRoundRobin(keys, state); // Returns key1
state.currentIndex = 1;
selectKeyRoundRobin(keys, state); // Returns key2
state.currentIndex = 2;
selectKeyRoundRobin(keys, state); // Returns key3
state.currentIndex = 0;
selectKeyRoundRobin(keys, state); // Returns key1 (wraps around)
```

### Fallback Strategy

Uses the first active key until it fails, then tries the next key sequentially.

**Use Case**: When you want to minimize key switching and only use additional keys when necessary.

**Behavior**:
- Always returns the first active key
- Caller is responsible for detecting failures and requesting the next key
- Skips inactive keys

**Example**:
```typescript
const keys = [key1, key2, key3];

selectKeyFallback(keys); // Returns key1
selectKeyFallback(keys); // Returns key1 (same key)
selectKeyFallback(keys); // Returns key1 (same key)

// If key1 fails, caller should disable it and call again
keys[0].active = false;
selectKeyFallback(keys); // Returns key2 (first active key)
```

### Least-Used Strategy

Selects the key with the highest remaining quota.

**Use Case**: When you want to maximize usage of all keys and avoid exhausting any single key's quota.

**Behavior**:
- Calculates remaining quota for each active key
- Remaining quota = Monthly Quota - Monthly Usage Tokens
- Selects the key with the most remaining quota
- Handles ties by selecting the first key with maximum quota
- Skips inactive keys

**Example**:
```typescript
const keys = [
  { id: 'key1', monthlyUsageTokens: 500_000 }, // 500k remaining
  { id: 'key2', monthlyUsageTokens: 200_000 }, // 800k remaining (most)
  { id: 'key3', monthlyUsageTokens: 800_000 }, // 200k remaining
];

selectKeyLeastUsed(keys); // Returns key2 (highest remaining quota)
```

## API Reference

### `selectKeyRoundRobin(keys: ApiKey[], state?: RotationState): ApiKey`

Selects the next key in round-robin sequence.

**Parameters**:
- `keys`: Array of API keys (active and inactive)
- `state`: Optional rotation state tracking current position

**Returns**: The selected API key

**Throws**: Error if no active keys available

### `selectKeyFallback(keys: ApiKey[]): ApiKey`

Selects the first active key.

**Parameters**:
- `keys`: Array of API keys (active and inactive)

**Returns**: The first active API key

**Throws**: Error if no active keys available

### `selectKeyLeastUsed(keys: ApiKey[]): ApiKey`

Selects the key with the highest remaining quota.

**Parameters**:
- `keys`: Array of API keys (active and inactive)

**Returns**: The API key with the most remaining quota

**Throws**: Error if no active keys available

### `selectKey(keys: ApiKey[], strategy: RotationStrategyType, state?: RotationState): ApiKey`

Selects a key based on the specified strategy.

**Parameters**:
- `keys`: Array of API keys
- `strategy`: The rotation strategy ('round_robin', 'fallback', or 'least_used')
- `state`: Optional rotation state (for round-robin)

**Returns**: The selected API key

**Throws**: Error if strategy is invalid or no active keys available

### `updateRotationState(keys: ApiKey[], currentState?: RotationState): RotationState`

Updates the rotation state for the next round-robin selection.

**Parameters**:
- `keys`: Array of API keys
- `currentState`: Current rotation state

**Returns**: Updated rotation state with incremented index

### `getKeyIndex(keys: ApiKey[], keyId: string): number`

Gets the index of a key in the active keys array.

**Parameters**:
- `keys`: Array of API keys
- `keyId`: The ID of the key to find

**Returns**: Index in active keys array, or -1 if not found

### `calculateRemainingQuota(key: ApiKey, monthlyQuota?: number): number`

Calculates the remaining quota for a key.

**Parameters**:
- `key`: The API key
- `monthlyQuota`: Monthly quota limit (default: 1,000,000 tokens)

**Returns**: Remaining quota (never negative)

## Usage Example

```typescript
import {
  selectKey,
  updateRotationState,
  RotationState,
} from './lib/rotation';

// Get keys for a provider
const keys = await getActiveKeysForProvider(tenantId, providerId);

// Get the rotation strategy for this tenant/provider
const strategy = await getRotationStrategy(tenantId, providerId);

// Initialize rotation state (typically stored in memory or cache)
let rotationState: RotationState = { currentIndex: 0, lastUpdated: new Date() };

// Select a key based on strategy
const selectedKey = selectKey(keys, strategy, rotationState);

// Use the key to make an API request
const response = await makeApiRequest(selectedKey, prompt);

// Update rotation state for next request (only for round-robin)
if (strategy === 'round_robin') {
  rotationState = updateRotationState(keys, rotationState);
}

// Handle failures
if (response.status === 429) {
  // Rate limited - mark key as rate-limited
  selectedKey.healthStatus = 'rate_limited';
  
  // Try next key
  const nextKey = selectKey(keys, strategy, rotationState);
  const retryResponse = await makeApiRequest(nextKey, prompt);
}
```

## Testing

The rotation engine includes comprehensive unit tests and property-based tests:

### Unit Tests (`index.test.ts`)
- Tests all three strategies with various scenarios
- Tests edge cases (single key, all inactive, empty array)
- Tests state management and key cycling
- 41 test cases covering all functions

### Property-Based Tests (`rotation.pbt.test.ts`)
- **Property 3**: Round-robin distribution fairness (±10% variance)
- **Property 4**: Fallback strategy sequential selection
- **Property 5**: Least-used strategy quota selection
- Tests with 100+ iterations each to verify universal properties

**Run tests**:
```bash
npm run test -- lib/rotation/index.test.ts --run
npm run test -- lib/rotation/rotation.pbt.test.ts --run
```

## Requirements Validation

This implementation validates the following requirements:

- **Requirement 4.1**: Multiple rotation strategies supported
- **Requirement 4.2**: Round-robin distributes requests evenly
- **Requirement 4.3**: Fallback uses sequential selection
- **Requirement 4.4**: Least-used selects key with highest quota

## Performance Considerations

- **Round-Robin**: O(1) selection time, requires state management
- **Fallback**: O(n) selection time (finds first active key), no state needed
- **Least-Used**: O(n) selection time (finds key with max quota), no state needed

For most use cases, the selection time is negligible compared to the API request time.

## Future Enhancements

- Weighted round-robin (assign different weights to keys)
- Time-based rotation (rotate keys at specific intervals)
- Cost-aware selection (select key with lowest cost per token)
- Custom strategy support (pluggable strategy pattern)
