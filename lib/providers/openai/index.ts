/**
 * OpenAI API Client Library
 * Handles LLM requests, TTS requests, key testing, and error handling
 *
 * Features:
 * - Authenticate with API key via Bearer token
 * - Send LLM chat completion requests (OpenAI-compatible format)
 * - Send TTS (text-to-speech) requests returning binary audio
 * - Test API key validity with minimal requests (LLM or TTS)
 * - Handle errors: 401 (invalid), 429 (rate limited), 500 (server error), timeout, network errors
 *
 * Requirements: 1.7, 1.8, 1.9, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const KEY_TEST_TIMEOUT_MS = 3000;
const DEFAULT_TIMEOUT_MS = 30000;

/** Model used for LLM key testing (minimal, fast, cheap) */
const KEY_TEST_LLM_MODEL = 'gpt-4o-mini';
const KEY_TEST_MAX_TOKENS = 5;

/** Model and voice used for TTS key testing */
const KEY_TEST_TTS_MODEL = 'tts-1';
const KEY_TEST_TTS_VOICE = 'alloy';
const KEY_TEST_TTS_INPUT = 'Hi';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  responseTimeMs: number;
  model: string;
}

export interface TTSRequest {
  model: string;   // tts-1 or tts-1-hd
  input: string;   // text to convert
  voice: string;   // alloy, echo, fable, onyx, nova, shimmer
  speed?: number;  // 0.25 to 4.0
}

export interface TTSResponse {
  audio: Buffer;
  responseTimeMs: number;
}

export interface KeyTestResult {
  status: 'valid' | 'invalid' | 'rate_limited';
  responseTimeMs: number;
  providerName: string;
  modelName?: string;
  errorCode?: string;
  errorMessage?: string;
  rateLimitResetTime?: Date;
}

// ============================================================================
// ERROR CLASS
// ============================================================================

/**
 * Provider-specific error with error code and optional HTTP status code
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_KEY' | 'RATE_LIMITED' | 'SERVER_ERROR' | 'TIMEOUT' | 'NETWORK_ERROR',
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Build common headers for OpenAI API requests
 */
function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create an AbortController with a timeout
 */
function createTimeoutController(timeoutMs: number): { controller: AbortController; timerId: ReturnType<typeof setTimeout> } {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timerId };
}

/**
 * Parse the retry-after header value into a Date
 * Supports both integer seconds and HTTP date strings
 */
function parseRetryAfter(retryAfterHeader: string | null): Date | undefined {
  if (!retryAfterHeader) return undefined;

  const seconds = parseInt(retryAfterHeader, 10);
  if (!isNaN(seconds)) {
    return new Date(Date.now() + seconds * 1000);
  }

  const date = new Date(retryAfterHeader);
  if (!isNaN(date.getTime())) {
    return date;
  }

  return undefined;
}

/**
 * Handle a non-OK HTTP response and throw or return the appropriate error/result.
 * Returns a KeyTestResult for 401/429 (used in testKey), throws ProviderError for 500+.
 */
function handleErrorResponse(
  status: number,
  headers: Headers,
  body: any,
  context: 'request' | 'test'
): KeyTestResult | never {
  if (status === 401) {
    if (context === 'test') {
      return {
        status: 'invalid',
        responseTimeMs: 0, // caller will fill in
        providerName: 'OpenAI',
        errorCode: 'INVALID_KEY',
        errorMessage: body?.error?.message || 'Invalid API key',
      };
    }
    throw new ProviderError(
      body?.error?.message || 'Invalid API key',
      'INVALID_KEY',
      401
    );
  }

  if (status === 429) {
    const retryAfterHeader = headers.get('retry-after');
    const rateLimitResetTime = parseRetryAfter(retryAfterHeader);

    if (context === 'test') {
      return {
        status: 'rate_limited',
        responseTimeMs: 0, // caller will fill in
        providerName: 'OpenAI',
        errorCode: 'RATE_LIMITED',
        errorMessage: body?.error?.message || 'Rate limit exceeded',
        rateLimitResetTime,
      };
    }
    throw new ProviderError(
      body?.error?.message || 'Rate limit exceeded',
      'RATE_LIMITED',
      429
    );
  }

  if (status >= 500) {
    throw new ProviderError(
      body?.error?.message || `Server error (HTTP ${status})`,
      'SERVER_ERROR',
      status
    );
  }

  // Other non-OK status codes
  throw new ProviderError(
    body?.error?.message || `Unexpected HTTP status ${status}`,
    'SERVER_ERROR',
    status
  );
}

// ============================================================================
// LLM REQUEST HANDLER
// ============================================================================

/**
 * Send an LLM chat completion request to the OpenAI API.
 *
 * Uses the OpenAI-compatible /chat/completions endpoint.
 * Response content is in `choices[0].message.content`, token usage in `usage`.
 *
 * @param apiKey OpenAI API key
 * @param request LLM request parameters
 * @param timeoutMs Request timeout in milliseconds (default: 30 seconds)
 * @returns LLM response with content, token usage, and response time
 * @throws ProviderError on HTTP 401, 429, 500, timeout, or network error
 */
export async function sendLLMRequest(
  apiKey: string,
  request: LLMRequest,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<LLMResponse> {
  const { controller, timerId } = createTimeoutController(timeoutMs);
  const startTime = Date.now();

  try {
    const body = JSON.stringify({
      model: request.model,
      messages: request.messages,
      ...(request.maxTokens !== undefined && { max_tokens: request.maxTokens }),
    });

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body,
      signal: controller.signal,
    });

    clearTimeout(timerId);
    const responseTimeMs = Date.now() - startTime;

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      handleErrorResponse(response.status, response.headers, responseBody, 'request');
    }

    const choice = responseBody.choices?.[0];
    const content = choice?.message?.content ?? '';
    const usage = responseBody.usage ?? {};

    return {
      content,
      tokensUsed: {
        prompt: usage.prompt_tokens ?? 0,
        completion: usage.completion_tokens ?? 0,
        total: usage.total_tokens ?? 0,
      },
      responseTimeMs,
      model: responseBody.model ?? request.model,
    };
  } catch (error) {
    clearTimeout(timerId);

    if (error instanceof ProviderError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ProviderError(
          `Request timed out after ${timeoutMs}ms`,
          'TIMEOUT'
        );
      }
      // Network / fetch errors
      throw new ProviderError(
        `Network error: ${error.message}`,
        'NETWORK_ERROR'
      );
    }

    throw new ProviderError('Unknown error occurred', 'NETWORK_ERROR');
  }
}

// ============================================================================
// TTS REQUEST HANDLER
// ============================================================================

/**
 * Send a text-to-speech request to the OpenAI API.
 *
 * Returns binary audio data (mp3 format) as a Buffer.
 * Supported models: tts-1, tts-1-hd
 * Supported voices: alloy, echo, fable, onyx, nova, shimmer
 *
 * @param apiKey OpenAI API key
 * @param request TTS request parameters (model, input text, voice, optional speed)
 * @param timeoutMs Request timeout in milliseconds (default: 30 seconds)
 * @returns TTS response with audio Buffer and response time
 * @throws ProviderError on HTTP 401, 429, 500, timeout, or network error
 */
export async function sendTTSRequest(
  apiKey: string,
  request: TTSRequest,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<TTSResponse> {
  const { controller, timerId } = createTimeoutController(timeoutMs);
  const startTime = Date.now();

  try {
    const bodyObj: Record<string, unknown> = {
      model: request.model,
      input: request.input,
      voice: request.voice,
    };

    if (request.speed !== undefined) {
      bodyObj.speed = request.speed;
    }

    const response = await fetch(`${OPENAI_BASE_URL}/audio/speech`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });

    clearTimeout(timerId);
    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      // For error responses, parse JSON body for error details
      const errorBody = await response.json().catch(() => ({}));
      handleErrorResponse(response.status, response.headers, errorBody, 'request');
    }

    // Successful response: binary audio data
    const arrayBuffer = await response.arrayBuffer();
    const audio = Buffer.from(arrayBuffer);

    return {
      audio,
      responseTimeMs,
    };
  } catch (error) {
    clearTimeout(timerId);

    if (error instanceof ProviderError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ProviderError(
          `Request timed out after ${timeoutMs}ms`,
          'TIMEOUT'
        );
      }
      throw new ProviderError(
        `Network error: ${error.message}`,
        'NETWORK_ERROR'
      );
    }

    throw new ProviderError('Unknown error occurred', 'NETWORK_ERROR');
  }
}

// ============================================================================
// KEY TESTING
// ============================================================================

/**
 * Test an OpenAI API key by sending a minimal request.
 *
 * For LLM keys: sends a minimal chat completion request (gpt-4o-mini, "Hi", max_tokens=5).
 * For TTS keys: sends a minimal TTS request (tts-1, "Hi", voice="alloy").
 * Uses a 3-second timeout to avoid long waits.
 *
 * @param apiKey OpenAI API key to test
 * @param type Type of key to test: 'llm' (default) or 'tts'
 * @returns Key test result with status, response time, and optional error details
 */
export async function testKey(
  apiKey: string,
  type: 'llm' | 'tts' = 'llm'
): Promise<KeyTestResult> {
  if (type === 'tts') {
    return testTTSKey(apiKey);
  }
  return testLLMKey(apiKey);
}

/**
 * Test an OpenAI API key using a minimal LLM request
 */
async function testLLMKey(apiKey: string): Promise<KeyTestResult> {
  const { controller, timerId } = createTimeoutController(KEY_TEST_TIMEOUT_MS);
  const startTime = Date.now();

  try {
    const body = JSON.stringify({
      model: KEY_TEST_LLM_MODEL,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: KEY_TEST_MAX_TOKENS,
    });

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body,
      signal: controller.signal,
    });

    clearTimeout(timerId);
    const responseTimeMs = Date.now() - startTime;

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      const result = handleErrorResponse(response.status, response.headers, responseBody, 'test') as KeyTestResult;
      return { ...result, responseTimeMs };
    }

    return {
      status: 'valid',
      responseTimeMs,
      providerName: 'OpenAI',
      modelName: KEY_TEST_LLM_MODEL,
    };
  } catch (error) {
    clearTimeout(timerId);

    if (error instanceof ProviderError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ProviderError(
          `Key test timed out after ${KEY_TEST_TIMEOUT_MS}ms`,
          'TIMEOUT'
        );
      }
      throw new ProviderError(
        `Network error during key test: ${error.message}`,
        'NETWORK_ERROR'
      );
    }

    throw new ProviderError('Unknown error during key test', 'NETWORK_ERROR');
  }
}

/**
 * Test an OpenAI API key using a minimal TTS request
 */
async function testTTSKey(apiKey: string): Promise<KeyTestResult> {
  const { controller, timerId } = createTimeoutController(KEY_TEST_TIMEOUT_MS);
  const startTime = Date.now();

  try {
    const body = JSON.stringify({
      model: KEY_TEST_TTS_MODEL,
      input: KEY_TEST_TTS_INPUT,
      voice: KEY_TEST_TTS_VOICE,
    });

    const response = await fetch(`${OPENAI_BASE_URL}/audio/speech`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body,
      signal: controller.signal,
    });

    clearTimeout(timerId);
    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const result = handleErrorResponse(response.status, response.headers, errorBody, 'test') as KeyTestResult;
      return { ...result, responseTimeMs };
    }

    return {
      status: 'valid',
      responseTimeMs,
      providerName: 'OpenAI',
      modelName: KEY_TEST_TTS_MODEL,
    };
  } catch (error) {
    clearTimeout(timerId);

    if (error instanceof ProviderError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ProviderError(
          `Key test timed out after ${KEY_TEST_TIMEOUT_MS}ms`,
          'TIMEOUT'
        );
      }
      throw new ProviderError(
        `Network error during key test: ${error.message}`,
        'NETWORK_ERROR'
      );
    }

    throw new ProviderError('Unknown error during key test', 'NETWORK_ERROR');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  sendLLMRequest,
  sendTTSRequest,
  testKey,
  ProviderError,
};
