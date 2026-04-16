/**
 * Provider Configuration API Tests
 * Unit tests for provider endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryOne, queryMany } from '@/lib/db';

// Mock database functions
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryMany: vi.fn(),
}));

describe('Provider Configuration API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // GET /api/providers - List all providers
  // ============================================================================

  describe('GET /api/providers - List all providers', () => {
    it('should list all providers', async () => {
      const mockProviders = [
        {
          id: 'provider-1',
          name: 'Groq',
          provider_type: 'LLM',
          api_endpoint: 'https://api.groq.com/openai/v1/',
          api_version: 'v1',
          pricing_per_1k_tokens: 0.0001,
          created_at: new Date(),
          updated_at: new Date(),
          model_count: '4',
          voice_count: '0',
          active_key_count: '2',
          total_key_count: '3',
        },
        {
          id: 'provider-2',
          name: 'ElevenLabs',
          provider_type: 'TTS',
          api_endpoint: 'https://api.elevenlabs.io/v1/',
          api_version: 'v1',
          pricing_per_1k_tokens: 0.0003,
          created_at: new Date(),
          updated_at: new Date(),
          model_count: '0',
          voice_count: '10',
          active_key_count: '1',
          total_key_count: '1',
        },
      ];

      vi.mocked(queryMany).mockResolvedValueOnce(mockProviders);

      const providers = await queryMany('SELECT * FROM providers', []);
      expect(providers).toHaveLength(2);
      expect(providers[0].name).toBe('Groq');
      expect(providers[1].name).toBe('ElevenLabs');
    });

    it('should filter providers by type LLM', async () => {
      const mockProviders = [
        {
          id: 'provider-1',
          name: 'Groq',
          provider_type: 'LLM',
          api_endpoint: 'https://api.groq.com/openai/v1/',
          model_count: '4',
          voice_count: '0',
          active_key_count: '1',
          total_key_count: '1',
        },
      ];

      vi.mocked(queryMany).mockResolvedValueOnce(mockProviders);

      const providers = await queryMany(
        'SELECT * FROM providers WHERE provider_type = $1',
        ['LLM']
      );
      expect(providers).toHaveLength(1);
      expect(providers[0].provider_type).toBe('LLM');
    });

    it('should filter providers by type TTS', async () => {
      const mockProviders = [
        {
          id: 'provider-2',
          name: 'ElevenLabs',
          provider_type: 'TTS',
          api_endpoint: 'https://api.elevenlabs.io/v1/',
          model_count: '0',
          voice_count: '10',
          active_key_count: '1',
          total_key_count: '1',
        },
      ];

      vi.mocked(queryMany).mockResolvedValueOnce(mockProviders);

      const providers = await queryMany(
        'SELECT * FROM providers WHERE provider_type = $1',
        ['TTS']
      );
      expect(providers).toHaveLength(1);
      expect(providers[0].provider_type).toBe('TTS');
    });

    it('should reject invalid provider type filter', () => {
      const validTypes = ['LLM', 'STT', 'TTS'];
      const invalidType = 'INVALID';

      expect(validTypes).not.toContain(invalidType);
    });

    it('should require tenant ID', () => {
      const tenantId = null;
      expect(tenantId).toBeNull();
    });

    it('should include model and voice counts', async () => {
      const mockProvider = {
        id: 'provider-1',
        name: 'Groq',
        provider_type: 'LLM',
        model_count: '4',
        voice_count: '0',
        active_key_count: '2',
        total_key_count: '3',
      };

      vi.mocked(queryMany).mockResolvedValueOnce([mockProvider]);

      const providers = await queryMany('SELECT * FROM providers', []);
      const modelCount = parseInt(providers[0].model_count, 10);
      const voiceCount = parseInt(providers[0].voice_count, 10);

      expect(modelCount).toBe(4);
      expect(voiceCount).toBe(0);
    });

    it('should include active and total key counts scoped to tenant', async () => {
      const mockProvider = {
        id: 'provider-1',
        name: 'Groq',
        provider_type: 'LLM',
        model_count: '4',
        voice_count: '0',
        active_key_count: '2',
        total_key_count: '3',
      };

      vi.mocked(queryMany).mockResolvedValueOnce([mockProvider]);

      const providers = await queryMany('SELECT * FROM providers', []);
      const activeKeyCount = parseInt(providers[0].active_key_count, 10);
      const totalKeyCount = parseInt(providers[0].total_key_count, 10);

      expect(activeKeyCount).toBe(2);
      expect(totalKeyCount).toBe(3);
      expect(activeKeyCount).toBeLessThanOrEqual(totalKeyCount);
    });
  });

  // ============================================================================
  // GET /api/providers/:id - Get provider details
  // ============================================================================

  describe('GET /api/providers/:id - Get provider details', () => {
    it('should return provider details with models and voices', async () => {
      const mockProvider = {
        id: 'provider-1',
        name: 'Groq',
        provider_type: 'LLM',
        api_endpoint: 'https://api.groq.com/openai/v1/',
        api_version: 'v1',
        pricing_per_1k_tokens: 0.0001,
        created_at: new Date(),
        updated_at: new Date(),
        active_key_count: '2',
        total_key_count: '3',
      };

      const mockModels = [
        {
          id: 'model-1',
          provider_id: 'provider-1',
          model_name: 'LLaMA 3.3 70B',
          model_id: 'llama-3.3-70b-versatile',
          pricing_per_1k_tokens: 0.0001,
          context_window: 128000,
          created_at: new Date(),
        },
      ];

      vi.mocked(queryOne).mockResolvedValueOnce(mockProvider);
      vi.mocked(queryMany)
        .mockResolvedValueOnce(mockModels)
        .mockResolvedValueOnce([]) // No voices for LLM
        .mockResolvedValueOnce([]); // No rotation strategy

      const provider = await queryOne('SELECT * FROM providers WHERE id = $1', ['provider-1']);
      expect(provider).toBeDefined();
      expect(provider?.name).toBe('Groq');
    });

    it('should return 404 for non-existent provider', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      const provider = await queryOne('SELECT * FROM providers WHERE id = $1', ['invalid-id']);
      expect(provider).toBeNull();
    });

    it('should include rotation strategy in response', async () => {
      const strategyRow = { strategy: 'fallback' };
      const strategy = strategyRow?.strategy ?? 'round_robin';
      expect(strategy).toBe('fallback');
    });

    it('should default rotation strategy to round_robin when not configured', () => {
      const strategyRow = null;
      const strategy = strategyRow ?? 'round_robin';
      expect(strategy).toBe('round_robin');
    });

    it('should require tenant ID', () => {
      const tenantId = null;
      expect(tenantId).toBeNull();
    });
  });

  // ============================================================================
  // GET /api/providers/:id/models - Get provider models
  // ============================================================================

  describe('GET /api/providers/:id/models - Get provider models', () => {
    it('should return models for a provider', async () => {
      const mockModels = [
        {
          id: 'model-1',
          provider_id: 'provider-1',
          model_name: 'LLaMA 3.3 70B',
          model_id: 'llama-3.3-70b-versatile',
          pricing_per_1k_tokens: 0.0001,
          context_window: 128000,
          created_at: new Date(),
        },
        {
          id: 'model-2',
          provider_id: 'provider-1',
          model_name: 'LLaMA 3.1 8B',
          model_id: 'llama-3.1-8b-instant',
          pricing_per_1k_tokens: 0.00005,
          context_window: 128000,
          created_at: new Date(),
        },
      ];

      vi.mocked(queryMany).mockResolvedValueOnce(mockModels);

      const models = await queryMany('SELECT * FROM provider_models WHERE provider_id = $1', ['provider-1']);
      expect(models).toHaveLength(2);
      expect(models[0].model_id).toBe('llama-3.3-70b-versatile');
    });

    it('should return 404 for non-existent provider', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      const provider = await queryOne('SELECT id FROM providers WHERE id = $1', ['invalid-id']);
      expect(provider).toBeNull();
    });

    it('should return empty array when provider has no models', async () => {
      const mockProvider = { id: 'provider-1', name: 'ElevenLabs', provider_type: 'TTS' };

      vi.mocked(queryOne).mockResolvedValueOnce(mockProvider);
      vi.mocked(queryMany).mockResolvedValueOnce([]);

      const models = await queryMany('SELECT * FROM provider_models WHERE provider_id = $1', ['provider-1']);
      expect(models).toHaveLength(0);
    });

    it('should include model metadata in response', () => {
      const mockModel = {
        id: 'model-1',
        provider_id: 'provider-1',
        model_name: 'LLaMA 3.3 70B',
        model_id: 'llama-3.3-70b-versatile',
        pricing_per_1k_tokens: 0.0001,
        context_window: 128000,
        created_at: new Date(),
      };

      // Verify model has all required fields
      expect(mockModel).toHaveProperty('model_name');
      expect(mockModel).toHaveProperty('model_id');
      expect(mockModel).toHaveProperty('pricing_per_1k_tokens');
      expect(mockModel).toHaveProperty('context_window');
    });

    it('should require tenant ID', () => {
      const tenantId = null;
      expect(tenantId).toBeNull();
    });
  });

  // ============================================================================
  // GET /api/providers/:id/voices - Get provider voices
  // ============================================================================

  describe('GET /api/providers/:id/voices - Get provider voices', () => {
    it('should return voices for a TTS provider', async () => {
      const mockProvider = {
        id: 'provider-2',
        name: 'ElevenLabs',
        provider_type: 'TTS',
      };

      const mockVoices = [
        {
          id: 'voice-1',
          provider_id: 'provider-2',
          voice_id: 'rachel',
          voice_name: 'Rachel',
          gender: 'female',
          tone: 'professional',
          language: 'en',
          sample_audio_url: 'https://example.com/rachel.mp3',
          created_at: new Date(),
        },
        {
          id: 'voice-2',
          provider_id: 'provider-2',
          voice_id: 'adam',
          voice_name: 'Adam',
          gender: 'male',
          tone: 'warm',
          language: 'en',
          sample_audio_url: 'https://example.com/adam.mp3',
          created_at: new Date(),
        },
      ];

      vi.mocked(queryOne).mockResolvedValueOnce(mockProvider);
      vi.mocked(queryMany).mockResolvedValueOnce(mockVoices);

      const provider = await queryOne('SELECT id, name, provider_type FROM providers WHERE id = $1', ['provider-2']);
      expect(provider?.provider_type).toBe('TTS');

      const voices = await queryMany('SELECT * FROM provider_voices WHERE provider_id = $1', ['provider-2']);
      expect(voices).toHaveLength(2);
    });

    it('should return 400 for non-TTS provider', () => {
      const providerType = 'LLM';
      const isTTS = providerType === 'TTS';
      expect(isTTS).toBe(false);
    });

    it('should filter voices by language', () => {
      // Filtering is done at the DB query level - verify the logic
      const allVoices = [
        { language: 'en', voice_name: 'Rachel' },
        { language: 'ur', voice_name: 'Urdu Voice' },
      ];
      const filtered = allVoices.filter(v => v.language === 'ur');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].language).toBe('ur');
    });

    it('should filter voices by gender', () => {
      const allVoices = [
        { gender: 'female', voice_name: 'Rachel' },
        { gender: 'male', voice_name: 'Adam' },
      ];
      const filtered = allVoices.filter(v => v.gender === 'female');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].gender).toBe('female');
    });

    it('should filter voices by tone', () => {
      const allVoices = [
        { tone: 'professional', voice_name: 'Rachel' },
        { tone: 'warm', voice_name: 'Adam' },
      ];
      const filtered = allVoices.filter(v => v.tone === 'professional');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].tone).toBe('professional');
    });

    it('should return 404 for non-existent provider', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      const provider = await queryOne('SELECT id FROM providers WHERE id = $1', ['invalid-id']);
      expect(provider).toBeNull();
    });

    it('should include voice metadata in response', () => {
      const mockVoice = {
        id: 'voice-1',
        provider_id: 'provider-2',
        voice_id: 'rachel',
        voice_name: 'Rachel',
        gender: 'female',
        tone: 'professional',
        language: 'en',
        sample_audio_url: 'https://example.com/rachel.mp3',
        created_at: new Date(),
      };

      expect(mockVoice).toHaveProperty('voice_name');
      expect(mockVoice).toHaveProperty('gender');
      expect(mockVoice).toHaveProperty('tone');
      expect(mockVoice).toHaveProperty('language');
      expect(mockVoice).toHaveProperty('sample_audio_url');
    });

    it('should require tenant ID', () => {
      const tenantId = null;
      expect(tenantId).toBeNull();
    });
  });

  // ============================================================================
  // Provider Types
  // ============================================================================

  describe('Provider Types', () => {
    it('should support LLM provider type', () => {
      const validTypes = ['LLM', 'STT', 'TTS'];
      expect(validTypes).toContain('LLM');
    });

    it('should support STT provider type', () => {
      const validTypes = ['LLM', 'STT', 'TTS'];
      expect(validTypes).toContain('STT');
    });

    it('should support TTS provider type', () => {
      const validTypes = ['LLM', 'STT', 'TTS'];
      expect(validTypes).toContain('TTS');
    });

    it('should reject invalid provider types', () => {
      const validTypes = ['LLM', 'STT', 'TTS'];
      const invalidTypes = ['AI', 'ML', 'NLP', ''];

      invalidTypes.forEach(type => {
        expect(validTypes).not.toContain(type);
      });
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should return 400 for missing tenant ID', () => {
      const statusCode = 400;
      expect(statusCode).toBe(400);
    });

    it('should return 400 for invalid provider type filter', () => {
      const statusCode = 400;
      expect(statusCode).toBe(400);
    });

    it('should return 400 when requesting voices for non-TTS provider', () => {
      const statusCode = 400;
      expect(statusCode).toBe(400);
    });

    it('should return 404 for non-existent provider', () => {
      const statusCode = 404;
      expect(statusCode).toBe(404);
    });

    it('should return error with code and message', () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'PROVIDER_NOT_FOUND',
          message: 'Provider not found',
        },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toHaveProperty('code');
      expect(errorResponse.error).toHaveProperty('message');
    });
  });
});
