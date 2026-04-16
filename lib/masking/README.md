# Masking Utility Module

Provides functions to mask sensitive data (API keys, emails, etc.) for safe display in UI and API responses.

## Overview

The masking utility ensures that sensitive information is never fully exposed in:
- API responses
- UI displays
- Logs and audit trails
- Error messages

All masking functions follow the principle of showing only the last N characters for identification purposes while hiding the rest.

## Functions

### `maskApiKey(apiKey: string): string`

Masks an API key to show only the last 4 characters with the prefix.

**Format:** `prefix_...XXXX` where XXXX are the last 4 characters

**Examples:**
```typescript
maskApiKey('gsk_abc123def456ghi789')  // → 'gsk_...789'
maskApiKey('sk-proj-abc123def456')    // → 'sk-proj_...456'
maskApiKey('abc123def456')            // → '...456'
maskApiKey('abc')                     // → '****'
```

**Parameters:**
- `apiKey` (string): Full API key to mask

**Returns:** Masked key string

**Edge Cases:**
- Empty string or null → `'****'`
- Key shorter than 4 characters → `'****'`
- Key without prefix → `'...XXXX'`

---

### `maskEmail(email: string): string`

Masks an email address to show only the domain and first character of local part.

**Format:** `a***@example.com`

**Examples:**
```typescript
maskEmail('john.doe@example.com')     // → 'j***@example.com'
maskEmail('admin@company.co.uk')      // → 'a***@company.co.uk'
maskEmail('user+tag@domain.com')      // → 'u***@domain.com'
maskEmail('invalid-email')            // → '***@***'
```

**Parameters:**
- `email` (string): Full email address to mask

**Returns:** Masked email string

**Edge Cases:**
- Empty string or null → `'***@***'`
- Invalid email format (no @) → `'***@***'`
- Empty local or domain part → `'***@***'`

---

### `maskSensitiveData(data: string, visibleChars?: number): string`

Generic function to mask any sensitive data. Shows only the last N characters, masks the rest with asterisks.

**Format:** `****XXXX` where XXXX are the last N characters

**Examples:**
```typescript
maskSensitiveData('secret123456', 4)   // → '****3456'
maskSensitiveData('password', 2)       // → '******rd'
maskSensitiveData('token', 0)          // → '*****'
maskSensitiveData('abc', 10)           // → 'abc'
```

**Parameters:**
- `data` (string): Sensitive data to mask
- `visibleChars` (number, optional): Number of characters to show at the end (default: 4)

**Returns:** Masked data string

**Edge Cases:**
- Empty string or null → `'****'`
- `visibleChars` < 0 → treated as 0 (mask everything)
- `visibleChars` > data length → show all characters
- Data shorter than 4 characters → `'****'`

---

### `isMasked(value: string): boolean`

Checks if a value is already masked. Detects common masking patterns.

**Patterns Detected:**
- `prefix_...XXXX` (e.g., `'gsk_...a3b9'`)
- `...XXXX` (e.g., `'...a3b9'`)
- `****XXXX` (e.g., `'****3456'`)
- `a***@domain` (e.g., `'j***@example.com'`)

**Examples:**
```typescript
isMasked('gsk_...a3b9')           // → true
isMasked('...a3b9')               // → true
isMasked('****3456')              // → true
isMasked('j***@example.com')      // → true
isMasked('gsk_abc123def456')      // → false
isMasked('john.doe@example.com')  // → false
```

**Parameters:**
- `value` (string): Value to check

**Returns:** `true` if value appears to be masked, `false` otherwise

---

### `maskApiKeys(apiKeys: string[]): string[]`

Masks multiple API keys at once.

**Examples:**
```typescript
maskApiKeys(['gsk_abc123', 'sk-proj-def456'])
// → ['gsk_...123', 'sk-proj_...456']
```

**Parameters:**
- `apiKeys` (string[]): Array of API keys to mask

**Returns:** Array of masked keys

---

### `maskEmails(emails: string[]): string[]`

Masks multiple emails at once.

**Examples:**
```typescript
maskEmails(['john@example.com', 'admin@company.org'])
// → ['j***@example.com', 'a***@company.org']
```

**Parameters:**
- `emails` (string[]): Array of emails to mask

**Returns:** Array of masked emails

---

## Usage Examples

### In API Responses

```typescript
import { maskApiKey } from '@/lib/masking';

// When returning API key information
const apiKeyResponse = {
  id: 'key-123',
  maskedKey: maskApiKey(decryptedKey),  // Never expose full key
  email: 'user@example.com',
  active: true,
};
```

### In UI Display

```typescript
import { maskApiKey, maskEmail } from '@/lib/masking';

// Display in Key Manager
<div>
  <span>Key: {maskApiKey(apiKey)}</span>
  <span>Email: {maskEmail(email)}</span>
</div>
```

### In Logs

```typescript
import { maskApiKey } from '@/lib/masking';

// Log key operations without exposing full key
logger.info('Key tested', {
  keyId: key.id,
  maskedKey: maskApiKey(key.value),  // Safe to log
  status: 'valid',
});
```

### Detecting Already-Masked Values

```typescript
import { isMasked, maskApiKey } from '@/lib/masking';

const value = 'gsk_...a3b9';
if (!isMasked(value)) {
  const masked = maskApiKey(value);
}
```

---

## Security Considerations

1. **Never Log Full Keys**: Always use masking functions before logging
2. **API Responses**: Always mask keys in API responses
3. **UI Display**: Always mask keys in UI components
4. **Database**: Store encrypted keys, mask when retrieving
5. **Error Messages**: Never include full keys in error messages

---

## Testing

The module includes comprehensive unit tests covering:
- Valid inputs with various formats
- Edge cases (empty, null, invalid)
- Masking verification (ensuring full values are not exposed)
- Batch operations
- Integration scenarios

Run tests:
```bash
npm run test lib/masking/index.test.ts
```

---

## Requirements

This module implements the following requirements:
- **Requirement 1.4**: Mask API keys to show only last 4 characters
- **Requirement 8.2**: Ensure full key is never exposed in API responses
- **Requirement 2.1**: Mask email addresses for display

---

## Related Modules

- `lib/encryption/index.ts` - Encryption/decryption of API keys
- `lib/db/index.ts` - Database operations with tenant isolation
