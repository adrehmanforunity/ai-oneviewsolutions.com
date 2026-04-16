# Encryption Service

Provides AES-256-GCM encryption/decryption for API keys in the AI Provider Management system.

## Overview

The encryption service implements authenticated encryption using AES-256-GCM (Galois/Counter Mode), which provides both confidentiality and authenticity guarantees. This ensures that API keys are:

- **Encrypted at rest** in the database
- **Authenticated** to detect tampering
- **Unique** for each encryption (random IV)
- **Secure** against known cryptographic attacks

## Security Features

### AES-256-GCM

- **Algorithm**: AES-256-GCM (Advanced Encryption Standard with 256-bit key)
- **Mode**: GCM (Galois/Counter Mode) for authenticated encryption
- **Key Size**: 256 bits (32 bytes)
- **IV Size**: 128 bits (16 bytes) - randomly generated for each encryption
- **Authentication Tag**: 128 bits (16 bytes) - ensures data integrity

### Master Key Management

- Master key is loaded from `ENCRYPTION_MASTER_KEY` environment variable
- Must be a base64-encoded 32-byte (256-bit) key
- Cached in memory after first load for performance
- Never logged or exposed in error messages

### Data Format

Encrypted data is stored as: `base64(IV + authTag + ciphertext)`

- **IV** (16 bytes): Random initialization vector
- **authTag** (16 bytes): Authentication tag for integrity verification
- **ciphertext**: Encrypted API key

This format allows decryption without storing IV separately.

## API Reference

### Core Functions

#### `encryptApiKey(plaintext: string): string`

Encrypts an API key using AES-256-GCM.

**Parameters:**
- `plaintext` (string): API key to encrypt

**Returns:**
- Base64-encoded encrypted data (IV + authTag + ciphertext)

**Throws:**
- Error if plaintext is empty or not a string
- Error if master key is not configured

**Example:**
```typescript
const encrypted = encryptApiKey('sk_test_123456789');
// Returns: "base64encodedstring..."
```

#### `decryptApiKey(encrypted: string): string`

Decrypts an API key using AES-256-GCM.

**Parameters:**
- `encrypted` (string): Base64-encoded encrypted data

**Returns:**
- Decrypted plaintext API key

**Throws:**
- Error if encrypted data is invalid or corrupted
- Error if authentication tag verification fails (wrong key or tampered data)
- Error if master key is not configured

**Example:**
```typescript
const plaintext = decryptApiKey(encrypted);
// Returns: "sk_test_123456789"
```

#### `maskApiKey(apiKey: string): string`

Masks an API key to show only the last 4 characters.

**Parameters:**
- `apiKey` (string): Full API key

**Returns:**
- Masked key in format "prefix_...XXXX" (e.g., "gsk_...a3b9")

**Example:**
```typescript
const masked = maskApiKey('gsk_test_abcdefghijklmnop');
// Returns: "gsk_...mnop"
```

### Master Key Management

#### `loadMasterKey(): Buffer`

Loads the master key from the `ENCRYPTION_MASTER_KEY` environment variable.

**Returns:**
- Master key as Buffer (32 bytes)

**Throws:**
- Error if environment variable is not set
- Error if key is not valid base64
- Error if key is not exactly 32 bytes

**Example:**
```typescript
const masterKey = loadMasterKey();
```

#### `generateMasterKey(): string`

Generates a new master key for setup or testing.

**Returns:**
- Base64-encoded master key (32 bytes / 256 bits)

**Example:**
```typescript
const newKey = generateMasterKey();
// Returns: "base64encodedstring..."
// Set as: process.env.ENCRYPTION_MASTER_KEY = newKey
```

#### `clearMasterKeyCache(): void`

Clears the cached master key. Useful for testing.

**Example:**
```typescript
clearMasterKeyCache();
```

### Utility Functions

#### `isValidEncryptedFormat(encrypted: string): boolean`

Validates that encrypted data is in the correct format.

**Parameters:**
- `encrypted` (string): Base64-encoded encrypted data

**Returns:**
- true if valid format, false otherwise

**Example:**
```typescript
if (isValidEncryptedFormat(data)) {
  const plaintext = decryptApiKey(data);
}
```

#### `testEncryptionRoundTrip(testData?: string): boolean`

Tests encryption/decryption round-trip.

**Parameters:**
- `testData` (string, optional): Data to test (default: 'test-key-12345')

**Returns:**
- true if round-trip succeeds, false otherwise

**Example:**
```typescript
if (testEncryptionRoundTrip()) {
  console.log('Encryption service is working correctly');
}
```

#### `getEncryptionErrorMessage(error: unknown): string`

Parses encryption error and returns user-friendly message.

**Parameters:**
- `error` (unknown): Error object

**Returns:**
- User-friendly error message

**Example:**
```typescript
try {
  decryptApiKey(corrupted);
} catch (error) {
  const message = getEncryptionErrorMessage(error);
  console.log(message);
}
```

## Setup

### 1. Generate Master Key

Generate a new master key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Set Environment Variable

Set the `ENCRYPTION_MASTER_KEY` environment variable:

```bash
# .env.local
ENCRYPTION_MASTER_KEY=your-base64-encoded-key-here
```

### 3. Verify Setup

Test the encryption service:

```typescript
import { testEncryptionRoundTrip } from '@/lib/encryption';

if (testEncryptionRoundTrip()) {
  console.log('✓ Encryption service is ready');
} else {
  console.error('✗ Encryption service failed');
}
```

## Usage Examples

### Encrypting an API Key

```typescript
import { encryptApiKey } from '@/lib/encryption';

const apiKey = 'sk_test_123456789';
const encrypted = encryptApiKey(apiKey);

// Store encrypted in database
await db.query(
  'INSERT INTO api_keys (key_value_encrypted) VALUES ($1)',
  [encrypted]
);
```

### Decrypting an API Key

```typescript
import { decryptApiKey } from '@/lib/encryption';

// Retrieve encrypted from database
const result = await db.query(
  'SELECT key_value_encrypted FROM api_keys WHERE id = $1',
  [keyId]
);

const encrypted = result.rows[0].key_value_encrypted;
const plaintext = decryptApiKey(encrypted);

// Use plaintext to make API request
```

### Masking API Keys in UI

```typescript
import { maskApiKey } from '@/lib/encryption';

const apiKey = 'gsk_test_abcdefghijklmnop';
const masked = maskApiKey(apiKey);

// Display in UI: "gsk_...mnop"
console.log(masked);
```

### Error Handling

```typescript
import { decryptApiKey, getEncryptionErrorMessage } from '@/lib/encryption';

try {
  const plaintext = decryptApiKey(encrypted);
} catch (error) {
  const message = getEncryptionErrorMessage(error);
  console.error('Decryption failed:', message);
  
  // Return user-friendly error
  return {
    success: false,
    error: message
  };
}
```

## Security Considerations

### Master Key Protection

- **Never commit** the master key to version control
- **Use environment variables** to manage the key
- **Rotate the key** periodically (requires re-encryption of all keys)
- **Restrict access** to the environment variable

### API Key Handling

- **Never log** plaintext API keys
- **Always mask** API keys in UI (show only last 4 characters)
- **Validate** API keys before storing
- **Encrypt** API keys before storing in database

### Error Messages

- **Never include** key material in error messages
- **Use generic messages** for authentication failures
- **Log detailed errors** only in secure logs

## Testing

### Unit Tests

Run unit tests:

```bash
npm run test:run -- lib/encryption/index.test.ts
```

Tests cover:
- Master key management
- Encryption/decryption
- Key masking
- Format validation
- Error handling
- Edge cases

### Property-Based Tests

Run property-based tests:

```bash
npm run test:run -- lib/encryption/encryption-roundtrip.test.ts
```

Tests verify:
- Round-trip encryption/decryption preserves plaintext
- Different ciphertexts for same plaintext (random IV)
- Consistent decryption of same ciphertext
- Character preservation (special chars, unicode, etc.)
- All valid key lengths (1 to 10000 characters)

## Performance

### Encryption

- **Time**: ~1-2ms per key (depends on key length)
- **Memory**: ~1KB per operation
- **IV Generation**: Uses cryptographically secure random

### Decryption

- **Time**: ~1-2ms per key (depends on key length)
- **Memory**: ~1KB per operation
- **Authentication**: Verified during decryption

### Caching

- Master key is cached after first load
- Subsequent operations use cached key
- Cache can be cleared with `clearMasterKeyCache()`

## Troubleshooting

### "ENCRYPTION_MASTER_KEY environment variable is not set"

**Solution**: Set the environment variable:

```bash
export ENCRYPTION_MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
```

### "ENCRYPTION_MASTER_KEY must be exactly 32 bytes"

**Solution**: Generate a new key with correct length:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### "Authentication tag verification failed"

**Causes:**
- Encrypted data is corrupted
- Encrypted data was encrypted with a different master key
- Encrypted data was tampered with

**Solution**: 
- Verify the master key is correct
- Check that encrypted data is not corrupted
- Re-encrypt the data with the current master key

### "Encrypted data is too short or corrupted"

**Causes:**
- Encrypted data is truncated
- Encrypted data is not valid base64
- Encrypted data is from a different encryption system

**Solution**:
- Verify the encrypted data is complete
- Check that it's base64-encoded
- Re-encrypt the data with the current encryption service

## References

- [AES-256-GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)

## License

Part of the AI Provider Management system. See main LICENSE file.
