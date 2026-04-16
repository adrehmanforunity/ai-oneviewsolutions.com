-- AI Provider Management - Seed Data
-- This seed file populates the providers, provider_models, and provider_voices tables
-- with all supported AI service providers and their models/voices

-- ============================================================================
-- GROQ PROVIDER
-- ============================================================================
INSERT INTO providers (name, provider_type, api_endpoint, api_version, pricing_per_1k_tokens)
VALUES (
  'Groq',
  'LLM',
  'https://api.groq.com/openai/v1/',
  'v1',
  0.0005
) ON CONFLICT (name) DO NOTHING;

-- Get Groq provider ID for model insertion
WITH groq_provider AS (
  SELECT id FROM providers WHERE name = 'Groq' AND provider_type = 'LLM'
)
INSERT INTO provider_models (provider_id, model_name, model_id, pricing_per_1k_tokens, context_window)
SELECT 
  groq_provider.id,
  model_data.model_name,
  model_data.model_id,
  model_data.pricing_per_1k_tokens,
  model_data.context_window
FROM groq_provider,
LATERAL (
  VALUES
    ('Llama 3.3 70B Versatile', 'llama-3.3-70b-versatile', 0.0005, 8192),
    ('Llama 3.1 8B Instant', 'llama-3.1-8b-instant', 0.00005, 8192),
    ('OpenAI GPT OSS 120B', 'openai/gpt-oss-120b', 0.001, 8192),
    ('Qwen 3 32B', 'qwen/qwen3-32b', 0.0008, 8192)
) AS model_data(model_name, model_id, pricing_per_1k_tokens, context_window)
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- ============================================================================
-- GROQ STT PROVIDER
-- ============================================================================
INSERT INTO providers (name, provider_type, api_endpoint, api_version, pricing_per_1k_tokens)
VALUES (
  'Groq Whisper',
  'STT',
  'https://api.groq.com/openai/v1/',
  'v1',
  0.0001
) ON CONFLICT (name) DO NOTHING;

-- Get Groq Whisper provider ID for model insertion
WITH groq_stt_provider AS (
  SELECT id FROM providers WHERE name = 'Groq Whisper' AND provider_type = 'STT'
)
INSERT INTO provider_models (provider_id, model_name, model_id, pricing_per_1k_tokens, context_window)
SELECT 
  groq_stt_provider.id,
  model_data.model_name,
  model_data.model_id,
  model_data.pricing_per_1k_tokens,
  model_data.context_window
FROM groq_stt_provider,
LATERAL (
  VALUES
    ('Whisper Large V3 Turbo', 'whisper-large-v3-turbo', 0.0001, NULL::integer),
    ('Whisper Large V3', 'whisper-large-v3', 0.0002, NULL::integer)
) AS model_data(model_name, model_id, pricing_per_1k_tokens, context_window)
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- ============================================================================
-- CLAUDE PROVIDER
-- ============================================================================
INSERT INTO providers (name, provider_type, api_endpoint, api_version, pricing_per_1k_tokens)
VALUES (
  'Claude',
  'LLM',
  'https://api.anthropic.com/v1/',
  'v1',
  0.003
) ON CONFLICT (name) DO NOTHING;

-- Get Claude provider ID for model insertion
WITH claude_provider AS (
  SELECT id FROM providers WHERE name = 'Claude' AND provider_type = 'LLM'
)
INSERT INTO provider_models (provider_id, model_name, model_id, pricing_per_1k_tokens, context_window)
SELECT 
  claude_provider.id,
  model_data.model_name,
  model_data.model_id,
  model_data.pricing_per_1k_tokens,
  model_data.context_window
FROM claude_provider,
LATERAL (
  VALUES
    ('Claude Sonnet 4 20250514', 'claude-sonnet-4-20250514', 0.003, 200000),
    ('Claude Opus 4.1 20250805', 'claude-opus-4-1-20250805', 0.015, 200000)
) AS model_data(model_name, model_id, pricing_per_1k_tokens, context_window)
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- ============================================================================
-- OPENAI PROVIDER (LLM)
-- ============================================================================
INSERT INTO providers (name, provider_type, api_endpoint, api_version, pricing_per_1k_tokens)
VALUES (
  'OpenAI',
  'LLM',
  'https://api.openai.com/v1/',
  'v1',
  0.0015
) ON CONFLICT (name) DO NOTHING;

-- Get OpenAI provider ID for model insertion
WITH openai_provider AS (
  SELECT id FROM providers WHERE name = 'OpenAI' AND provider_type = 'LLM'
)
INSERT INTO provider_models (provider_id, model_name, model_id, pricing_per_1k_tokens, context_window)
SELECT 
  openai_provider.id,
  model_data.model_name,
  model_data.model_id,
  model_data.pricing_per_1k_tokens,
  model_data.context_window
FROM openai_provider,
LATERAL (
  VALUES
    ('GPT-4o Mini', 'gpt-4o-mini', 0.00015, 128000),
    ('GPT-4o', 'gpt-4o', 0.005, 128000)
) AS model_data(model_name, model_id, pricing_per_1k_tokens, context_window)
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- ============================================================================
-- OPENAI PROVIDER (TTS)
-- ============================================================================
INSERT INTO providers (name, provider_type, api_endpoint, api_version, pricing_per_1k_tokens)
VALUES (
  'OpenAI TTS',
  'TTS',
  'https://api.openai.com/v1/',
  'v1',
  0.000015
) ON CONFLICT (name) DO NOTHING;

-- Get OpenAI TTS provider ID for model insertion
WITH openai_tts_provider AS (
  SELECT id FROM providers WHERE name = 'OpenAI TTS' AND provider_type = 'TTS'
)
INSERT INTO provider_models (provider_id, model_name, model_id, pricing_per_1k_tokens, context_window)
SELECT 
  openai_tts_provider.id,
  model_data.model_name,
  model_data.model_id,
  model_data.pricing_per_1k_tokens,
  model_data.context_window
FROM openai_tts_provider,
LATERAL (
  VALUES
    ('TTS-1', 'tts-1', 0.000015, NULL::integer),
    ('TTS-1 HD', 'tts-1-hd', 0.00003, NULL::integer)
) AS model_data(model_name, model_id, pricing_per_1k_tokens, context_window)
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- ============================================================================
-- ELEVENLABS PROVIDER (TTS)
-- ============================================================================
INSERT INTO providers (name, provider_type, api_endpoint, api_version, pricing_per_1k_tokens)
VALUES (
  'ElevenLabs',
  'TTS',
  'https://api.elevenlabs.io/v1/',
  'v1',
  0.00003
) ON CONFLICT (name) DO NOTHING;

-- Get ElevenLabs provider ID for voice insertion
WITH elevenlabs_provider AS (
  SELECT id FROM providers WHERE name = 'ElevenLabs' AND provider_type = 'TTS'
)
INSERT INTO provider_voices (provider_id, voice_id, voice_name, gender, tone, language, sample_audio_url)
SELECT 
  elevenlabs_provider.id,
  voice_data.voice_id,
  voice_data.voice_name,
  voice_data.gender,
  voice_data.tone,
  voice_data.language,
  voice_data.sample_audio_url
FROM elevenlabs_provider,
LATERAL (
  VALUES
    ('21m00Tcm4TlvDq8ikWAM', 'Rachel', 'female', 'warm', 'en', 'https://elevenlabs.io/samples/rachel.mp3'),
    ('EXAVITQu4vr4xnSDxMaL', 'Bella', 'female', 'professional', 'en', 'https://elevenlabs.io/samples/bella.mp3'),
    ('IKne3meq5aSrNqLBXnI9', 'Antoni', 'male', 'warm', 'en', 'https://elevenlabs.io/samples/antoni.mp3'),
    ('pFZP5JQG7iQjIQuC4Suw', 'Elli', 'female', 'professional', 'en', 'https://elevenlabs.io/samples/elli.mp3'),
    ('TxGEqnHWrfWFTfGW9XjX', 'Josh', 'male', 'warm', 'en', 'https://elevenlabs.io/samples/josh.mp3'),
    ('VR6AewLTigWG4xSOukaG', 'Arnold', 'male', 'professional', 'en', 'https://elevenlabs.io/samples/arnold.mp3'),
    ('pNInz6obpgDQGcFmaJgB', 'Adam', 'male', 'neutral', 'en', 'https://elevenlabs.io/samples/adam.mp3'),
    ('yoZ06aMxZJJ28mfd3POQ', 'Sam', 'male', 'warm', 'en', 'https://elevenlabs.io/samples/sam.mp3')
) AS voice_data(voice_id, voice_name, gender, tone, language, sample_audio_url)
ON CONFLICT (provider_id, voice_id) DO NOTHING;

-- ============================================================================
-- ELEVENLABS PROVIDER (STT)
-- ============================================================================
INSERT INTO providers (name, provider_type, api_endpoint, api_version, pricing_per_1k_tokens)
VALUES (
  'ElevenLabs STT',
  'STT',
  'https://api.elevenlabs.io/v1/',
  'v1',
  0.00001
) ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- UPLIFT AI PROVIDER (TTS - Urdu Optimized)
-- ============================================================================
INSERT INTO providers (name, provider_type, api_endpoint, api_version, pricing_per_1k_tokens)
VALUES (
  'Uplift AI',
  'TTS',
  'https://api.upliftai.com/v1/',
  'v1',
  0.00005
) ON CONFLICT (name) DO NOTHING;

-- Get Uplift AI provider ID for voice insertion
WITH uplift_provider AS (
  SELECT id FROM providers WHERE name = 'Uplift AI' AND provider_type = 'TTS'
)
INSERT INTO provider_voices (provider_id, voice_id, voice_name, gender, tone, language, sample_audio_url)
SELECT 
  uplift_provider.id,
  voice_data.voice_id,
  voice_data.voice_name,
  voice_data.gender,
  voice_data.tone,
  voice_data.language,
  voice_data.sample_audio_url
FROM uplift_provider,
LATERAL (
  VALUES
    ('uplift_urdu_female_1', 'Aisha', 'female', 'professional', 'ur', 'https://upliftai.com/samples/aisha_ur.mp3'),
    ('uplift_urdu_female_2', 'Fatima', 'female', 'warm', 'ur', 'https://upliftai.com/samples/fatima_ur.mp3'),
    ('uplift_urdu_male_1', 'Ahmed', 'male', 'professional', 'ur', 'https://upliftai.com/samples/ahmed_ur.mp3'),
    ('uplift_urdu_male_2', 'Hassan', 'male', 'warm', 'ur', 'https://upliftai.com/samples/hassan_ur.mp3'),
    ('uplift_urdu_male_3', 'Ali', 'male', 'neutral', 'ur', 'https://upliftai.com/samples/ali_ur.mp3'),
    ('uplift_urdu_female_3', 'Zainab', 'female', 'neutral', 'ur', 'https://upliftai.com/samples/zainab_ur.mp3')
) AS voice_data(voice_id, voice_name, gender, tone, language, sample_audio_url)
ON CONFLICT (provider_id, voice_id) DO NOTHING;

-- ============================================================================
-- GOOGLE CLOUD PROVIDER (STT)
-- ============================================================================
INSERT INTO providers (name, provider_type, api_endpoint, api_version, pricing_per_1k_tokens)
VALUES (
  'Google Cloud STT',
  'STT',
  'https://speech.googleapis.com/',
  'v1',
  0.000024
) ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- GOOGLE CLOUD PROVIDER (TTS)
-- ============================================================================
INSERT INTO providers (name, provider_type, api_endpoint, api_version, pricing_per_1k_tokens)
VALUES (
  'Google Cloud TTS',
  'TTS',
  'https://texttospeech.googleapis.com/',
  'v1',
  0.000004
) ON CONFLICT (name) DO NOTHING;

-- Get Google Cloud TTS provider ID for voice insertion
WITH google_tts_provider AS (
  SELECT id FROM providers WHERE name = 'Google Cloud TTS' AND provider_type = 'TTS'
)
INSERT INTO provider_voices (provider_id, voice_id, voice_name, gender, tone, language, sample_audio_url)
SELECT 
  google_tts_provider.id,
  voice_data.voice_id,
  voice_data.voice_name,
  voice_data.gender,
  voice_data.tone,
  voice_data.language,
  voice_data.sample_audio_url
FROM google_tts_provider,
LATERAL (
  VALUES
    ('en-US-Neural2-A', 'Google US Female A', 'female', 'professional', 'en', 'https://cloud.google.com/samples/en-US-Neural2-A.mp3'),
    ('en-US-Neural2-C', 'Google US Female C', 'female', 'warm', 'en', 'https://cloud.google.com/samples/en-US-Neural2-C.mp3'),
    ('en-US-Neural2-E', 'Google US Male E', 'male', 'professional', 'en', 'https://cloud.google.com/samples/en-US-Neural2-E.mp3'),
    ('en-US-Neural2-F', 'Google US Male F', 'male', 'warm', 'en', 'https://cloud.google.com/samples/en-US-Neural2-F.mp3'),
    ('ur-PK-Neural2-A', 'Google Urdu Female', 'female', 'professional', 'ur', 'https://cloud.google.com/samples/ur-PK-Neural2-A.mp3'),
    ('ur-PK-Neural2-B', 'Google Urdu Male', 'male', 'professional', 'ur', 'https://cloud.google.com/samples/ur-PK-Neural2-B.mp3')
) AS voice_data(voice_id, voice_name, gender, tone, language, sample_audio_url)
ON CONFLICT (provider_id, voice_id) DO NOTHING;

-- ============================================================================
-- AMAZON POLLY PROVIDER (TTS)
-- ============================================================================
INSERT INTO providers (name, provider_type, api_endpoint, api_version, pricing_per_1k_tokens)
VALUES (
  'Amazon Polly',
  'TTS',
  'https://polly.amazonaws.com/',
  'v1',
  0.000004
) ON CONFLICT (name) DO NOTHING;

-- Get Amazon Polly provider ID for voice insertion
WITH polly_provider AS (
  SELECT id FROM providers WHERE name = 'Amazon Polly' AND provider_type = 'TTS'
)
INSERT INTO provider_voices (provider_id, voice_id, voice_name, gender, tone, language, sample_audio_url)
SELECT 
  polly_provider.id,
  voice_data.voice_id,
  voice_data.voice_name,
  voice_data.gender,
  voice_data.tone,
  voice_data.language,
  voice_data.sample_audio_url
FROM polly_provider,
LATERAL (
  VALUES
    ('Joanna', 'Joanna', 'female', 'professional', 'en', 'https://polly.amazonaws.com/samples/joanna.mp3'),
    ('Ivy', 'Ivy', 'female', 'warm', 'en', 'https://polly.amazonaws.com/samples/ivy.mp3'),
    ('Matthew', 'Matthew', 'male', 'professional', 'en', 'https://polly.amazonaws.com/samples/matthew.mp3'),
    ('Justin', 'Justin', 'male', 'warm', 'en', 'https://polly.amazonaws.com/samples/justin.mp3'),
    ('Joey', 'Joey', 'male', 'neutral', 'en', 'https://polly.amazonaws.com/samples/joey.mp3'),
    ('Kendra', 'Kendra', 'female', 'neutral', 'en', 'https://polly.amazonaws.com/samples/kendra.mp3')
) AS voice_data(voice_id, voice_name, gender, tone, language, sample_audio_url)
ON CONFLICT (provider_id, voice_id) DO NOTHING;
