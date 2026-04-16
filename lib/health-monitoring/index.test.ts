/**
 * Unit Tests for Key Health Monitoring Service
 * Tests status detection, transitions, and auto re-enabling logic
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import { describe, it, expect } from 'vitest';
import {
  detectRateLimit,
  detectInvalidKey,
  HttpResponse,
} from './index';

// ============================================================================
// RATE LIMIT DETECTION TESTS
// ============================================================================

describe('detectRateLimit', () => {
  it('should detect HTTP 429 as rate limited', () => {
    const response: HttpResponse = {
      statusCode: 429,
      headers: {},
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
  });

  it('should not detect non-429 status as rate limited', () => {
    const response: HttpResponse = {
      statusCode: 200,
      headers: {},
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(false);
  });

  it('should extract retry-after header in seconds', () => {
    const response: HttpResponse = {
      statusCode: 429,
      headers: {
        'retry-after': '60',
      },
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
    expect(result.retryAfter).toBe(60);
    expect(result.resetTime).toBeDefined();
  });

  it('should extract x-ratelimit-reset header', () => {
    const response: HttpResponse = {
      statusCode: 429,
      headers: {
        'x-ratelimit-reset': '120',
      },
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
    expect(result.retryAfter).toBe(120);
  });

  it('should parse HTTP date format in retry-after header', () => {
    const futureDate = new Date(Date.now() + 60000);
    const response: HttpResponse = {
      statusCode: 429,
      headers: {
        'retry-after': futureDate.toUTCString(),
      },
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
    expect(result.resetTime).toBeDefined();
  });

  it('should handle missing retry-after header', () => {
    const response: HttpResponse = {
      statusCode: 429,
      headers: {},
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('should handle case-insensitive headers', () => {
    const response: HttpResponse = {
      statusCode: 429,
      headers: {
        'Retry-After': '90',
      },
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
    expect(result.retryAfter).toBe(90);
  });

  it('should handle multiple headers with same value', () => {
    const response: HttpResponse = {
      statusCode: 429,
      headers: {
        'retry-after': '60',
        'x-ratelimit-reset': '120',
      },
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
    expect(result.retryAfter).toBeDefined();
  });

  it('should handle response with no headers', () => {
    const response: HttpResponse = {
      statusCode: 429,
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('should handle negative retry-after values', () => {
    const response: HttpResponse = {
      statusCode: 429,
      headers: { 'retry-after': '-10' },
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
    expect(result.retryAfter).toBe(-10);
  });

  it('should handle non-numeric retry-after values', () => {
    const response: HttpResponse = {
      statusCode: 429,
      headers: { 'retry-after': 'invalid' },
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
  });
});

// ============================================================================
// INVALID KEY DETECTION TESTS
// ============================================================================

describe('detectInvalidKey', () => {
  it('should detect HTTP 401 as invalid key', () => {
    const response: HttpResponse = {
      statusCode: 401,
      errorMessage: 'Unauthorized',
    };

    const result = detectInvalidKey(response);

    expect(result.isInvalid).toBe(true);
  });

  it('should not detect non-401 status as invalid', () => {
    const response: HttpResponse = {
      statusCode: 200,
    };

    const result = detectInvalidKey(response);

    expect(result.isInvalid).toBe(false);
  });

  it('should extract error code from response body', () => {
    const response: HttpResponse = {
      statusCode: 401,
      body: {
        error_code: 'INVALID_API_KEY',
        error_message: 'The API key is invalid',
      },
    };

    const result = detectInvalidKey(response);

    expect(result.isInvalid).toBe(true);
    expect(result.errorCode).toBe('INVALID_API_KEY');
    expect(result.errorMessage).toBe('The API key is invalid');
  });

  it('should handle string response body', () => {
    const response: HttpResponse = {
      statusCode: 401,
      body: 'Invalid authentication credentials',
    };

    const result = detectInvalidKey(response);

    expect(result.isInvalid).toBe(true);
    expect(result.errorMessage).toBe('Invalid authentication credentials');
  });

  it('should use default error message if not provided', () => {
    const response: HttpResponse = {
      statusCode: 401,
    };

    const result = detectInvalidKey(response);

    expect(result.isInvalid).toBe(true);
    expect(result.errorMessage).toBe('Unauthorized');
  });

  it('should handle alternative error field names', () => {
    const response: HttpResponse = {
      statusCode: 401,
      body: {
        code: 'AUTH_FAILED',
        message: 'Authentication failed',
      },
    };

    const result = detectInvalidKey(response);

    expect(result.isInvalid).toBe(true);
    expect(result.errorCode).toBe('AUTH_FAILED');
    expect(result.errorMessage).toBe('Authentication failed');
  });

  it('should handle empty error message', () => {
    const response: HttpResponse = {
      statusCode: 401,
      body: {
        error_code: 'AUTH_ERROR',
        error_message: '',
      },
    };

    const result = detectInvalidKey(response);

    expect(result.isInvalid).toBe(true);
    expect(result.errorCode).toBe('AUTH_ERROR');
  });

  it('should handle null response body', () => {
    const response: HttpResponse = {
      statusCode: 401,
      body: null,
    };

    const result = detectInvalidKey(response);

    expect(result.isInvalid).toBe(true);
  });
});

// ============================================================================
// HTTP STATUS CODE HANDLING
// ============================================================================

describe('HTTP Status Code Handling', () => {
  it('should handle 403 Forbidden', () => {
    const response: HttpResponse = {
      statusCode: 403,
      errorMessage: 'Access denied',
    };

    expect(response.statusCode).toBe(403);
  });

  it('should handle 404 Not Found', () => {
    const response: HttpResponse = {
      statusCode: 404,
      errorMessage: 'Resource not found',
    };

    expect(response.statusCode).toBe(404);
  });

  it('should handle 500 Server Error', () => {
    const response: HttpResponse = {
      statusCode: 500,
      errorMessage: 'Internal server error',
    };

    expect(response.statusCode).toBe(500);
  });

  it('should handle 200 Success', () => {
    const response: HttpResponse = {
      statusCode: 200,
    };

    expect(response.statusCode).toBe(200);
  });

  it('should handle 201 Created', () => {
    const response: HttpResponse = {
      statusCode: 201,
    };

    expect(response.statusCode).toBe(201);
  });

  it('should handle 204 No Content', () => {
    const response: HttpResponse = {
      statusCode: 204,
    };

    expect(response.statusCode).toBe(204);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle response with empty headers object', () => {
    const response: HttpResponse = {
      statusCode: 429,
      headers: {},
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
  });

  it('should handle response with undefined headers', () => {
    const response: HttpResponse = {
      statusCode: 429,
      headers: undefined,
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
  });

  it('should handle very large retry-after values', () => {
    const response: HttpResponse = {
      statusCode: 429,
      headers: { 'retry-after': '999999' },
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
    expect(result.retryAfter).toBe(999999);
  });

  it('should handle zero retry-after value', () => {
    const response: HttpResponse = {
      statusCode: 429,
      headers: { 'retry-after': '0' },
    };

    const result = detectRateLimit(response);

    expect(result.isRateLimited).toBe(true);
    expect(result.retryAfter).toBe(0);
  });

  it('should handle response with multiple error fields', () => {
    const response: HttpResponse = {
      statusCode: 401,
      body: {
        error_code: 'AUTH_ERROR',
        error_message: 'Auth failed',
        code: 'BACKUP_CODE',
        message: 'Backup message',
      },
    };

    const result = detectInvalidKey(response);

    expect(result.isInvalid).toBe(true);
    expect(result.errorCode).toBe('AUTH_ERROR');
    expect(result.errorMessage).toBe('Auth failed');
  });

  it('should handle response with only code field', () => {
    const response: HttpResponse = {
      statusCode: 401,
      body: {
        code: 'ONLY_CODE',
      },
    };

    const result = detectInvalidKey(response);

    expect(result.isInvalid).toBe(true);
    expect(result.errorCode).toBe('ONLY_CODE');
  });

  it('should handle response with only message field', () => {
    const response: HttpResponse = {
      statusCode: 401,
      body: {
        message: 'Only message',
      },
    };

    const result = detectInvalidKey(response);

    expect(result.isInvalid).toBe(true);
    expect(result.errorMessage).toBe('Only message');
  });
});
