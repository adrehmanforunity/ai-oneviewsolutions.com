/**
 * Unit Tests for Claude API Client
 *
 * Tests all response scenarios using mocked fetch:
 * - Successful LLM requests (200)
 * - Invalid key (401)
 * - Rate limited (429) with retry-after header
 * - Server error (500, 529)
 * - Timeout handling
 * - Network error handling
 * - Key testing scenarios
 * - Correct headers (x-api-key, anthropic-version)
 * - Correct endpoint URL
 * - Response parsing (content extraction, token counting)
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

function mockFetchNetworkError(message = 'Failed to fetch'): Promise<never> {
  return Promise.reject(new TypeError(message));
}

function mockFetchAbortError(): Promise<never> {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return Promise.reject(error);
}

// ============================================================================
// TEST SETUP
// ============================================================================

const VALID_API_KEY = 'sk-ant-test_valid_key_12345';

const SAMPLE_LLM_REQUEST: LLMRequest = {
  model: 'claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: 'Hello, world!' }],
  maxTokens: 100,
};

const SAMPLE_LLM_RESPONSE_BODY = {
  id: 'msg_abc123',
  type: 'message',
  role: 'assistant',
  content: [{ type: 'text', text: 'Hello! How can I help you today?' }],
  model: 'claude-sonnet-4-20250514',
  stop_reason: 'end_turn',
  usage: {
    input_tokens: 12,
    output_tokens: 9,
  },
};

// ============================================================================
// LLM REQUEST TESTS
// ============================================================================

describe('sendLLMRequest', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return parsed LLM response on HTTP 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);

    expect(result.content).toBe('Hello! How can I help you today?');
    expect(result.tokensUsed.prompt).toBe(12);
    expect(result.tokensUsed.completion).toBe(9);
    expect(result.tokensUsed.total).toBe(21);
    expect(result.model).toBe('claude-sonnet-4-20250514');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should include x-api-key header (NOT Bearer)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe(VALID_API_KEY);
    expect(headers['Authorization']).toBeUndefined();
  });

  it('should include anthropic-version header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('should include Content-Type: application/json header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('should POST to the correct Claude endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
  });

  it('should include max_tokens in request body when provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await sendLLMRequest(VALID_API_KEY, { ...SAMPLE_LLM_REQUEST, maxTokens: 50 });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.max_tokens).toBe(50);
  });

  it('should use default max_tokens of 1024 when not provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    const requestWithoutMaxTokens: LLMRequest = {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hi' }],
    };

    await sendLLMRequest(VALID_API_KEY, requestWithoutMaxTokens);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.max_tokens).toBe(1024);
  });

  it('should include system field when system prompt is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await sendLLMRequest(VALID_API_KEY, {
      ...SAMPLE_LLM_REQUEST,
      system: 'You are a helpful assistant.',
    });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.system).toBe('You are a helpful assistant.');
  });

  it('should NOT include system field when not provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.system).toBeUndefined();
  });

  it('should throw ProviderError with INVALID_KEY on HTTP 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(401, { error: { message: 'Invalid API key' } })
    );

    try {
      await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('INVALID_KEY');
      expect((err as ProviderError).statusCode).toBe(401);
    }
  });

  it('should throw ProviderError with RATE_LIMITED on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, { error: { message: 'Rate limit exceeded' } }, {
        'retry-after': '60',
      })
    );

    try {
      await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('RATE_LIMITED');
      expect((err as ProviderError).statusCode).toBe(429);
    }
  });

  it('should throw ProviderError with SERVER_ERROR on HTTP 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(500, { error: { message: 'Internal server error' } })
    );

    try {
      await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('SERVER_ERROR');
      expect((err as ProviderError).statusCode).toBe(500);
    }
  });

  it('should throw ProviderError with SERVER_ERROR on HTTP 529 (overloaded)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(529, { error: { message: 'Overloaded' } })
    );

    try {
      await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('SERVER_ERROR');
      expect((err as ProviderError).statusCode).toBe(529);
    }
  });

  it('should throw ProviderError with TIMEOUT on AbortError', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchAbortError());

    try {
      await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST, 100);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('TIMEOUT');
    }
  });

  it('should throw ProviderError with NETWORK_ERROR on fetch failure', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchNetworkError('Network unreachable'));

    try {
      await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('NETWORK_ERROR');
    }
  });

  it('should handle empty content in response gracefully', async () => {
    const emptyContentResponse = {
      ...SAMPLE_LLM_RESPONSE_BODY,
      content: [{ type: 'text', text: '' }],
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, emptyContentResponse)
    );

    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    expect(result.content).toBe('');
  });

  it('should handle missing content array in response gracefully', async () => {
    const noContentResponse = {
      ...SAMPLE_LLM_RESPONSE_BODY,
      content: undefined,
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, noContentResponse)
    );

    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    expect(result.content).toBe('');
  });

  it('should handle missing usage in response gracefully', async () => {
    const noUsageResponse = {
      ...SAMPLE_LLM_RESPONSE_BODY,
      usage: undefined,
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, noUsageResponse)
    );

    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    expect(result.tokensUsed.prompt).toBe(0);
    expect(result.tokensUsed.completion).toBe(0);
    expect(result.tokensUsed.total).toBe(0);
  });

  it('should compute total tokens as sum of input + output tokens', async () => {
    const responseWithTokens = {
      ...SAMPLE_LLM_RESPONSE_BODY,
      usage: { input_tokens: 25, output_tokens: 15 },
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, responseWithTokens)
    );

    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    expect(result.tokensUsed.prompt).toBe(25);
    expect(result.tokensUsed.completion).toBe(15);
    expect(result.tokensUsed.total).toBe(40);
  });

  it('should pass all messages in the request body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    const multiTurnRequest: LLMRequest = {
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ],
    };

    await sendLLMRequest(VALID_API_KEY, multiTurnRequest);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.messages).toHaveLength(3);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[1].role).toBe('assistant');
  });

  it('should return responseTimeMs as a non-negative number', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.responseTimeMs).toBe('number');
  });

  it('should use model from response body, not request', async () => {
    const responseWithDifferentModel = {
      ...SAMPLE_LLM_RESPONSE_BODY,
      model: 'claude-opus-4-1-20250805',
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, responseWithDifferentModel)
    );

    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    expect(result.model).toBe('claude-opus-4-1-20250805');
  });

  it('should fall back to request model when response model is missing', async () => {
    const responseWithoutModel = { ...SAMPLE_LLM_RESPONSE_BODY };
    delete (responseWithoutModel as any).model;

    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, responseWithoutModel)
    );

    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    expect(result.model).toBe('claude-sonnet-4-20250514');
  });

  it('should handle malformed JSON response gracefully', async () => {
    const badResponse = {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => { throw new SyntaxError('Unexpected token'); },
    } as unknown as Response;

    vi.mocked(fetch).mockResolvedValueOnce(badResponse);

    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    expect(result.content).toBe('');
    expect(result.tokensUsed.total).toBe(0);
  });

  it('should include model in request body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.model).toBe('claude-sonnet-4-20250514');
  });

  it('should use POST method', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options?.method).toBe('POST');
  });
});

// ============================================================================
// KEY TESTING TESTS
// ============================================================================

describe('testKey', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return status: valid on HTTP 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    const result = await testKey(VALID_API_KEY);

    expect(result.status).toBe('valid');
    expect(result.providerName).toBe('Claude');
    expect(result.modelName).toBe('claude-sonnet-4-20250514');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should return status: invalid on HTTP 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(401, { error: { message: 'Invalid API key provided' } })
    );

    const result = await testKey(VALID_API_KEY);

    expect(result.status).toBe('invalid');
    expect(result.errorCode).toBe('INVALID_KEY');
    expect(result.errorMessage).toBe('Invalid API key provided');
    expect(result.providerName).toBe('Claude');
  });

  it('should return status: rate_limited on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, { error: { message: 'Rate limit exceeded' } }, {
        'retry-after': '30',
      })
    );

    const result = await testKey(VALID_API_KEY);

    expect(result.status).toBe('rate_limited');
    expect(result.errorCode).toBe('RATE_LIMITED');
    expect(result.rateLimitResetTime).toBeInstanceOf(Date);
    expect(result.providerName).toBe('Claude');
  });

  it('should parse retry-after header as seconds', async () => {
    const now = Date.now();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, { error: { message: 'Rate limit exceeded' } }, {
        'retry-after': '60',
      })
    );

    const result = await testKey(VALID_API_KEY);

    expect(result.rateLimitResetTime).toBeInstanceOf(Date);
    const resetTime = result.rateLimitResetTime!.getTime();
    expect(resetTime).toBeGreaterThan(now + 55000);
    expect(resetTime).toBeLessThan(now + 65000);
  });

  it('should parse retry-after header as HTTP date', async () => {
    const futureDate = new Date(Date.now() + 120000).toUTCString();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, { error: { message: 'Rate limit exceeded' } }, {
        'retry-after': futureDate,
      })
    );

    const result = await testKey(VALID_API_KEY);

    expect(result.rateLimitResetTime).toBeInstanceOf(Date);
  });

  it('should throw ProviderError with TIMEOUT on AbortError', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchAbortError());

    try {
      await testKey(VALID_API_KEY);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('TIMEOUT');
    }
  });

  it('should throw ProviderError with NETWORK_ERROR on fetch failure', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchNetworkError('Connection refused'));

    try {
      await testKey(VALID_API_KEY);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('NETWORK_ERROR');
    }
  });

  it('should throw ProviderError with SERVER_ERROR on HTTP 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(500, { error: { message: 'Internal server error' } })
    );

    try {
      await testKey(VALID_API_KEY);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('SERVER_ERROR');
    }
  });

  it('should use claude-sonnet-4-20250514 model for key testing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await testKey(VALID_API_KEY);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.model).toBe('claude-sonnet-4-20250514');
  });

  it('should use max_tokens=5 for key testing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await testKey(VALID_API_KEY);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.max_tokens).toBe(5);
  });

  it('should send "Hi" as the test message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await testKey(VALID_API_KEY);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content).toBe('Hi');
    expect(body.messages[0].role).toBe('user');
  });

  it('should POST to the correct Claude messages endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await testKey(VALID_API_KEY);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
  });

  it('should include x-api-key header in key test request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await testKey(VALID_API_KEY);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe(VALID_API_KEY);
  });

  it('should include anthropic-version header in key test request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await testKey(VALID_API_KEY);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('should include responseTimeMs in valid result', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    const result = await testKey(VALID_API_KEY);
    expect(typeof result.responseTimeMs).toBe('number');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should include responseTimeMs in invalid result', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(401, { error: { message: 'Unauthorized' } })
    );

    const result = await testKey(VALID_API_KEY);
    expect(typeof result.responseTimeMs).toBe('number');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should include responseTimeMs in rate_limited result', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, { error: { message: 'Rate limited' } })
    );

    const result = await testKey(VALID_API_KEY);
    expect(typeof result.responseTimeMs).toBe('number');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle 401 with no error body gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(401, {})
    );

    const result = await testKey(VALID_API_KEY);
    expect(result.status).toBe('invalid');
    expect(result.errorMessage).toBe('Invalid API key');
  });

  it('should handle 429 with no retry-after header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, { error: { message: 'Rate limited' } })
    );

    const result = await testKey(VALID_API_KEY);
    expect(result.status).toBe('rate_limited');
    expect(result.rateLimitResetTime).toBeUndefined();
  });
});

// ============================================================================
// PROVIDER ERROR CLASS TESTS
// ============================================================================

describe('ProviderError', () => {
  it('should be an instance of Error', () => {
    const err = new ProviderError('test', 'INVALID_KEY');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ProviderError);
  });

  it('should have name ProviderError', () => {
    const err = new ProviderError('test', 'TIMEOUT');
    expect(err.name).toBe('ProviderError');
  });

  it('should store the error code', () => {
    const err = new ProviderError('test', 'RATE_LIMITED');
    expect(err.code).toBe('RATE_LIMITED');
  });

  it('should store the status code when provided', () => {
    const err = new ProviderError('test', 'SERVER_ERROR', 503);
    expect(err.statusCode).toBe(503);
  });

  it('should have undefined statusCode when not provided', () => {
    const err = new ProviderError('test', 'NETWORK_ERROR');
    expect(err.statusCode).toBeUndefined();
  });

  it('should support all error codes', () => {
    const codes: Array<ProviderError['code']> = [
      'INVALID_KEY',
      'RATE_LIMITED',
      'SERVER_ERROR',
      'TIMEOUT',
      'NETWORK_ERROR',
    ];

    for (const code of codes) {
      const err = new ProviderError(`Error: ${code}`, code);
      expect(err.code).toBe(code);
    }
  });
});
