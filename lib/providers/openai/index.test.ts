/**
 * Unit Tests for OpenAI API Client
 * Requirements: 1.7, 1.8, 1.9, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendLLMRequest,
  sendTTSRequest,
  testKey,
  ProviderError,
  LLMRequest,
  TTSRequest,
} from './index';

function mockFetchResponse(status: number, body: any, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function mockFetchBinaryResponse(status: number, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    arrayBuffer: async () => new ArrayBuffer(8),
    json: async () => ({}),
  } as unknown as Response;
}

function mockFetchTTSErrorResponse(status: number, body: any, headers: Record<string, string> = {}): Response {
  return {
    ok: false,
    status,
    headers: new Headers(headers),
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
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

const VALID_API_KEY = 'sk-test_valid_openai_key_12345';

const SAMPLE_LLM_REQUEST: LLMRequest = {
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello, world!' }],
  maxTokens: 100,
};

const SAMPLE_LLM_RESPONSE_BODY = {
  id: 'chatcmpl-abc123',
  object: 'chat.completion',
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Hello! How can I help you today?' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 12, completion_tokens: 9, total_tokens: 21 },
};

const SAMPLE_TTS_REQUEST: TTSRequest = {
  model: 'tts-1',
  input: 'Hello, world!',
  voice: 'alloy',
};

describe('sendLLMRequest', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('should return parsed LLM response on HTTP 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY));
    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    expect(result.content).toBe('Hello! How can I help you today?');
    expect(result.tokensUsed.prompt).toBe(12);
    expect(result.tokensUsed.completion).toBe(9);
    expect(result.tokensUsed.total).toBe(21);
    expect(result.model).toBe('gpt-4o');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should include Authorization header with Bearer token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY));
    await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options?.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${VALID_API_KEY}`);
  });

  it('should POST to the correct OpenAI endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY));
    await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('should include max_tokens in request body when provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY));
    await sendLLMRequest(VALID_API_KEY, { ...SAMPLE_LLM_REQUEST, maxTokens: 50 });
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.max_tokens).toBe(50);
  });

  it('should not include max_tokens when not provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY));
    const req: LLMRequest = { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] };
    await sendLLMRequest(VALID_API_KEY, req);
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.max_tokens).toBeUndefined();
  });

  it('should throw ProviderError with INVALID_KEY on HTTP 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(401, { error: { message: 'Invalid API key' } }));
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
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(429, { error: { message: 'Rate limit exceeded' } }, { 'retry-after': '60' }));
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
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(500, { error: { message: 'Internal server error' } }));
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

  it('should handle missing usage fields gracefully', async () => {
    const noUsageResponse = { ...SAMPLE_LLM_RESPONSE_BODY, usage: undefined };
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, noUsageResponse));
    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    expect(result.tokensUsed.prompt).toBe(0);
    expect(result.tokensUsed.completion).toBe(0);
    expect(result.tokensUsed.total).toBe(0);
  });

  it('should handle missing content in response gracefully', async () => {
    const noContentResponse = {
      ...SAMPLE_LLM_RESPONSE_BODY,
      choices: [{ index: 0, message: { role: 'assistant', content: null }, finish_reason: 'stop' }],
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, noContentResponse));
    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    expect(result.content).toBe('');
  });

  it('should pass all messages in multi-turn conversation', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY));
    const multiTurnRequest: LLMRequest = {
      model: 'gpt-4o',
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
    expect(body.messages[3].role).toBe('user');
  });

  it('should return responseTimeMs as a non-negative number', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY));
    const result = await sendLLMRequest(VALID_API_KEY, SAMPLE_LLM_REQUEST);
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.responseTimeMs).toBe('number');
  });
});

describe('sendTTSRequest', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('should return Buffer with audio data on HTTP 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchBinaryResponse(200));
    const result = await sendTTSRequest(VALID_API_KEY, SAMPLE_TTS_REQUEST);
    expect(result.audio).toBeInstanceOf(Buffer);
    expect(result.audio.length).toBe(8);
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should POST to the correct OpenAI TTS endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchBinaryResponse(200));
    await sendTTSRequest(VALID_API_KEY, SAMPLE_TTS_REQUEST);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/speech');
  });

  it('should include Authorization header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchBinaryResponse(200));
    await sendTTSRequest(VALID_API_KEY, SAMPLE_TTS_REQUEST);
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options?.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${VALID_API_KEY}`);
  });

  it('should include speed in request body when provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchBinaryResponse(200));
    await sendTTSRequest(VALID_API_KEY, { ...SAMPLE_TTS_REQUEST, speed: 1.5 });
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.speed).toBe(1.5);
  });

  it('should not include speed in request body when not provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchBinaryResponse(200));
    await sendTTSRequest(VALID_API_KEY, SAMPLE_TTS_REQUEST);
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.speed).toBeUndefined();
  });

  it('should throw ProviderError with INVALID_KEY on HTTP 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchTTSErrorResponse(401, { error: { message: 'Invalid API key' } }));
    try {
      await sendTTSRequest(VALID_API_KEY, SAMPLE_TTS_REQUEST);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('INVALID_KEY');
      expect((err as ProviderError).statusCode).toBe(401);
    }
  });

  it('should throw ProviderError with RATE_LIMITED on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchTTSErrorResponse(429, { error: { message: 'Rate limit exceeded' } }, { 'retry-after': '30' }));
    try {
      await sendTTSRequest(VALID_API_KEY, SAMPLE_TTS_REQUEST);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('RATE_LIMITED');
      expect((err as ProviderError).statusCode).toBe(429);
    }
  });

  it('should throw ProviderError with SERVER_ERROR on HTTP 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchTTSErrorResponse(500, { error: { message: 'Internal server error' } }));
    try {
      await sendTTSRequest(VALID_API_KEY, SAMPLE_TTS_REQUEST);
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
      await sendTTSRequest(VALID_API_KEY, SAMPLE_TTS_REQUEST, 100);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('TIMEOUT');
    }
  });

  it('should throw ProviderError with NETWORK_ERROR on fetch failure', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchNetworkError('Connection refused'));
    try {
      await sendTTSRequest(VALID_API_KEY, SAMPLE_TTS_REQUEST);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('NETWORK_ERROR');
    }
  });
});

describe('testKey (type=llm)', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('should return status: valid on HTTP 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY));
    const result = await testKey(VALID_API_KEY, 'llm');
    expect(result.status).toBe('valid');
    expect(result.providerName).toBe('OpenAI');
    expect(result.modelName).toBe('gpt-4o-mini');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should return status: invalid on HTTP 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(401, { error: { message: 'Invalid API key provided' } }));
    const result = await testKey(VALID_API_KEY, 'llm');
    expect(result.status).toBe('invalid');
    expect(result.errorCode).toBe('INVALID_KEY');
    expect(result.errorMessage).toBe('Invalid API key provided');
    expect(result.providerName).toBe('OpenAI');
  });

  it('should return status: rate_limited on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(429, { error: { message: 'Rate limit exceeded' } }, { 'retry-after': '30' }));
    const result = await testKey(VALID_API_KEY, 'llm');
    expect(result.status).toBe('rate_limited');
    expect(result.errorCode).toBe('RATE_LIMITED');
    expect(result.rateLimitResetTime).toBeInstanceOf(Date);
    expect(result.providerName).toBe('OpenAI');
  });

  it('should parse retry-after header as seconds', async () => {
    const now = Date.now();
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(429, { error: { message: 'Rate limit exceeded' } }, { 'retry-after': '60' }));
    const result = await testKey(VALID_API_KEY, 'llm');
    expect(result.rateLimitResetTime).toBeInstanceOf(Date);
    const resetTime = result.rateLimitResetTime!.getTime();
    expect(resetTime).toBeGreaterThan(now + 55000);
    expect(resetTime).toBeLessThan(now + 65000);
  });

  it('should throw ProviderError with TIMEOUT on AbortError', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchAbortError());
    try {
      await testKey(VALID_API_KEY, 'llm');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('TIMEOUT');
    }
  });

  it('should throw ProviderError with NETWORK_ERROR on fetch failure', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => mockFetchNetworkError('Connection refused'));
    try {
      await testKey(VALID_API_KEY, 'llm');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('NETWORK_ERROR');
    }
  });

  it('should throw ProviderError with SERVER_ERROR on HTTP 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(500, { error: { message: 'Internal server error' } }));
    try {
      await testKey(VALID_API_KEY, 'llm');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe('SERVER_ERROR');
    }
  });

  it('should use gpt-4o-mini model for key testing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY));
    await testKey(VALID_API_KEY, 'llm');
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.model).toBe('gpt-4o-mini');
  });

  it('should use max_tokens=5 for key testing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY));
    await testKey(VALID_API_KEY, 'llm');
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.max_tokens).toBe(5);
  });

  it('should send "Hi" as the test message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY));
    await testKey(VALID_API_KEY, 'llm');
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content).toBe('Hi');
    expect(body.messages[0].role).toBe('user');
  });

  it('should default to llm type when no type provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY));
    const result = await testKey(VALID_API_KEY);
    expect(result.status).toBe('valid');
    expect(result.modelName).toBe('gpt-4o-mini');
  });

  it('should handle 429 with no retry-after header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(429, { error: { message: 'Rate limited' } }));
    const result = await testKey(VALID_API_KEY, 'llm');
    expect(result.status).toBe('rate_limited');
    expect(result.rateLimitResetTime).toBeUndefined();
  });

  it('should handle 401 with no error body gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(401, {}));
    const result = await testKey(VALID_API_KEY, 'llm');
    expect(result.status).toBe('invalid');
    expect(result.errorMessage).toBe('Invalid API key');
  });

  it('should include responseTimeMs in valid result', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LLM_RESPONSE_BODY));
    const result = await testKey(VALID_API_KEY, 'llm');
    expect(typeof result.responseTimeMs).toBe('number');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should include responseTimeMs in invalid result', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(401, { error: { message: 'Unauthorized' } }));
    const result = await testKey(VALID_API_KEY, 'llm');
    expect(typeof result.responseTimeMs).toBe('number');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should include responseTimeMs in rate_limited result', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(429, { error: { message: 'Rate limited' } }));
    const result = await testKey(VALID_API_KEY, 'llm');
    expect(typeof result.responseTimeMs).toBe('number');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('testKey (type=tts)', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('should return status: valid on HTTP 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchBinaryResponse(200));
    const result = await testKey(VALID_API_KEY, 'tts');
    expect(result.status).toBe('valid');
    expect(result.providerName).toBe('OpenAI');
    expect(result.modelName).toBe('tts-1');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should return status: invalid on HTTP 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchTTSErrorResponse(401, { error: { message: 'Invalid API key' } }));
    const result = await testKey(VALID_API_KEY, 'tts');
    expect(result.status).toBe('invalid');
    expect(result.errorCode).toBe('INVALID_KEY');
    expect(result.providerName).toBe('OpenAI');
  });

  it('should return status: rate_limited on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchTTSErrorResponse(429, { error: { message: 'Rate limit exceeded' } }, { 'retry-after': '30' }));
    const result = await testKey(VALID_API_KEY, 'tts');
    expect(result.status).toBe('rate_limited');
    expect(result.errorCode).toBe('RATE_LIMITED');
    expect(result.rateLimitResetTime).toBeInstanceOf(Date);
  });

  it('should POST to the TTS endpoint for tts key test', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchBinaryResponse(200));
    await testKey(VALID_API_KEY, 'tts');
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/speech');
  });

  it('should use tts-1 model, alloy voice, and "Hi" input for TTS key test', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchBinaryResponse(200));
    await testKey(VALID_API_KEY, 'tts');
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.model).toBe('tts-1');
    expect(body.voice).toBe('alloy');
    expect(body.input).toBe('Hi');
  });
});

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
