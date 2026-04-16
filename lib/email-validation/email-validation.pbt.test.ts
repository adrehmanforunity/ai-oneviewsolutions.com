/**
 * Property-Based Tests for Email Validation Service
 * Tests universal correctness properties across many inputs
 * 
 * **Validates: Requirements 2.2**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  validateEmail,
  isValidEmail,
  normalizeEmail,
  getEmailDomain,
} from './index';

// ============================================================================
// PROPERTY 1: Email Validation Consistency
// ============================================================================

/**
 * Property: validateEmail and isValidEmail should be consistent
 * For any email string, validateEmail().valid should equal isValidEmail()
 */
describe('Email Validation - Property: Consistency', () => {
  it('should have consistent validation results between validateEmail and isValidEmail', () => {
    fc.assert(
      fc.property(fc.string(), (email) => {
        const validateResult = validateEmail(email);
        const isValidResult = isValidEmail(email);
        
        // Both should agree on validity
        expect(validateResult.valid).toBe(isValidResult);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 2: Valid Email Format Preservation
// ============================================================================

/**
 * Property: All emails matching RFC 5322 pattern should be accepted
 * For any email with valid format, validateEmail should return valid: true
 */
describe('Email Validation - Property: Valid Format Acceptance', () => {
  it('should accept all emails with valid RFC 5322 format', () => {
    // Generate valid emails using fast-check
    const validEmailArb = fc.tuple(
      fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),                    // Local part
      fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),                    // Domain label 1
      fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),                    // Domain label 2
      fc.stringMatching(/^[a-zA-Z]{2,6}$/)                         // TLD
    ).map(([local, label1, label2, tld]) => {
      return `${local}@${label1}.${label2}.${tld}`;
    });

    fc.assert(
      fc.property(validEmailArb, (email) => {
        const result = validateEmail(email);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// PROPERTY 3: Invalid Email Rejection
// ============================================================================

/**
 * Property: Emails without @ symbol should always be rejected
 * For any string without @, validateEmail should return valid: false
 */
describe('Email Validation - Property: Invalid Format Rejection', () => {
  it('should reject all emails without @ symbol', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[^@]*$/),  // String without @
        (email) => {
          if (email.length === 0) return;  // Skip empty strings
          
          const result = validateEmail(email);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject all emails with multiple @ symbols', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 })
        ),
        ([part1, part2, part3]) => {
          // Skip if any part contains @
          if (part1.includes('@') || part2.includes('@') || part3.includes('@')) {
            return;
          }
          
          const email = `${part1}@${part2}@${part3}`;
          
          const result = validateEmail(email);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('@');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject all emails without domain dot', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z0-9._+\-]{1,20}$/),
          fc.stringMatching(/^[a-zA-Z0-9\-]{1,20}$/)
        ),
        ([local, domain]) => {
          const email = `${local}@${domain}`;
          
          // Skip if domain already has a dot
          if (domain.includes('.')) return;
          
          const result = validateEmail(email);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 4: Normalization Idempotence
// ============================================================================

/**
 * Property: Normalizing an email twice should produce the same result
 * For any email, normalizeEmail(normalizeEmail(email)) == normalizeEmail(email)
 */
describe('Email Validation - Property: Normalization Idempotence', () => {
  it('should be idempotent when normalizing emails', () => {
    fc.assert(
      fc.property(fc.string(), (email) => {
        const normalized1 = normalizeEmail(email);
        const normalized2 = normalizeEmail(normalized1);
        
        expect(normalized2).toBe(normalized1);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 5: Normalization Produces Lowercase
// ============================================================================

/**
 * Property: Normalized email should always be lowercase
 * For any email, normalizeEmail(email) should be all lowercase
 */
describe('Email Validation - Property: Normalization Lowercase', () => {
  it('should produce lowercase emails after normalization', () => {
    fc.assert(
      fc.property(fc.string(), (email) => {
        const normalized = normalizeEmail(email);
        
        // Check if normalized email is lowercase (or empty)
        if (normalized.length > 0) {
          expect(normalized).toBe(normalized.toLowerCase());
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 6: Domain Extraction Consistency
// ============================================================================

/**
 * Property: Domain extraction should be consistent with email validation
 * For any valid email, getEmailDomain should return a non-null domain
 * For any invalid email, getEmailDomain should return null
 */
describe('Email Validation - Property: Domain Extraction Consistency', () => {
  it('should extract domain only from valid emails', () => {
    // Generate valid emails
    const validEmailArb = fc.tuple(
      fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),
      fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),
      fc.stringMatching(/^[a-zA-Z]{2,6}$/)
    ).map(([local, label, tld]) => {
      return `${local}@${label}.${tld}`;
    });

    fc.assert(
      fc.property(validEmailArb, (email) => {
        const isValid = isValidEmail(email);
        const domain = getEmailDomain(email);
        
        // If email is valid, domain should not be null
        if (isValid) {
          expect(domain).not.toBeNull();
        }
        
        // If domain is not null, email should be valid
        if (domain !== null) {
          expect(isValid).toBe(true);
        }
      }),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// PROPERTY 7: Domain Extraction Lowercase
// ============================================================================

/**
 * Property: Extracted domain should always be lowercase
 * For any email with extractable domain, getEmailDomain should return lowercase
 */
describe('Email Validation - Property: Domain Extraction Lowercase', () => {
  it('should return lowercase domains', () => {
    fc.assert(
      fc.property(fc.string(), (email) => {
        const domain = getEmailDomain(email);
        
        if (domain !== null) {
          expect(domain).toBe(domain.toLowerCase());
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 8: Email Length Constraints
// ============================================================================

/**
 * Property: Email validation should respect RFC 5321 length constraints
 * - Total email length: max 254 characters
 * - Local part: max 64 characters
 * - Domain: max 255 characters
 */
describe('Email Validation - Property: Length Constraints', () => {
  it('should reject emails exceeding maximum length', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 255 }),
        (email) => {
          if (email.length > 254) {
            const result = validateEmail(email);
            expect(result.valid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject local parts exceeding maximum length', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9._+\-]{65,}$/),
        (localPart) => {
          const email = `${localPart}@example.com`;
          
          const result = validateEmail(email);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 9: Whitespace Handling
// ============================================================================

/**
 * Property: Whitespace should be trimmed during validation
 * For any email with leading/trailing whitespace, validation should work
 */
describe('Email Validation - Property: Whitespace Handling', () => {
  it('should handle leading and trailing whitespace', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[ \t\n]*$/),  // Only whitespace
          fc.stringMatching(/^[a-zA-Z0-9]{1,10}@[a-zA-Z0-9]{1,10}\.[a-zA-Z]{2,4}$/),
          fc.stringMatching(/^[ \t\n]*$/)   // Only whitespace
        ),
        ([prefix, email, suffix]) => {
          const emailWithWhitespace = `${prefix}${email}${suffix}`;
          const result = validateEmail(emailWithWhitespace);
          
          // Should be valid if the core email is valid
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// PROPERTY 10: Error Messages Consistency
// ============================================================================

/**
 * Property: Invalid emails should always have error messages
 * For any invalid email, validateEmail should return an error message
 */
describe('Email Validation - Property: Error Messages', () => {
  it('should provide error messages for invalid emails', () => {
    fc.assert(
      fc.property(fc.string(), (email) => {
        const result = validateEmail(email);
        
        // If invalid, must have error message
        if (!result.valid) {
          expect(result.error).toBeDefined();
          expect(result.error).not.toBe('');
          expect(typeof result.error).toBe('string');
        }
        
        // If valid, should not have error message
        if (result.valid) {
          expect(result.error).toBeUndefined();
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 11: Domain Extraction from Valid Emails
// ============================================================================

/**
 * Property: Domain extraction should work for all valid emails
 * For any valid email, getEmailDomain should return the domain part
 */
describe('Email Validation - Property: Domain Extraction from Valid Emails', () => {
  it('should extract domain from all valid emails', () => {
    const validEmailArb = fc.tuple(
      fc.stringMatching(/^[a-zA-Z0-9._+\-]{1,20}$/),
      fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/),
      fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/),
      fc.stringMatching(/^[a-zA-Z]{2,6}$/)
    ).map(([local, label1, label2, tld]) => {
      return `${local}@${label1}.${label2}.${tld}`;
    });

    fc.assert(
      fc.property(validEmailArb, (email) => {
        const domain = getEmailDomain(email);
        
        // Domain should not be null for valid emails
        expect(domain).not.toBeNull();
        
        // Domain should contain the expected parts
        if (domain) {
          expect(domain).toContain('.');
          expect(domain).not.toContain('@');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 12: Normalization Preserves Validity
// ============================================================================

/**
 * Property: Normalizing a valid email should keep it valid
 * For any valid email, normalizeEmail should not make it invalid
 */
describe('Email Validation - Property: Normalization Preserves Validity', () => {
  it('should preserve validity after normalization', () => {
    const validEmailArb = fc.tuple(
      fc.stringMatching(/^[a-zA-Z0-9._+\-]{1,20}$/),
      fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/),
      fc.stringMatching(/^[a-zA-Z]{2,6}$/)
    ).map(([local, label, tld]) => {
      return `${local}@${label}.${tld}`;
    });

    fc.assert(
      fc.property(validEmailArb, (email) => {
        const isValidBefore = isValidEmail(email);
        const normalized = normalizeEmail(email);
        const isValidAfter = isValidEmail(normalized);
        
        // If valid before, should be valid after normalization
        if (isValidBefore) {
          expect(isValidAfter).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});
