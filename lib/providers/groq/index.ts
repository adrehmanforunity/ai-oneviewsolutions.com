/**
 * Groq API Client Library
 * Handles LLM requests, STT requests, key testing, and error handling
 *
 * Features:
 * - Authenticate with API key via Bearer token
 * - Send LLM chat completion requests
 * - Send STT (speech-to-text) transcription requests
 * - Test API key validity with minimal requests
 * - Handle errors: 401 (invalid), 429 (rate limited), 500 (server error), timeout, network errors
 *
 * Requirements: 1.7, 1.8, 1.9, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const KEY_TEST_TIMEOUT_MS = 3000;
const DEFAULT_TIMEOUT_MS = 30000;

/** Model used for key testing (minimal, fast, cheap) */
const KEY_TEST_LLM_MODEL = 'llama-3.1-8b-instant';
const KEY_TEST_MAX_TOKENS = 5;

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

export interface STTRequest {
  audio: Buffer;
  model: string;
  language?: string;
}

export interface STTResponse {
  text: string;
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
 * Build common headers for Groq API requests
 */
function buildHeaders(apiKey: string, contentType = 'application/json'): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': contentType,
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
        providerName: 'Groq',
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
    const retryAfterHeader = headers.get('retry-after') || headers.get('x-ratelimit-reset-requests');
    const rateLimitResetTime = parseRetryAfter(retryAfterHeader);

    if (context === 'test') {
      return {
        status: 'rate_limited',
        responseTimeMs: 0, // caller will fill in
        providerName: 'Groq',
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
 * Send an LLM chat completion request to the Groq API.
 *
 * @param apiKey Groq API key
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

    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
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
// STT REQUEST HANDLER
// ============================================================================

/**
 * Send a speech-to-text transcription request to the Groq API.
 *
 * @param apiKey Groq API key
 * @param request STT request parameters (audio buffer, model, optional language)
 * @param timeoutMs Request timeout in milliseconds (default: 30 seconds)
 * @returns STT response with transcription text and response time
 * @throws ProviderError on HTTP 401, 429, 500, timeout, or network error
 */
export async function sendSTTRequest(
  apiKey: string,
  request: STTRequest,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<STTResponse> {
  const { controller, timerId } = createTimeoutController(timeoutMs);
  const startTime = Date.now();

  try {
    const formData = new FormData();
    const audioBlob = new Blob([request.audio as unknown as ArrayBuffer], { type: 'audio/wav' });
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', request.model);
    if (request.language) {
      formData.append('language', request.language);
    }

    // For FormData, we only set Authorization; Content-Type is set automatically with boundary
    const response = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timerId);
    const responseTimeMs = Date.now() - startTime;

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      handleErrorResponse(response.status, response.headers, responseBody, 'request');
    }

    return {
      text: responseBody.text ?? '',
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
 * Test a Groq API key by sending a minimal LLM request.
 *
 * Uses a 3-second timeout and a minimal prompt to avoid consuming quota.
 * Returns status: 'valid' | 'invalid' | 'rate_limited'.
 *
 * @param apiKey Groq API key to test
 * @returns Key test result with status, response time, and optional error details
 */
export async function testKey(apiKey: string): Promise<KeyTestResult> {
  const { controller, timerId } = createTimeoutController(KEY_TEST_TIMEOUT_MS);
  const startTime = Date.now();

  try {
    const body = JSON.stringify({
      model: KEY_TEST_LLM_MODEL,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: KEY_TEST_MAX_TOKENS,
    });

    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
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
      providerName: 'Groq',
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

// ============================================================================
// EXPORTS
// ============================================================================

const groqProvider = { sendLLMRequest, sendSTTRequest, testKey, ProviderError };
export default groqProvider;
