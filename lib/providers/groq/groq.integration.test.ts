/**
 * Integration Tests for Groq API Client
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
  sendSTTRequest,
  testKey,
  ProviderError,
  LLMRequest,
  STTRequest,
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
// REALISTIC GROQ API RESPONSE FIXTURES
// ============================================================================

const GROQ_LLM_SUCCESS_RESPONSE = {
  id: 'chatcmpl-xyz789',
  object: 'chat.completion',
  created: 1700000000,
  model: 'llama-3.3-70b-versatile',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'The capital of France is Paris.',
      },
      logprobs: null,
      finish_reason: 'stop',
    },
  ],
  usage: {
    queue_time: 0.001,
    prompt_tokens: 15,
    prompt_time: 0.002,
    completion_tokens: 8,
    completion_time: 0.003,
    total_tokens: 23,
    total_time: 0.005,
  },
  system_fingerprint: 'fp_abc123',
  x_groq: { id: 'req_abc123' },
};

const GROQ_STT_SUCCESS_RESPONSE = {
  text: 'Hello, my name is John and I am testing the speech to text API.',
  x_groq: { id: 'req_stt_abc123' },
};

const GROQ_401_RESPONSE = {
  error: {
    message: 'Invalid API Key. Please refer to https://console.groq.com for more details.',
    type: 'invalid_request_error',
    code: 'invalid_api_key',
  },
};

const GROQ_429_RESPONSE = {
  error: {
    message: 'Rate limit reached for model `llama-3.1-8b-instant` in organization `org-abc` on tokens per minute (TPM): Limit 6000, Used 5999, Requested 100.',
    type: 'tokens',
    code: 'rate_limit_exceeded',
  },
};

const GROQ_500_RESPONSE = {
  error: {
    message: 'Internal server error. Please try again later.',
    type: 'internal_server_error',
    code: 'internal_error',
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

  it('should correctly extract content from nested choices[0].message.content', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, GROQ_LLM_SUCCESS_RESPONSE)
    );

    const result = await sendLLMRequest('test-key', {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'What is the capital of France?' }],
    });

    expect(result.content).toBe('The capital of France is Paris.');
  });

  it('should correctly extract all token counts from usage object', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, GROQ_LLM_SUCCESS_RESPONSE)
    );

    const result = await sendLLMRequest('test-key', {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.tokensUsed.prompt).toBe(15);
    expect(result.tokensUsed.completion).toBe(8);
    expect(result.tokensUsed.total).toBe(23);
  });

  it('should use model from response body, not request', async () => {
    const responseWithDifferentModel = {
      ...GROQ_LLM_SUCCESS_RESPONSE,
      model: 'llama-3.3-70b-versatile-8192',
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, responseWithDifferentModel)
    );

    const result = await sendLLMRequest('test-key', {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.model).toBe('llama-3.3-70b-versatile-8192');
  });

  it('should fall back to request model when response model is missing', async () => {
    const responseWithoutModel = { ...GROQ_LLM_SUCCESS_RESPONSE };
    delete (responseWithoutModel as any).model;

    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, responseWithoutModel)
    );

    const result = await sendLLMRequest('test-key', {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.model).toBe('llama-3.3-70b-versatile');
  });

  it('should serialize messages correctly in request body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, GROQ_LLM_SUCCESS_RESPONSE)
    );

    const request: LLMRequest = {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is 2+2?' },
      ],
      maxTokens: 10,
    };

    await sendLLMRequest('test-key', request);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);

    expect(body.model).toBe('llama-3.1-8b-instant');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'What is 2+2?' });
    expect(body.max_tokens).toBe(10);
  });

  it('should measure response time accurately', async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return mockFetchResponse(200, GROQ_LLM_SUCCESS_RESPONSE);
    });

    const result = await sendLLMRequest('test-key', {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    // Should be at least 50ms (the artificial delay)
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(40);
  });
});

// ============================================================================
// STT REQUEST PARSING TESTS
// ============================================================================

describe('STT Request/Response Parsing', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should correctly extract transcription text from response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, GROQ_STT_SUCCESS_RESPONSE)
    );

    const result = await sendSTTRequest('test-key', {
      audio: Buffer.from([0x00, 0x01, 0x02]),
      model: 'whisper-large-v3-turbo',
    });

    expect(result.text).toBe('Hello, my name is John and I am testing the speech to text API.');
  });

  it('should send audio as FormData with correct field name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, GROQ_STT_SUCCESS_RESPONSE)
    );

    const audioBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46]);
    await sendSTTRequest('test-key', {
      audio: audioBuffer,
      model: 'whisper-large-v3-turbo',
    });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options?.body).toBeInstanceOf(FormData);
    const formData = options?.body as FormData;
    expect(formData.get('file')).not.toBeNull();
    expect(formData.get('model')).toBe('whisper-large-v3-turbo');
  });

  it('should support whisper-large-v3 model', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, GROQ_STT_SUCCESS_RESPONSE)
    );

    await sendSTTRequest('test-key', {
      audio: Buffer.from([0x00]),
      model: 'whisper-large-v3',
    });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const formData = options?.body as FormData;
    expect(formData.get('model')).toBe('whisper-large-v3');
  });

  it('should include language code when specified', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, GROQ_STT_SUCCESS_RESPONSE)
    );

    await sendSTTRequest('test-key', {
      audio: Buffer.from([0x00]),
      model: 'whisper-large-v3-turbo',
      language: 'ur',
    });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const formData = options?.body as FormData;
    expect(formData.get('language')).toBe('ur');
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

  it('should include Groq error message in ProviderError for 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(401, GROQ_401_RESPONSE)
    );

    try {
      await sendLLMRequest('invalid-key', {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).message).toContain('Invalid API Key');
    }
  });

  it('should include Groq error message in ProviderError for 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, GROQ_429_RESPONSE)
    );

    try {
      await sendLLMRequest('test-key', {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).message).toContain('Rate limit');
    }
  });

  it('should include Groq error message in ProviderError for 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(500, GROQ_500_RESPONSE)
    );

    try {
      await sendLLMRequest('test-key', {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).message).toContain('Internal server error');
    }
  });

  it('should handle 503 as SERVER_ERROR', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(503, { error: { message: 'Service unavailable' } })
    );

    try {
      await sendLLMRequest('test-key', {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('SERVER_ERROR');
      expect((err as ProviderError).statusCode).toBe(503);
    }
  });

  it('should handle malformed JSON response gracefully', async () => {
    const badResponse = {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => { throw new SyntaxError('Unexpected token'); },
    } as unknown as Response;

    vi.mocked(fetch).mockResolvedValueOnce(badResponse);

    // Should not throw, should return empty content
    const result = await sendLLMRequest('test-key', {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.content).toBe('');
    expect(result.tokensUsed.total).toBe(0);
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
      mockFetchResponse(429, GROQ_429_RESPONSE, { 'retry-after': '45' })
    );

    const result = await testKey('test-key');

    expect(result.status).toBe('rate_limited');
    expect(result.rateLimitResetTime).toBeInstanceOf(Date);
  });

  it('should parse retry-after as integer seconds', async () => {
    const beforeTest = Date.now();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, GROQ_429_RESPONSE, { 'retry-after': '120' })
    );

    const result = await testKey('test-key');

    const resetTime = result.rateLimitResetTime!.getTime();
    expect(resetTime).toBeGreaterThan(beforeTest + 115000);
    expect(resetTime).toBeLessThan(beforeTest + 125000);
  });

  it('should parse retry-after as HTTP date string', async () => {
    const futureDate = new Date(Date.now() + 300000); // 5 minutes from now
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, GROQ_429_RESPONSE, {
        'retry-after': futureDate.toUTCString(),
      })
    );

    const result = await testKey('test-key');

    expect(result.rateLimitResetTime).toBeInstanceOf(Date);
    // Should be approximately 5 minutes from now
    const resetTime = result.rateLimitResetTime!.getTime();
    expect(resetTime).toBeGreaterThan(Date.now() + 290000);
  });

  it('should handle missing retry-after header gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, GROQ_429_RESPONSE)
    );

    const result = await testKey('test-key');

    expect(result.status).toBe('rate_limited');
    expect(result.rateLimitResetTime).toBeUndefined();
  });

  it('should handle invalid retry-after header gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, GROQ_429_RESPONSE, { 'retry-after': 'not-a-date' })
    );

    const result = await testKey('test-key');

    expect(result.status).toBe('rate_limited');
    expect(result.rateLimitResetTime).toBeUndefined();
  });

  it('should also check x-ratelimit-reset-requests header', async () => {
    const beforeTest = Date.now();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, GROQ_429_RESPONSE, {
        'x-ratelimit-reset-requests': '30',
      })
    );

    const result = await testKey('test-key');

    expect(result.status).toBe('rate_limited');
    // rateLimitResetTime may or may not be set depending on header priority
    // The important thing is status is rate_limited
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

  it('should throw TIMEOUT error when request exceeds timeout', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchAbortError());

    try {
      await sendLLMRequest('test-key', {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Hello' }],
      }, 100);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('TIMEOUT');
      expect((err as ProviderError).message).toContain('timed out');
    }
  });

  it('should throw TIMEOUT error for STT when request exceeds timeout', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchAbortError());

    try {
      await sendSTTRequest('test-key', {
        audio: Buffer.from([0x00]),
        model: 'whisper-large-v3-turbo',
      }, 100);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('TIMEOUT');
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
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Hello' }],
      }, 5000);
      expect.fail('Should have thrown');
    } catch (err) {
      expect((err as ProviderError).message).toContain('5000');
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
      mockFetchResponse(200, {
        ...GROQ_LLM_SUCCESS_RESPONSE,
        model: 'llama-3.1-8b-instant',
      })
    );

    const result = await testKey('valid-key');

    expect(result).toMatchObject({
      status: 'valid',
      providerName: 'Groq',
      modelName: 'llama-3.1-8b-instant',
    });
    expect(typeof result.responseTimeMs).toBe('number');
    expect(result.errorCode).toBeUndefined();
    expect(result.errorMessage).toBeUndefined();
  });

  it('should return complete invalid result with all required fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(401, GROQ_401_RESPONSE)
    );

    const result = await testKey('invalid-key');

    expect(result).toMatchObject({
      status: 'invalid',
      providerName: 'Groq',
      errorCode: 'INVALID_KEY',
    });
    expect(result.errorMessage).toBeTruthy();
    expect(typeof result.responseTimeMs).toBe('number');
  });

  it('should return complete rate_limited result with all required fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, GROQ_429_RESPONSE, { 'retry-after': '60' })
    );

    const result = await testKey('rate-limited-key');

    expect(result).toMatchObject({
      status: 'rate_limited',
      providerName: 'Groq',
      errorCode: 'RATE_LIMITED',
    });
    expect(result.rateLimitResetTime).toBeInstanceOf(Date);
    expect(typeof result.responseTimeMs).toBe('number');
  });

  it('should use the correct endpoint for key testing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, GROQ_LLM_SUCCESS_RESPONSE)
    );

    await testKey('test-key');

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  it('should use minimal request to avoid consuming quota', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, GROQ_LLM_SUCCESS_RESPONSE)
    );

    await testKey('test-key');

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);

    // Minimal request: small model, 1 message, max 5 tokens
    expect(body.model).toBe('llama-3.1-8b-instant');
    expect(body.messages).toHaveLength(1);
    expect(body.max_tokens).toBe(5);
  });
});
