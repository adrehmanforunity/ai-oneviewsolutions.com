/**
 * Amazon Polly API Client Library
 * Handles TTS requests, voice listing, key testing, and error handling
 *
 * Requirements: 1.7, 1.8, 1.9, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3
 */

const POLLY_BASE_URL = "https://polly.amazonaws.com";
const KEY_TEST_TIMEOUT_MS = 3000;
const DEFAULT_TIMEOUT_MS = 30000;
const KEY_TEST_TEXT = "Hi";
const KEY_TEST_VOICE_ID = "Joanna";

export interface TTSRequest {
  text: string;
  voiceId: string;
  engine?: "neural" | "standard";
  languageCode?: string;
  sampleRate?: string;
}

export interface TTSResponse {
  audio: Buffer;
  responseTimeMs: number;
}

export interface VoiceMetadata {
  id: string;
  name: string;
  languageCode: string;
  languageName: string;
  gender?: string;
  supportedEngines?: string[];
}

export interface KeyTestResult {
  status: "valid" | "invalid" | "rate_limited";
  responseTimeMs: number;
  providerName: string;
  voiceId?: string;
  errorCode?: string;
  errorMessage?: string;
  rateLimitResetTime?: Date;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public code: "INVALID_KEY" | "RATE_LIMITED" | "SERVER_ERROR" | "TIMEOUT" | "NETWORK_ERROR",
    public statusCode?: number
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function createTimeoutController(timeoutMs: number): { controller: AbortController; timerId: ReturnType<typeof setTimeout> } {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timerId };
}

function parseRetryAfter(header: string | null): Date | undefined {
  if (!header) return undefined;
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return new Date(Date.now() + seconds * 1000);
  const date = new Date(header);
  if (!isNaN(date.getTime())) return date;
  return undefined;
}

function handleErrorResponse(
  status: number,
  headers: Headers,
  body: any,
  context: "request" | "test"
): KeyTestResult | never {
  const message = body?.message || body?.Message || body?.error || "";
  if (status === 401) {
    if (context === "test") {
      return { status: "invalid", responseTimeMs: 0, providerName: "Amazon Polly", errorCode: "INVALID_KEY", errorMessage: message || "Invalid API key" };
    }
    throw new ProviderError(message || "Invalid API key", "INVALID_KEY", 401);
  }
  if (status === 429) {
    const rateLimitResetTime = parseRetryAfter(headers.get("retry-after"));
    if (context === "test") {
      return { status: "rate_limited", responseTimeMs: 0, providerName: "Amazon Polly", errorCode: "RATE_LIMITED", errorMessage: message || "Rate limit exceeded", rateLimitResetTime };
    }
    throw new ProviderError(message || "Rate limit exceeded", "RATE_LIMITED", 429);
  }
  if (status >= 500) {
    throw new ProviderError(message || `Server error (HTTP ${status})`, "SERVER_ERROR", status);
  }
  throw new ProviderError(message || `Unexpected HTTP status ${status}`, "SERVER_ERROR", status);
}

export async function sendTTSRequest(
  apiKey: string,
  request: TTSRequest,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<TTSResponse> {
  const { controller, timerId } = createTimeoutController(timeoutMs);
  const startTime = Date.now();
  try {
    const bodyObj: Record<string, unknown> = {
      Text: request.text,
      VoiceId: request.voiceId,
      OutputFormat: "mp3",
    };
    if (request.engine !== undefined) bodyObj.Engine = request.engine;
    if (request.languageCode !== undefined) bodyObj.LanguageCode = request.languageCode;
    if (request.sampleRate !== undefined) bodyObj.SampleRate = request.sampleRate;

    const response = await fetch(`${POLLY_BASE_URL}/v1/speech`, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });
    clearTimeout(timerId);
    const responseTimeMs = Date.now() - startTime;
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      handleErrorResponse(response.status, response.headers, errorBody, "request");
    }
    const arrayBuffer = await response.arrayBuffer();
    return { audio: Buffer.from(arrayBuffer), responseTimeMs };
  } catch (error) {
    clearTimeout(timerId);
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error) {
      if (error.name === "AbortError") throw new ProviderError(`Request timed out after ${timeoutMs}ms`, "TIMEOUT");
      throw new ProviderError(`Network error: ${error.message}`, "NETWORK_ERROR");
    }
    throw new ProviderError("Unknown error occurred", "NETWORK_ERROR");
  }
}

export async function listVoices(
  apiKey: string,
  languageCode?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<VoiceMetadata[]> {
  const { controller, timerId } = createTimeoutController(timeoutMs);
  try {
    const url = languageCode
      ? `${POLLY_BASE_URL}/v1/voices?LanguageCode=${encodeURIComponent(languageCode)}`
      : `${POLLY_BASE_URL}/v1/voices`;

    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(apiKey),
      signal: controller.signal,
    });
    clearTimeout(timerId);
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      handleErrorResponse(response.status, response.headers, responseBody, "request");
    }
    const voices: any[] = responseBody.Voices ?? [];
    return voices.map((v) => ({
      id: v.Id,
      name: v.Name,
      languageCode: v.LanguageCode,
      languageName: v.LanguageName,
      gender: v.Gender,
      supportedEngines: v.SupportedEngines,
    }));
  } catch (error) {
    clearTimeout(timerId);
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error) {
      if (error.name === "AbortError") throw new ProviderError(`Request timed out after ${timeoutMs}ms`, "TIMEOUT");
      throw new ProviderError(`Network error: ${error.message}`, "NETWORK_ERROR");
    }
    throw new ProviderError("Unknown error occurred", "NETWORK_ERROR");
  }
}

export async function testKey(apiKey: string): Promise<KeyTestResult> {
  const { controller, timerId } = createTimeoutController(KEY_TEST_TIMEOUT_MS);
  const startTime = Date.now();
  try {
    const bodyObj = {
      Text: KEY_TEST_TEXT,
      VoiceId: KEY_TEST_VOICE_ID,
      OutputFormat: "mp3",
    };

    const response = await fetch(`${POLLY_BASE_URL}/v1/speech`, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });
    clearTimeout(timerId);
    const responseTimeMs = Date.now() - startTime;
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const result = handleErrorResponse(response.status, response.headers, errorBody, "test") as KeyTestResult;
      return { ...result, responseTimeMs };
    }
    return { status: "valid", responseTimeMs, providerName: "Amazon Polly", voiceId: KEY_TEST_VOICE_ID };
  } catch (error) {
    clearTimeout(timerId);
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error) {
      if (error.name === "AbortError") throw new ProviderError(`Key test timed out after ${KEY_TEST_TIMEOUT_MS}ms`, "TIMEOUT");
      throw new ProviderError(`Network error during key test: ${error.message}`, "NETWORK_ERROR");
    }
    throw new ProviderError("Unknown error during key test", "NETWORK_ERROR");
  }
}

const amazonPollyProvider = { sendTTSRequest, listVoices, testKey, ProviderError };
export default amazonPollyProvider;
