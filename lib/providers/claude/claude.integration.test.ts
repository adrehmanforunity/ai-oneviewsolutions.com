/**
 * Integration Tests for Claude API Client
 *
 * Tests request/response parsing, error handling logic, token extraction,
 * rate limit detection, retry-after parsing, and timeout handling.
 *
 * These tests use mocked fetch to simulate real API behavior without
 * making actual network calls.
 *
 * Requirements: 1.7, 1.8, 1.9, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendLLMRequest,
  testKey,
  ProviderError,
  LLMRequest,
} from './index';

// ============================================================================
// MOCK HELPERS
// ============================================================================

function mockFetchResponse(
  status: number,
  body: any,
  headers: Record<string, string> = {}
): Response {
  const headersObj = new Headers(headers);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headersObj,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function mockFetchAbortError(): Promise<never> {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return Promise.reject(error);
}

function mockFetchNetworkError(message = 'Failed to fetch'): Promise<never> {
  return Promise.reject(new TypeError(message));
}

// ============================================================================
// REALISTIC CLAUDE API RESPONSE FIXTURES
// ============================================================================

const CLAUDE_LLM_SUCCESS_RESPONSE = {
  id: 'msg_xyz789',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: 'The capital of France is Paris.',
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: {
    input_tokens: 15,
    output_tokens: 8,
  },
};

const CLAUDE_401_RESPONSE = {
  type: 'error',
  error: {
    type: 'authentication_error',
    message: 'invalid x-api-key',
  },
};

const CLAUDE_429_RESPONSE = {
  type: 'error',
  error: {
    type: 'rate_limit_error',
    message: 'Rate limit exceeded. Please retry after some time.',
  },
};

const CLAUDE_500_RESPONSE = {
  type: 'error',
  error: {
    type: 'api_error',
    message: 'Internal server error. Please try again later.',
  },
};

const CLAUDE_529_RESPONSE = {
  type: 'error',
  error: {
    type: 'overloaded_error',
    message: 'Anthropic\'s API is temporarily overloaded.',
  },
};

// ============================================================================
// LLM REQUEST PARSING TESTS
// ============================================================================

describe('LLM Request/Response Parsing', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should correctly extract content from content[0].text', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, CLAUDE_LLM_SUCCESS_RESPONSE)
    );

    const result = await sendLLMRequest('test-key', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'What is the capital of France?' }],
    });

    expect(result.content).toBe('The capital of France is Paris.');
  });

  it('should correctly extract input_tokens and output_tokens from usage', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, CLAUDE_LLM_SUCCESS_RESPONSE)
    );

    const result = await sendLLMRequest('test-key', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.tokensUsed.prompt).toBe(15);
    expect(result.tokensUsed.completion).toBe(8);
    expect(result.tokensUsed.total).toBe(23);
  });

  it('should compute total as input_tokens + output_tokens (not a separate field)', async () => {
    const responseWithTokens = {
      ...CLAUDE_LLM_SUCCESS_RESPONSE,
      usage: { input_tokens: 100, output_tokens: 50 },
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, responseWithTokens)
    );

    const result = await sendLLMRequest('test-key', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.tokensUsed.total).toBe(150);
  });

  it('should use model from response body, not request', async () => {
    const responseWithDifferentModel = {
      ...CLAUDE_LLM_SUCCESS_RESPONSE,
      model: 'claude-opus-4-1-20250805',
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, responseWithDifferentModel)
    );

    const result = await sendLLMRequest('test-key', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.model).toBe('claude-opus-4-1-20250805');
  });

  it('should fall back to request model when response model is missing', async () => {
    const responseWithoutModel = { ...CLAUDE_LLM_SUCCESS_RESPONSE };
    delete (responseWithoutModel as any).model;

    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, responseWithoutModel)
    );

    const result = await sendLLMRequest('test-key', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.model).toBe('claude-sonnet-4-20250514');
  });

  it('should serialize messages correctly in request body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, CLAUDE_LLM_SUCCESS_RESPONSE)
    );

    const request: LLMRequest = {
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'user', content: 'What is 2+2?' },
        { role: 'assistant', content: '4' },
        { role: 'user', content: 'And 3+3?' },
      ],
      maxTokens: 10,
    };

    await sendLLMRequest('test-key', request);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);

    expect(body.model).toBe('claude-sonnet-4-20250514');
    expect(body.messages).toHaveLength(3);
    expect(body.messages[0]).toEqual({ role: 'user', content: 'What is 2+2?' });
    expect(body.messages[1]).toEqual({ role: 'assistant', content: '4' });
    expect(body.max_tokens).toBe(10);
  });

  it('should include system field in request body when provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, CLAUDE_LLM_SUCCESS_RESPONSE)
    );

    await sendLLMRequest('test-key', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
      system: 'You are a helpful assistant.',
    });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.system).toBe('You are a helpful assistant.');
  });

  it('should NOT include system field when not provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, CLAUDE_LLM_SUCCESS_RESPONSE)
    );

    await sendLLMRequest('test-key', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.system).toBeUndefined();
  });

  it('should measure response time accurately', async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return mockFetchResponse(200, CLAUDE_LLM_SUCCESS_RESPONSE);
    });

    const result = await sendLLMRequest('test-key', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.responseTimeMs).toBeGreaterThanOrEqual(40);
  });

  it('should handle malformed JSON response gracefully', async () => {
    const badResponse = {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => { throw new SyntaxError('Unexpected token'); },
    } as unknown as Response;

    vi.mocked(fetch).mockResolvedValueOnce(badResponse);

    const result = await sendLLMRequest('test-key', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.content).toBe('');
    expect(result.tokensUsed.total).toBe(0);
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Handling', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should include Claude error message in ProviderError for 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(401, CLAUDE_401_RESPONSE)
    );

    try {
      await sendLLMRequest('invalid-key', {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).message).toContain('invalid x-api-key');
    }
  });

  it('should include Claude error message in ProviderError for 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, CLAUDE_429_RESPONSE)
    );

    try {
      await sendLLMRequest('test-key', {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).message).toContain('Rate limit');
    }
  });

  it('should include Claude error message in ProviderError for 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(500, CLAUDE_500_RESPONSE)
    );

    try {
      await sendLLMRequest('test-key', {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).message).toContain('Internal server error');
    }
  });

  it('should handle 529 (overloaded) as SERVER_ERROR', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(529, CLAUDE_529_RESPONSE)
    );

    try {
      await sendLLMRequest('test-key', {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('SERVER_ERROR');
      expect((err as ProviderError).statusCode).toBe(529);
    }
  });

  it('should handle 503 as SERVER_ERROR', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(503, { error: { message: 'Service unavailable' } })
    );

    try {
      await sendLLMRequest('test-key', {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('SERVER_ERROR');
      expect((err as ProviderError).statusCode).toBe(503);
    }
  });
});

// ============================================================================
// RATE LIMIT DETECTION TESTS
// ============================================================================

describe('Rate Limit Detection and Retry-After Parsing', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should detect rate limit from HTTP 429 in testKey', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, CLAUDE_429_RESPONSE, { 'retry-after': '45' })
    );

    const result = await testKey('test-key');

    expect(result.status).toBe('rate_limited');
    expect(result.rateLimitResetTime).toBeInstanceOf(Date);
  });

  it('should parse retry-after as integer seconds', async () => {
    const beforeTest = Date.now();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, CLAUDE_429_RESPONSE, { 'retry-after': '120' })
    );

    const result = await testKey('test-key');

    const resetTime = result.rateLimitResetTime!.getTime();
    expect(resetTime).toBeGreaterThan(beforeTest + 115000);
    expect(resetTime).toBeLessThan(beforeTest + 125000);
  });

  it('should parse retry-after as HTTP date string', async () => {
    const futureDate = new Date(Date.now() + 300000);
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, CLAUDE_429_RESPONSE, {
        'retry-after': futureDate.toUTCString(),
      })
    );

    const result = await testKey('test-key');

    expect(result.rateLimitResetTime).toBeInstanceOf(Date);
    const resetTime = result.rateLimitResetTime!.getTime();
    expect(resetTime).toBeGreaterThan(Date.now() + 290000);
  });

  it('should handle missing retry-after header gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, CLAUDE_429_RESPONSE)
    );

    const result = await testKey('test-key');

    expect(result.status).toBe('rate_limited');
    expect(result.rateLimitResetTime).toBeUndefined();
  });

  it('should handle invalid retry-after header gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, CLAUDE_429_RESPONSE, { 'retry-after': 'not-a-date' })
    );

    const result = await testKey('test-key');

    expect(result.status).toBe('rate_limited');
    expect(result.rateLimitResetTime).toBeUndefined();
  });
});

// ============================================================================
// TIMEOUT HANDLING TESTS
// ============================================================================

describe('Timeout Handling', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should throw TIMEOUT error when LLM request exceeds timeout', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchAbortError());

    try {
      await sendLLMRequest('test-key', {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
      }, 100);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('TIMEOUT');
      expect((err as ProviderError).message).toContain('timed out');
    }
  });

  it('should throw TIMEOUT error for testKey when request exceeds 3 seconds', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchAbortError());

    try {
      await testKey('test-key');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('TIMEOUT');
    }
  });

  it('should include timeout duration in error message', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchAbortError());

    try {
      await sendLLMRequest('test-key', {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
      }, 5000);
      expect.fail('Should have thrown');
    } catch (err) {
      expect((err as ProviderError).message).toContain('5000');
    }
  });

  it('should throw NETWORK_ERROR on network failure during LLM request', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchNetworkError('ECONNREFUSED'));

    try {
      await sendLLMRequest('test-key', {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('NETWORK_ERROR');
    }
  });
});

// ============================================================================
// KEY TESTING INTEGRATION TESTS
// ============================================================================

describe('Key Testing Integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return complete valid result with all required fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, CLAUDE_LLM_SUCCESS_RESPONSE)
    );

    const result = await testKey('valid-key');

    expect(result).toMatchObject({
      status: 'valid',
      providerName: 'Claude',
      modelName: 'claude-sonnet-4-20250514',
    });
    expect(typeof result.responseTimeMs).toBe('number');
    expect(result.errorCode).toBeUndefined();
    expect(result.errorMessage).toBeUndefined();
  });

  it('should return complete invalid result with all required fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(401, CLAUDE_401_RESPONSE)
    );

    const result = await testKey('invalid-key');

    expect(result).toMatchObject({
      status: 'invalid',
      providerName: 'Claude',
      errorCode: 'INVALID_KEY',
    });
    expect(result.errorMessage).toBeTruthy();
    expect(typeof result.responseTimeMs).toBe('number');
  });

  it('should return complete rate_limited result with all required fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, CLAUDE_429_RESPONSE, { 'retry-after': '60' })
    );

    const result = await testKey('rate-limited-key');

    expect(result).toMatchObject({
      status: 'rate_limited',
      providerName: 'Claude',
      errorCode: 'RATE_LIMITED',
    });
    expect(result.rateLimitResetTime).toBeInstanceOf(Date);
    expect(typeof result.responseTimeMs).toBe('number');
  });

  it('should use the correct endpoint for key testing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, CLAUDE_LLM_SUCCESS_RESPONSE)
    );

    await testKey('test-key');

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
  });

  it('should use minimal request to avoid consuming quota', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, CLAUDE_LLM_SUCCESS_RESPONSE)
    );

    await testKey('test-key');

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);

    expect(body.model).toBe('claude-sonnet-4-20250514');
    expect(body.messages).toHaveLength(1);
    expect(body.max_tokens).toBe(5);
  });

  it('should use x-api-key header (not Bearer) for key testing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, CLAUDE_LLM_SUCCESS_RESPONSE)
    );

    await testKey('my-test-api-key');

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('my-test-api-key');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('should include anthropic-version header for key testing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, CLAUDE_LLM_SUCCESS_RESPONSE)
    );

    await testKey('test-key');

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });
});
