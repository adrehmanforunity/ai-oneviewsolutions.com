/**
 * Property-Based Test: Key Encryption Round-Trip
 * 
 * Property: For any valid API key string, encrypting it with AES-256 and then 
 * decrypting it SHALL produce the original key value unchanged.
 * 
 * Validates: Requirements 1.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptApiKey, decryptApiKey, generateMasterKey, clearMasterKeyCache } from './index';

describe('Property: Key Encryption Round-Trip', () => {
  beforeEach(() => {
    // Set a test master key before each test
    process.env.ENCRYPTION_MASTER_KEY = generateMasterKey();
    clearMasterKeyCache();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.ENCRYPTION_MASTER_KEY;
    clearMasterKeyCache();
  });

  /**
   * Property 1: Key Encryption Round-Trip
   * 
   * For any valid API key string, encrypting it with AES-256 and then 
   * decrypting it SHALL produce the original key value unchanged.
   * 
   * Validates: Requirements 1.3
   */
  it('should preserve plaintext through encrypt/decrypt cycle for all valid API keys', () => {
    // Test cases covering various API key formats and edge cases
    const testCases = [
      // Standard API key formats
      'sk_test_123456789',
      'gsk_test_abcdefghijklmnop',
      'sk-prod-xyz123',
      'sk_live_1234567890abcdef',
      
      // Different lengths
      'a',
      'ab',
      'abc',
      'abcd',
      'a'.repeat(10),
      'a'.repeat(100),
      'a'.repeat(1000),
      'a'.repeat(10000),
      
      // Special characters
      '!@#$%^&*()',
      '_-+=[]{}|;:,.<>?',
      '~`!@#$%^&*()_+-=[]{}|;:,.<>?/',
      
      // Mixed content
      'sk_test_!@#$%^&*()_+-=[]{}|;:,.<>?',
      'Mixed: abc123!@#',
      'Numbers: 0123456789',
      'Uppercase: ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'Lowercase: abcdefghijklmnopqrstuvwxyz',
      
      // Whitespace and control characters
      'sk_test\n123456789',
      'sk_test\t123456789',
      'sk_test\r\n123456789',
      'sk_test 123456789',
      
      // Unicode and international characters
      'UTF-8: 你好世界',
      'Arabic: مرحبا بالعالم',
      'Urdu: السلام علیکم',
      'Emoji: 🔐🔑🗝️',
      'Mixed: sk_test_你好_🔐',
      
      // Real-world API key patterns (fake examples for testing)
      'sk_test_FAKE_KEY_FOR_TESTING_ONLY_abc123',
      'gsk_test_abcdefghijklmnopqrstuvwxyz123456',
      'pk_live_FAKE_KEY_FOR_TESTING_ONLY_xyz789',
      'rk_test_FAKE_KEY_FOR_TESTING_ONLY_1234567890',
      
      // Edge cases
      'a'.repeat(1),
      'a'.repeat(2),
      'a'.repeat(3),
      'a'.repeat(4),
      'a'.repeat(5),
      'a'.repeat(16),
      'a'.repeat(32),
      'a'.repeat(64),
      'a'.repeat(128),
      'a'.repeat(256),
      'a'.repeat(512),
      'a'.repeat(1024),
      'a'.repeat(2048),
      'a'.repeat(4096),
      'a'.repeat(8192),
    ];

    // Test each case
    testCases.forEach((plaintext, index) => {
      try {
        const encrypted = encryptApiKey(plaintext);
        const decrypted = decryptApiKey(encrypted);
        
        expect(decrypted).toBe(plaintext, 
          `Round-trip failed for test case ${index}: "${plaintext.substring(0, 50)}${plaintext.length > 50 ? '...' : ''}"`
        );
      } catch (error) {
        throw new Error(
          `Round-trip test failed for case ${index}: "${plaintext.substring(0, 50)}${plaintext.length > 50 ? '...' : ''}" - ${error}`
        );
      }
    });
  });

  /**
   * Property 1b: Encryption Produces Different Ciphertexts
   * 
   * For any valid API key string, encrypting it multiple times SHALL produce 
   * different ciphertexts (due to random IV), but all SHALL decrypt to the 
   * same plaintext.
   * 
   * Validates: Requirements 1.3 (IV randomness)
   */
  it('should produce different ciphertexts for same plaintext due to random IV', () => {
    const plaintext = 'sk_test_123456789';
    const encryptedValues = new Set<string>();
    const decryptedValues = new Set<string>();

    // Encrypt the same plaintext 100 times
    for (let i = 0; i < 100; i++) {
      const encrypted = encryptApiKey(plaintext);
      encryptedValues.add(encrypted);
      
      const decrypted = decryptApiKey(encrypted);
      decryptedValues.add(decrypted);
    }

    // All ciphertexts should be different (with very high probability)
    // We expect at least 95 unique ciphertexts out of 100
    expect(encryptedValues.size).toBeGreaterThanOrEqual(95);

    // All decrypted values should be the same
    expect(decryptedValues.size).toBe(1);
    expect(decryptedValues.has(plaintext)).toBe(true);
  });

  /**
   * Property 1c: Encryption is Deterministic Given Same IV
   * 
   * For any valid API key string and a fixed IV, encrypting it multiple times 
   * SHALL produce the same ciphertext.
   * 
   * Note: This property is tested indirectly by verifying that decryption 
   * always produces the same plaintext for a given ciphertext.
   * 
   * Validates: Requirements 1.3 (deterministic encryption)
   */
  it('should decrypt same ciphertext to same plaintext consistently', () => {
    const plaintext = 'sk_test_123456789';
    const encrypted = encryptApiKey(plaintext);

    // Decrypt the same ciphertext 100 times
    const decryptedValues = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const decrypted = decryptApiKey(encrypted);
      decryptedValues.add(decrypted);
    }

    // All decrypted values should be identical
    expect(decryptedValues.size).toBe(1);
    expect(decryptedValues.has(plaintext)).toBe(true);
  });

  /**
   * Property 1d: Round-Trip Preserves Data Integrity
   * 
   * For any valid API key string, the round-trip encryption/decryption 
   * SHALL preserve all characters, including special characters, unicode, 
   * and whitespace.
   * 
   * Validates: Requirements 1.3 (data integrity)
   */
  it('should preserve all character types through round-trip', () => {
    const testCases = [
      // Test each character type separately
      { name: 'ASCII letters', value: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' },
      { name: 'ASCII digits', value: '0123456789' },
      { name: 'ASCII special', value: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`' },
      { name: 'Whitespace', value: ' \t\n\r' },
      { name: 'Unicode', value: '你好世界مرحبا بالعالمالسلام علیکم' },
      { name: 'Emoji', value: '🔐🔑🗝️🔓🔒' },
      { name: 'Mixed', value: 'sk_test_!@#$%^&*()_+-=[]{}|;:,.<>?/~`你好🔐' },
    ];

    testCases.forEach(({ name, value }) => {
      const encrypted = encryptApiKey(value);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(value, `Character preservation failed for: ${name}`);
      expect(decrypted.length).toBe(value.length, `Length mismatch for: ${name}`);
      
      // Verify each character
      for (let i = 0; i < value.length; i++) {
        expect(decrypted.charCodeAt(i)).toBe(value.charCodeAt(i), 
          `Character mismatch at position ${i} for: ${name}`
        );
      }
    });
  });

  /**
   * Property 1e: Round-Trip Works for All Valid Key Lengths
   * 
   * For any valid API key string of length 1 to 10000 characters, 
   * the round-trip encryption/decryption SHALL succeed.
   * 
   * Validates: Requirements 1.3 (variable length support)
   */
  it('should handle all valid key lengths from 1 to 10000 characters', () => {
    // Test various lengths
    const lengths = [
      1, 2, 3, 4, 5, 10, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 10000
    ];

    lengths.forEach((length) => {
      const plaintext = 'a'.repeat(length);
      const encrypted = encryptApiKey(plaintext);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(plaintext, `Round-trip failed for length ${length}`);
      expect(decrypted.length).toBe(length, `Length mismatch for ${length}`);
    });
  });
});
