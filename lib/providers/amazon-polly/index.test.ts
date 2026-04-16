/**
 * Unit Tests for Amazon Polly API Client
 * Requirements: 1.7, 1.8, 1.9, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendTTSRequest, listVoices, testKey, ProviderError } from "./index";

function mockBin(status: number, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    arrayBuffer: async () => new ArrayBuffer(8),
    json: async () => ({}),
  } as unknown as Response;
}
function mockJson(status: number, body: any, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  } as unknown as Response;
}
function netErr(msg = "Failed to fetch"): Promise<never> { return Promise.reject(new TypeError(msg)); }
function abortErr(): Promise<never> { const e = new Error("The operation was aborted"); e.name = "AbortError"; return Promise.reject(e); }

const KEY = "polly_test_key";
const TTS_REQ = { text: "Hello world test", voiceId: "Joanna" };
const VOICES_RESP = {
  Voices: [
    { Id: "Joanna", Name: "Joanna", LanguageCode: "en-US", LanguageName: "US English", Gender: "Female", SupportedEngines: ["neural", "standard"] },
    { Id: "Matthew", Name: "Matthew", LanguageCode: "en-US", LanguageName: "US English", Gender: "Male", SupportedEngines: ["neural", "standard"] },
  ],
};

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
    expect(url).toBe("https://polly.amazonaws.com/v1/speech");
  });

  it("includes Authorization Bearer header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await sendTTSRequest(KEY, TTS_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts?.headers as any)["Authorization"]).toBe(`Bearer ${KEY}`);
  });

  it("sends correct request body structure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await sendTTSRequest(KEY, TTS_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.Text).toBe("Hello world test");
    expect(body.VoiceId).toBe("Joanna");
    expect(body.OutputFormat).toBe("mp3");
  });

  it("includes Engine when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await sendTTSRequest(KEY, { ...TTS_REQ, engine: "neural" });
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.Engine).toBe("neural");
  });

  it("includes LanguageCode when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await sendTTSRequest(KEY, { ...TTS_REQ, languageCode: "en-US" });
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.LanguageCode).toBe("en-US");
  });

  it("omits optional fields when not provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await sendTTSRequest(KEY, TTS_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.Engine).toBeUndefined();
    expect(body.LanguageCode).toBeUndefined();
    expect(body.SampleRate).toBeUndefined();
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
    expect(voices[0].id).toBe("Joanna");
    expect(voices[0].name).toBe("Joanna");
    expect(voices[0].languageCode).toBe("en-US");
    expect(voices[0].languageName).toBe("US English");
    expect(voices[0].gender).toBe("Female");
    expect(voices[0].supportedEngines).toEqual(["neural", "standard"]);
  });

  it("GETs the correct voices endpoint without language filter", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, VOICES_RESP));
    await listVoices(KEY);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://polly.amazonaws.com/v1/voices");
  });

  it("appends LanguageCode query param when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, VOICES_RESP));
    await listVoices(KEY, "en-US");
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://polly.amazonaws.com/v1/voices?LanguageCode=en-US");
  });

  it("includes Authorization Bearer header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, VOICES_RESP));
    await listVoices(KEY);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts?.headers as any)["Authorization"]).toBe(`Bearer ${KEY}`);
  });

  it("returns empty array when no voices", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { Voices: [] }));
    expect(await listVoices(KEY)).toHaveLength(0);
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
    expect(r.providerName).toBe("Amazon Polly");
    expect(r.voiceId).toBe("Joanna");
    expect(r.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("returns invalid on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(401, { message: "Invalid API key" }));
    const r = await testKey(KEY);
    expect(r.status).toBe("invalid");
    expect(r.errorCode).toBe("INVALID_KEY");
    expect(r.providerName).toBe("Amazon Polly");
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

  it("uses Joanna voice and mp3 format for key test", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockBin(200));
    await testKey(KEY);
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://polly.amazonaws.com/v1/speech");
    const body = JSON.parse(opts?.body as string);
    expect(body.VoiceId).toBe("Joanna");
    expect(body.OutputFormat).toBe("mp3");
    expect(body.Text).toBe("Hi");
  });

  it("includes responseTimeMs in all result types", async () => {
    for (const mock of [
      mockBin(200),
      mockJson(401, { message: "Unauthorized" }),
      mockJson(429, { message: "Rate limited" }),
    ]) {
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
