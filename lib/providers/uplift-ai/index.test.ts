import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendTTSRequest, listVoices, testKey, ProviderError } from "./index";

function mockBin(status: number, headers: Record<string, string> = {}): Response {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(headers), arrayBuffer: async () => new ArrayBuffer(8), json: async () => ({}) } as unknown as Response;
}
function mockJson(status: number, body: any, headers: Record<string, string> = {}): Response {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(headers), json: async () => body, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Response;
}
function netErr(msg = "Failed to fetch"): Promise<never> { return Promise.reject(new TypeError(msg)); }
function abortErr(): Promise<never> { const e = new Error("The operation was aborted"); e.name = "AbortError"; return Promise.reject(e); }

const KEY = "uplift_test_key";
const TTS_REQ = { voiceId: "ur-PK-UroojNeural", text: "ہیلو دنیا" };
const VOICES_RESP = { voices: [
  { voice_id: "ur-PK-UroojNeural", name: "Urooj", language: "ur", gender: "female", tone: "warm", preview_url: "https://example.com/urooj.mp3" },
  { voice_id: "ur-PK-AsadNeural", name: "Asad", language: "ur", gender: "male" },
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
    expect(url).toBe("https://api.upliftai.com/v1/tts");
  });

  it("includes Authorization Bearer header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await sendTTSRequest(KEY, TTS_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts?.headers as any)["Authorization"]).toBe(Bearer );
  });

  it("includes speed and pitch when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await sendTTSRequest(KEY, { ...TTS_REQ, speed: 1.2, pitch: 5 });
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.speed).toBe(1.2);
    expect(body.pitch).toBe(5);
  });

  it("omits speed and pitch when not provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await sendTTSRequest(KEY, TTS_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.speed).toBeUndefined();
    expect(body.pitch).toBeUndefined();
  });

  it("sends Urdu text correctly", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await sendTTSRequest(KEY, TTS_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.text).toBe("ہیلو دنیا");
  });

  it("throws INVALID_KEY on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(401, { message: "Invalid API key" }));
    await expect(sendTTSRequest(KEY, TTS_REQ)).rejects.toMatchObject({ code: "INVALID_KEY", statusCode: 401 });
  });

  it("throws RATE_LIMITED on 429", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(429, { message: "Rate limit exceeded" }, { "retry-after": "30" }));
    await expect(sendTTSRequest(KEY, TTS_REQ)).rejects.toMatchObject({ code: "RATE_LIMITED", statusCode: 429 });
  });

  it("throws SERVER_ERROR on 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(500, { message: "Server error" }));
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

describe("listVoices", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("returns mapped VoiceMetadata array on 200", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, VOICES_RESP));
    const voices = await listVoices(KEY);
    expect(voices).toHaveLength(2);
    expect(voices[0].voiceId).toBe("ur-PK-UroojNeural");
    expect(voices[0].name).toBe("Urooj");
    expect(voices[0].language).toBe("ur");
    expect(voices[0].gender).toBe("female");
    expect(voices[0].tone).toBe("warm");
    expect(voices[0].previewUrl).toBe("https://example.com/urooj.mp3");
  });

  it("GETs the correct voices endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, VOICES_RESP));
    await listVoices(KEY);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.upliftai.com/v1/voices");
  });

  it("includes Authorization Bearer header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, VOICES_RESP));
    await listVoices(KEY);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts?.headers as any)["Authorization"]).toBe(Bearer );
  });

  it("returns empty array when no voices", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { voices: [] }));
    expect(await listVoices(KEY)).toHaveLength(0);
  });

  it("handles missing optional fields gracefully", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { voices: [{ voice_id: "x", name: "Test", language: "ur" }] }));
    const voices = await listVoices(KEY);
    expect(voices[0].gender).toBeUndefined();
    expect(voices[0].tone).toBeUndefined();
    expect(voices[0].previewUrl).toBeUndefined();
  });

  it("throws INVALID_KEY on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(401, { message: "Unauthorized" }));
    await expect(listVoices(KEY)).rejects.toMatchObject({ code: "INVALID_KEY" });
  });

  it("throws SERVER_ERROR on 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(500, { message: "Server error" }));
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
    expect(r.providerName).toBe("Uplift AI");
    expect(r.voiceId).toBe("ur-PK-UroojNeural");
    expect(r.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("returns invalid on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(401, { message: "Invalid API key" }));
    const r = await testKey(KEY);
    expect(r.status).toBe("invalid");
    expect(r.errorCode).toBe("INVALID_KEY");
    expect(r.providerName).toBe("Uplift AI");
  });

  it("returns rate_limited on 429 with retry-after", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(429, { message: "Rate limit exceeded" }, { "retry-after": "30" }));
    const r = await testKey(KEY);
    expect(r.status).toBe("rate_limited");
    expect(r.errorCode).toBe("RATE_LIMITED");
    expect(r.rateLimitResetTime).toBeInstanceOf(Date);
  });

  it("parses retry-after header as seconds", async () => {
    const now = Date.now();
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(429, { message: "Rate limited" }, { "retry-after": "60" }));
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
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(500, { message: "Server error" }));
    await expect(testKey(KEY)).rejects.toMatchObject({ code: "SERVER_ERROR" });
  });

  it("uses Urdu voice and Urdu text for key test", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await testKey(KEY);
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.upliftai.com/v1/tts");
    const body = JSON.parse(opts?.body as string);
    expect(body.voice_id).toBe("ur-PK-UroojNeural");
    expect(body.text).toBe("ہیلو");
  });

  it("includes responseTimeMs in all result types", async () => {
    for (const mock of [mockBin(200), mockJson(401, { message: "Unauthorized" }), mockJson(429, { message: "Rate limited" })]) {
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
