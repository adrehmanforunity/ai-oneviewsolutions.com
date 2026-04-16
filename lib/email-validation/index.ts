/**
 * Email Validation Service
 * Provides RFC 5322 compliant email validation with descriptive error messages
 * 
 * Features:
 * - RFC 5322 standard email format validation
 * - Descriptive error messages for invalid emails
 * - Email normalization (lowercase, trim)
 * - Domain extraction
 * - Edge case handling (very long emails, unicode, special characters)
 * 
 * Security Features:
 * - Prevents email injection attacks
 * - Validates email length constraints
 * - Handles unicode and international domain names
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Email validation result
 */
export interface EmailValidationResult {
  valid: boolean;
  error?: string;  // Descriptive error message if invalid
}

// ============================================================================
// CONSTANTS
// ============================================================================

// RFC 5322 compliant email regex pattern
// This pattern validates:
// - Local part: alphanumeric, dots, hyphens, underscores, plus signs
// - Domain: alphanumeric, dots, hyphens
// - TLD: at least 2 characters
const RFC5322_EMAIL_REGEX = /^[a-zA-Z0-9._+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// More permissive pattern for international domain names (IDN)
const IDN_EMAIL_REGEX = /^[a-zA-Z0-9._+\-]+@[a-zA-Z0-9.\-\u0080-\uFFFF]+\.[a-zA-Z\u0080-\uFFFF]{2,}$/u;

// Maximum email length (RFC 5321)
const MAX_EMAIL_LENGTH = 254;

// Maximum local part length (before @)
const MAX_LOCAL_PART_LENGTH = 64;

// Maximum domain length
const MAX_DOMAIN_LENGTH = 255;

// Minimum email length
const MIN_EMAIL_LENGTH = 5;  // a@b.c

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate email format according to RFC 5322 standard
 * Returns detailed validation result with error message if invalid
 * 
 * Validates:
 * - Email length (5-254 characters)
 * - Local part length (max 64 characters)
 * - Domain length (max 255 characters)
 * - Format: localpart@domain.tld
 * - Local part: alphanumeric, dots, hyphens, underscores, plus signs
 * - Domain: alphanumeric, dots, hyphens
 * - TLD: at least 2 characters
 * - No consecutive dots
 * - No leading/trailing dots in local part
 * - No leading/trailing hyphens in domain
 * 
 * @param email Email address to validate
 * @returns Validation result with error message if invalid
 */
export function validateEmail(email: string): EmailValidationResult {
  // Check if email is provided
  if (!email || typeof email !== 'string') {
    return {
      valid: false,
      error: 'Email address is required',
    };
  }

  // Trim whitespace
  const trimmedEmail = email.trim();

  // Check minimum length
  if (trimmedEmail.length < MIN_EMAIL_LENGTH) {
    return {
      valid: false,
      error: `Email address is too short (minimum ${MIN_EMAIL_LENGTH} characters)`,
    };
  }

  // Check maximum length
  if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
    return {
      valid: false,
      error: `Email address is too long (maximum ${MAX_EMAIL_LENGTH} characters)`,
    };
  }

  // Check for @ symbol
  const atCount = (trimmedEmail.match(/@/g) || []).length;
  if (atCount === 0) {
    return {
      valid: false,
      error: 'Email address must contain an @ symbol',
    };
  }

  if (atCount > 1) {
    return {
      valid: false,
      error: 'Email address must contain exactly one @ symbol',
    };
  }

  // Split into local and domain parts
  const [localPart, domain] = trimmedEmail.split('@');

  // Validate local part
  const localValidation = validateLocalPart(localPart);
  if (!localValidation.valid) {
    return localValidation;
  }

  // Validate domain
  const domainValidation = validateDomain(domain);
  if (!domainValidation.valid) {
    return domainValidation;
  }

  // Check RFC 5322 format
  if (!RFC5322_EMAIL_REGEX.test(trimmedEmail) && !IDN_EMAIL_REGEX.test(trimmedEmail)) {
    return {
      valid: false,
      error: 'Email address format is invalid',
    };
  }

  return {
    valid: true,
  };
}

/**
 * Validate local part of email (before @)
 * 
 * @param localPart Local part to validate
 * @returns Validation result
 */
function validateLocalPart(localPart: string): EmailValidationResult {
  // Check if local part is provided
  if (!localPart || localPart.length === 0) {
    return {
      valid: false,
      error: 'Email address must have a local part (before @)',
    };
  }

  // Check local part length
  if (localPart.length > MAX_LOCAL_PART_LENGTH) {
    return {
      valid: false,
      error: `Email local part is too long (maximum ${MAX_LOCAL_PART_LENGTH} characters)`,
    };
  }

  // Check for leading/trailing dots
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return {
      valid: false,
      error: 'Email local part cannot start or end with a dot',
    };
  }

  // Check for consecutive dots
  if (localPart.includes('..')) {
    return {
      valid: false,
      error: 'Email local part cannot contain consecutive dots',
    };
  }

  // Check for invalid characters
  const validLocalChars = /^[a-zA-Z0-9._+\-]+$/;
  if (!validLocalChars.test(localPart)) {
    return {
      valid: false,
      error: 'Email local part contains invalid characters (allowed: alphanumeric, dots, hyphens, underscores, plus signs)',
    };
  }

  return {
    valid: true,
  };
}

/**
 * Validate domain part of email (after @)
 * 
 * @param domain Domain to validate
 * @returns Validation result
 */
function validateDomain(domain: string): EmailValidationResult {
  // Check if domain is provided
  if (!domain || domain.length === 0) {
    return {
      valid: false,
      error: 'Email address must have a domain (after @)',
    };
  }

  // Check domain length
  if (domain.length > MAX_DOMAIN_LENGTH) {
    return {
      valid: false,
      error: `Email domain is too long (maximum ${MAX_DOMAIN_LENGTH} characters)`,
    };
  }

  // Check for at least one dot
  if (!domain.includes('.')) {
    return {
      valid: false,
      error: 'Email domain must contain at least one dot (e.g., example.com)',
    };
  }

  // Check for leading/trailing dots
  if (domain.startsWith('.') || domain.endsWith('.')) {
    return {
      valid: false,
      error: 'Email domain cannot start or end with a dot',
    };
  }

  // Check for leading/trailing hyphens
  if (domain.startsWith('-') || domain.endsWith('-')) {
    return {
      valid: false,
      error: 'Email domain cannot start or end with a hyphen',
    };
  }

  // Check for consecutive dots
  if (domain.includes('..')) {
    return {
      valid: false,
      error: 'Email domain cannot contain consecutive dots',
    };
  }

  // Split domain into labels
  const labels = domain.split('.');

  // Check each label
  for (const label of labels) {
    if (label.length === 0) {
      return {
        valid: false,
        error: 'Email domain contains empty labels',
      };
    }

    if (label.length > 63) {
      return {
        valid: false,
        error: 'Email domain label is too long (maximum 63 characters per label)',
      };
    }

    // Check for leading/trailing hyphens in label
    if (label.startsWith('-') || label.endsWith('-')) {
      return {
        valid: false,
        error: 'Email domain labels cannot start or end with hyphens',
      };
    }

    // Check for invalid characters in label
    const validLabelChars = /^[a-zA-Z0-9\-\u0080-\uFFFF]+$/u;
    if (!validLabelChars.test(label)) {
      return {
        valid: false,
        error: 'Email domain contains invalid characters',
      };
    }
  }

  // Check TLD (last label)
  const tld = labels[labels.length - 1];
  if (tld.length < 2) {
    return {
      valid: false,
      error: 'Email domain TLD must be at least 2 characters',
    };
  }

  // TLD should not be all numeric
  if (/^\d+$/.test(tld)) {
    return {
      valid: false,
      error: 'Email domain TLD cannot be all numeric',
    };
  }

  return {
    valid: true,
  };
}

// ============================================================================
// SIMPLE VALIDATION
// ============================================================================

/**
 * Simple boolean check for email validity
 * Returns true if email is valid, false otherwise
 * 
 * @param email Email address to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const result = validateEmail(email);
  return result.valid;
}

// ============================================================================
// EMAIL NORMALIZATION
// ============================================================================

/**
 * Normalize email address
 * - Trim whitespace
 * - Convert to lowercase
 * - Remove leading/trailing spaces
 * 
 * Note: Does NOT validate the email format
 * Use validateEmail() to validate before normalizing
 * 
 * @param email Email address to normalize
 * @returns Normalized email address
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }

  return email.trim().toLowerCase();
}

// ============================================================================
// DOMAIN EXTRACTION
// ============================================================================

/**
 * Extract domain from email address
 * 
 * Examples:
 * - "user@example.com" → "example.com"
 * - "john.doe@company.co.uk" → "company.co.uk"
 * - "invalid-email" → null
 * 
 * @param email Email address
 * @returns Domain name or null if email is invalid
 */
export function getEmailDomain(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const trimmedEmail = email.trim();

  // Check for @ symbol - must have exactly one
  const atCount = (trimmedEmail.match(/@/g) || []).length;
  if (atCount !== 1) {
    return null;
  }

  // Split and extract domain
  const parts = trimmedEmail.split('@');
  if (parts.length !== 2) {
    return null;
  }

  const [localPart, domain] = parts;

  // Validate local part is not empty
  if (!localPart || localPart.length === 0) {
    return null;
  }

  // Validate domain is not empty
  if (!domain || domain.length === 0) {
    return null;
  }

  return domain.toLowerCase();
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Validate multiple email addresses
 * 
 * @param emails Array of email addresses to validate
 * @returns Array of validation results
 */
export function validateEmails(emails: string[]): EmailValidationResult[] {
  return emails.map(validateEmail);
}

/**
 * Check if all emails in array are valid
 * 
 * @param emails Array of email addresses to validate
 * @returns true if all emails are valid, false otherwise
 */
export function areAllEmailsValid(emails: string[]): boolean {
  return emails.every(isValidEmail);
}

/**
 * Normalize multiple email addresses
 * 
 * @param emails Array of email addresses to normalize
 * @returns Array of normalized email addresses
 */
export function normalizeEmails(emails: string[]): string[] {
  return emails.map(normalizeEmail);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  validateEmail,
  isValidEmail,
  normalizeEmail,
  getEmailDomain,
  validateEmails,
  areAllEmailsValid,
  normalizeEmails,
};
