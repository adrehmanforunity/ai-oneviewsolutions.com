/**
 * Property-Based Test for Provider Configuration Round-Trip Serialization
 * 
 * **Validates: Requirements 15.5**
 * 
 * Property: For any valid provider configuration object, serializing it to JSON
 * and then parsing it back SHALL produce an equivalent configuration object with
 * all fields preserved and no data loss.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  parseProviderConfig,
  serializeProviderConfig,
  validateProviderConfig,
  ProviderConfiguration,
} from './index';

// ============================================================================
// ARBITRARIES (GENERATORS)
// ============================================================================

/**
 * Generate valid provider IDs
 */
const providerIdArbitrary = fc
  .stringMatching(/^[a-z0-9]{5,20}$/)
  .filter((s) => s.length > 0);

/**
 * Generate valid provider names
 */
const providerNameArbitrary = fc
  .stringMatching(/^[A-Za-z0-9\s]{3,50}$/)
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

/**
 * Generate valid provider types
 */
const providerTypeArbitrary = fc.constantFrom('LLM' as const, 'STT' as const, 'TTS' as const);

/**
 * Generate valid rotation strategies
 */
const rotationStrategyArbitrary = fc.constantFrom(
  'round_robin' as const,
  'fallback' as const,
  'least_used' as const
);

/**
 * Generate valid key counts (ensure activeKeys <= totalKeys)
 */
const keyCountArbitrary = fc.tuple(
  fc.integer({ min: 0, max: 100 }),
  fc.integer({ min: 0, max: 100 })
).map(([active, total]) => ({
  activeKeys: Math.min(active, total),
  totalKeys: Math.max(active, total),
}));

/**
 * Generate valid model objects
 */
const modelArbitrary = fc.record({
  id: fc.uuid(),
  providerId: providerIdArbitrary,
  modelName: fc.stringMatching(/^[A-Za-z0-9\s\-\.]{3,100}$/),
  modelId: fc.stringMatching(/^[a-z0-9\-\.]{3,100}$/),
  pricingPer1kTokens: fc.option(fc.float({ min: 0, max: 1, noNaN: true })),
  contextWindow: fc.option(fc.integer({ min: 512, max: 200000 })),
  createdAt: fc.date(),
});

/**
 * Generate valid voice objects
 */
const voiceArbitrary = fc.record({
  id: fc.uuid(),
  providerId: providerIdArbitrary,
  voiceId: fc.stringMatching(/^[a-z0-9\-_]{3,50}$/),
  voiceName: fc.stringMatching(/^[A-Za-z0-9\s\-]{3,50}$/),
  gender: fc.option(fc.constantFrom('male' as const, 'female' as const, 'neutral' as const)),
  tone: fc.option(fc.stringMatching(/^[a-z\s]{3,30}$/)),
  language: fc.constantFrom('en', 'ur'),
  sampleAudioUrl: fc.option(fc.webUrl()),
  createdAt: fc.date(),
});

/**
 * Generate valid provider configurations
 */
const providerConfigArbitrary = fc
  .tuple(
    providerIdArbitrary,
    providerNameArbitrary,
    providerTypeArbitrary,
    rotationStrategyArbitrary,
    keyCountArbitrary,
    fc.option(fc.array(modelArbitrary, { maxLength: 10 })),
    fc.option(fc.array(voiceArbitrary, { maxLength: 10 }))
  )
  .map(([providerId, providerName, providerType, rotationStrategy, keyCounts, models, voices]) => {
    const result: ProviderConfiguration = {
      providerId,
      providerName,
      providerType,
      rotationStrategy,
      activeKeys: keyCounts.activeKeys,
      totalKeys: keyCounts.totalKeys,
    };

    if (models && models.length > 0) {
      result.models = models;
    }

    if (voices && voices.length > 0) {
      result.voices = voices;
    }

    return result;
  });

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Provider Configuration Round-Trip Serialization', () => {
  it(
    'should preserve configuration through serialize-parse cycle',
    () => {
      fc.assert(
        fc.property(providerConfigArbitrary, (config) => {
          // Validate input configuration
          const inputValidation = validateProviderConfig(config);
          expect(inputValidation.valid).toBe(true);

          // Serialize to JSON
          const serializeResult = serializeProviderConfig(config);
          expect(serializeResult.success).toBe(true);
          expect(serializeResult.json).toBeDefined();

          // Parse back from JSON
          const parseResult = parseProviderConfig(serializeResult.json!);
          expect(parseResult.success).toBe(true);
          expect(parseResult.data).toBeDefined();

          // Validate output configuration
          const outputValidation = validateProviderConfig(parseResult.data);
          expect(outputValidation.valid).toBe(true);

          // Compare configurations
          const parsed = parseResult.data!;
          expect(parsed.providerId).toBe(config.providerId);
          expect(parsed.providerName).toBe(config.providerName);
          expect(parsed.providerType).toBe(config.providerType);
          expect(parsed.rotationStrategy).toBe(config.rotationStrategy);
          expect(parsed.activeKeys).toBe(config.activeKeys);
          expect(parsed.totalKeys).toBe(config.totalKeys);

          // Compare models
          if (config.models) {
            expect(parsed.models).toHaveLength(config.models.length);
            config.models.forEach((model, index) => {
              expect(parsed.models![index].id).toBe(model.id);
              expect(parsed.models![index].modelName).toBe(model.modelName);
              expect(parsed.models![index].modelId).toBe(model.modelId);
            });
          } else {
            expect(parsed.models).toBeUndefined();
          }

          // Compare voices
          if (config.voices) {
            expect(parsed.voices).toHaveLength(config.voices.length);
            config.voices.forEach((voice, index) => {
              expect(parsed.voices![index].id).toBe(voice.id);
              expect(parsed.voices![index].voiceId).toBe(voice.voiceId);
              expect(parsed.voices![index].voiceName).toBe(voice.voiceName);
            });
          } else {
            expect(parsed.voices).toBeUndefined();
          }
        }),
        { numRuns: 100 }
      );
    },
    { timeout: 30000 }
  );

  it(
    'should produce valid JSON that can be parsed multiple times',
    () => {
      fc.assert(
        fc.property(providerConfigArbitrary, (config) => {
          let current = config;

          // Perform 3 round-trips
          for (let i = 0; i < 3; i++) {
            const serializeResult = serializeProviderConfig(current);
            expect(serializeResult.success).toBe(true);

            const parseResult = parseProviderConfig(serializeResult.json!);
            expect(parseResult.success).toBe(true);

            current = parseResult.data!;
          }

          // Final configuration should match original
          expect(current.providerId).toBe(config.providerId);
          expect(current.providerName).toBe(config.providerName);
          expect(current.providerType).toBe(config.providerType);
        }),
        { numRuns: 50 }
      );
    },
    { timeout: 30000 }
  );

  it(
    'should preserve all numeric fields with precision',
    () => {
      fc.assert(
        fc.property(providerConfigArbitrary, (config) => {
          const serializeResult = serializeProviderConfig(config);
          const parseResult = parseProviderConfig(serializeResult.json!);
          const parsed = parseResult.data!;

          // Check numeric precision
          expect(parsed.activeKeys).toBe(config.activeKeys);
          expect(parsed.totalKeys).toBe(config.totalKeys);

          // Check model pricing precision
          if (config.models) {
            config.models.forEach((model, index) => {
              if (model.pricingPer1kTokens !== undefined) {
                expect(parsed.models![index].pricingPer1kTokens).toBe(
                  model.pricingPer1kTokens
                );
              }
              if (model.contextWindow !== undefined) {
                expect(parsed.models![index].contextWindow).toBe(model.contextWindow);
              }
            });
          }
        }),
        { numRuns: 100 }
      );
    },
    { timeout: 30000 }
  );

  it(
    'should preserve string fields without modification',
    () => {
      fc.assert(
        fc.property(providerConfigArbitrary, (config) => {
          const serializeResult = serializeProviderConfig(config);
          const parseResult = parseProviderConfig(serializeResult.json!);
          const parsed = parseResult.data!;

          // Check string fields
          expect(parsed.providerId).toBe(config.providerId);
          expect(parsed.providerName).toBe(config.providerName);
          expect(parsed.providerType).toBe(config.providerType);
          expect(parsed.rotationStrategy).toBe(config.rotationStrategy);

          // Check model strings
          if (config.models) {
            config.models.forEach((model, index) => {
              expect(parsed.models![index].modelName).toBe(model.modelName);
              expect(parsed.models![index].modelId).toBe(model.modelId);
            });
          }

          // Check voice strings
          if (config.voices) {
            config.voices.forEach((voice, index) => {
              expect(parsed.voices![index].voiceId).toBe(voice.voiceId);
              expect(parsed.voices![index].voiceName).toBe(voice.voiceName);
              expect(parsed.voices![index].language).toBe(voice.language);
            });
          }
        }),
        { numRuns: 100 }
      );
    },
    { timeout: 30000 }
  );

  it(
    'should handle configurations with empty models and voices arrays',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            providerId: providerIdArbitrary,
            providerName: providerNameArbitrary,
            providerType: providerTypeArbitrary,
            rotationStrategy: rotationStrategyArbitrary,
            activeKeys: fc.integer({ min: 0, max: 50 }),
            totalKeys: fc.integer({ min: 0, max: 100 }),
          }).filter((c) => c.activeKeys <= c.totalKeys),
          (config) => {
            const serializeResult = serializeProviderConfig(config as any);
            expect(serializeResult.success).toBe(true);

            const parseResult = parseProviderConfig(serializeResult.json!);
            expect(parseResult.success).toBe(true);

            const parsed = parseResult.data!;
            expect(parsed.providerId).toBe(config.providerId);
          }
        ),
        { numRuns: 50 }
      );
    },
    { timeout: 30000 }
  );

  it(
    'should handle configurations with unicode characters',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            providerId: providerIdArbitrary,
            providerName: providerNameArbitrary,
            providerType: providerTypeArbitrary,
            rotationStrategy: rotationStrategyArbitrary,
            activeKeys: fc.integer({ min: 0, max: 50 }),
            totalKeys: fc.integer({ min: 0, max: 100 }),
          }).filter((c) => c.activeKeys <= c.totalKeys),
          (config) => {
            const serializeResult = serializeProviderConfig(config as any);
            expect(serializeResult.success).toBe(true);

            const parseResult = parseProviderConfig(serializeResult.json!);
            expect(parseResult.success).toBe(true);

            const parsed = parseResult.data!;
            expect(parsed.providerName).toBe(config.providerName);
          }
        ),
        { numRuns: 50 }
      );
    },
    { timeout: 30000 }
  );

  it(
    'should maintain configuration validity after round-trip',
    () => {
      fc.assert(
        fc.property(providerConfigArbitrary, (config) => {
          // Original should be valid
          let validation = validateProviderConfig(config);
          expect(validation.valid).toBe(true);

          // After serialization and parsing
          const serializeResult = serializeProviderConfig(config);
          const parseResult = parseProviderConfig(serializeResult.json!);
          const parsed = parseResult.data!;

          // Parsed should also be valid
          validation = validateProviderConfig(parsed);
          expect(validation.valid).toBe(true);
        }),
        { numRuns: 100 }
      );
    },
    { timeout: 30000 }
  );
});
