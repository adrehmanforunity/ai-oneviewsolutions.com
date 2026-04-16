/**
 * Claude (Anthropic) API Client Library
 * Handles LLM requests, key testing, and error handling
 *
 * Features:
 * - Authenticate with API key via x-api-key header (NOT Bearer)
 * - Required anthropic-version header: 2023-06-01
 * - Send LLM chat completion requests via /messages endpoint
 * - Test API key validity with minimal requests
 * - Handle errors: 401 (invalid), 429 (rate limited), 500/529 (server error), timeout, network errors
 *
 * Note: Claude does NOT support STT capability.
 * Note: Claude does NOT support 'system' role in messages array —
 *       system prompts go in a separate `system` field.
 *
 * Requirements: 1.7, 1.8, 1.9, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const CLAUDE_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const KEY_TEST_TIMEOUT_MS = 3000;
const DEFAULT_TIMEOUT_MS = 30000;

/** Model used for key testing (minimal, fast) */
const KEY_TEST_LLM_MODEL = 'claude-sonnet-4-20250514';
const KEY_TEST_MAX_TOKENS = 5;

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  maxTokens?: number;
  /** Optional system prompt (sent as separate `system` field, not in messages) */
  system?: string;
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
 * Build common headers for Claude API requests
 */
function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
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
        providerName: 'Claude',
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
        providerName: 'Claude',
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
 * Send an LLM chat completion request to the Claude API.
 *
 * Claude uses the /messages endpoint with a different response format than OpenAI-compatible APIs.
 * The response content is in `content[0].text`, and token usage is in `usage.input_tokens`
 * and `usage.output_tokens`.
 *
 * Note: Claude does NOT support 'system' role in the messages array.
 * Pass system prompts via the `request.system` field instead.
 *
 * @param apiKey Claude API key
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
    const bodyObj: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens ?? 1024,
    };

    if (request.system) {
      bodyObj.system = request.system;
    }

    const response = await fetch(`${CLAUDE_BASE_URL}/messages`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });

    clearTimeout(timerId);
    const responseTimeMs = Date.now() - startTime;

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      handleErrorResponse(response.status, response.headers, responseBody, 'request');
    }

    // Claude response format: content[0].text
    const content = responseBody.content?.[0]?.text ?? '';
    const usage = responseBody.usage ?? {};

    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;

    return {
      content,
      tokensUsed: {
        prompt: inputTokens,
        completion: outputTokens,
        total: inputTokens + outputTokens,
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
// KEY TESTING
// ============================================================================

/**
 * Test a Claude API key by sending a minimal LLM request.
 *
 * Uses a 3-second timeout and a minimal prompt to avoid consuming quota.
 * Returns status: 'valid' | 'invalid' | 'rate_limited'.
 *
 * @param apiKey Claude API key to test
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

    const response = await fetch(`${CLAUDE_BASE_URL}/messages`, {
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
      providerName: 'Claude',
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

export default {
  sendLLMRequest,
  testKey,
  ProviderError,
};
