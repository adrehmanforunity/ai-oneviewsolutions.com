/**
 * Key Rotation Engine
 * Implements multiple rotation strategies for selecting API keys
 * - Round-Robin: Distribute requests evenly across all active keys
 * - Fallback: Use first key until rate-limited, then try next
 * - Least-Used: Select key with highest remaining quota
 */

import { ApiKey, RotationStrategyType } from '../db/schema';

/**
 * Rotation state tracks the current position for round-robin strategy
 */
export interface RotationState {
  currentIndex: number;
  lastUpdated: Date;
}

/**
 * Round-Robin Rotation Strategy
 * Distributes requests evenly across all active keys in sequence
 *
 * @param keys - Array of active API keys
 * @param state - Current rotation state (tracks position)
 * @returns The next key in round-robin sequence
 * @throws Error if no active keys available
 */
export function selectKeyRoundRobin(
  keys: ApiKey[],
  state?: RotationState
): ApiKey {
  if (!keys || keys.length === 0) {
    throw new Error('No active keys available for round-robin selection');
  }

  // Filter to only active keys
  const activeKeys = keys.filter((k) => k.active);
  if (activeKeys.length === 0) {
    throw new Error('No active keys available for round-robin selection');
  }

  // Determine the next index
  let nextIndex = 0;
  if (state && state.currentIndex !== undefined) {
    nextIndex = (state.currentIndex + 1) % activeKeys.length;
  }

  return activeKeys[nextIndex];
}

/**
 * Fallback Rotation Strategy
 * Uses the first key until it fails, then tries the next key sequentially
 *
 * @param keys - Array of API keys (should be ordered by preference)
 * @returns The first active key
 * @throws Error if no active keys available
 */
export function selectKeyFallback(keys: ApiKey[]): ApiKey {
  if (!keys || keys.length === 0) {
    throw new Error('No active keys available for fallback selection');
  }

  // Filter to only active keys
  const activeKeys = keys.filter((k) => k.active);
  if (activeKeys.length === 0) {
    throw new Error('No active keys available for fallback selection');
  }

  // Return the first active key
  return activeKeys[0];
}

/**
 * Least-Used Rotation Strategy
 * Selects the key with the highest remaining quota
 * Remaining quota = (monthlyUsageTokens - dailyUsageTokens) or similar metric
 *
 * @param keys - Array of API keys with quota information
 * @returns The key with the highest remaining quota
 * @throws Error if no active keys available
 */
export function selectKeyLeastUsed(keys: ApiKey[]): ApiKey {
  if (!keys || keys.length === 0) {
    throw new Error('No active keys available for least-used selection');
  }

  // Filter to only active keys
  const activeKeys = keys.filter((k) => k.active);
  if (activeKeys.length === 0) {
    throw new Error('No active keys available for least-used selection');
  }

  // Calculate remaining quota for each key
  // Assuming a monthly quota of 1,000,000 tokens (can be configurable)
  const MONTHLY_QUOTA = 1_000_000;

  let keyWithMostQuota = activeKeys[0];
  let maxRemainingQuota = MONTHLY_QUOTA - activeKeys[0].monthlyUsageTokens;

  for (let i = 1; i < activeKeys.length; i++) {
    const remainingQuota = MONTHLY_QUOTA - activeKeys[i].monthlyUsageTokens;
    if (remainingQuota > maxRemainingQuota) {
      maxRemainingQuota = remainingQuota;
      keyWithMostQuota = activeKeys[i];
    }
  }

  return keyWithMostQuota;
}

/**
 * Select a key based on the specified rotation strategy
 *
 * @param keys - Array of API keys
 * @param strategy - The rotation strategy to use
 * @param state - Optional rotation state (for round-robin)
 * @returns The selected API key
 * @throws Error if strategy is invalid or no active keys available
 */
export function selectKey(
  keys: ApiKey[],
  strategy: RotationStrategyType,
  state?: RotationState
): ApiKey {
  switch (strategy) {
    case 'round_robin':
      return selectKeyRoundRobin(keys, state);
    case 'fallback':
      return selectKeyFallback(keys);
    case 'least_used':
      return selectKeyLeastUsed(keys);
    default:
      throw new Error(`Unknown rotation strategy: ${strategy}`);
  }
}

/**
 * Update rotation state for round-robin strategy
 * This should be called after each successful key selection
 *
 * @param keys - Array of active keys
 * @param currentState - Current rotation state
 * @returns Updated rotation state
 */
export function updateRotationState(
  keys: ApiKey[],
  currentState?: RotationState
): RotationState {
  const activeKeys = keys.filter((k) => k.active);
  if (activeKeys.length === 0) {
    return {
      currentIndex: 0,
      lastUpdated: new Date(),
    };
  }

  let nextIndex = 0;
  if (currentState && currentState.currentIndex !== undefined) {
    nextIndex = (currentState.currentIndex + 1) % activeKeys.length;
  }

  return {
    currentIndex: nextIndex,
    lastUpdated: new Date(),
  };
}

/**
 * Get the index of a key in the active keys array
 * Used for round-robin state management
 *
 * @param keys - Array of API keys
 * @param keyId - The ID of the key to find
 * @returns The index of the key in the active keys array, or -1 if not found
 */
export function getKeyIndex(keys: ApiKey[], keyId: string): number {
  const activeKeys = keys.filter((k) => k.active);
  return activeKeys.findIndex((k) => k.id === keyId);
}

/**
 * Calculate remaining quota for a key
 * Used by least-used strategy
 *
 * @param key - The API key
 * @param monthlyQuota - The monthly quota limit (default: 1,000,000 tokens)
 * @returns The remaining quota
 */
export function calculateRemainingQuota(
  key: ApiKey,
  monthlyQuota: number = 1_000_000
): number {
  return Math.max(0, monthlyQuota - key.monthlyUsageTokens);
}
