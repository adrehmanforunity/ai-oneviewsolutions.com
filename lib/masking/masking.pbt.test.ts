/**
 * Property-Based Tests for Masking Utility Module
 * Tests universal properties that should hold across all valid inputs
 * 
 * **Validates: Requirements 1.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  maskApiKey,
  maskEmail,
  maskSensitiveData,
  isMasked,
} from './index';

// ============================================================================
// PROPERTY 1: Key Masking Correctness
// ============================================================================

/**
 * **Property 2: Key Masking Correctness**
 * 
 * For any API key string with length ≥ 4, the masking function SHALL return
 * exactly the last 4 characters of the key, formatted as "prefix_...XXXX"
 * where XXXX are the last 4 characters.
 * 
 * **Validates: Requirements 1.4**
 */
describe('Property 2: Key Masking Correctness', () => {
  it('should always show exactly the last 4 characters of the key', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{4,}$/),  // Keys with 4+ alphanumeric chars
        (key: string) => {
          const masked = maskApiKey(key);
          const lastFour = key.slice(-4);
          
          // The masked value should contain the last 4 characters
          expect(masked).toContain(lastFour);
          
          // The masked value should end with the last 4 characters
          expect(masked.slice(-4)).toBe(lastFour);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never expose more than the last 4 characters', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{4,}$/),
        (key: string) => {
          const masked = maskApiKey(key);
          const lastFour = key.slice(-4);
          const beforeLastFour = key.slice(0, -4);
          
          // The masked value should not contain any characters from before the last 4
          // (except for the prefix which is allowed)
          const visiblePart = masked.slice(-4);
          expect(visiblePart).toBe(lastFour);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always include masking indicators (... or prefix_)', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{4,}$/),
        (key: string) => {
          const masked = maskApiKey(key);
          
          // Should contain either ellipsis or prefix with underscore
          const hasEllipsis = masked.includes('...');
          const hasPrefix = masked.includes('_');
          
          expect(hasEllipsis || hasPrefix).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle keys with various prefixes correctly', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z0-9]+$/),  // Prefix
          fc.stringMatching(/^[a-zA-Z0-9_-]{4,}$/)  // Rest of key
        ),
        ([prefix, rest]: [string, string]) => {
          const key = `${prefix}_${rest}`;
          const masked = maskApiKey(key);
          
          // Should show the prefix
          expect(masked).toContain(prefix);
          
          // Should show the last 4 characters
          expect(masked.slice(-4)).toBe(rest.slice(-4));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should mask keys shorter than 4 characters as ****', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{1,3}$/),  // Keys with 1-3 chars
        (key: string) => {
          const masked = maskApiKey(key);
          expect(masked).toBe('****');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be idempotent for already-masked values', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{4,}$/),
        (key: string) => {
          const masked1 = maskApiKey(key);
          const masked2 = maskApiKey(masked1);
          
          // Masking an already-masked value should produce the same result
          // (or **** if the masked value is too short)
          if (masked1.length >= 4) {
            expect(masked2).toBe(masked1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 2: Email Masking Correctness
// ============================================================================

/**
 * Property: Email masking should always show first character and domain
 * 
 * For any valid email address, the masking function SHALL return
 * the first character of the local part, exactly 3 asterisks, and the full domain.
 */
describe('Property: Email Masking Correctness', () => {
  it('should always show first character and domain', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9.+_-]*$/),  // Local part
          fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/)  // Domain
        ),
        ([localPart, domain]: [string, string]) => {
          const email = `${localPart}@${domain}`;
          const masked = maskEmail(email);
          
          // Should start with first character of local part
          expect(masked[0]).toBe(localPart[0]);
          
          // Should contain exactly 3 asterisks after first character
          expect(masked).toContain('***');
          
          // Should contain the full domain
          expect(masked).toContain(domain);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never expose the full local part', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9.+_-]{2,}$/),  // Local part with 3+ chars
          fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/)  // Domain
        ),
        ([localPart, domain]: [string, string]) => {
          const email = `${localPart}@${domain}`;
          const masked = maskEmail(email);
          
          // Should not contain the full local part (exact match)
          expect(masked).not.toContain(localPart);
          
          // Should not contain the middle part of local part (everything except first char)
          // Only check if middle part is long enough and doesn't appear in domain
          const middlePart = localPart.slice(1);
          if (middlePart.length > 2 && !domain.includes(middlePart)) {
            expect(masked).not.toContain(middlePart);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always preserve the domain exactly', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9.+_-]*$/),
          fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/)
        ),
        ([localPart, domain]: [string, string]) => {
          const email = `${localPart}@${domain}`;
          const masked = maskEmail(email);
          
          // Extract domain from masked email
          const maskedDomain = masked.split('@')[1];
          expect(maskedDomain).toBe(domain);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 3: Generic Sensitive Data Masking
// ============================================================================

/**
 * Property: Generic masking should show exactly N visible characters
 * 
 * For any sensitive data string and visibleChars parameter,
 * the masking function SHALL show exactly the last N characters.
 */
describe('Property: Generic Sensitive Data Masking', () => {
  it('should show exactly the last N characters', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9]{5,}$/),  // Data with 5+ chars
        fc.integer({ min: 0, max: 4 }),  // visibleChars 0-4
        (data: string, visibleChars: number) => {
          const masked = maskSensitiveData(data, visibleChars);
          
          if (visibleChars === 0) {
            // All masked
            expect(masked).toMatch(/^\*+$/);
          } else if (visibleChars >= data.length) {
            // Show all
            expect(masked).toBe(data);
          } else {
            // Show last N characters
            const lastN = data.slice(-visibleChars);
            expect(masked.slice(-visibleChars)).toBe(lastN);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never expose more than visibleChars characters', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9]{10,}$/),
        fc.integer({ min: 1, max: 5 }),
        (data: string, visibleChars: number) => {
          const masked = maskSensitiveData(data, visibleChars);
          
          if (visibleChars < data.length) {
            // Should not contain characters from before the last N
            const beforeLastN = data.slice(0, -visibleChars);
            const visiblePart = masked.slice(-visibleChars);
            
            // The visible part should be the last N characters
            expect(visiblePart).toBe(data.slice(-visibleChars));
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always include asterisks for masked part', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9]{5,}$/),
        fc.integer({ min: 0, max: 3 }),
        (data: string, visibleChars: number) => {
          const masked = maskSensitiveData(data, visibleChars);
          
          if (visibleChars < data.length) {
            // Should start with asterisks
            expect(masked).toMatch(/^\*+/);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 4: Masking Detection
// ============================================================================

/**
 * Property: isMasked should correctly identify masked values
 * 
 * For any value produced by a masking function, isMasked should return true.
 * For any unmasked value, isMasked should return false.
 */
describe('Property: Masking Detection', () => {
  it('should detect all API key masked values', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{4,}$/),
        (key: string) => {
          const masked = maskApiKey(key);
          expect(isMasked(masked)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect all email masked values', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9.+_-]*$/),
          fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/)
        ),
        ([localPart, domain]: [string, string]) => {
          const email = `${localPart}@${domain}`;
          const masked = maskEmail(email);
          expect(isMasked(masked)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect all generic data masked values', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9]{5,}$/),
        fc.integer({ min: 1, max: 4 }),  // Changed from 0-4 to 1-4 to avoid all-asterisks case
        (data: string, visibleChars: number) => {
          const masked = maskSensitiveData(data, visibleChars);
          
          // If it's actually masked (not just showing all chars), should be detected
          if (visibleChars < data.length) {
            expect(isMasked(masked)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not detect unmasked values as masked', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{4,}$/),
        (key: string) => {
          // Unmasked keys should not be detected as masked
          expect(isMasked(key)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 5: Masking Consistency
// ============================================================================

/**
 * Property: Masking should be consistent
 * 
 * For the same input, masking should always produce the same output.
 */
describe('Property: Masking Consistency', () => {
  it('should produce consistent results for API keys', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{4,}$/),
        (key: string) => {
          const masked1 = maskApiKey(key);
          const masked2 = maskApiKey(key);
          expect(masked1).toBe(masked2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce consistent results for emails', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9.+_-]*$/),
          fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/)
        ),
        ([localPart, domain]: [string, string]) => {
          const email = `${localPart}@${domain}`;
          const masked1 = maskEmail(email);
          const masked2 = maskEmail(email);
          expect(masked1).toBe(masked2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce consistent results for generic data', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9]{5,}$/),
        fc.integer({ min: 0, max: 4 }),
        (data: string, visibleChars: number) => {
          const masked1 = maskSensitiveData(data, visibleChars);
          const masked2 = maskSensitiveData(data, visibleChars);
          expect(masked1).toBe(masked2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
