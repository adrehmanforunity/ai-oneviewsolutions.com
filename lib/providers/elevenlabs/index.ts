/**
 * ElevenLabs API Client Library
 * Handles TTS requests, STT requests, voice listing, key testing, and error handling
 *
 * Requirements: 1.7, 1.8, 1.9, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3
 */

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";
const KEY_TEST_TIMEOUT_MS = 3000;
const DEFAULT_TIMEOUT_MS = 30000;
const KEY_TEST_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const KEY_TEST_MODEL_ID = "eleven_monolingual_v1";
const KEY_TEST_TEXT = "Hi";

export interface TTSRequest {
  voiceId: string;
  text: string;
  modelId?: string;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  };
}

export interface TTSResponse {
  audio: Buffer;
  responseTimeMs: number;
}

export interface STTRequest {
  audio: Buffer;
  modelId?: string;
}

export interface STTResponse {
  text: string;
  responseTimeMs: number;
}

export interface VoiceMetadata {
  voiceId: string;
  name: string;
  gender?: string;
  accent?: string;
  description?: string;
  previewUrl?: string;
}

export interface KeyTestResult {
  status: "valid" | "invalid" | "rate_limited";
  responseTimeMs: number;
  providerName: string;
  modelName?: string;
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
    "xi-api-key": apiKey,
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
  if (status === 401) {
    if (context === "test") {
      return {
        status: "invalid",
        responseTimeMs: 0,
        providerName: "ElevenLabs",
        errorCode: "INVALID_KEY",
        errorMessage: body?.detail?.message || body?.detail || "Invalid API key",
      };
    }
    throw new ProviderError(body?.detail?.message || body?.detail || "Invalid API key", "INVALID_KEY", 401);
  }
  if (status === 429) {
    const rateLimitResetTime = parseRetryAfter(headers.get("retry-after"));
    if (context === "test") {
      return {
        status: "rate_limited",
        responseTimeMs: 0,
        providerName: "ElevenLabs",
        errorCode: "RATE_LIMITED",
        errorMessage: body?.detail?.message || body?.detail || "Rate limit exceeded",
        rateLimitResetTime,
      };
    }
    throw new ProviderError(body?.detail?.message || body?.detail || "Rate limit exceeded", "RATE_LIMITED", 429);
  }
  if (status >= 500) {
    throw new ProviderError(body?.detail?.message || body?.detail || `Server error (HTTP ${status})`, "SERVER_ERROR", status);
  }
  throw new ProviderError(body?.detail?.message || body?.detail || `Unexpected HTTP status ${status}`, "SERVER_ERROR", status);
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
      text: request.text,
      model_id: request.modelId ?? "eleven_monolingual_v1",
    };
    if (request.voiceSettings) {
      const vs = request.voiceSettings;
      bodyObj.voice_settings = {
        ...(vs.stability !== undefined && { stability: vs.stability }),
        ...(vs.similarityBoost !== undefined && { similarity_boost: vs.similarityBoost }),
        ...(vs.style !== undefined && { style: vs.style }),
        ...(vs.useSpeakerBoost !== undefined && { use_speaker_boost: vs.useSpeakerBoost }),
      };
    }
    const response = await fetch(`${ELEVENLABS_BASE_URL}/v1/text-to-speech/${request.voiceId}`, {
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

export async function sendSTTRequest(
  apiKey: string,
  request: STTRequest,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<STTResponse> {
  const { controller, timerId } = createTimeoutController(timeoutMs);
  const startTime = Date.now();
  try {
    const formData = new FormData();
    const audioBlob = new Blob([request.audio], { type: "audio/wav" });
    formData.append("file", audioBlob, "audio.wav");
    formData.append("model_id", request.modelId ?? "scribe_v1");
    const response = await fetch(`${ELEVENLABS_BASE_URL}/v1/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timerId);
    const responseTimeMs = Date.now() - startTime;
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      handleErrorResponse(response.status, response.headers, responseBody, "request");
    }
    return { text: responseBody.text ?? "", responseTimeMs };
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
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<VoiceMetadata[]> {
  const { controller, timerId } = createTimeoutController(timeoutMs);
  try {
    const response = await fetch(`${ELEVENLABS_BASE_URL}/v1/voices`, {
      method: "GET",
      headers: { "xi-api-key": apiKey },
      signal: controller.signal,
    });
    clearTimeout(timerId);
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      handleErrorResponse(response.status, response.headers, responseBody, "request");
    }
    const voices: any[] = responseBody.voices ?? [];
    return voices.map((v) => ({
      voiceId: v.voice_id,
      name: v.name,
      gender: v.labels?.gender,
      accent: v.labels?.accent,
      description: v.labels?.description,
      previewUrl: v.preview_url,
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
    const body = JSON.stringify({ text: KEY_TEST_TEXT, model_id: KEY_TEST_MODEL_ID });
    const response = await fetch(`${ELEVENLABS_BASE_URL}/v1/text-to-speech/${KEY_TEST_VOICE_ID}`, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body,
      signal: controller.signal,
    });
    clearTimeout(timerId);
    const responseTimeMs = Date.now() - startTime;
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const result = handleErrorResponse(response.status, response.headers, errorBody, "test") as KeyTestResult;
      return { ...result, responseTimeMs };
    }
    return { status: "valid", responseTimeMs, providerName: "ElevenLabs", modelName: KEY_TEST_MODEL_ID };
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

const elevenlabsProvider = { sendTTSRequest, sendSTTRequest, listVoices, testKey, ProviderError };
export default elevenlabsProvider;
