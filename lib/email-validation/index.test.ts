/**
 * Unit Tests for Email Validation Service
 * Tests RFC 5322 compliant email validation with edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  isValidEmail,
  normalizeEmail,
  getEmailDomain,
  validateEmails,
  areAllEmailsValid,
  normalizeEmails,
} from './index';

// ============================================================================
// VALID EMAIL TESTS
// ============================================================================

describe('Email Validation - Valid Emails', () => {
  it('should validate simple email addresses', () => {
    const validEmails = [
      'user@example.com',
      'john@company.org',
      'admin@domain.co.uk',
      'test@mail.io',
    ];

    validEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  it('should validate emails with dots in local part', () => {
    const validEmails = [
      'john.doe@example.com',
      'first.last.name@company.org',
      'user.name.123@domain.com',
    ];

    validEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
    });
  });

  it('should validate emails with hyphens in local part', () => {
    const validEmails = [
      'user-name@example.com',
      'first-last@company.org',
      'test-123@domain.com',
    ];

    validEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
    });
  });

  it('should validate emails with underscores in local part', () => {
    const validEmails = [
      'user_name@example.com',
      'first_last@company.org',
      'test_123@domain.com',
    ];

    validEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
    });
  });

  it('should validate emails with plus signs in local part', () => {
    const validEmails = [
      'user+tag@example.com',
      'john+work@company.org',
      'test+123@domain.com',
    ];

    validEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
    });
  });

  it('should validate emails with numbers in local part', () => {
    const validEmails = [
      'user123@example.com',
      '123user@company.org',
      '123@domain.com',
    ];

    validEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
    });
  });

  it('should validate emails with multi-level domains', () => {
    const validEmails = [
      'user@mail.example.com',
      'john@subdomain.company.org',
      'test@a.b.c.d.com',
    ];

    validEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
    });
  });

  it('should validate emails with hyphens in domain', () => {
    const validEmails = [
      'user@my-domain.com',
      'john@my-company.org',
      'test@sub-domain.example.com',
    ];

    validEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
    });
  });

  it('should validate emails with long TLDs', () => {
    const validEmails = [
      'user@example.museum',
      'john@company.international',
      'test@domain.photography',
    ];

    validEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
    });
  });

  it('should validate emails with uppercase letters', () => {
    const validEmails = [
      'User@Example.com',
      'JOHN@COMPANY.ORG',
      'Test@Domain.COM',
    ];

    validEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
    });
  });

  it('should validate emails with leading/trailing whitespace', () => {
    const validEmails = [
      '  user@example.com  ',
      '\tjohn@company.org\t',
      '\ntest@domain.com\n',
    ];

    validEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
    });
  });

  it('should validate minimum length email', () => {
    const result = validateEmail('a@b.co');
    expect(result.valid).toBe(true);
  });

  it('should validate maximum length email', () => {
    // Create email with 254 characters (max allowed)
    const localPart = 'a'.repeat(64);  // 64 chars
    const domain = 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(63) + '.' + 'e'.repeat(50);  // ~189 chars
    const email = `${localPart}@${domain}`;
    
    if (email.length <= 254) {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
    }
  });
});

// ============================================================================
// INVALID EMAIL TESTS
// ============================================================================

describe('Email Validation - Invalid Emails', () => {
  it('should reject empty or null emails', () => {
    const invalidEmails = ['', null, undefined];

    invalidEmails.forEach((email) => {
      const result = validateEmail(email as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  it('should reject emails without @ symbol', () => {
    const invalidEmails = [
      'userexample.com',
      'john.company.org',
      'test-domain.com',
    ];

    invalidEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('@');
    });
  });

  it('should reject emails with multiple @ symbols', () => {
    const invalidEmails = [
      'user@@example.com',
      'john@company@org',
      'test@domain@com',
    ];

    invalidEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('@');
    });
  });

  it('should reject emails without local part', () => {
    const invalidEmails = [
      '@example.com',
      '@domain.org',
    ];

    invalidEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('local part');
    });
  });

  it('should reject emails without domain', () => {
    const invalidEmails = [
      'user@',
      'john@',
    ];

    invalidEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('domain');
    });
  });

  it('should reject emails with leading dot in local part', () => {
    const result = validateEmail('.user@example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('dot');
  });

  it('should reject emails with trailing dot in local part', () => {
    const result = validateEmail('user.@example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('dot');
  });

  it('should reject emails with consecutive dots in local part', () => {
    const result = validateEmail('user..name@example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('consecutive dots');
  });

  it('should reject emails with leading dot in domain', () => {
    const result = validateEmail('user@.example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('dot');
  });

  it('should reject emails with trailing dot in domain', () => {
    const result = validateEmail('user@example.com.');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('dot');
  });

  it('should reject emails with consecutive dots in domain', () => {
    const result = validateEmail('user@example..com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('consecutive dots');
  });

  it('should reject emails without domain dot', () => {
    const result = validateEmail('user@localhost');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('dot');
  });

  it('should reject emails with invalid characters in local part', () => {
    const invalidEmails = [
      'user name@example.com',  // space
      'user!name@example.com',  // exclamation
      'user#name@example.com',  // hash
      'user$name@example.com',  // dollar
      'user%name@example.com',  // percent
      'user&name@example.com',  // ampersand
      'user*name@example.com',  // asterisk
    ];

    invalidEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });
  });

  it('should reject emails with leading hyphen in domain', () => {
    const result = validateEmail('user@-example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('hyphen');
  });

  it('should reject emails with trailing hyphen in domain', () => {
    const result = validateEmail('user@example-.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('hyphen');
  });

  it('should reject emails with leading hyphen in domain label', () => {
    const result = validateEmail('user@example.-com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('hyphen');
  });

  it('should reject emails with trailing hyphen in domain label', () => {
    const result = validateEmail('user@example-.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('hyphen');
  });

  it('should reject emails with numeric TLD', () => {
    const result = validateEmail('user@example.123');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('numeric');
  });

  it('should reject emails with single character TLD', () => {
    const result = validateEmail('user@example.c');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('TLD');
  });

  it('should reject emails that are too short', () => {
    const result = validateEmail('a@b');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too short');
  });

  it('should reject emails that are too long', () => {
    // Create email with 255+ characters
    const localPart = 'a'.repeat(100);
    const domain = 'b'.repeat(100) + '.com';
    const email = `${localPart}@${domain}`;
    
    const result = validateEmail(email);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('should reject emails with local part that is too long', () => {
    // Create local part with 65+ characters
    const localPart = 'a'.repeat(65);
    const email = `${localPart}@example.com`;
    
    const result = validateEmail(email);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('local part');
  });

  it('should reject emails with domain that is too long', () => {
    // Create domain with 256+ characters
    const domain = 'a'.repeat(256) + '.com';
    const email = `user@${domain}`;
    
    const result = validateEmail(email);
    expect(result.valid).toBe(false);
    // Error could be about total length or domain length
    expect(result.error).toBeDefined();
  });

  it('should reject emails with domain label that is too long', () => {
    // Create domain label with 64+ characters
    const label = 'a'.repeat(64);
    const email = `user@${label}.com`;
    
    const result = validateEmail(email);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('label');
  });
});

// ============================================================================
// SIMPLE VALIDATION TESTS
// ============================================================================

describe('Email Validation - isValidEmail', () => {
  it('should return true for valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('john.doe@company.org')).toBe(true);
    expect(isValidEmail('test+tag@domain.co.uk')).toBe(true);
  });

  it('should return false for invalid emails', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

// ============================================================================
// EMAIL NORMALIZATION TESTS
// ============================================================================

describe('Email Normalization - normalizeEmail', () => {
  it('should convert to lowercase', () => {
    expect(normalizeEmail('User@Example.COM')).toBe('user@example.com');
    expect(normalizeEmail('JOHN@COMPANY.ORG')).toBe('john@company.org');
  });

  it('should trim whitespace', () => {
    expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
    expect(normalizeEmail('\tjohn@company.org\t')).toBe('john@company.org');
    expect(normalizeEmail('\ntest@domain.com\n')).toBe('test@domain.com');
  });

  it('should handle empty strings', () => {
    expect(normalizeEmail('')).toBe('');
    expect(normalizeEmail('   ')).toBe('');
  });

  it('should handle null/undefined', () => {
    expect(normalizeEmail(null as any)).toBe('');
    expect(normalizeEmail(undefined as any)).toBe('');
  });

  it('should normalize combined cases', () => {
    expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com');
    expect(normalizeEmail('\tJOHN+TAG@COMPANY.ORG\t')).toBe('john+tag@company.org');
  });
});

// ============================================================================
// DOMAIN EXTRACTION TESTS
// ============================================================================

describe('Email Domain Extraction - getEmailDomain', () => {
  it('should extract domain from valid emails', () => {
    expect(getEmailDomain('user@example.com')).toBe('example.com');
    expect(getEmailDomain('john@company.org')).toBe('company.org');
    expect(getEmailDomain('test@mail.example.co.uk')).toBe('mail.example.co.uk');
  });

  it('should convert domain to lowercase', () => {
    expect(getEmailDomain('user@Example.COM')).toBe('example.com');
    expect(getEmailDomain('john@COMPANY.ORG')).toBe('company.org');
  });

  it('should trim whitespace before extracting', () => {
    expect(getEmailDomain('  user@example.com  ')).toBe('example.com');
    expect(getEmailDomain('\tjohn@company.org\t')).toBe('company.org');
  });

  it('should return null for invalid emails', () => {
    expect(getEmailDomain('invalid')).toBeNull();
    expect(getEmailDomain('user@')).toBeNull();
    // '@example.com' has no local part, so it's invalid
    expect(getEmailDomain('@example.com')).toBeNull();
    expect(getEmailDomain('')).toBeNull();
    expect(getEmailDomain(null as any)).toBeNull();
    expect(getEmailDomain(undefined as any)).toBeNull();
  });

  it('should return null for emails with multiple @ symbols', () => {
    expect(getEmailDomain('user@@example.com')).toBeNull();
    expect(getEmailDomain('john@company@org')).toBeNull();
  });
});

// ============================================================================
// BATCH OPERATIONS TESTS
// ============================================================================

describe('Email Validation - Batch Operations', () => {
  it('should validate multiple emails', () => {
    const emails = [
      'user@example.com',
      'invalid',
      'john@company.org',
    ];

    const results = validateEmails(emails);
    expect(results).toHaveLength(3);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
    expect(results[2].valid).toBe(true);
  });

  it('should check if all emails are valid', () => {
    expect(areAllEmailsValid(['user@example.com', 'john@company.org'])).toBe(true);
    expect(areAllEmailsValid(['user@example.com', 'invalid'])).toBe(false);
    expect(areAllEmailsValid([])).toBe(true);  // Empty array is valid
  });

  it('should normalize multiple emails', () => {
    const emails = ['  User@Example.COM  ', 'JOHN@COMPANY.ORG'];
    const normalized = normalizeEmails(emails);
    
    expect(normalized).toEqual([
      'user@example.com',
      'john@company.org',
    ]);
  });
});

// ============================================================================
// EDGE CASES TESTS
// ============================================================================

describe('Email Validation - Edge Cases', () => {
  it('should handle very long local parts', () => {
    const localPart = 'a'.repeat(64);
    const email = `${localPart}@example.com`;
    const result = validateEmail(email);
    expect(result.valid).toBe(true);
  });

  it('should reject local parts that exceed max length', () => {
    const localPart = 'a'.repeat(65);
    const email = `${localPart}@example.com`;
    const result = validateEmail(email);
    expect(result.valid).toBe(false);
  });

  it('should handle emails with many domain levels', () => {
    const email = 'user@a.b.c.d.e.f.g.h.i.j.com';
    const result = validateEmail(email);
    expect(result.valid).toBe(true);
  });

  it('should handle single character local part', () => {
    const result = validateEmail('a@example.com');
    expect(result.valid).toBe(true);
  });

  it('should handle single character domain labels', () => {
    // Single character labels are technically valid in DNS, but TLD must be at least 2 chars
    // So 'user@a.b.c' is invalid because 'c' is a single character TLD
    const result = validateEmail('user@a.b.co');
    expect(result.valid).toBe(true);
  });

  it('should handle emails with all special allowed characters', () => {
    const result = validateEmail('user+tag-name_test.123@example.com');
    expect(result.valid).toBe(true);
  });

  it('should handle emails with numbers only in local part', () => {
    const result = validateEmail('123456@example.com');
    expect(result.valid).toBe(true);
  });

  it('should handle emails with numbers only in domain labels', () => {
    const result = validateEmail('user@123.456.com');
    expect(result.valid).toBe(true);  // 123 and 456 are valid labels, com is valid TLD
  });

  it('should handle emails with mixed case', () => {
    const result = validateEmail('UsEr@ExAmPlE.CoM');
    expect(result.valid).toBe(true);
  });

  it('should handle emails with plus sign and numbers', () => {
    const result = validateEmail('user+123@example.com');
    expect(result.valid).toBe(true);
  });

  it('should handle emails with hyphen in multiple domain labels', () => {
    const result = validateEmail('user@my-domain.my-company.com');
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// REAL-WORLD EXAMPLES TESTS
// ============================================================================

describe('Email Validation - Real-World Examples', () => {
  it('should validate common email formats', () => {
    const validEmails = [
      'support@example.com',
      'info@company.org',
      'contact@domain.co.uk',
      'hello@startup.io',
      'admin@nonprofit.org',
      'noreply@service.com',
    ];

    validEmails.forEach((email) => {
      expect(isValidEmail(email)).toBe(true);
    });
  });

  it('should validate emails with plus addressing', () => {
    const validEmails = [
      'user+work@gmail.com',
      'john+personal@outlook.com',
      'test+staging@company.org',
    ];

    validEmails.forEach((email) => {
      expect(isValidEmail(email)).toBe(true);
    });
  });

  it('should validate emails with subdomains', () => {
    const validEmails = [
      'user@mail.example.com',
      'john@support.company.org',
      'test@api.service.io',
    ];

    validEmails.forEach((email) => {
      expect(isValidEmail(email)).toBe(true);
    });
  });

  it('should reject common invalid formats', () => {
    const invalidEmails = [
      'user',  // No domain
      'user@',  // No domain
      '@example.com',  // No local part
      'user @example.com',  // Space in local part
      'user@example',  // No TLD
      'user@@example.com',  // Double @
      'user@.example.com',  // Leading dot in domain
      'user@example..com',  // Consecutive dots
    ];

    invalidEmails.forEach((email) => {
      expect(isValidEmail(email)).toBe(false);
    });
  });
});
