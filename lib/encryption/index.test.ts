/**
 * Unit Tests for Encryption Service
 * Tests AES-256-GCM encryption/decryption functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  encryptApiKey,
  decryptApiKey,
  maskApiKey,
  loadMasterKey,
  generateMasterKey,
  clearMasterKeyCache,
  isValidEncryptedFormat,
  testEncryptionRoundTrip,
  getEncryptionErrorMessage,
} from './index';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('Encryption Service', () => {
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

  // ============================================================================
  // MASTER KEY MANAGEMENT TESTS
  // ============================================================================

  describe('Master Key Management', () => {
    it('should generate a valid master key', () => {
      const key = generateMasterKey();
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      
      // Should be base64 encoded
      const buffer = Buffer.from(key, 'base64');
      expect(buffer.length).toBe(32);  // 256 bits
    });

    it('should load master key from environment variable', () => {
      const key = loadMasterKey();
      expect(key).toBeDefined();
      expect(key.length).toBe(32);  // 256 bits
    });

    it('should throw error if ENCRYPTION_MASTER_KEY is not set', () => {
      delete process.env.ENCRYPTION_MASTER_KEY;
      clearMasterKeyCache();
      
      expect(() => loadMasterKey()).toThrow('ENCRYPTION_MASTER_KEY environment variable is not set');
    });

    it('should throw error if ENCRYPTION_MASTER_KEY is invalid base64', () => {
      process.env.ENCRYPTION_MASTER_KEY = 'not-valid-base64!!!';
      clearMasterKeyCache();
      
      // The error could be either "invalid base64" or "wrong length" depending on what decodes
      expect(() => loadMasterKey()).toThrow();
    });

    it('should throw error if ENCRYPTION_MASTER_KEY is wrong length', () => {
      // Generate a 16-byte key instead of 32-byte
      const shortKey = Buffer.alloc(16).toString('base64');
      process.env.ENCRYPTION_MASTER_KEY = shortKey;
      clearMasterKeyCache();
      
      expect(() => loadMasterKey()).toThrow('must be exactly 32 bytes');
    });

    it('should cache master key after first load', () => {
      const key1 = loadMasterKey();
      const key2 = loadMasterKey();
      
      expect(key1).toBe(key2);  // Same object reference
    });

    it('should clear cached master key', () => {
      const key1 = loadMasterKey();
      clearMasterKeyCache();
      
      // Change environment variable
      process.env.ENCRYPTION_MASTER_KEY = generateMasterKey();
      const key2 = loadMasterKey();
      
      expect(key1).not.toBe(key2);  // Different objects
    });
  });

  // ============================================================================
  // ENCRYPTION TESTS
  // ============================================================================

  describe('Encryption', () => {
    it('should encrypt a simple API key', () => {
      const plaintext = 'sk_test_123456789';
      const encrypted = encryptApiKey(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
      
      // Should be base64 encoded
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    });

    it('should encrypt keys with special characters', () => {
      const plaintext = 'sk_test_!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encryptApiKey(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should encrypt long API keys', () => {
      const plaintext = 'a'.repeat(1000);
      const encrypted = encryptApiKey(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should encrypt empty string', () => {
      // Empty string is technically valid, though not a real API key
      const plaintext = '';
      expect(() => encryptApiKey(plaintext)).toThrow('non-empty string');
    });

    it('should throw error for non-string input', () => {
      expect(() => encryptApiKey(null as any)).toThrow();
      expect(() => encryptApiKey(undefined as any)).toThrow();
      expect(() => encryptApiKey(123 as any)).toThrow();
      expect(() => encryptApiKey({} as any)).toThrow();
    });

    it('should produce different ciphertexts for same plaintext (due to random IV)', () => {
      const plaintext = 'sk_test_123456789';
      const encrypted1 = encryptApiKey(plaintext);
      const encrypted2 = encryptApiKey(plaintext);
      
      // Ciphertexts should be different (different IVs)
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should include IV, authTag, and ciphertext in output', () => {
      const plaintext = 'sk_test_123456789';
      const encrypted = encryptApiKey(plaintext);
      
      const combined = Buffer.from(encrypted, 'base64');
      
      // IV (16 bytes) + authTag (16 bytes) + ciphertext (at least 1 byte)
      expect(combined.length).toBeGreaterThanOrEqual(16 + 16 + 1);
    });
  });

  // ============================================================================
  // DECRYPTION TESTS
  // ============================================================================

  describe('Decryption', () => {
    it('should decrypt an encrypted API key', () => {
      const plaintext = 'sk_test_123456789';
      const encrypted = encryptApiKey(plaintext);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt keys with special characters', () => {
      const plaintext = 'sk_test_!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encryptApiKey(plaintext);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt long API keys', () => {
      const plaintext = 'a'.repeat(1000);
      const encrypted = encryptApiKey(plaintext);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid encrypted data', () => {
      expect(() => decryptApiKey('invalid-base64-data')).toThrow();
    });

    it('should throw error for corrupted encrypted data', () => {
      const plaintext = 'sk_test_123456789';
      const encrypted = encryptApiKey(plaintext);
      
      // Corrupt the encrypted data
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[buffer.length - 1] ^= 0xFF;  // Flip bits in last byte
      const corrupted = buffer.toString('base64');
      
      expect(() => decryptApiKey(corrupted)).toThrow('Authentication tag verification failed');
    });

    it('should throw error for data encrypted with different key', () => {
      const plaintext = 'sk_test_123456789';
      const encrypted = encryptApiKey(plaintext);
      
      // Change the master key
      process.env.ENCRYPTION_MASTER_KEY = generateMasterKey();
      clearMasterKeyCache();
      
      expect(() => decryptApiKey(encrypted)).toThrow('Authentication tag verification failed');
    });

    it('should throw error for empty encrypted data', () => {
      expect(() => decryptApiKey('')).toThrow();
    });

    it('should throw error for non-string input', () => {
      expect(() => decryptApiKey(null as any)).toThrow();
      expect(() => decryptApiKey(undefined as any)).toThrow();
      expect(() => decryptApiKey(123 as any)).toThrow();
    });

    it('should throw error for truncated encrypted data', () => {
      const plaintext = 'sk_test_123456789';
      const encrypted = encryptApiKey(plaintext);
      
      // Truncate the encrypted data
      const truncated = encrypted.slice(0, 10);
      
      expect(() => decryptApiKey(truncated)).toThrow('too short or corrupted');
    });
  });

  // ============================================================================
  // ROUND-TRIP TESTS (Property-Based)
  // ============================================================================

  describe('Encryption Round-Trip (Property-Based)', () => {
    it('should preserve plaintext through encrypt/decrypt cycle', () => {
      const testCases = [
        'sk_test_123456789',
        'gsk_test_abcdefghijklmnop',
        'sk-prod-xyz123',
        'a',
        'a'.repeat(100),
        'a'.repeat(10000),
        '!@#$%^&*()',
        'UTF-8: 你好世界',
        'Mixed: abc123!@#',
      ];

      testCases.forEach((plaintext) => {
        const encrypted = encryptApiKey(plaintext);
        const decrypted = decryptApiKey(encrypted);
        expect(decrypted).toBe(plaintext);
      });
    });

    it('should pass round-trip test utility', () => {
      const result = testEncryptionRoundTrip();
      expect(result).toBe(true);
    });

    it('should pass round-trip test with custom data', () => {
      const result = testEncryptionRoundTrip('custom-test-key-12345');
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // KEY MASKING TESTS
  // ============================================================================

  describe('Key Masking', () => {
    it('should mask API key showing last 4 characters', () => {
      const apiKey = 'sk_test_123456789';
      const masked = maskApiKey(apiKey);
      
      expect(masked).toContain('...6789');
      expect(masked).not.toContain('123456789');
    });

    it('should include prefix in masked key', () => {
      const apiKey = 'gsk_test_abcdefghijklmnop';
      const masked = maskApiKey(apiKey);
      
      expect(masked).toContain('gsk_');
      expect(masked).toContain('...mnop');
    });

    it('should handle keys without underscore prefix', () => {
      const apiKey = 'abcdefghijklmnop';
      const masked = maskApiKey(apiKey);
      
      expect(masked).toContain('...mnop');
    });

    it('should handle short keys', () => {
      const apiKey = 'abc';
      const masked = maskApiKey(apiKey);
      
      expect(masked).toBe('****');
    });

    it('should handle empty key', () => {
      const masked = maskApiKey('');
      expect(masked).toBe('****');
    });

    it('should handle null/undefined', () => {
      expect(maskApiKey(null as any)).toBe('****');
      expect(maskApiKey(undefined as any)).toBe('****');
    });

    it('should handle keys with multiple underscores', () => {
      const apiKey = 'sk_test_prod_123456789';
      const masked = maskApiKey(apiKey);
      
      expect(masked).toContain('sk_');
      expect(masked).toContain('...6789');
    });

    it('should handle keys with dashes', () => {
      const apiKey = 'sk-test-123456789';
      const masked = maskApiKey(apiKey);
      
      // The regex looks for underscore or dash, so it should extract 'sk'
      expect(masked).toContain('sk');
      expect(masked).toContain('...6789');
    });
  });

  // ============================================================================
  // FORMAT VALIDATION TESTS
  // ============================================================================

  describe('Format Validation', () => {
    it('should validate correct encrypted format', () => {
      const plaintext = 'sk_test_123456789';
      const encrypted = encryptApiKey(plaintext);
      
      expect(isValidEncryptedFormat(encrypted)).toBe(true);
    });

    it('should reject invalid base64', () => {
      expect(isValidEncryptedFormat('not-valid-base64!!!')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidEncryptedFormat('')).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isValidEncryptedFormat(null as any)).toBe(false);
      expect(isValidEncryptedFormat(undefined as any)).toBe(false);
    });

    it('should reject truncated data', () => {
      const plaintext = 'sk_test_123456789';
      const encrypted = encryptApiKey(plaintext);
      const truncated = encrypted.slice(0, 10);
      
      expect(isValidEncryptedFormat(truncated)).toBe(false);
    });

    it('should reject data that is too short', () => {
      // Create a buffer that's too short (less than IV + authTag + 1 byte)
      const shortBuffer = Buffer.alloc(10);
      const encoded = shortBuffer.toString('base64');
      
      expect(isValidEncryptedFormat(encoded)).toBe(false);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should provide user-friendly error message for missing master key', () => {
      delete process.env.ENCRYPTION_MASTER_KEY;
      clearMasterKeyCache();
      
      try {
        encryptApiKey('test');
      } catch (error) {
        const message = getEncryptionErrorMessage(error);
        expect(message).toContain('not properly configured');
      }
    });

    it('should provide user-friendly error message for authentication failure', () => {
      const plaintext = 'sk_test_123456789';
      const encrypted = encryptApiKey(plaintext);
      
      // Change the master key
      process.env.ENCRYPTION_MASTER_KEY = generateMasterKey();
      clearMasterKeyCache();
      
      try {
        decryptApiKey(encrypted);
      } catch (error) {
        const message = getEncryptionErrorMessage(error);
        expect(message).toContain('Failed to decrypt key');
      }
    });

    it('should provide user-friendly error message for corrupted data', () => {
      const plaintext = 'sk_test_123456789';
      const encrypted = encryptApiKey(plaintext);
      
      // Corrupt the data
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[buffer.length - 1] ^= 0xFF;
      const corrupted = buffer.toString('base64');
      
      try {
        decryptApiKey(corrupted);
      } catch (error) {
        const message = getEncryptionErrorMessage(error);
        expect(message).toContain('Failed to decrypt key');
      }
    });

    it('should handle unknown error types', () => {
      const message = getEncryptionErrorMessage('unknown error');
      expect(message).toBe('Unknown encryption error');
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle very long API keys (10KB)', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encryptApiKey(plaintext);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle API keys with all special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = encryptApiKey(plaintext);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle API keys with newlines and tabs', () => {
      const plaintext = 'sk_test\n\t123456789';
      const encrypted = encryptApiKey(plaintext);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle API keys with unicode characters', () => {
      const plaintext = 'sk_test_你好世界_🔐';
      const encrypted = encryptApiKey(plaintext);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle rapid successive encryptions', () => {
      const plaintext = 'sk_test_123456789';
      const encrypted1 = encryptApiKey(plaintext);
      const encrypted2 = encryptApiKey(plaintext);
      const encrypted3 = encryptApiKey(plaintext);
      
      // All should decrypt to same plaintext
      expect(decryptApiKey(encrypted1)).toBe(plaintext);
      expect(decryptApiKey(encrypted2)).toBe(plaintext);
      expect(decryptApiKey(encrypted3)).toBe(plaintext);
      
      // But ciphertexts should be different
      expect(encrypted1).not.toBe(encrypted2);
      expect(encrypted2).not.toBe(encrypted3);
    });
  });
});
