/**
 * Property-Based Tests for Key Rotation Engine
 * Tests universal properties that should hold across all valid inputs
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  selectKeyRoundRobin,
  selectKeyFallback,
  selectKeyLeastUsed,
  selectKey,
  calculateRemainingQuota,
  RotationState,
} from './index';
import { ApiKey } from '../db/schema';

/**
 * Arbitraries for property-based testing
 */

// Generate a valid API key
const apiKeyArbitrary = (active: boolean = true, usage: number = 0): fc.Arbitrary<ApiKey> => {
  return fc.record({
    id: fc.uuid(),
    tenantId: fc.uuid(),
    providerId: fc.uuid(),
    keyValueEncrypted: fc.string(),
    emailAddress: fc.emailAddress(),
    label: fc.option(fc.string()),
    active: fc.constant(active),
    createdAt: fc.date(),
    updatedAt: fc.date(),
    lastUsedAt: fc.option(fc.date()),
    dailyUsageTokens: fc.integer({ min: 0, max: 1_000_000 }),
    monthlyUsageTokens: fc.constant(usage),
    healthStatus: fc.constantFrom('active', 'rate_limited', 'invalid', 'expired'),
  });
};

// Generate a list of active keys
const activeKeysArbitrary = (): fc.Arbitrary<ApiKey[]> => {
  return fc
    .tuple(
      fc.integer({ min: 1, max: 10 }), // Number of keys
      fc.integer({ min: 0, max: 1_000_000 }) // Usage per key
    )
    .chain(([numKeys, usage]) => {
      return fc.tuple(
        ...Array.from({ length: numKeys }, (_, i) =>
          apiKeyArbitrary(true, usage + i * 100_000)
        )
      );
    })
    .map((tuple) => Array.from(tuple));
};

// Generate a list of mixed active/inactive keys
const mixedKeysArbitrary = (): fc.Arbitrary<ApiKey[]> => {
  return fc
    .tuple(
      fc.integer({ min: 1, max: 10 }), // Number of keys
      fc.float({ min: 0, max: 1 }) // Probability of being active
    )
    .chain(([numKeys, activeProb]) => {
      return fc.tuple(
        ...Array.from({ length: numKeys }, (_, i) =>
          apiKeyArbitrary(Math.random() < activeProb, i * 100_000)
        )
      );
    })
    .map((tuple) => Array.from(tuple));
};

describe('Property-Based Tests: Key Rotation Engine', () => {
  describe('Property 3: Round-Robin Distribution Fairness', () => {
    it(
      'should distribute requests evenly across all active keys (within ±10% variance)',
      () => {
        fc.assert(
          fc.property(activeKeysArbitrary(), (keys) => {
            // Skip if no active keys
            const activeKeys = keys.filter((k) => k.active);
            if (activeKeys.length === 0) return true;

            // Simulate 100+ requests
            const numRequests = 100 + activeKeys.length * 10;
            const selectionCounts: Record<string, number> = {};

            for (let i = 0; i < numRequests; i++) {
              const state = { currentIndex: i - 1, lastUpdated: new Date() };
              const selected = selectKeyRoundRobin(keys, state);
              selectionCounts[selected.id] = (selectionCounts[selected.id] || 0) + 1;
            }

            // Check that each key was selected approximately numRequests / activeKeys.length times
            const expectedCount = numRequests / activeKeys.length;
            const tolerance = expectedCount * 0.1; // ±10% variance

            for (const keyId of Object.keys(selectionCounts)) {
              const count = selectionCounts[keyId];
              expect(count).toBeGreaterThanOrEqual(expectedCount - tolerance);
              expect(count).toBeLessThanOrEqual(expectedCount + tolerance);
            }
          }),
          { numRuns: 100 }
        );
      }
    );

    it('should select from all active keys over multiple requests', () => {
      fc.assert(
        fc.property(activeKeysArbitrary(), (keys) => {
          const activeKeys = keys.filter((k) => k.active);
          if (activeKeys.length === 0) return true;

          const selectedIds = new Set<string>();
          const numRequests = Math.max(100, activeKeys.length * 20);

          for (let i = 0; i < numRequests; i++) {
            const state = { currentIndex: i - 1, lastUpdated: new Date() };
            const selected = selectKeyRoundRobin(keys, state);
            selectedIds.add(selected.id);
          }

          // All active keys should be selected at least once
          expect(selectedIds.size).toBe(activeKeys.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should cycle through keys in order', () => {
      fc.assert(
        fc.property(activeKeysArbitrary(), (keys) => {
          const activeKeys = keys.filter((k) => k.active);
          if (activeKeys.length === 0) return true;

          // Select keys in sequence and verify they cycle
          const selections: string[] = [];
          for (let i = 0; i < activeKeys.length * 3; i++) {
            const state = { currentIndex: i - 1, lastUpdated: new Date() };
            const selected = selectKeyRoundRobin(keys, state);
            selections.push(selected.id);
          }

          // Verify cycling pattern
          for (let i = 0; i < activeKeys.length; i++) {
            expect(selections[i]).toBe(selections[i + activeKeys.length]);
            expect(selections[i]).toBe(selections[i + activeKeys.length * 2]);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('**Validates: Requirements 4.2**', () => {
      // This is a marker test to document which requirements this property validates
      expect(true).toBe(true);
    });
  });

  describe('Property 4: Fallback Strategy Sequential Selection', () => {
    it('should always select the first active key', () => {
      fc.assert(
        fc.property(mixedKeysArbitrary(), (keys) => {
          const activeKeys = keys.filter((k) => k.active);
          if (activeKeys.length === 0) return true;

          const selected = selectKeyFallback(keys);
          expect(selected.id).toBe(activeKeys[0].id);
        }),
        { numRuns: 100 }
      );
    });

    it('should return the same key on every call', () => {
      fc.assert(
        fc.property(activeKeysArbitrary(), (keys) => {
          const selected1 = selectKeyFallback(keys);
          const selected2 = selectKeyFallback(keys);
          const selected3 = selectKeyFallback(keys);

          expect(selected1.id).toBe(selected2.id);
          expect(selected2.id).toBe(selected3.id);
        }),
        { numRuns: 100 }
      );
    });

    it('should skip all inactive keys and select first active', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(
              fc.integer({ min: 1, max: 5 }), // Number of inactive keys at start
              fc.integer({ min: 1, max: 5 }) // Number of active keys
            )
            .chain(([numInactive, numActive]) => {
              const inactiveKeys = Array.from({ length: numInactive }, (_, i) =>
                apiKeyArbitrary(false, i * 100_000)
              );
              const activeKeys = Array.from({ length: numActive }, (_, i) =>
                apiKeyArbitrary(true, (numInactive + i) * 100_000)
              );
              return fc.tuple(...inactiveKeys, ...activeKeys).map((tuple) => Array.from(tuple));
            }),
          (keys) => {
            const activeKeys = keys.filter((k) => k.active);
            if (activeKeys.length === 0) return true;

            const selected = selectKeyFallback(keys);
            expect(selected.id).toBe(activeKeys[0].id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('**Validates: Requirements 4.3**', () => {
      // This is a marker test to document which requirements this property validates
      expect(true).toBe(true);
    });
  });

  describe('Property 5: Least-Used Strategy Quota Selection', () => {
    it('should always select the key with highest remaining quota', () => {
      fc.assert(
        fc.property(activeKeysArbitrary(), (keys) => {
          const activeKeys = keys.filter((k) => k.active);
          if (activeKeys.length === 0) return true;

          const selected = selectKeyLeastUsed(keys);

          // Calculate remaining quota for all active keys
          const maxRemainingQuota = Math.max(
            ...activeKeys.map((k) => 1_000_000 - k.monthlyUsageTokens)
          );
          const selectedRemainingQuota = 1_000_000 - selected.monthlyUsageTokens;

          expect(selectedRemainingQuota).toBe(maxRemainingQuota);
        }),
        { numRuns: 100 }
      );
    });

    it('should select key with zero usage when available', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(
              fc.integer({ min: 1, max: 5 }), // Number of used keys
              fc.integer({ min: 1, max: 5 }) // Number of unused keys
            )
            .chain(([numUsed, numUnused]) => {
              const usedKeys = Array.from({ length: numUsed }, (_, i) =>
                apiKeyArbitrary(true, 100_000 + i * 100_000)
              );
              const unusedKeys = Array.from({ length: numUnused }, (_, i) =>
                apiKeyArbitrary(true, 0)
              );
              return fc.tuple(...usedKeys, ...unusedKeys).map((tuple) => Array.from(tuple));
            }),
          (keys) => {
            const selected = selectKeyLeastUsed(keys);
            expect(selected.monthlyUsageTokens).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should skip inactive keys when selecting', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(
              fc.integer({ min: 1, max: 5 }), // Number of inactive keys
              fc.integer({ min: 1, max: 5 }) // Number of active keys
            )
            .chain(([numInactive, numActive]) => {
              const inactiveKeys = Array.from({ length: numInactive }, (_, i) =>
                apiKeyArbitrary(false, 0) // Inactive with zero usage
              );
              const activeKeys = Array.from({ length: numActive }, (_, i) =>
                apiKeyArbitrary(true, i * 100_000)
              );
              return fc.tuple(...inactiveKeys, ...activeKeys).map((tuple) => Array.from(tuple));
            }),
          (keys) => {
            const activeKeys = keys.filter((k) => k.active);
            if (activeKeys.length === 0) return true;

            const selected = selectKeyLeastUsed(keys);
            expect(selected.active).toBe(true);

            // Verify it's the least used among active keys
            const maxRemainingQuota = Math.max(
              ...activeKeys.map((k) => 1_000_000 - k.monthlyUsageTokens)
            );
            const selectedRemainingQuota = 1_000_000 - selected.monthlyUsageTokens;
            expect(selectedRemainingQuota).toBe(maxRemainingQuota);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle ties by selecting one of the tied keys', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(
              fc.integer({ min: 2, max: 5 }), // Number of tied keys
              fc.integer({ min: 0, max: 500_000 }) // Usage for tied keys
            )
            .chain(([numTied, usage]) => {
              const tiedKeys = Array.from({ length: numTied }, (_, i) =>
                apiKeyArbitrary(true, usage)
              );
              const otherKeys = Array.from({ length: 2 }, (_, i) =>
                apiKeyArbitrary(true, usage + 100_000 + i * 100_000)
              );
              return fc.tuple(...tiedKeys, ...otherKeys).map((tuple) => Array.from(tuple));
            }),
          (keys) => {
            const selected = selectKeyLeastUsed(keys);
            // Should select one of the tied keys (with lowest usage)
            expect(selected.monthlyUsageTokens).toBe(keys[0].monthlyUsageTokens);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('**Validates: Requirements 4.4**', () => {
      // This is a marker test to document which requirements this property validates
      expect(true).toBe(true);
    });
  });

  describe('Property: Strategy Selection Consistency', () => {
    it('should select same key for fallback strategy across multiple calls', () => {
      fc.assert(
        fc.property(activeKeysArbitrary(), (keys) => {
          const selected1 = selectKey(keys, 'fallback');
          const selected2 = selectKey(keys, 'fallback');
          const selected3 = selectKey(keys, 'fallback');

          expect(selected1.id).toBe(selected2.id);
          expect(selected2.id).toBe(selected3.id);
        }),
        { numRuns: 100 }
      );
    });

    it('should select same key for least_used strategy across multiple calls', () => {
      fc.assert(
        fc.property(activeKeysArbitrary(), (keys) => {
          const selected1 = selectKey(keys, 'least_used');
          const selected2 = selectKey(keys, 'least_used');
          const selected3 = selectKey(keys, 'least_used');

          expect(selected1.id).toBe(selected2.id);
          expect(selected2.id).toBe(selected3.id);
        }),
        { numRuns: 100 }
      );
    });

    it('should always select an active key', () => {
      fc.assert(
        fc.property(
          mixedKeysArbitrary(),
          fc.constantFrom('round_robin', 'fallback', 'least_used'),
          (keys, strategy) => {
            const activeKeys = keys.filter((k) => k.active);
            if (activeKeys.length === 0) return true;

            const selected = selectKey(keys, strategy);
            expect(selected.active).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Remaining Quota Calculation', () => {
    it('should never return negative remaining quota', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2_000_000 }), // Usage
          fc.integer({ min: 0, max: 2_000_000 }), // Monthly quota
          (usage, monthlyQuota) => {
            const key = {
              id: 'test-key',
              tenantId: 'tenant-1',
              providerId: 'provider-1',
              keyValueEncrypted: 'encrypted',
              emailAddress: 'test@example.com',
              label: 'Test',
              active: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              dailyUsageTokens: 0,
              monthlyUsageTokens: usage,
              healthStatus: 'active' as const,
            };

            const remaining = calculateRemainingQuota(key, monthlyQuota);
            expect(remaining).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return correct remaining quota', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1_000_000 }), // Usage
          fc.integer({ min: 1_000_000, max: 2_000_000 }), // Monthly quota
          (usage, monthlyQuota) => {
            const key = {
              id: 'test-key',
              tenantId: 'tenant-1',
              providerId: 'provider-1',
              keyValueEncrypted: 'encrypted',
              emailAddress: 'test@example.com',
              label: 'Test',
              active: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              dailyUsageTokens: 0,
              monthlyUsageTokens: usage,
              healthStatus: 'active' as const,
            };

            const remaining = calculateRemainingQuota(key, monthlyQuota);
            expect(remaining).toBe(monthlyQuota - usage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
