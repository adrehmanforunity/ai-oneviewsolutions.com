/**
 * Unit Tests for Masking Utility Module
 * Tests all masking functions with various inputs and edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  maskApiKey,
  maskEmail,
  maskSensitiveData,
  isMasked,
  maskApiKeys,
  maskEmails,
} from './index';

// ============================================================================
// TESTS: maskApiKey
// ============================================================================

describe('maskApiKey', () => {
  describe('valid API keys', () => {
    it('should mask Groq API key with prefix', () => {
      const key = 'gsk_abc123def456ghi789';
      const masked = maskApiKey(key);
      expect(masked).toBe('gsk_...i789');
      expect(masked).not.toContain('abc123');
      expect(masked).not.toContain('def456');
    });

    it('should mask OpenAI API key with sk- prefix', () => {
      const key = 'sk-proj-abc123def456ghi789';
      const masked = maskApiKey(key);
      expect(masked).toBe('sk_...i789');
      expect(masked).not.toContain('abc123');
    });

    it('should mask key without prefix', () => {
      const key = 'abc123def456ghi789jkl';
      const masked = maskApiKey(key);
      expect(masked).toBe('...9jkl');
      expect(masked).not.toContain('abc123');
    });

    it('should show last 4 characters', () => {
      const key = 'verylongapikey1234567890';
      const masked = maskApiKey(key);
      expect(masked).toContain('7890');
      expect(masked.slice(-4)).toBe('7890');
    });

    it('should handle keys with underscores', () => {
      const key = 'prefix_key_abc123def456';
      const masked = maskApiKey(key);
      expect(masked).toBe('prefix_...f456');
    });

    it('should handle keys with dashes', () => {
      const key = 'prefix-key-abc123def456';
      const masked = maskApiKey(key);
      expect(masked).toBe('prefix_...f456');
    });
  });

  describe('edge cases', () => {
    it('should return **** for empty string', () => {
      expect(maskApiKey('')).toBe('****');
    });

    it('should return **** for null', () => {
      expect(maskApiKey(null as any)).toBe('****');
    });

    it('should return **** for undefined', () => {
      expect(maskApiKey(undefined as any)).toBe('****');
    });

    it('should return **** for non-string', () => {
      expect(maskApiKey(123 as any)).toBe('****');
    });

    it('should return **** for key shorter than 4 characters', () => {
      expect(maskApiKey('abc')).toBe('****');
      expect(maskApiKey('ab')).toBe('****');
      expect(maskApiKey('a')).toBe('****');
    });

    it('should handle exactly 4 character key', () => {
      const key = 'abcd';
      const masked = maskApiKey(key);
      expect(masked).toBe('...abcd');
    });

    it('should handle key with special characters', () => {
      const key = 'gsk_abc!@#$%^&*()1234';
      const masked = maskApiKey(key);
      expect(masked).toContain('gsk_');
      expect(masked).toContain('...');
    });
  });

  describe('masking verification', () => {
    it('should never expose more than last 4 characters', () => {
      const key = 'gsk_verylongapikey123456789';
      const masked = maskApiKey(key);
      const visibleChars = masked.slice(-4);
      expect(visibleChars).toBe('6789');
      expect(masked.length).toBeLessThan(key.length);
    });

    it('should always include ellipsis or asterisks', () => {
      const keys = [
        'gsk_abc123def456',
        'sk-proj-abc123def456',
        'abc123def456',
      ];
      keys.forEach(key => {
        const masked = maskApiKey(key);
        expect(masked).toMatch(/\.\.\.|^\*+/);
      });
    });
  });
});

// ============================================================================
// TESTS: maskEmail
// ============================================================================

describe('maskEmail', () => {
  describe('valid emails', () => {
    it('should mask simple email', () => {
      const email = 'john.doe@example.com';
      const masked = maskEmail(email);
      expect(masked).toBe('j***@example.com');
      expect(masked).not.toContain('john');
      expect(masked).not.toContain('doe');
    });

    it('should mask email with plus addressing', () => {
      const email = 'user+tag@domain.com';
      const masked = maskEmail(email);
      expect(masked).toBe('u***@domain.com');
      expect(masked).not.toContain('user');
      expect(masked).not.toContain('tag');
    });

    it('should mask email with subdomain', () => {
      const email = 'admin@mail.company.co.uk';
      const masked = maskEmail(email);
      expect(masked).toBe('a***@mail.company.co.uk');
      expect(masked).not.toContain('admin');
    });

    it('should preserve domain exactly', () => {
      const email = 'test@example.com';
      const masked = maskEmail(email);
      expect(masked).toContain('@example.com');
    });

    it('should show first character of local part', () => {
      const email = 'alice@example.com';
      const masked = maskEmail(email);
      expect(masked.startsWith('a')).toBe(true);
    });

    it('should handle single character local part', () => {
      const email = 'a@example.com';
      const masked = maskEmail(email);
      expect(masked).toBe('a***@example.com');
    });

    it('should handle long local part', () => {
      const email = 'verylongemailaddress@example.com';
      const masked = maskEmail(email);
      expect(masked).toContain('v***');
      expect(masked).toContain('@example.com');
    });
  });

  describe('edge cases', () => {
    it('should return ***@*** for empty string', () => {
      expect(maskEmail('')).toBe('***@***');
    });

    it('should return ***@*** for null', () => {
      expect(maskEmail(null as any)).toBe('***@***');
    });

    it('should return ***@*** for undefined', () => {
      expect(maskEmail(undefined as any)).toBe('***@***');
    });

    it('should return ***@*** for non-string', () => {
      expect(maskEmail(123 as any)).toBe('***@***');
    });

    it('should return ***@*** for invalid email format (no @)', () => {
      expect(maskEmail('invalidemail.com')).toBe('***@***');
    });

    it('should return ***@*** for invalid email format (multiple @)', () => {
      expect(maskEmail('invalid@email@com')).toBe('***@***');
    });

    it('should return ***@*** for email with empty local part', () => {
      expect(maskEmail('@example.com')).toBe('***@***');
    });

    it('should return ***@*** for email with empty domain', () => {
      expect(maskEmail('user@')).toBe('***@***');
    });
  });

  describe('masking verification', () => {
    it('should never expose full local part', () => {
      const email = 'secretemail@example.com';
      const masked = maskEmail(email);
      expect(masked).not.toContain('secretemail');
      expect(masked).not.toContain('secret');
      expect(masked).not.toContain('email');
    });

    it('should always show domain', () => {
      const emails = [
        'user@example.com',
        'admin@company.org',
        'test@mail.co.uk',
      ];
      emails.forEach(email => {
        const masked = maskEmail(email);
        const domain = email.split('@')[1];
        expect(masked).toContain(domain);
      });
    });
  });
});

// ============================================================================
// TESTS: maskSensitiveData
// ============================================================================

describe('maskSensitiveData', () => {
  describe('with default visibleChars (4)', () => {
    it('should mask generic sensitive data', () => {
      const data = 'secret123456';
      const masked = maskSensitiveData(data);
      // 12 chars - 4 visible = 8 masked, but minimum 4 asterisks, so 8 asterisks
      expect(masked).toBe('********3456');
      expect(masked).not.toContain('secret');
    });

    it('should show last 4 characters', () => {
      const data = 'verylongsecretdata1234';
      const masked = maskSensitiveData(data);
      expect(masked.slice(-4)).toBe('1234');
    });

    it('should mask data shorter than 4 characters', () => {
      const data = 'abc';
      const masked = maskSensitiveData(data);
      // When visibleChars >= data.length, show all
      expect(masked).toBe('abc');
    });
  });

  describe('with custom visibleChars', () => {
    it('should show last 2 characters when visibleChars=2', () => {
      const data = 'password';
      const masked = maskSensitiveData(data, 2);
      expect(masked).toBe('******rd');
    });

    it('should show last 6 characters when visibleChars=6', () => {
      const data = 'secrettoken123456';
      const masked = maskSensitiveData(data, 6);
      expect(masked.slice(-6)).toBe('123456');
    });

    it('should mask everything when visibleChars=0', () => {
      const data = 'secret';
      const masked = maskSensitiveData(data, 0);
      expect(masked).toBe('******');
    });

    it('should show all characters when visibleChars >= length', () => {
      const data = 'abc';
      const masked = maskSensitiveData(data, 10);
      expect(masked).toBe('abc');
    });
  });

  describe('edge cases', () => {
    it('should return **** for empty string', () => {
      expect(maskSensitiveData('')).toBe('****');
    });

    it('should return **** for null', () => {
      expect(maskSensitiveData(null as any)).toBe('****');
    });

    it('should return **** for undefined', () => {
      expect(maskSensitiveData(undefined as any)).toBe('****');
    });

    it('should return **** for non-string', () => {
      expect(maskSensitiveData(123 as any)).toBe('****');
    });

    it('should handle negative visibleChars', () => {
      const data = 'secret';
      const masked = maskSensitiveData(data, -5);
      expect(masked).toBe('******');
    });

    it('should handle very large visibleChars', () => {
      const data = 'secret';
      const masked = maskSensitiveData(data, 1000);
      expect(masked).toBe('secret');
    });
  });

  describe('masking verification', () => {
    it('should never expose more than visibleChars characters', () => {
      const data = 'verylongsecretdata';
      const masked = maskSensitiveData(data, 3);
      expect(masked.slice(-3)).toBe('ata');
      expect(masked.length).toBeLessThanOrEqual(data.length);
    });

    it('should always include asterisks for masked part', () => {
      const data = 'secret123456';
      const masked = maskSensitiveData(data, 4);
      expect(masked).toMatch(/^\*+/);
    });
  });
});

// ============================================================================
// TESTS: isMasked
// ============================================================================

describe('isMasked', () => {
  describe('already masked values', () => {
    it('should detect API key masking pattern (prefix_...XXXX)', () => {
      expect(isMasked('gsk_...a3b9')).toBe(true);
      expect(isMasked('sk-proj_...xyz1')).toBe(true);
    });

    it('should detect ellipsis masking pattern (...XXXX)', () => {
      expect(isMasked('...a3b9')).toBe(true);
      expect(isMasked('...xyz1')).toBe(true);
    });

    it('should detect asterisk masking pattern (****XXXX)', () => {
      expect(isMasked('****3456')).toBe(true);
      expect(isMasked('*****789')).toBe(true);
    });

    it('should detect email masking pattern (a***@domain)', () => {
      expect(isMasked('j***@example.com')).toBe(true);
      expect(isMasked('a***@company.org')).toBe(true);
    });
  });

  describe('unmasked values', () => {
    it('should not detect full API key as masked', () => {
      expect(isMasked('gsk_abc123def456')).toBe(false);
      expect(isMasked('sk-proj-abc123def456')).toBe(false);
    });

    it('should not detect full email as masked', () => {
      expect(isMasked('john.doe@example.com')).toBe(false);
      expect(isMasked('admin@company.org')).toBe(false);
    });

    it('should not detect random strings as masked', () => {
      expect(isMasked('randomstring')).toBe(false);
      expect(isMasked('abc123')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false for empty string', () => {
      expect(isMasked('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isMasked(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isMasked(undefined as any)).toBe(false);
    });

    it('should return false for non-string', () => {
      expect(isMasked(123 as any)).toBe(false);
    });

    it('should return false for just asterisks', () => {
      expect(isMasked('****')).toBe(false);
    });

    it('should return false for just ellipsis', () => {
      expect(isMasked('...')).toBe(false);
    });
  });
});

// ============================================================================
// TESTS: maskApiKeys (batch)
// ============================================================================

describe('maskApiKeys', () => {
  it('should mask multiple API keys', () => {
    const keys = [
      'gsk_abc123def456',
      'sk-proj-abc123def456',
      'abc123def456',
    ];
    const masked = maskApiKeys(keys);
    expect(masked).toHaveLength(3);
    expect(masked[0]).toBe('gsk_...f456');
    expect(masked[1]).toBe('sk_...f456');
    expect(masked[2]).toBe('...f456');
  });

  it('should handle empty array', () => {
    expect(maskApiKeys([])).toEqual([]);
  });

  it('should handle array with invalid keys', () => {
    const keys = ['', null as any, undefined as any];
    const masked = maskApiKeys(keys);
    expect(masked).toHaveLength(3);
    expect(masked.every(m => m === '****')).toBe(true);
  });
});

// ============================================================================
// TESTS: maskEmails (batch)
// ============================================================================

describe('maskEmails', () => {
  it('should mask multiple emails', () => {
    const emails = [
      'john.doe@example.com',
      'admin@company.org',
      'user@mail.co.uk',
    ];
    const masked = maskEmails(emails);
    expect(masked).toHaveLength(3);
    expect(masked[0]).toBe('j***@example.com');
    expect(masked[1]).toBe('a***@company.org');
    expect(masked[2]).toBe('u***@mail.co.uk');
  });

  it('should handle empty array', () => {
    expect(maskEmails([])).toEqual([]);
  });

  it('should handle array with invalid emails', () => {
    const emails = ['', null as any, undefined as any];
    const masked = maskEmails(emails);
    expect(masked).toHaveLength(3);
    expect(masked.every(m => m === '***@***')).toBe(true);
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('masking integration', () => {
  it('should mask and detect API key masking', () => {
    const key = 'gsk_abc123def456ghi789';
    const masked = maskApiKey(key);
    expect(isMasked(masked)).toBe(true);
  });

  it('should mask and detect email masking', () => {
    const email = 'john.doe@example.com';
    const masked = maskEmail(email);
    expect(isMasked(masked)).toBe(true);
  });

  it('should mask and detect generic data masking', () => {
    const data = 'secret123456';
    const masked = maskSensitiveData(data);
    expect(isMasked(masked)).toBe(true);
  });

  it('should not mask already masked values', () => {
    const masked = 'gsk_...a3b9';
    const reMasked = maskApiKey(masked);
    // Re-masking an already masked value should return ****
    // because the masked value is only 11 chars, so last 4 is "a3b9"
    expect(reMasked).toBe('gsk_...a3b9');
  });

  it('should handle mixed masked and unmasked values', () => {
    const values = [
      'gsk_abc123def456',  // unmasked
      'gsk_...a3b9',       // masked
      'sk-proj-abc123',    // unmasked
    ];
    const results = values.map(v => ({
      value: v,
      masked: maskApiKey(v),
      isMasked: isMasked(v),
    }));
    expect(results[0].isMasked).toBe(false);
    expect(results[1].isMasked).toBe(true);
    expect(results[2].isMasked).toBe(false);
  });
});
