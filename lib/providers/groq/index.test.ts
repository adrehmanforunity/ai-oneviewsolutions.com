/**
 * Unit Tests for Groq API Client
 *
 * Tests all response scenarios using mocked fetch:
 * - Successful LLM requests (200)
 * - Successful STT requests (200)
 * - Invalid key (401)
 * - Rate limited (429) with retry-after header
 * - Server error (500)
 * - Timeout handling
 * - Network error handling
 * - Key testing scenarios
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

const VALID_API_KEY = 'gsk_test_valid_key_12345';

const SAMPLE_LLM_REQUEST: LLMRequest = {
  model: 'llama-3.3-70b-versatile',
  messages: [{ role: 'user', content: 'Hello, world!' }],
  maxTokens: 100,
};

const SAMPLE_LLM_RESPONSE_BODY = {
  id: 'chatcmpl-abc123',
  object: 'chat.completion',
  model: 'llama-3.3-70b-versatile',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Hello! How can I help you today?',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 12,
    completion_tokens: 9,
    total_tokens: 21,
  },
};

const SAMPLE_STT_RESPONSE_BODY = {
  text: 'Hello, this is a transcription.',
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
    expect(result.model).toBe('llama-3.3-70b-versatile');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should include Authorization header with Bearer token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/chat/completions');
    expect((options?.headers as Record<string, string>)['Authorization']).toBe(
      `Bearer ${VALID_API_KEY}`
    );
  });

  it('should POST to the correct Groq endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
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

  it('should not include max_tokens when not provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    const requestWithoutMaxTokens: LLMRequest = {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Hi' }],
    };

    await sendLLMRequest(VALID_API_KEY, requestWithoutMaxTokens);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.max_tokens).toBeUndefined();
  });

  it('should throw ProviderError with INVALID_KEY on HTTP 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(401, { error: { message: 'Invalid API key' } })
    );

    await expect(sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST)).rejects.toThrow(
      ProviderError
    );

    try {
      await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    } catch (err) {
      // fetch was called twice; reset for next assertion
    }

    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(401, { error: { message: 'Invalid API key' } })
    );

    try {
      await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
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
      choices: [{ index: 0, message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, emptyContentResponse)
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

  it('should pass all messages in the request body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    const multiTurnRequest: LLMRequest = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ],
    };

    await sendLLMRequest(VALID_API_KEY, multiTurnRequest);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.messages).toHaveLength(4);
    expect(body.messages[0].role).toBe('system');
  });

  it('should return responseTimeMs as a non-negative number', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.responseTimeMs).toBe('number');
  });
});

// ============================================================================
// STT REQUEST TESTS
// ============================================================================

describe('sendSTTRequest', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const sampleAudioBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46]); // RIFF header

  const sampleSTTRequest: STTRequest = {
    audio: sampleAudioBuffer,
    model: 'whisper-large-v3-turbo',
  };

  it('should return transcription text on HTTP 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_STT_RESPONSE_BODY)
    );

    const result = await sendSTTRequest(VALID_API_KEY, sampleSTTRequest);

    expect(result.text).toBe('Hello, this is a transcription.');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should POST to the correct STT endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_STT_RESPONSE_BODY)
    );

    await sendSTTRequest(VALID_API_KEY, sampleSTTRequest);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
  });

  it('should include Authorization header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_STT_RESPONSE_BODY)
    );

    await sendSTTRequest(VALID_API_KEY, sampleSTTRequest);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options?.headers as Record<string, string>)['Authorization']).toBe(
      `Bearer ${VALID_API_KEY}`
    );
  });

  it('should include language in FormData when provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_STT_RESPONSE_BODY)
    );

    const requestWithLanguage: STTRequest = {
      ...sampleSTTRequest,
      language: 'en',
    };

    await sendSTTRequest(VALID_API_KEY, requestWithLanguage);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options?.body).toBeInstanceOf(FormData);
    const formData = options?.body as FormData;
    expect(formData.get('language')).toBe('en');
  });

  it('should not include language in FormData when not provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_STT_RESPONSE_BODY)
    );

    await sendSTTRequest(VALID_API_KEY, sampleSTTRequest);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const formData = options?.body as FormData;
    expect(formData.get('language')).toBeNull();
  });

  it('should throw ProviderError with INVALID_KEY on HTTP 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(401, { error: { message: 'Unauthorized' } })
    );

    try {
      await sendSTTRequest(VALID_API_KEY, sampleSTTRequest);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('INVALID_KEY');
    }
  });

  it('should throw ProviderError with RATE_LIMITED on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(429, { error: { message: 'Rate limit exceeded' } })
    );

    try {
      await sendSTTRequest(VALID_API_KEY, sampleSTTRequest);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('RATE_LIMITED');
    }
  });

  it('should throw ProviderError with SERVER_ERROR on HTTP 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(500, { error: { message: 'Internal server error' } })
    );

    try {
      await sendSTTRequest(VALID_API_KEY, sampleSTTRequest);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('SERVER_ERROR');
    }
  });

  it('should throw ProviderError with TIMEOUT on AbortError', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchAbortError());

    try {
      await sendSTTRequest(VALID_API_KEY, sampleSTTRequest, 100);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('TIMEOUT');
    }
  });

  it('should throw ProviderError with NETWORK_ERROR on fetch failure', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchNetworkError());

    try {
      await sendSTTRequest(VALID_API_KEY, sampleSTTRequest);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('NETWORK_ERROR');
    }
  });

  it('should handle empty transcription text gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, { text: '' })
    );

    const result = await sendSTTRequest(VALID_API_KEY, sampleSTTRequest);
    expect(result.text).toBe('');
  });

  it('should use whisper-large-v3 model when specified', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_STT_RESPONSE_BODY)
    );

    const requestWithV3: STTRequest = {
      audio: sampleAudioBuffer,
      model: 'whisper-large-v3',
    };

    await sendSTTRequest(VALID_API_KEY, requestWithV3);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const formData = options?.body as FormData;
    expect(formData.get('model')).toBe('whisper-large-v3');
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
    expect(result.providerName).toBe('Groq');
    expect(result.modelName).toBe('llama-3.1-8b-instant');
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
    expect(result.providerName).toBe('Groq');
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
    expect(result.providerName).toBe('Groq');
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
    // Should be approximately now + 60 seconds (within 5 second tolerance)
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

  it('should use minimal model (llama-3.1-8b-instant) for key testing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY)
    );

    await testKey(VALID_API_KEY);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.model).toBe('llama-3.1-8b-instant');
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
