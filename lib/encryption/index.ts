/**
 * Encryption Service
 * Provides AES-256-GCM encryption/decryption for API keys
 * 
 * Security Features:
 * - AES-256-GCM for authenticated encryption (confidentiality + authenticity)
 * - Random IV (initialization vector) for each encryption
 * - Authentication tag ensures data integrity
 * - Master key loaded from environment variables
 * - Secure error handling (no key material in error messages)
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Result of encryption operation
 * Contains IV, authentication tag, and ciphertext
 */
export interface EncryptionResult {
  iv: string;  // Base64 encoded
  authTag: string;  // Base64 encoded
  ciphertext: string;  // Base64 encoded
}

/**
 * Decryption result
 */
export interface DecryptionResult {
  plaintext: string;
}

/**
 * Encryption error details
 */
export interface EncryptionError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;  // 128 bits
const AUTH_TAG_LENGTH = 16;  // 128 bits
const SALT_LENGTH = 16;  // 128 bits for key derivation
const KEY_LENGTH = 32;  // 256 bits for AES-256
const ENCODING = 'base64';

// ============================================================================
// MASTER KEY MANAGEMENT
// ============================================================================

let cachedMasterKey: Buffer | null = null;

/**
 * Load master key from environment variable
 * The master key should be a base64-encoded 32-byte (256-bit) key
 * 
 * @returns Master key as Buffer
 * @throws Error if ENCRYPTION_MASTER_KEY is not set or invalid
 */
export function loadMasterKey(): Buffer {
  // Return cached key if available
  if (cachedMasterKey) {
    return cachedMasterKey;
  }

  // Support both prefixed (Vercel: aidemo_ENCRYPTION_MASTER_KEY) and plain names
  const masterKeyEnv = process.env.aidemo_ENCRYPTION_MASTER_KEY || process.env.ENCRYPTION_MASTER_KEY;
  if (!masterKeyEnv) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY environment variable is not set. ' +
      'Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }

  try {
    const masterKey = Buffer.from(masterKeyEnv, 'base64');
    
    if (masterKey.length !== KEY_LENGTH) {
      throw new Error(
        `ENCRYPTION_MASTER_KEY must be exactly ${KEY_LENGTH} bytes (256 bits). ` +
        `Got ${masterKey.length} bytes. ` +
        `Generate a new key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"`
      );
    }

    cachedMasterKey = masterKey;
    return masterKey;
  } catch (error) {
    if (error instanceof Error && error.message.includes('must be exactly')) {
      throw error;
    }
    throw new Error(
      'ENCRYPTION_MASTER_KEY must be a valid base64-encoded string. ' +
      'Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
}

/**
 * Generate a new master key for setup/testing
 * 
 * @returns Base64-encoded master key (32 bytes / 256 bits)
 */
export function generateMasterKey(): string {
  const key = randomBytes(KEY_LENGTH);
  return key.toString('base64');
}

/**
 * Clear cached master key (useful for testing)
 */
export function clearMasterKeyCache(): void {
  cachedMasterKey = null;
}

// ============================================================================
// ENCRYPTION FUNCTIONS
// ============================================================================

/**
 * Encrypt an API key using AES-256-GCM
 * 
 * Process:
 * 1. Generate random IV (16 bytes)
 * 2. Create cipher with master key and IV
 * 3. Encrypt plaintext
 * 4. Get authentication tag
 * 5. Return base64(IV + authTag + ciphertext)
 * 
 * @param plaintext API key to encrypt
 * @returns Base64-encoded encrypted data (IV + authTag + ciphertext)
 * @throws Error if encryption fails
 */
export function encryptApiKey(plaintext: string): string {
  try {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Plaintext must be a non-empty string');
    }

    const masterKey = loadMasterKey();
    const iv = randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, masterKey, iv);

    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'binary');
    encrypted += cipher.final('binary');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine IV + authTag + ciphertext and encode as base64
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'binary')]);
    return combined.toString(ENCODING);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENCRYPTION_MASTER_KEY')) {
      throw error;
    }
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decrypt an API key using AES-256-GCM
 * 
 * Process:
 * 1. Decode base64 input
 * 2. Extract IV (first 16 bytes)
 * 3. Extract authTag (next 16 bytes)
 * 4. Extract ciphertext (remaining bytes)
 * 5. Create decipher with master key and IV
 * 6. Set authentication tag
 * 7. Decrypt ciphertext
 * 
 * @param encrypted Base64-encoded encrypted data (IV + authTag + ciphertext)
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong key, corrupted data, etc.)
 */
export function decryptApiKey(encrypted: string): string {
  try {
    if (!encrypted || typeof encrypted !== 'string') {
      throw new Error('Encrypted data must be a non-empty string');
    }

    const masterKey = loadMasterKey();

    // Decode base64
    const combined = Buffer.from(encrypted, ENCODING);

    // Validate length (IV + authTag + at least 1 byte of ciphertext)
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      throw new Error('Encrypted data is too short or corrupted');
    }

    // Extract components
    const iv = combined.slice(0, IV_LENGTH);
    const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    let decrypted = decipher.update(ciphertext, 'binary', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    if (error instanceof Error) {
      // Provide specific error messages for common failure modes
      if (error.message.includes('Unsupported state or unable to authenticate data')) {
        throw new Error(
          'Decryption failed: Authentication tag verification failed. ' +
          'This usually means the encrypted data is corrupted or was encrypted with a different key.'
        );
      }
      if (error.message.includes('ENCRYPTION_MASTER_KEY')) {
        throw error;
      }
      if (error.message.includes('too short or corrupted')) {
        throw error;
      }
    }
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Mask an API key to show only the last 4 characters
 * Format: "prefix_...XXXX" where XXXX are the last 4 characters
 * 
 * @param apiKey Full API key
 * @returns Masked key (e.g., "gsk_...a3b9")
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || typeof apiKey !== 'string') {
    return '****';
  }

  if (apiKey.length < 4) {
    return '****';
  }

  // Extract last 4 characters
  const lastFour = apiKey.slice(-4);

  // Try to extract prefix (before first underscore or dash)
  const prefixMatch = apiKey.match(/^[a-zA-Z0-9]+[_-]/);
  const prefix = prefixMatch ? prefixMatch[0].slice(0, -1) : '';

  if (prefix) {
    return `${prefix}_...${lastFour}`;
  }

  return `...${lastFour}`;
}

/**
 * Validate that encrypted data is in the correct format
 * 
 * @param encrypted Base64-encoded encrypted data
 * @returns true if valid format, false otherwise
 */
export function isValidEncryptedFormat(encrypted: string): boolean {
  try {
    if (!encrypted || typeof encrypted !== 'string') {
      return false;
    }

    const combined = Buffer.from(encrypted, ENCODING);
    return combined.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

/**
 * Test encryption/decryption round-trip
 * Useful for verifying the encryption service is working correctly
 * 
 * @param testData Data to encrypt and decrypt
 * @returns true if round-trip succeeds, false otherwise
 */
export function testEncryptionRoundTrip(testData: string = 'test-key-12345'): boolean {
  try {
    const encrypted = encryptApiKey(testData);
    const decrypted = decryptApiKey(encrypted);
    return decrypted === testData;
  } catch {
    return false;
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Parse encryption error and return user-friendly message
 * 
 * @param error Error object
 * @returns User-friendly error message
 */
export function getEncryptionErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('ENCRYPTION_MASTER_KEY')) {
      return 'Encryption service is not properly configured. Please contact support.';
    }
    if (error.message.includes('Authentication tag verification failed')) {
      return 'Failed to decrypt key. The key may be corrupted or encrypted with a different master key.';
    }
    if (error.message.includes('too short or corrupted')) {
      return 'Encrypted data is corrupted or invalid.';
    }
    return error.message;
  }
  return 'Unknown encryption error';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  encryptApiKey,
  decryptApiKey,
  maskApiKey,
  loadMasterKey,
  generateMasterKey,
  clearMasterKeyCache,
  isValidEncryptedFormat,
  testEncryptionRoundTrip,
  getEncryptionErrorMessage,
};
