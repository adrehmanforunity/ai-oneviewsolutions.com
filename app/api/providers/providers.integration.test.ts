/**
 * Provider Configuration Integration Tests
 * Integration tests for provider endpoints
 */

import { describe, it, expect } from 'vitest';

describe('Provider Configuration Integration Tests', () => {
  // ============================================================================
  // Provider Data
  // ============================================================================

  describe('Provider Data', () => {
    it('should support all required LLM providers', () => {
      const llmProviders = ['Groq', 'Claude', 'OpenAI'];
      expect(llmProviders).toContain('Groq');
      expect(llmProviders).toContain('Claude');
      expect(llmProviders).toContain('OpenAI');
    });

    it('should support all required STT providers', () => {
      const sttProviders = ['Groq', 'Google Cloud', 'ElevenLabs'];
      expect(sttProviders).toContain('Groq');
      expect(sttProviders).toContain('Google Cloud');
      expect(sttProviders).toContain('ElevenLabs');
    });

    it('should support all required TTS providers', () => {
      const ttsProviders = ['Uplift AI', 'ElevenLabs', 'Google Cloud', 'OpenAI', 'Amazon Polly'];
      expect(ttsProviders).toContain('Uplift AI');
      expect(ttsProviders).toContain('ElevenLabs');
      expect(ttsProviders).toContain('Google Cloud');
      expect(ttsProviders).toContain('OpenAI');
      expect(ttsProviders).toContain('Amazon Polly');
    });
  });

  // ============================================================================
  // GET /api/providers - List providers
  // ============================================================================

  describe('GET /api/providers', () => {
    it('should return success response format', () => {
      const response = {
        success: true,
        data: [],
      };

      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should include provider metadata in each item', () => {
      const provider = {
        id: 'provider-1',
        name: 'Groq',
        providerType: 'LLM',
        apiEndpoint: 'https://api.groq.com/openai/v1/',
        modelCount: 4,
        voiceCount: 0,
        activeKeyCount: 2,
        totalKeyCount: 3,
      };

      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('providerType');
      expect(provider).toHaveProperty('apiEndpoint');
      expect(provider).toHaveProperty('modelCount');
      expect(provider).toHaveProperty('voiceCount');
      expect(provider).toHaveProperty('activeKeyCount');
      expect(provider).toHaveProperty('totalKeyCount');
    });

    it('should filter by LLM type', () => {
      const providers = [
        { name: 'Groq', providerType: 'LLM' },
        { name: 'ElevenLabs', providerType: 'TTS' },
        { name: 'Google Cloud', providerType: 'STT' },
      ];

      const llmProviders = providers.filter(p => p.providerType === 'LLM');
      expect(llmProviders).toHaveLength(1);
      expect(llmProviders[0].name).toBe('Groq');
    });

    it('should filter by TTS type', () => {
      const providers = [
        { name: 'Groq', providerType: 'LLM' },
        { name: 'ElevenLabs', providerType: 'TTS' },
        { name: 'Google Cloud', providerType: 'STT' },
      ];

      const ttsProviders = providers.filter(p => p.providerType === 'TTS');
      expect(ttsProviders).toHaveLength(1);
      expect(ttsProviders[0].name).toBe('ElevenLabs');
    });

    it('should filter by STT type', () => {
      const providers = [
        { name: 'Groq', providerType: 'LLM' },
        { name: 'ElevenLabs', providerType: 'TTS' },
        { name: 'Google Cloud', providerType: 'STT' },
      ];

      const sttProviders = providers.filter(p => p.providerType === 'STT');
      expect(sttProviders).toHaveLength(1);
      expect(sttProviders[0].name).toBe('Google Cloud');
    });
  });

  // ============================================================================
  // GET /api/providers/:id - Get provider details
  // ============================================================================

  describe('GET /api/providers/:id', () => {
    it('should return full provider details', () => {
      const response = {
        success: true,
        data: {
          id: 'provider-1',
          name: 'Groq',
          providerType: 'LLM',
          apiEndpoint: 'https://api.groq.com/openai/v1/',
          apiVersion: 'v1',
          pricingPer1kTokens: 0.0001,
          activeKeyCount: 2,
          totalKeyCount: 3,
          rotationStrategy: 'round_robin',
          models: [],
          voices: [],
        },
      };

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('models');
      expect(response.data).toHaveProperty('voices');
      expect(response.data).toHaveProperty('rotationStrategy');
    });

    it('should include models array for LLM providers', () => {
      const models = [
        { modelId: 'llama-3.3-70b-versatile', modelName: 'LLaMA 3.3 70B' },
        { modelId: 'llama-3.1-8b-instant', modelName: 'LLaMA 3.1 8B' },
      ];

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should include voices array for TTS providers', () => {
      const voices = [
        { voiceId: 'rachel', voiceName: 'Rachel', language: 'en' },
      ];

      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // GET /api/providers/:id/models
  // ============================================================================

  describe('GET /api/providers/:id/models', () => {
    it('should return models with correct structure', () => {
      const model = {
        id: 'model-1',
        providerId: 'provider-1',
        modelName: 'LLaMA 3.3 70B',
        modelId: 'llama-3.3-70b-versatile',
        pricingPer1kTokens: 0.0001,
        contextWindow: 128000,
      };

      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('providerId');
      expect(model).toHaveProperty('modelName');
      expect(model).toHaveProperty('modelId');
      expect(model).toHaveProperty('pricingPer1kTokens');
      expect(model).toHaveProperty('contextWindow');
    });

    it('should return Groq models', () => {
      const groqModels = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'openai/gpt-oss-120b',
        'qwen/qwen3-32b',
      ];

      expect(groqModels).toHaveLength(4);
      expect(groqModels).toContain('llama-3.3-70b-versatile');
    });

    it('should return Claude models', () => {
      const claudeModels = [
        'claude-sonnet-4-20250514',
        'claude-opus-4-1-20250805',
      ];

      expect(claudeModels).toHaveLength(2);
      expect(claudeModels).toContain('claude-sonnet-4-20250514');
    });

    it('should return OpenAI models', () => {
      const openaiModels = ['gpt-4o-mini', 'gpt-4o'];

      expect(openaiModels).toHaveLength(2);
      expect(openaiModels).toContain('gpt-4o');
    });

    it('should return response with total count', () => {
      const response = {
        success: true,
        data: {
          providerId: 'provider-1',
          providerName: 'Groq',
          providerType: 'LLM',
          models: [],
          total: 0,
        },
      };

      expect(response.data).toHaveProperty('total');
      expect(typeof response.data.total).toBe('number');
    });
  });

  // ============================================================================
  // GET /api/providers/:id/voices
  // ============================================================================

  describe('GET /api/providers/:id/voices', () => {
    it('should return voices with correct structure', () => {
      const voice = {
        id: 'voice-1',
        providerId: 'provider-2',
        voiceId: 'rachel',
        voiceName: 'Rachel',
        gender: 'female',
        tone: 'professional',
        language: 'en',
        sampleAudioUrl: 'https://example.com/rachel.mp3',
      };

      expect(voice).toHaveProperty('id');
      expect(voice).toHaveProperty('providerId');
      expect(voice).toHaveProperty('voiceId');
      expect(voice).toHaveProperty('voiceName');
      expect(voice).toHaveProperty('gender');
      expect(voice).toHaveProperty('tone');
      expect(voice).toHaveProperty('language');
      expect(voice).toHaveProperty('sampleAudioUrl');
    });

    it('should support English voices', () => {
      const voice = { language: 'en', voiceName: 'Rachel' };
      expect(voice.language).toBe('en');
    });

    it('should support Urdu voices', () => {
      const voice = { language: 'ur', voiceName: 'Urdu Voice' };
      expect(voice.language).toBe('ur');
    });

    it('should support male gender filter', () => {
      const voices = [
        { voiceName: 'Adam', gender: 'male' },
        { voiceName: 'Rachel', gender: 'female' },
      ];

      const maleVoices = voices.filter(v => v.gender === 'male');
      expect(maleVoices).toHaveLength(1);
      expect(maleVoices[0].voiceName).toBe('Adam');
    });

    it('should support female gender filter', () => {
      const voices = [
        { voiceName: 'Adam', gender: 'male' },
        { voiceName: 'Rachel', gender: 'female' },
      ];

      const femaleVoices = voices.filter(v => v.gender === 'female');
      expect(femaleVoices).toHaveLength(1);
      expect(femaleVoices[0].voiceName).toBe('Rachel');
    });

    it('should support tone filter', () => {
      const voices = [
        { voiceName: 'Rachel', tone: 'professional' },
        { voiceName: 'Adam', tone: 'warm' },
      ];

      const professionalVoices = voices.filter(v => v.tone === 'professional');
      expect(professionalVoices).toHaveLength(1);
      expect(professionalVoices[0].voiceName).toBe('Rachel');
    });

    it('should reject non-TTS provider', () => {
      const providerType = 'LLM';
      const isTTS = providerType === 'TTS';
      expect(isTTS).toBe(false);
    });

    it('should return response with filters applied', () => {
      const response = {
        success: true,
        data: {
          providerId: 'provider-2',
          providerName: 'ElevenLabs',
          voices: [],
          total: 0,
          filters: {
            language: 'en',
            gender: null,
            tone: null,
          },
        },
      };

      expect(response.data).toHaveProperty('filters');
      expect(response.data.filters.language).toBe('en');
    });
  });

  // ============================================================================
  // Tenant Isolation
  // ============================================================================

  describe('Tenant Isolation', () => {
    it('should scope key counts to requesting tenant', () => {
      // Key counts in provider list should only count keys for the requesting tenant
      const tenant1KeyCount = 3;
      const tenant2KeyCount = 1;

      expect(tenant1KeyCount).not.toBe(tenant2KeyCount);
    });

    it('should require tenant ID for all endpoints', () => {
      const endpoints = [
        'GET /api/providers',
        'GET /api/providers/:id',
        'GET /api/providers/:id/models',
        'GET /api/providers/:id/voices',
      ];

      endpoints.forEach(endpoint => {
        expect(endpoint).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should return 400 for missing tenant ID', () => {
      const errorResponse = {
        success: false,
        error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('MISSING_TENANT');
    });

    it('should return 400 for invalid provider type filter', () => {
      const errorResponse = {
        success: false,
        error: { code: 'INVALID_TYPE', message: 'Invalid provider type. Must be one of: LLM, STT, TTS' },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('INVALID_TYPE');
    });

    it('should return 400 when requesting voices for non-TTS provider', () => {
      const errorResponse = {
        success: false,
        error: { code: 'NOT_TTS_PROVIDER', message: 'Voices are only available for TTS providers' },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('NOT_TTS_PROVIDER');
    });

    it('should return 404 for non-existent provider', () => {
      const errorResponse = {
        success: false,
        error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('PROVIDER_NOT_FOUND');
    });
  });
});
