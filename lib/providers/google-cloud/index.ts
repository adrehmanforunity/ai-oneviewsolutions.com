/**
 * Google Cloud TTS/STT API Client Library
 * Handles TTS requests, STT requests, voice listing, key testing, and error handling
 *
 * Requirements: 1.7, 1.8, 1.9, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3
 */

const GOOGLE_TTS_BASE_URL = "https://texttospeech.googleapis.com/v1";
const GOOGLE_STT_BASE_URL = "https://speech.googleapis.com/v1";
const KEY_TEST_TIMEOUT_MS = 3000;
const DEFAULT_TIMEOUT_MS = 30000;
const KEY_TEST_TEXT = "Hi";
const KEY_TEST_VOICE_NAME = "en-US-Standard-A";
const KEY_TEST_LANGUAGE_CODE = "en-US";

export interface TTSRequest {
  text: string;
  voiceName: string;
  languageCode: string;
  speakingRate?: number;
  pitch?: number;
}

export interface TTSResponse {
  audio: Buffer;
  responseTimeMs: number;
}

export interface STTRequest {
  audio: Buffer;
  languageCode?: string;
  sampleRateHertz?: number;
}

export interface STTResponse {
  text: string;
  responseTimeMs: number;
}

export interface VoiceMetadata {
  name: string;
  languageCodes: string[];
  gender?: string;
  naturalSampleRateHertz?: number;
}

export interface KeyTestResult {
  status: "valid" | "invalid" | "rate_limited";
  responseTimeMs: number;
  providerName: string;
  voiceName?: string;
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
  const message = body?.error?.message || body?.message || body?.error || "";
  if (status === 401) {
    if (context === "test") {
      return { status: "invalid", responseTimeMs: 0, providerName: "Google Cloud", errorCode: "INVALID_KEY", errorMessage: message || "Invalid API key" };
    }
    throw new ProviderError(message || "Invalid API key", "INVALID_KEY", 401);
  }
  if (status === 429) {
    const rateLimitResetTime = parseRetryAfter(headers.get("retry-after"));
    if (context === "test") {
      return { status: "rate_limited", responseTimeMs: 0, providerName: "Google Cloud", errorCode: "RATE_LIMITED", errorMessage: message || "Rate limit exceeded", rateLimitResetTime };
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
    const audioConfig: Record<string, unknown> = { audioEncoding: "MP3" };
    if (request.speakingRate !== undefined) audioConfig.speakingRate = request.speakingRate;
    if (request.pitch !== undefined) audioConfig.pitch = request.pitch;

    const bodyObj = {
      input: { text: request.text },
      voice: { languageCode: request.languageCode, name: request.voiceName },
      audioConfig,
    };

    const response = await fetch(`${GOOGLE_TTS_BASE_URL}/text:synthesize`, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });
    clearTimeout(timerId);
    const responseTimeMs = Date.now() - startTime;
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      handleErrorResponse(response.status, response.headers, responseBody, "request");
    }
    const audio = Buffer.from(responseBody.audioContent, "base64");
    return { audio, responseTimeMs };
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

export async function sendSTTRequest(
  apiKey: string,
  request: STTRequest,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<STTResponse> {
  const { controller, timerId } = createTimeoutController(timeoutMs);
  const startTime = Date.now();
  try {
    const audioBase64 = Buffer.from(request.audio).toString("base64");
    const bodyObj = {
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: request.sampleRateHertz ?? 16000,
        languageCode: request.languageCode ?? "en-US",
      },
      audio: { content: audioBase64 },
    };

    const response = await fetch(`${GOOGLE_STT_BASE_URL}/speech:recognize`, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });
    clearTimeout(timerId);
    const responseTimeMs = Date.now() - startTime;
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      handleErrorResponse(response.status, response.headers, responseBody, "request");
    }
    const transcript = responseBody?.results?.[0]?.alternatives?.[0]?.transcript ?? "";
    return { text: transcript, responseTimeMs };
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
      ? `${GOOGLE_TTS_BASE_URL}/voices?languageCode=${encodeURIComponent(languageCode)}`
      : `${GOOGLE_TTS_BASE_URL}/voices`;

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
    const voices: any[] = responseBody.voices ?? [];
    return voices.map((v) => ({
      name: v.name,
      languageCodes: v.languageCodes ?? [],
      gender: v.ssmlGender,
      naturalSampleRateHertz: v.naturalSampleRateHertz,
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
      input: { text: KEY_TEST_TEXT },
      voice: { languageCode: KEY_TEST_LANGUAGE_CODE, name: KEY_TEST_VOICE_NAME },
      audioConfig: { audioEncoding: "MP3" },
    };

    const response = await fetch(`${GOOGLE_TTS_BASE_URL}/text:synthesize`, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });
    clearTimeout(timerId);
    const responseTimeMs = Date.now() - startTime;
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      const result = handleErrorResponse(response.status, response.headers, responseBody, "test") as KeyTestResult;
      return { ...result, responseTimeMs };
    }
    return { status: "valid", responseTimeMs, providerName: "Google Cloud", voiceName: KEY_TEST_VOICE_NAME };
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

export default { sendTTSRequest, sendSTTRequest, listVoices, testKey, ProviderError };
