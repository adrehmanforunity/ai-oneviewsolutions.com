/**
 * Unit Tests for Google Cloud TTS/STT API Client
 * Requirements: 1.7, 1.8, 1.9, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2, 14.3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendTTSRequest, sendSTTRequest, listVoices, testKey, ProviderError } from "./index";

// base64 of 8 zero bytes
const FAKE_AUDIO_B64 = Buffer.alloc(8).toString("base64");

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

const KEY = "gcp_test_key";
const TTS_REQ = { text: "Hello world test", voiceName: "en-US-Standard-A", languageCode: "en-US" };
const STT_REQ = { audio: Buffer.from([0x52, 0x49, 0x46, 0x46]), languageCode: "en-US" };
const VOICES_RESP = {
  voices: [
    { name: "en-US-Standard-A", languageCodes: ["en-US"], ssmlGender: "FEMALE", naturalSampleRateHertz: 24000 },
    { name: "en-GB-Standard-B", languageCodes: ["en-GB"], ssmlGender: "MALE", naturalSampleRateHertz: 24000 },
  ],
};

describe("sendTTSRequest", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("returns Buffer decoded from base64 on 200", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { audioContent: FAKE_AUDIO_B64 }));
    const r = await sendTTSRequest(KEY, TTS_REQ);
    expect(r.audio).toBeInstanceOf(Buffer);
    expect(r.audio.length).toBe(8);
    expect(r.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("POSTs to correct TTS endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { audioContent: FAKE_AUDIO_B64 }));
    await sendTTSRequest(KEY, TTS_REQ);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://texttospeech.googleapis.com/v1/text:synthesize");
  });

  it("includes Authorization Bearer header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { audioContent: FAKE_AUDIO_B64 }));
    await sendTTSRequest(KEY, TTS_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts?.headers as any)["Authorization"]).toBe(`Bearer ${KEY}`);
  });

  it("sends correct request body structure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { audioContent: FAKE_AUDIO_B64 }));
    await sendTTSRequest(KEY, TTS_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.input.text).toBe("Hello world test");
    expect(body.voice.languageCode).toBe("en-US");
    expect(body.voice.name).toBe("en-US-Standard-A");
    expect(body.audioConfig.audioEncoding).toBe("MP3");
  });

  it("includes speakingRate and pitch when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { audioContent: FAKE_AUDIO_B64 }));
    await sendTTSRequest(KEY, { ...TTS_REQ, speakingRate: 1.2, pitch: -2 });
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.audioConfig.speakingRate).toBe(1.2);
    expect(body.audioConfig.pitch).toBe(-2);
  });

  it("omits speakingRate and pitch when not provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { audioContent: FAKE_AUDIO_B64 }));
    await sendTTSRequest(KEY, TTS_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.audioConfig.speakingRate).toBeUndefined();
    expect(body.audioConfig.pitch).toBeUndefined();
  });

  it("throws INVALID_KEY on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(401, { error: { message: "Invalid API key" } }));
    await expect(sendTTSRequest(KEY, TTS_REQ)).rejects.toMatchObject({ code: "INVALID_KEY", statusCode: 401 });
  });

  it("throws RATE_LIMITED on 429", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(429, { error: { message: "Rate limit exceeded" } }, { "retry-after": "30" }));
    await expect(sendTTSRequest(KEY, TTS_REQ)).rejects.toMatchObject({ code: "RATE_LIMITED", statusCode: 429 });
  });

  it("throws SERVER_ERROR on 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(500, { error: { message: "Server error" } }));
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
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { results: [{ alternatives: [{ transcript: "Hello world" }] }] }));
    const r = await sendSTTRequest(KEY, STT_REQ);
    expect(r.text).toBe("Hello world");
    expect(r.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("POSTs to correct STT endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { results: [{ alternatives: [{ transcript: "test" }] }] }));
    await sendSTTRequest(KEY, STT_REQ);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://speech.googleapis.com/v1/speech:recognize");
  });

  it("includes Authorization Bearer header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { results: [] }));
    await sendSTTRequest(KEY, STT_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts?.headers as any)["Authorization"]).toBe(`Bearer ${KEY}`);
  });

  it("sends audio as base64 in request body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { results: [] }));
    await sendSTTRequest(KEY, STT_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.audio.content).toBe(Buffer.from(STT_REQ.audio).toString("base64"));
  });

  it("sends correct config structure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { results: [] }));
    await sendSTTRequest(KEY, STT_REQ);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.config.encoding).toBe("LINEAR16");
    expect(body.config.sampleRateHertz).toBe(16000);
    expect(body.config.languageCode).toBe("en-US");
  });

  it("uses custom sampleRateHertz when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { results: [] }));
    await sendSTTRequest(KEY, { ...STT_REQ, sampleRateHertz: 8000 });
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.config.sampleRateHertz).toBe(8000);
  });

  it("returns empty string when no results", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { results: [] }));
    const r = await sendSTTRequest(KEY, STT_REQ);
    expect(r.text).toBe("");
  });

  it("throws INVALID_KEY on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(401, { error: { message: "Unauthorized" } }));
    await expect(sendSTTRequest(KEY, STT_REQ)).rejects.toMatchObject({ code: "INVALID_KEY" });
  });

  it("throws RATE_LIMITED on 429", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(429, { error: { message: "Rate limited" } }));
    await expect(sendSTTRequest(KEY, STT_REQ)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("throws SERVER_ERROR on 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(500, { error: { message: "Server error" } }));
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
});

describe("listVoices", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("returns mapped VoiceMetadata array on 200", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, VOICES_RESP));
    const voices = await listVoices(KEY);
    expect(voices).toHaveLength(2);
    expect(voices[0].name).toBe("en-US-Standard-A");
    expect(voices[0].languageCodes).toEqual(["en-US"]);
    expect(voices[0].gender).toBe("FEMALE");
    expect(voices[0].naturalSampleRateHertz).toBe(24000);
  });

  it("GETs the correct voices endpoint without language filter", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, VOICES_RESP));
    await listVoices(KEY);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://texttospeech.googleapis.com/v1/voices");
  });

  it("appends languageCode query param when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, VOICES_RESP));
    await listVoices(KEY, "en-US");
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://texttospeech.googleapis.com/v1/voices?languageCode=en-US");
  });

  it("includes Authorization Bearer header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, VOICES_RESP));
    await listVoices(KEY);
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts?.headers as any)["Authorization"]).toBe(`Bearer ${KEY}`);
  });

  it("returns empty array when no voices", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { voices: [] }));
    expect(await listVoices(KEY)).toHaveLength(0);
  });

  it("throws INVALID_KEY on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(401, { error: { message: "Unauthorized" } }));
    await expect(listVoices(KEY)).rejects.toMatchObject({ code: "INVALID_KEY" });
  });

  it("throws SERVER_ERROR on 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(500, { error: { message: "Server error" } }));
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
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { audioContent: FAKE_AUDIO_B64 }));
    const r = await testKey(KEY);
    expect(r.status).toBe("valid");
    expect(r.providerName).toBe("Google Cloud");
    expect(r.voiceName).toBe("en-US-Standard-A");
    expect(r.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("returns invalid on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(401, { error: { message: "Invalid API key" } }));
    const r = await testKey(KEY);
    expect(r.status).toBe("invalid");
    expect(r.errorCode).toBe("INVALID_KEY");
    expect(r.providerName).toBe("Google Cloud");
  });

  it("returns rate_limited on 429 with retry-after", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(429, { error: { message: "Rate limit exceeded" } }, { "retry-after": "30" }));
    const r = await testKey(KEY);
    expect(r.status).toBe("rate_limited");
    expect(r.errorCode).toBe("RATE_LIMITED");
    expect(r.rateLimitResetTime).toBeInstanceOf(Date);
  });

  it("parses retry-after header as seconds", async () => {
    const now = Date.now();
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(429, { error: { message: "Rate limited" } }, { "retry-after": "60" }));
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
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(500, { error: { message: "Server error" } }));
    await expect(testKey(KEY)).rejects.toMatchObject({ code: "SERVER_ERROR" });
  });

  it("uses en-US-Standard-A voice for key test", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson(200, { audioContent: FAKE_AUDIO_B64 }));
    await testKey(KEY);
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://texttospeech.googleapis.com/v1/text:synthesize");
    const body = JSON.parse(opts?.body as string);
    expect(body.voice.name).toBe("en-US-Standard-A");
    expect(body.input.text).toBe("Hi");
  });

  it("includes responseTimeMs in all result types", async () => {
    for (const mock of [
      mockJson(200, { audioContent: FAKE_AUDIO_B64 }),
      mockJson(401, { error: { message: "Unauthorized" } }),
      mockJson(429, { error: { message: "Rate limited" } }),
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
