/**
 * Unit Tests for ElevenLabs API Client
 * Requirements: 1.7, 1.8, 1.9, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendTTSRequest, sendSTTRequest, listVoices, testKey, ProviderError } from "./index";

function mockBin(status: number, headers: Record<string, string> = {}): Response {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(headers), arrayBuffer: async () => new ArrayBuffer(8), json: async () => ({}) } as unknown as Response;
}
function mockJson(status: number, body: any, headers: Record<string, string> = {}): Response {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(headers), json: async () => body, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Response;
}
function netErr(msg = "Failed to fetch"): Promise<never> { return Promise.reject(new TypeError(msg)); }
function abortErr(): Promise<never> { const e = new Error("The operation was aborted"); e.name = "AbortError"; return Promise.reject(e); }

const KEY = "el_test_key";
const TTS_REQ = { voiceId: "21m00Tcm4TlvDq8ikWAM", text: "Hello world test" };
const STT_REQ = { audio: Buffer.from([0x52, 0x49, 0x46, 0x46]) };
const VOICES_RESP = { voices: [
  { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", labels: { gender: "female", accent: "american", description: "calm" }, preview_url: "https://example.com/r.mp3" },
  { voice_id: "abc", name: "Domi", labels: { gender: "female" }, preview_url: null },
]};

describe("sendTTSRequest", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("returns Buffer on 200", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    const r = await sendTTSRequest(KEY, TTS_REQ);
    expect(r.audio).toBeInstanceOf(Buffer);
    expect(r.audio.length).toBe(8);
    expect(r.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("POSTs to correct TTS endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await sendTTSRequest(KEY, TTS_REQ);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM");
  });

  it("includes xi-api-key header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await sendTTSRequest(KEY, TTS_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts?.headers as any)["xi-api-key"]).toBe(KEY);
  });

  it("includes voice_settings when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await sendTTSRequest(KEY, { ...TTS_REQ, voiceSettings: { stability: 0.7, similarityBoost: 0.8 } });
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.voice_settings.stability).toBe(0.7);
    expect(body.voice_settings.similarity_boost).toBe(0.8);
  });

  it("omits voice_settings when not provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await sendTTSRequest(KEY, TTS_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.voice_settings).toBeUndefined();
  });

  it("throws INVALID_KEY on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(401, { detail: "Invalid API key" }));
    await expect(sendTTSRequest(KEY, TTS_REQ)).rejects.toMatchObject({ code: "INVALID_KEY", statusCode: 401 });
  });

  it("throws RATE_LIMITED on 429", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(429, { detail: "Rate limit exceeded" }, { "retry-after": "30" }));
    await expect(sendTTSRequest(KEY, TTS_REQ)).rejects.toMatchObject({ code: "RATE_LIMITED", statusCode: 429 });
  });

  it("throws SERVER_ERROR on 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(500, { detail: "Server error" }));
    await expect(sendTTSRequest(KEY, TTS_REQ)).rejects.toMatchObject({ code: "SERVER_ERROR", statusCode: 500 });
  });

  it("throws TIMEOUT on AbortError", async () => {
    vi.mocked(fetch).mockImplementationOnce(() => abortErr());
    await expect(sendTTSRequest(KEY, TTS_REQ, 100)).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("throws NETWORK_ERROR on fetch failure", async () => {
    vi.mocked(fetch).mockImplementationOnce(() => netErr());
    await expect(sendTTSRequest(KEY, TTS_REQ)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
});

describe("sendSTTRequest", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("returns transcription text on 200", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { text: "Hello world" }));
    const r = await sendSTTRequest(KEY, STT_REQ);
    expect(r.text).toBe("Hello world");
    expect(r.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("POSTs to correct STT endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { text: "test" }));
    await sendSTTRequest(KEY, STT_REQ);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
  });

  it("includes xi-api-key header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { text: "test" }));
    await sendSTTRequest(KEY, STT_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts?.headers as any)["xi-api-key"]).toBe(KEY);
  });

  it("sends FormData with audio file", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { text: "test" }));
    await sendSTTRequest(KEY, STT_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect(opts?.body).toBeInstanceOf(FormData);
  });

  it("uses custom modelId when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { text: "test" }));
    await sendSTTRequest(KEY, { ...STT_REQ, modelId: "scribe_v2" });
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts?.body as FormData).get("model_id")).toBe("scribe_v2");
  });

  it("throws INVALID_KEY on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(401, { detail: "Unauthorized" }));
    await expect(sendSTTRequest(KEY, STT_REQ)).rejects.toMatchObject({ code: "INVALID_KEY" });
  });

  it("throws RATE_LIMITED on 429", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(429, { detail: "Rate limited" }));
    await expect(sendSTTRequest(KEY, STT_REQ)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("throws SERVER_ERROR on 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(500, { detail: "Server error" }));
    await expect(sendSTTRequest(KEY, STT_REQ)).rejects.toMatchObject({ code: "SERVER_ERROR" });
  });

  it("throws TIMEOUT on AbortError", async () => {
    vi.mocked(fetch).mockImplementationOnce(() => abortErr());
    await expect(sendSTTRequest(KEY, STT_REQ, 100)).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("throws NETWORK_ERROR on fetch failure", async () => {
    vi.mocked(fetch).mockImplementationOnce(() => netErr());
    await expect(sendSTTRequest(KEY, STT_REQ)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("handles empty transcription gracefully", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { text: "" }));
    const r = await sendSTTRequest(KEY, STT_REQ);
    expect(r.text).toBe("");
  });
});

describe("listVoices", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("returns mapped VoiceMetadata array on 200", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, VOICES_RESP));
    const voices = await listVoices(KEY);
    expect(voices).toHaveLength(2);
    expect(voices[0].voiceId).toBe("21m00Tcm4TlvDq8ikWAM");
    expect(voices[0].name).toBe("Rachel");
    expect(voices[0].gender).toBe("female");
    expect(voices[0].accent).toBe("american");
    expect(voices[0].description).toBe("calm");
    expect(voices[0].previewUrl).toBe("https://example.com/r.mp3");
  });

  it("GETs the correct voices endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, VOICES_RESP));
    await listVoices(KEY);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/voices");
  });

  it("includes xi-api-key header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, VOICES_RESP));
    await listVoices(KEY);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts?.headers as any)["xi-api-key"]).toBe(KEY);
  });

  it("returns empty array when no voices", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { voices: [] }));
    expect(await listVoices(KEY)).toHaveLength(0);
  });

  it("handles missing labels gracefully", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { voices: [{ voice_id: "x", name: "Test" }] }));
    const voices = await listVoices(KEY);
    expect(voices[0].gender).toBeUndefined();
    expect(voices[0].accent).toBeUndefined();
  });

  it("throws INVALID_KEY on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(401, { detail: "Unauthorized" }));
    await expect(listVoices(KEY)).rejects.toMatchObject({ code: "INVALID_KEY" });
  });

  it("throws SERVER_ERROR on 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(500, { detail: "Server error" }));
    await expect(listVoices(KEY)).rejects.toMatchObject({ code: "SERVER_ERROR" });
  });

  it("throws NETWORK_ERROR on fetch failure", async () => {
    vi.mocked(fetch).mockImplementationOnce(() => netErr());
    await expect(listVoices(KEY)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
});

describe("testKey", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("returns valid on 200", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    const r = await testKey(KEY);
    expect(r.status).toBe("valid");
    expect(r.providerName).toBe("ElevenLabs");
    expect(r.modelName).toBe("eleven_monolingual_v1");
    expect(r.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("returns invalid on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(401, { detail: "Invalid API key" }));
    const r = await testKey(KEY);
    expect(r.status).toBe("invalid");
    expect(r.errorCode).toBe("INVALID_KEY");
    expect(r.providerName).toBe("ElevenLabs");
  });

  it("returns rate_limited on 429 with retry-after", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(429, { detail: "Rate limit exceeded" }, { "retry-after": "30" }));
    const r = await testKey(KEY);
    expect(r.status).toBe("rate_limited");
    expect(r.errorCode).toBe("RATE_LIMITED");
    expect(r.rateLimitResetTime).toBeInstanceOf(Date);
  });

  it("parses retry-after header as seconds", async () => {
    const now = Date.now();
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(429, { detail: "Rate limited" }, { "retry-after": "60" }));
    const r = await testKey(KEY);
    const t = r.rateLimitResetTime!.getTime();
    expect(t).toBeGreaterThan(now + 55000);
    expect(t).toBeLessThan(now + 65000);
  });

  it("throws TIMEOUT on AbortError", async () => {
    vi.mocked(fetch).mockImplementationOnce(() => abortErr());
    await expect(testKey(KEY)).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("throws NETWORK_ERROR on fetch failure", async () => {
    vi.mocked(fetch).mockImplementationOnce(() => netErr());
    await expect(testKey(KEY)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("throws SERVER_ERROR on 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(500, { detail: "Server error" }));
    await expect(testKey(KEY)).rejects.toMatchObject({ code: "SERVER_ERROR" });
  });

  it("uses Rachel voice and eleven_monolingual_v1 for key test", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await testKey(KEY);
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("21m00Tcm4TlvDq8ikWAM");
    const body = JSON.parse(opts?.body as string);
    expect(body.model_id).toBe("eleven_monolingual_v1");
    expect(body.text).toBe("Hi");
  });

  it("includes responseTimeMs in all result types", async () => {
    for (const mock of [mockBin(200), mockJson(401, { detail: "Unauthorized" }), mockJson(429, { detail: "Rate limited" })]) {
      vi.mocked(fetch).mockResolvedValueOnce(mock);
      const r = await testKey(KEY);
      expect(typeof r.responseTimeMs).toBe("number");
      expect(r.responseTimeMs).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("ProviderError", () => {
  it("is an instance of Error", () => { expect(new ProviderError("t", "INVALID_KEY")).toBeInstanceOf(Error); });
  it("has name ProviderError", () => { expect(new ProviderError("t", "TIMEOUT").name).toBe("ProviderError"); });
  it("stores error code", () => { expect(new ProviderError("t", "RATE_LIMITED").code).toBe("RATE_LIMITED"); });
  it("stores statusCode when provided", () => { expect(new ProviderError("t", "SERVER_ERROR", 503).statusCode).toBe(503); });
  it("has undefined statusCode when not provided", () => { expect(new ProviderError("t", "NETWORK_ERROR").statusCode).toBeUndefined(); });
  it("supports all error codes", () => {
    for (const code of ["INVALID_KEY", "RATE_LIMITED", "SERVER_ERROR", "TIMEOUT", "NETWORK_ERROR"] as const)
      expect(new ProviderError("t", code).code).toBe(code);
  });
});
