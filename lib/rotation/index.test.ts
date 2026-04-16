/**
 * Unit Tests for Key Rotation Engine
 * Tests all three rotation strategies with various scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  selectKeyRoundRobin,
  selectKeyFallback,
  selectKeyLeastUsed,
  selectKey,
  updateRotationState,
  getKeyIndex,
  calculateRemainingQuota,
  RotationState,
} from './index';
import { ApiKey } from '../db/schema';

/**
 * Helper function to create mock API keys
 */
function createMockKey(
  id: string,
  active: boolean = true,
  monthlyUsageTokens: number = 0
): ApiKey {
  return {
    id,
    tenantId: 'tenant-1',
    providerId: 'provider-1',
    keyValueEncrypted: 'encrypted-key-value',
    emailAddress: 'test@example.com',
    label: `Key ${id}`,
    active,
    createdAt: new Date(),
    updatedAt: new Date(),
    dailyUsageTokens: 0,
    monthlyUsageTokens,
    healthStatus: 'active',
  };
}

describe('Key Rotation Engine', () => {
  describe('selectKeyRoundRobin', () => {
    it('should select the first key when no state is provided', () => {
      const keys = [
        createMockKey('key-1'),
        createMockKey('key-2'),
        createMockKey('key-3'),
      ];

      const selected = selectKeyRoundRobin(keys);
      expect(selected.id).toBe('key-1');
    });

    it('should cycle through keys in sequence', () => {
      const keys = [
        createMockKey('key-1'),
        createMockKey('key-2'),
        createMockKey('key-3'),
      ];

      let state: RotationState | undefined;
      const selected1 = selectKeyRoundRobin(keys, state);
      expect(selected1.id).toBe('key-1');

      state = { currentIndex: 0, lastUpdated: new Date() };
      const selected2 = selectKeyRoundRobin(keys, state);
      expect(selected2.id).toBe('key-2');

      state = { currentIndex: 1, lastUpdated: new Date() };
      const selected3 = selectKeyRoundRobin(keys, state);
      expect(selected3.id).toBe('key-3');

      state = { currentIndex: 2, lastUpdated: new Date() };
      const selected4 = selectKeyRoundRobin(keys, state);
      expect(selected4.id).toBe('key-1'); // Wraps around
    });

    it('should skip inactive keys', () => {
      const keys = [
        createMockKey('key-1', false), // inactive
        createMockKey('key-2', true),
        createMockKey('key-3', true),
      ];

      const selected = selectKeyRoundRobin(keys);
      expect(selected.id).toBe('key-2');
    });

    it('should throw error when no active keys available', () => {
      const keys = [
        createMockKey('key-1', false),
        createMockKey('key-2', false),
      ];

      expect(() => selectKeyRoundRobin(keys)).toThrow(
        'No active keys available for round-robin selection'
      );
    });

    it('should throw error when keys array is empty', () => {
      expect(() => selectKeyRoundRobin([])).toThrow(
        'No active keys available for round-robin selection'
      );
    });

    it('should handle single key', () => {
      const keys = [createMockKey('key-1')];

      const selected1 = selectKeyRoundRobin(keys);
      expect(selected1.id).toBe('key-1');

      const state = { currentIndex: 0, lastUpdated: new Date() };
      const selected2 = selectKeyRoundRobin(keys, state);
      expect(selected2.id).toBe('key-1'); // Wraps to itself
    });
  });

  describe('selectKeyFallback', () => {
    it('should select the first active key', () => {
      const keys = [
        createMockKey('key-1'),
        createMockKey('key-2'),
        createMockKey('key-3'),
      ];

      const selected = selectKeyFallback(keys);
      expect(selected.id).toBe('key-1');
    });

    it('should skip inactive keys and select first active', () => {
      const keys = [
        createMockKey('key-1', false),
        createMockKey('key-2', true),
        createMockKey('key-3', true),
      ];

      const selected = selectKeyFallback(keys);
      expect(selected.id).toBe('key-2');
    });

    it('should throw error when no active keys available', () => {
      const keys = [
        createMockKey('key-1', false),
        createMockKey('key-2', false),
      ];

      expect(() => selectKeyFallback(keys)).toThrow(
        'No active keys available for fallback selection'
      );
    });

    it('should throw error when keys array is empty', () => {
      expect(() => selectKeyFallback([])).toThrow(
        'No active keys available for fallback selection'
      );
    });

    it('should always return the same key (first active)', () => {
      const keys = [
        createMockKey('key-1'),
        createMockKey('key-2'),
        createMockKey('key-3'),
      ];

      const selected1 = selectKeyFallback(keys);
      const selected2 = selectKeyFallback(keys);
      const selected3 = selectKeyFallback(keys);

      expect(selected1.id).toBe('key-1');
      expect(selected2.id).toBe('key-1');
      expect(selected3.id).toBe('key-1');
    });
  });

  describe('selectKeyLeastUsed', () => {
    it('should select key with lowest usage', () => {
      const keys = [
        createMockKey('key-1', true, 500_000), // 500k used
        createMockKey('key-2', true, 200_000), // 200k used (least used)
        createMockKey('key-3', true, 800_000), // 800k used
      ];

      const selected = selectKeyLeastUsed(keys);
      expect(selected.id).toBe('key-2');
    });

    it('should select key with zero usage when available', () => {
      const keys = [
        createMockKey('key-1', true, 500_000),
        createMockKey('key-2', true, 0), // No usage (least used)
        createMockKey('key-3', true, 300_000),
      ];

      const selected = selectKeyLeastUsed(keys);
      expect(selected.id).toBe('key-2');
    });

    it('should skip inactive keys', () => {
      const keys = [
        createMockKey('key-1', false, 100_000),
        createMockKey('key-2', true, 500_000),
        createMockKey('key-3', true, 200_000), // Least used among active
      ];

      const selected = selectKeyLeastUsed(keys);
      expect(selected.id).toBe('key-3');
    });

    it('should handle tie by selecting first key with max quota', () => {
      const keys = [
        createMockKey('key-1', true, 500_000), // Same remaining quota
        createMockKey('key-2', true, 500_000), // Same remaining quota
        createMockKey('key-3', true, 600_000),
      ];

      const selected = selectKeyLeastUsed(keys);
      expect(selected.id).toBe('key-1'); // First one with max quota
    });

    it('should throw error when no active keys available', () => {
      const keys = [
        createMockKey('key-1', false),
        createMockKey('key-2', false),
      ];

      expect(() => selectKeyLeastUsed(keys)).toThrow(
        'No active keys available for least-used selection'
      );
    });

    it('should throw error when keys array is empty', () => {
      expect(() => selectKeyLeastUsed([])).toThrow(
        'No active keys available for least-used selection'
      );
    });

    it('should handle single key', () => {
      const keys = [createMockKey('key-1', true, 300_000)];

      const selected = selectKeyLeastUsed(keys);
      expect(selected.id).toBe('key-1');
    });
  });

  describe('selectKey', () => {
    it('should delegate to round_robin strategy', () => {
      const keys = [
        createMockKey('key-1'),
        createMockKey('key-2'),
        createMockKey('key-3'),
      ];

      const selected = selectKey(keys, 'round_robin');
      expect(selected.id).toBe('key-1');
    });

    it('should delegate to fallback strategy', () => {
      const keys = [
        createMockKey('key-1'),
        createMockKey('key-2'),
        createMockKey('key-3'),
      ];

      const selected = selectKey(keys, 'fallback');
      expect(selected.id).toBe('key-1');
    });

    it('should delegate to least_used strategy', () => {
      const keys = [
        createMockKey('key-1', true, 500_000),
        createMockKey('key-2', true, 200_000),
        createMockKey('key-3', true, 800_000),
      ];

      const selected = selectKey(keys, 'least_used');
      expect(selected.id).toBe('key-2');
    });

    it('should throw error for unknown strategy', () => {
      const keys = [createMockKey('key-1')];

      expect(() => selectKey(keys, 'unknown' as any)).toThrow(
        'Unknown rotation strategy: unknown'
      );
    });

    it('should pass state to round_robin strategy', () => {
      const keys = [
        createMockKey('key-1'),
        createMockKey('key-2'),
        createMockKey('key-3'),
      ];

      const state = { currentIndex: 1, lastUpdated: new Date() };
      const selected = selectKey(keys, 'round_robin', state);
      expect(selected.id).toBe('key-3');
    });
  });

  describe('updateRotationState', () => {
    it('should increment index for next selection', () => {
      const keys = [
        createMockKey('key-1'),
        createMockKey('key-2'),
        createMockKey('key-3'),
      ];

      const state = { currentIndex: 0, lastUpdated: new Date() };
      const updated = updateRotationState(keys, state);

      expect(updated.currentIndex).toBe(1);
      expect(updated.lastUpdated).toBeInstanceOf(Date);
    });

    it('should wrap around to 0 at end of list', () => {
      const keys = [
        createMockKey('key-1'),
        createMockKey('key-2'),
        createMockKey('key-3'),
      ];

      const state = { currentIndex: 2, lastUpdated: new Date() };
      const updated = updateRotationState(keys, state);

      expect(updated.currentIndex).toBe(0);
    });

    it('should start at 0 when no state provided', () => {
      const keys = [
        createMockKey('key-1'),
        createMockKey('key-2'),
        createMockKey('key-3'),
      ];

      const updated = updateRotationState(keys);

      expect(updated.currentIndex).toBe(0);
    });

    it('should handle single key', () => {
      const keys = [createMockKey('key-1')];

      const state = { currentIndex: 0, lastUpdated: new Date() };
      const updated = updateRotationState(keys, state);

      expect(updated.currentIndex).toBe(0); // Wraps to itself
    });

    it('should skip inactive keys when calculating next index', () => {
      const keys = [
        createMockKey('key-1', true),
        createMockKey('key-2', false), // inactive
        createMockKey('key-3', true),
      ];

      const state = { currentIndex: 0, lastUpdated: new Date() };
      const updated = updateRotationState(keys, state);

      // Should move to next active key (key-3), not key-2
      expect(updated.currentIndex).toBe(1);
    });
  });

  describe('getKeyIndex', () => {
    it('should return index of key in active keys array', () => {
      const keys = [
        createMockKey('key-1'),
        createMockKey('key-2'),
        createMockKey('key-3'),
      ];

      const index = getKeyIndex(keys, 'key-2');
      expect(index).toBe(1);
    });

    it('should return -1 when key not found', () => {
      const keys = [
        createMockKey('key-1'),
        createMockKey('key-2'),
        createMockKey('key-3'),
      ];

      const index = getKeyIndex(keys, 'key-999');
      expect(index).toBe(-1);
    });

    it('should skip inactive keys', () => {
      const keys = [
        createMockKey('key-1', false),
        createMockKey('key-2', true),
        createMockKey('key-3', true),
      ];

      const index = getKeyIndex(keys, 'key-3');
      expect(index).toBe(1); // key-3 is at index 1 in active keys
    });

    it('should return -1 for inactive key', () => {
      const keys = [
        createMockKey('key-1', true),
        createMockKey('key-2', false),
        createMockKey('key-3', true),
      ];

      const index = getKeyIndex(keys, 'key-2');
      expect(index).toBe(-1); // key-2 is inactive
    });
  });

  describe('calculateRemainingQuota', () => {
    it('should calculate remaining quota correctly', () => {
      const key = createMockKey('key-1', true, 300_000);
      const remaining = calculateRemainingQuota(key);

      expect(remaining).toBe(700_000); // 1,000,000 - 300,000
    });

    it('should return 0 when quota exceeded', () => {
      const key = createMockKey('key-1', true, 1_500_000);
      const remaining = calculateRemainingQuota(key);

      expect(remaining).toBe(0); // Can't go negative
    });

    it('should return full quota when no usage', () => {
      const key = createMockKey('key-1', true, 0);
      const remaining = calculateRemainingQuota(key);

      expect(remaining).toBe(1_000_000);
    });

    it('should support custom monthly quota', () => {
      const key = createMockKey('key-1', true, 300_000);
      const remaining = calculateRemainingQuota(key, 500_000);

      expect(remaining).toBe(200_000); // 500,000 - 300,000
    });

    it('should handle zero custom quota', () => {
      const key = createMockKey('key-1', true, 100_000);
      const remaining = calculateRemainingQuota(key, 0);

      expect(remaining).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null keys array gracefully', () => {
      expect(() => selectKeyRoundRobin(null as any)).toThrow();
      expect(() => selectKeyFallback(null as any)).toThrow();
      expect(() => selectKeyLeastUsed(null as any)).toThrow();
    });

    it('should handle undefined keys array gracefully', () => {
      expect(() => selectKeyRoundRobin(undefined as any)).toThrow();
      expect(() => selectKeyFallback(undefined as any)).toThrow();
      expect(() => selectKeyLeastUsed(undefined as any)).toThrow();
    });

    it('should handle large number of keys', () => {
      const keys = Array.from({ length: 1000 }, (_, i) =>
        createMockKey(`key-${i}`)
      );

      const selected = selectKeyRoundRobin(keys);
      expect(selected.id).toBe('key-0');

      const state = { currentIndex: 999, lastUpdated: new Date() };
      const selected2 = selectKeyRoundRobin(keys, state);
      expect(selected2.id).toBe('key-0'); // Wraps around
    });

    it('should handle keys with very high usage', () => {
      const keys = [
        createMockKey('key-1', true, 999_999_999),
        createMockKey('key-2', true, 1_000_000_000),
        createMockKey('key-3', true, 500_000_000),
      ];

      const selected = selectKeyLeastUsed(keys);
      expect(selected.id).toBe('key-3'); // Least used
    });
  });
});
