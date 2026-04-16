# Email Validation Service

Provides RFC 5322 compliant email validation with descriptive error messages, normalization, and domain extraction.

## Features

- **RFC 5322 Compliant**: Validates email format according to RFC 5322 standard
- **Descriptive Error Messages**: Returns specific error messages for invalid emails
- **Email Normalization**: Converts emails to lowercase and trims whitespace
- **Domain Extraction**: Extracts domain from email addresses
- **Edge Case Handling**: Handles very long emails, unicode, and special characters
- **Batch Operations**: Validate, normalize, or extract domains from multiple emails

## API

### `validateEmail(email: string): EmailValidationResult`

Validates email format according to RFC 5322 standard.

**Returns**: `{ valid: boolean; error?: string }`

**Examples**:
```typescript
import { validateEmail } from '@/lib/email-validation';

// Valid email
validateEmail('user@example.com');
// { valid: true }

// Invalid email
validateEmail('invalid-email');
// { valid: false, error: 'Email address must contain an @ symbol' }

// Invalid format
validateEmail('user@');
// { valid: false, error: 'Email address must have a domain (after @)' }
```

**Validation Rules**:
- Email length: 5-254 characters
- Local part (before @): max 64 characters
- Domain: max 255 characters
- Local part characters: alphanumeric, dots, hyphens, underscores, plus signs
- Domain characters: alphanumeric, dots, hyphens
- TLD: at least 2 characters, not all numeric
- No consecutive dots
- No leading/trailing dots in local part or domain
- No leading/trailing hyphens in domain

### `isValidEmail(email: string): boolean`

Simple boolean check for email validity.

**Returns**: `boolean`

**Examples**:
```typescript
import { isValidEmail } from '@/lib/email-validation';

isValidEmail('user@example.com');  // true
isValidEmail('invalid');           // false
```

### `normalizeEmail(email: string): string`

Normalize email address (lowercase, trim whitespace).

**Returns**: `string`

**Examples**:
```typescript
import { normalizeEmail } from '@/lib/email-validation';

normalizeEmail('  User@Example.COM  ');  // 'user@example.com'
normalizeEmail('\tJOHN@COMPANY.ORG\t');  // 'john@company.org'
```

**Note**: Does NOT validate the email format. Use `validateEmail()` to validate before normalizing.

### `getEmailDomain(email: string): string | null`

Extract domain from email address.

**Returns**: `string | null`

**Examples**:
```typescript
import { getEmailDomain } from '@/lib/email-validation';

getEmailDomain('user@example.com');           // 'example.com'
getEmailDomain('john@mail.company.org');      // 'mail.company.org'
getEmailDomain('invalid-email');              // null
```

### Batch Operations

#### `validateEmails(emails: string[]): EmailValidationResult[]`

Validate multiple email addresses.

```typescript
import { validateEmails } from '@/lib/email-validation';

const results = validateEmails([
  'user@example.com',
  'invalid',
  'john@company.org'
]);
// [
//   { valid: true },
//   { valid: false, error: '...' },
//   { valid: true }
// ]
```

#### `areAllEmailsValid(emails: string[]): boolean`

Check if all emails in array are valid.

```typescript
import { areAllEmailsValid } from '@/lib/email-validation';

areAllEmailsValid(['user@example.com', 'john@company.org']);  // true
areAllEmailsValid(['user@example.com', 'invalid']);           // false
```

#### `normalizeEmails(emails: string[]): string[]`

Normalize multiple email addresses.

```typescript
import { normalizeEmails } from '@/lib/email-validation';

normalizeEmails(['  User@Example.COM  ', 'JOHN@COMPANY.ORG']);
// ['user@example.com', 'john@company.org']
```

## Valid Email Examples

- Simple: `user@example.com`
- With dots: `john.doe@company.org`
- With hyphens: `user-name@my-domain.com`
- With underscores: `user_name@example.com`
- With plus signs: `user+tag@example.com`
- With numbers: `user123@example.com`
- Multi-level domain: `user@mail.example.co.uk`
- Uppercase: `User@Example.COM` (normalized to lowercase)

## Invalid Email Examples

- No @ symbol: `userexample.com`
- Multiple @ symbols: `user@@example.com`
- No local part: `@example.com`
- No domain: `user@`
- No domain dot: `user@localhost`
- Leading dot in local part: `.user@example.com`
- Trailing dot in local part: `user.@example.com`
- Consecutive dots: `user..name@example.com`
- Invalid characters: `user name@example.com`
- Numeric TLD: `user@example.123`
- Single character TLD: `user@example.c`

## Error Messages

The `validateEmail()` function returns descriptive error messages:

- `"Email address is required"` - Empty or null email
- `"Email address is too short (minimum 5 characters)"` - Email too short
- `"Email address is too long (maximum 254 characters)"` - Email too long
- `"Email address must contain an @ symbol"` - No @ symbol
- `"Email address must contain exactly one @ symbol"` - Multiple @ symbols
- `"Email address must have a local part (before @)"` - No local part
- `"Email local part is too long (maximum 64 characters)"` - Local part too long
- `"Email local part cannot start or end with a dot"` - Leading/trailing dot in local part
- `"Email local part cannot contain consecutive dots"` - Consecutive dots in local part
- `"Email local part contains invalid characters..."` - Invalid characters in local part
- `"Email address must have a domain (after @)"` - No domain
- `"Email domain is too long (maximum 255 characters)"` - Domain too long
- `"Email domain must contain at least one dot..."` - No dot in domain
- `"Email domain cannot start or end with a dot"` - Leading/trailing dot in domain
- `"Email domain cannot start or end with a hyphen"` - Leading/trailing hyphen in domain
- `"Email domain cannot contain consecutive dots"` - Consecutive dots in domain
- `"Email domain label is too long (maximum 63 characters per label)"` - Domain label too long
- `"Email domain labels cannot start or end with hyphens"` - Leading/trailing hyphen in label
- `"Email domain TLD must be at least 2 characters"` - TLD too short
- `"Email domain TLD cannot be all numeric"` - Numeric TLD

## Testing

### Unit Tests

Run unit tests:
```bash
npm test -- lib/email-validation/index.test.ts
```

Tests cover:
- Valid email formats (simple, with dots, hyphens, underscores, plus signs, numbers, multi-level domains)
- Invalid email formats (missing @, multiple @, no local part, no domain, etc.)
- Edge cases (very long emails, unicode, special characters)
- Normalization (lowercase, trim whitespace)
- Domain extraction
- Batch operations
- Real-world examples

### Property-Based Tests

Run property-based tests:
```bash
npm test -- lib/email-validation/email-validation.pbt.test.ts
```

**Validates: Requirements 2.2**

Properties tested:
1. **Consistency**: `validateEmail().valid` equals `isValidEmail()`
2. **Valid Format Acceptance**: All RFC 5322 formatted emails are accepted
3. **Invalid Format Rejection**: Emails without @ or with multiple @ are rejected
4. **Normalization Idempotence**: `normalize(normalize(email)) == normalize(email)`
5. **Normalization Lowercase**: Normalized emails are always lowercase
6. **Domain Extraction Consistency**: Domain extraction works only for valid emails
7. **Domain Extraction Lowercase**: Extracted domains are always lowercase
8. **Length Constraints**: RFC 5321 length constraints are enforced
9. **Whitespace Handling**: Leading/trailing whitespace is handled correctly
10. **Error Messages**: Invalid emails always have error messages
11. **Domain Extraction from Valid Emails**: All valid emails have extractable domains
12. **Normalization Preserves Validity**: Valid emails remain valid after normalization

## Integration with API Key Management

The email validation service is used in the API Key Management system:

1. **Key Creation**: Email is validated when creating a new API key
2. **Key Update**: Email is validated when updating an existing key
3. **Billing Integration**: Email addresses are stored in plaintext for billing system
4. **Error Handling**: Descriptive error messages are returned to the user

### Example Usage in API Endpoint

```typescript
import { validateEmail } from '@/lib/email-validation';

export async function POST(request: Request) {
  const { email, keyValue, providerId } = await request.json();

  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return Response.json(
      { error: emailValidation.error },
      { status: 400 }
    );
  }

  // Normalize email for storage
  const normalizedEmail = normalizeEmail(email);

  // Create API key with validated email
  // ...
}
```

## Performance

- **Validation**: O(n) where n is email length (typically < 254 characters)
- **Normalization**: O(n) where n is email length
- **Domain Extraction**: O(n) where n is email length
- **Batch Operations**: O(m*n) where m is number of emails and n is average email length

## Security Considerations

- **Email Injection Prevention**: Validates email format to prevent injection attacks
- **Length Constraints**: Enforces RFC 5321 length limits to prevent buffer overflows
- **Unicode Support**: Handles international domain names (IDN) safely
- **No External Calls**: All validation is local (no DNS lookups or external API calls)

## Requirements Coverage

- **Requirement 2.1**: Email address field is mandatory for API key creation
- **Requirement 2.2**: Email format is validated using RFC 5322 standard
- **Requirement 2.3**: Descriptive error messages are returned for invalid emails
- **Requirement 2.4**: Email addresses are stored in plaintext for billing system integration
- **Requirement 2.5**: Email addresses are displayed in Key Manager
- **Requirement 2.6**: Email addresses can be edited and changes are logged
- **Requirement 2.7**: Multiple keys can share the same email address
- **Requirement 2.8**: Email addresses are preserved in activity log when key is deleted

## References

- [RFC 5322 - Internet Message Format](https://tools.ietf.org/html/rfc5322)
- [RFC 5321 - Simple Mail Transfer Protocol](https://tools.ietf.org/html/rfc5321)
- [RFC 6531 - SMTPUTF8 Protocol Extension](https://tools.ietf.org/html/rfc6531)
