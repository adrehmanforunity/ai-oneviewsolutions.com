/**
 * Masking Utility Module
 * Provides functions to mask sensitive data (API keys, emails, etc.)
 * for safe display in UI and API responses
 * 
 * Security Features:
 * - Never expose full sensitive values
 * - Show only last N characters for identification
 * - Support for multiple data types (keys, emails, generic data)
 * - Detection of already-masked values
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Masking options for generic masking function
 */
export interface MaskingOptions {
  visibleChars?: number;  // Number of characters to show at the end (default: 4)
  prefix?: string;  // Optional prefix to prepend (e.g., "gsk_")
  separator?: string;  // Separator between prefix and masked part (default: "...")
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_VISIBLE_CHARS = 4;
const DEFAULT_SEPARATOR = '...';
const MASKED_PATTERN = /^[a-zA-Z0-9_-]*\.\.\.[a-zA-Z0-9_-]{1,}$/;  // Pattern for already-masked values

// ============================================================================
// API KEY MASKING
// ============================================================================

/**
 * Mask an API key to show only the last 4 characters
 * Format: "prefix_...XXXX" where XXXX are the last 4 characters
 * 
 * Examples:
 * - "gsk_abc123def456" → "gsk_...456"
 * - "sk-proj-abc123def456" → "sk-proj_...456"
 * - "abc123def456" → "...456"
 * 
 * @param apiKey Full API key
 * @returns Masked key (e.g., "gsk_...a3b9")
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || typeof apiKey !== 'string') {
    return '****';
  }

  if (apiKey.length < DEFAULT_VISIBLE_CHARS) {
    return '****';
  }

  // Extract last 4 characters
  const lastFour = apiKey.slice(-DEFAULT_VISIBLE_CHARS);

  // Try to extract prefix (before first underscore or dash)
  const prefixMatch = apiKey.match(/^[a-zA-Z0-9]+[_-]/);
  const prefix = prefixMatch ? prefixMatch[0].slice(0, -1) : '';

  if (prefix) {
    return `${prefix}_${DEFAULT_SEPARATOR}${lastFour}`;
  }

  return `${DEFAULT_SEPARATOR}${lastFour}`;
}

// ============================================================================
// EMAIL MASKING
// ============================================================================

/**
 * Mask an email address to show only domain and first character
 * Format: "a***@example.com"
 * 
 * Examples:
 * - "john.doe@example.com" → "j***@example.com"
 * - "admin@company.co.uk" → "a***@company.co.uk"
 * - "user+tag@domain.com" → "u***@domain.com"
 * 
 * @param email Full email address
 * @returns Masked email (e.g., "j***@example.com")
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '***@***';
  }

  // Split email into local and domain parts
  const parts = email.split('@');
  if (parts.length !== 2) {
    return '***@***';
  }

  const [localPart, domain] = parts;

  if (!localPart || localPart.length === 0 || !domain) {
    return '***@***';
  }

  // Show first character of local part, mask the rest with exactly 3 asterisks
  const firstChar = localPart[0];
  const maskedLocal = `${firstChar}***`;

  return `${maskedLocal}@${domain}`;
}

// ============================================================================
// GENERIC SENSITIVE DATA MASKING
// ============================================================================

/**
 * Generic function to mask any sensitive data
 * Shows only the last N characters, masks the rest with asterisks
 * 
 * Examples:
 * - maskSensitiveData("secret123456", 4) → "****3456"
 * - maskSensitiveData("password", 2) → "******rd"
 * - maskSensitiveData("token", 0) → "*****"
 * 
 * @param data Sensitive data to mask
 * @param visibleChars Number of characters to show at the end (default: 4)
 * @returns Masked data
 */
export function maskSensitiveData(data: string, visibleChars: number = DEFAULT_VISIBLE_CHARS): string {
  if (!data || typeof data !== 'string') {
    return '****';
  }

  // Validate visibleChars parameter
  if (visibleChars < 0) {
    visibleChars = 0;
  }
  if (visibleChars > data.length) {
    visibleChars = data.length;
  }

  // If visibleChars is 0, mask everything with minimum 4 asterisks
  if (visibleChars === 0) {
    return '*'.repeat(Math.max(4, data.length));
  }

  // If visibleChars >= data.length, show all
  if (visibleChars >= data.length) {
    return data;
  }

  // Extract visible characters from the end
  const visiblePart = data.slice(-visibleChars);
  const maskedLength = Math.max(4, data.length - visibleChars);
  const maskedPart = '*'.repeat(maskedLength);

  return `${maskedPart}${visiblePart}`;
}

// ============================================================================
// MASKING DETECTION
// ============================================================================

/**
 * Check if a value is already masked
 * Detects common masking patterns like "prefix_...XXXX" or "****XXXX"
 * 
 * Examples:
 * - isMasked("gsk_...a3b9") → true
 * - isMasked("...a3b9") → true
 * - isMasked("****3456") → true
 * - isMasked("gsk_abc123def456") → false
 * 
 * @param value Value to check
 * @returns true if value appears to be masked, false otherwise
 */
export function isMasked(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Check for common masking patterns
  // Pattern 1: "prefix_...XXXX" (e.g., "gsk_...a3b9")
  if (MASKED_PATTERN.test(value)) {
    return true;
  }

  // Pattern 2: "****XXXX" (all asterisks followed by visible chars)
  if (/^\*{4,}[a-zA-Z0-9_-]{1,}$/.test(value)) {
    return true;
  }

  // Pattern 3: "...XXXX" (ellipsis followed by visible chars)
  if (/^\.\.\.[a-zA-Z0-9_-]{1,}$/.test(value)) {
    return true;
  }

  // Pattern 4: "a***@domain" (email masking pattern)
  if (/^[a-zA-Z0-9]\*{3}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
    return true;
  }

  return false;
}

// ============================================================================
// BATCH MASKING UTILITIES
// ============================================================================

/**
 * Mask multiple API keys at once
 * 
 * @param apiKeys Array of API keys to mask
 * @returns Array of masked keys
 */
export function maskApiKeys(apiKeys: string[]): string[] {
  return apiKeys.map(maskApiKey);
}

/**
 * Mask multiple emails at once
 * 
 * @param emails Array of emails to mask
 * @returns Array of masked emails
 */
export function maskEmails(emails: string[]): string[] {
  return emails.map(maskEmail);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  maskApiKey,
  maskEmail,
  maskSensitiveData,
  isMasked,
  maskApiKeys,
  maskEmails,
};
