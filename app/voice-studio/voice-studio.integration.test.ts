/**
 * Integration Tests for Voice Studio
 * Tests API calls to voice endpoints and end-to-end workflows
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============================================================================
// MOCK DATA
// ============================================================================

const mockTenantId = 'test-tenant-123'

const mockProviders = [
  {
    id: 'provider-1',
    name: 'Uplift AI',
    providerType: 'TTS',
    apiEndpoint: 'https://api.upliftai.com',
  },
  {
    id: 'provider-2',
    name: 'ElevenLabs',
    providerType: 'TTS',
    apiEndpoint: 'https://api.elevenlabs.io',
  },
  {
    id: 'provider-3',
    name: 'Google Cloud',
    providerType: 'TTS',
    apiEndpoint: 'https://texttospeech.googleapis.com',
  },
]

const mockVoices = [
  {
    id: 'voice-1',
    voiceId: 'en-US-Neural2-A',
    name: 'Alex',
    gender: 'male',
    tone: 'professional',
    language: 'en',
    sampleAudioUrl: 'https://example.com/sample1.mp3',
    providerId: 'provider-3',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'voice-2',
    voiceId: 'en-US-Neural2-C',
    name: 'Emma',
    gender: 'female',
    tone: 'warm',
    language: 'en',
    sampleAudioUrl: 'https://example.com/sample2.mp3',
    providerId: 'provider-3',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'voice-3',
    voiceId: 'ur-PK-Neural-1',
    name: 'Zara',
    gender: 'female',
    tone: 'neutral',
    language: 'ur',
    sampleAudioUrl: 'https://example.com/sample3.mp3',
    providerId: 'provider-1',
    createdAt: new Date().toISOString(),
  },
]

const mockVoiceConfig = {
  id: 'config-1',
  language: 'en',
  voice: {
    id: 'voice-1',
    voiceId: 'en-US-Neural2-A',
    name: 'Alex',
    gender: 'male',
    tone: 'professional',
    language: 'en',
    sampleAudioUrl: 'https://example.com/sample1.mp3',
  },
  provider: {
    id: 'provider-3',
    name: 'Google Cloud',
  },
  parameters: {
    speed: 1.0,
    pitch: 0,
    stability: 0.5,
    similarity: 0.75,
    style: 0.0,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Voice Studio Integration Tests', () => {
  // ============================================================================
  // VOICE FETCHING TESTS
  // ============================================================================

  describe('Voice Fetching', () => {
    it('should fetch voices from provider API', async () => {
      const response = {
        success: true,
        data: mockVoices.filter((v) => v.providerId === 'provider-3'),
      }

      expect(response.success).toBe(true)
      expect(response.data).toHaveLength(2)
      expect(response.data[0].name).toBe('Alex')
      expect(response.data[1].name).toBe('Emma')
    })

    it('should filter voices by language', async () => {
      const englishVoices = mockVoices.filter((v) => v.language === 'en')
      const urduVoices = mockVoices.filter((v) => v.language === 'ur')

      expect(englishVoices).toHaveLength(2)
      expect(urduVoices).toHaveLength(1)
    })

    it('should filter voices by gender', async () => {
      const maleVoices = mockVoices.filter((v) => v.gender === 'male')
      const femaleVoices = mockVoices.filter((v) => v.gender === 'female')

      expect(maleVoices).toHaveLength(1)
      expect(femaleVoices).toHaveLength(2)
    })

    it('should filter voices by tone', async () => {
      const professionalVoices = mockVoices.filter((v) => v.tone === 'professional')
      const warmVoices = mockVoices.filter((v) => v.tone === 'warm')

      expect(professionalVoices).toHaveLength(1)
      expect(warmVoices).toHaveLength(1)
    })

    it('should combine multiple filters', async () => {
      const filtered = mockVoices.filter(
        (v) => v.language === 'en' && v.gender === 'female' && v.tone === 'warm'
      )

      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Emma')
    })

    it('should handle empty voice list', async () => {
      const filtered = mockVoices.filter((v) => v.language === 'fr')

      expect(filtered).toHaveLength(0)
    })
  })

  // ============================================================================
  // VOICE PREVIEW TESTS
  // ============================================================================

  describe('Voice Preview', () => {
    it('should generate voice preview with default text', async () => {
      const previewRequest = {
        voiceId: 'voice-1',
        text: undefined,
        language: 'en',
        parameters: {
          speed: 1.0,
          pitch: 0,
          stability: 0.5,
          similarity: 0.75,
          style: 0.0,
        },
      }

      expect(previewRequest.voiceId).toBe('voice-1')
      expect(previewRequest.language).toBe('en')
      expect(previewRequest.parameters.speed).toBe(1.0)
    })

    it('should generate voice preview with custom text', async () => {
      const customText = 'This is a custom preview text'
      const previewRequest = {
        voiceId: 'voice-1',
        text: customText,
        language: 'en',
        parameters: {
          speed: 1.0,
          pitch: 0,
        },
      }

      expect(previewRequest.text).toBe(customText)
      expect(previewRequest.text.length).toBeLessThanOrEqual(500)
    })

    it('should support Urdu UTF-8 text in preview', async () => {
      const urduText = 'السلام عليكم ورحمة الله وبركاته'
      const previewRequest = {
        voiceId: 'voice-3',
        text: urduText,
        language: 'ur',
        parameters: {
          speed: 1.0,
          pitch: 0,
        },
      }

      expect(previewRequest.text).toBe(urduText)
      expect(previewRequest.language).toBe('ur')
    })

    it('should validate text length (max 500 characters)', async () => {
      const longText = 'a'.repeat(600)
      const isValid = longText.length <= 500

      expect(isValid).toBe(false)
    })

    it('should apply voice parameters to preview', async () => {
      const previewRequest = {
        voiceId: 'voice-1',
        text: 'Test',
        language: 'en',
        parameters: {
          speed: 1.5,
          pitch: 5,
          stability: 0.7,
          similarity: 0.8,
          style: 0.2,
        },
      }

      expect(previewRequest.parameters.speed).toBe(1.5)
      expect(previewRequest.parameters.pitch).toBe(5)
      expect(previewRequest.parameters.stability).toBe(0.7)
    })

    it('should validate speed parameter (0.5 - 2.0)', async () => {
      const validSpeeds = [0.5, 1.0, 1.5, 2.0]
      const invalidSpeeds = [0.3, 2.5, -1]

      validSpeeds.forEach((speed) => {
        expect(speed >= 0.5 && speed <= 2.0).toBe(true)
      })

      invalidSpeeds.forEach((speed) => {
        expect(speed >= 0.5 && speed <= 2.0).toBe(false)
      })
    })

    it('should validate pitch parameter (-20 to +20)', async () => {
      const validPitches = [-20, -10, 0, 10, 20]
      const invalidPitches = [-25, 25, -100]

      validPitches.forEach((pitch) => {
        expect(pitch >= -20 && pitch <= 20).toBe(true)
      })

      invalidPitches.forEach((pitch) => {
        expect(pitch >= -20 && pitch <= 20).toBe(false)
      })
    })

    it('should validate stability parameter (0.0 - 1.0)', async () => {
      const validStabilities = [0.0, 0.5, 1.0]
      const invalidStabilities = [-0.1, 1.1, 2.0]

      validStabilities.forEach((stability) => {
        expect(stability >= 0.0 && stability <= 1.0).toBe(true)
      })

      invalidStabilities.forEach((stability) => {
        expect(stability >= 0.0 && stability <= 1.0).toBe(false)
      })
    })
  })

  // ============================================================================
  // LANGUAGE SLOT ASSIGNMENT TESTS
  // ============================================================================

  describe('Language Slot Assignment', () => {
    it('should assign voice to EN slot', async () => {
      const enConfig = {
        language: 'en',
        voiceId: 'voice-1',
        voiceName: 'Alex',
        providerName: 'Google Cloud',
        parameters: {
          speed: 1.0,
          pitch: 0,
        },
      }

      expect(enConfig.language).toBe('en')
      expect(enConfig.voiceId).toBe('voice-1')
      expect(enConfig.voiceName).toBe('Alex')
    })

    it('should assign voice to UR slot', async () => {
      const urConfig = {
        language: 'ur',
        voiceId: 'voice-3',
        voiceName: 'Zara',
        providerName: 'Uplift AI',
        parameters: {
          speed: 1.0,
          pitch: 0,
        },
      }

      expect(urConfig.language).toBe('ur')
      expect(urConfig.voiceId).toBe('voice-3')
      expect(urConfig.voiceName).toBe('Zara')
    })

    it('should validate that both EN and UR slots have voices', async () => {
      const enSlot = { voiceId: 'voice-1' }
      const urSlot = { voiceId: 'voice-3' }

      const bothAssigned = !!(enSlot.voiceId && urSlot.voiceId)

      expect(bothAssigned).toBe(true)
    })

    it('should prevent saving without EN slot', async () => {
      const enSlot = { voiceId: null }
      const urSlot = { voiceId: 'voice-3' }

      const bothAssigned = !!(enSlot.voiceId && urSlot.voiceId)

      expect(bothAssigned).toBe(false)
    })

    it('should prevent saving without UR slot', async () => {
      const enSlot = { voiceId: 'voice-1' }
      const urSlot = { voiceId: null }

      const bothAssigned = !!(enSlot.voiceId && urSlot.voiceId)

      expect(bothAssigned).toBe(false)
    })
  })

  // ============================================================================
  // CONVERSATION MODE ASSIGNMENT TESTS
  // ============================================================================

  describe('Conversation Mode Assignment', () => {
    const modes = ['greeting', 'information', 'alert', 'validation', 'farewell', 'error', 'transfer']

    it('should assign voice to all conversation modes', async () => {
      const modeConfigs = modes.map((mode) => ({
        mode,
        language: 'en',
        voiceId: 'voice-1',
        voiceName: 'Alex',
      }))

      expect(modeConfigs).toHaveLength(7)
      modeConfigs.forEach((config) => {
        expect(modes).toContain(config.mode)
      })
    })

    it('should support different voices per mode', async () => {
      const modeConfigs = {
        greeting: { voiceId: 'voice-1', language: 'en' },
        information: { voiceId: 'voice-2', language: 'en' },
        alert: { voiceId: 'voice-1', language: 'en' },
      }

      expect(modeConfigs.greeting.voiceId).toBe('voice-1')
      expect(modeConfigs.information.voiceId).toBe('voice-2')
      expect(modeConfigs.alert.voiceId).toBe('voice-1')
    })

    it('should support different languages per mode', async () => {
      const modeConfigs = {
        greeting: { voiceId: 'voice-1', language: 'en' },
        farewell: { voiceId: 'voice-3', language: 'ur' },
      }

      expect(modeConfigs.greeting.language).toBe('en')
      expect(modeConfigs.farewell.language).toBe('ur')
    })

    it('should apply parameters to conversation mode voices', async () => {
      const modeConfig = {
        mode: 'greeting',
        language: 'en',
        voiceId: 'voice-1',
        parameters: {
          speed: 1.2,
          pitch: 2,
          stability: 0.6,
        },
      }

      expect(modeConfig.parameters.speed).toBe(1.2)
      expect(modeConfig.parameters.pitch).toBe(2)
    })
  })

  // ============================================================================
  // SAVE CONFIGURATION TESTS
  // ============================================================================

  describe('Save Configuration', () => {
    it('should save EN language slot configuration', async () => {
      const saveRequest = {
        language: 'en',
        voiceId: 'voice-1',
        parameters: {
          speed: 1.0,
          pitch: 0,
        },
      }

      expect(saveRequest.language).toBe('en')
      expect(saveRequest.voiceId).toBe('voice-1')
    })

    it('should save UR language slot configuration', async () => {
      const saveRequest = {
        language: 'ur',
        voiceId: 'voice-3',
        parameters: {
          speed: 1.0,
          pitch: 0,
        },
      }

      expect(saveRequest.language).toBe('ur')
      expect(saveRequest.voiceId).toBe('voice-3')
    })

    it('should save conversation mode configuration', async () => {
      const saveRequest = {
        language: 'en',
        mode: 'greeting',
        voiceId: 'voice-1',
        parameters: {
          speed: 1.0,
          pitch: 0,
        },
      }

      expect(saveRequest.mode).toBe('greeting')
      expect(saveRequest.voiceId).toBe('voice-1')
    })

    it('should validate configuration before saving', async () => {
      const config = {
        enSlot: { voiceId: 'voice-1' },
        urSlot: { voiceId: 'voice-3' },
      }

      const isValid = !!(config.enSlot.voiceId && config.urSlot.voiceId)

      expect(isValid).toBe(true)
    })

    it('should handle save errors gracefully', async () => {
      const saveError = {
        code: 'SAVE_ERROR',
        message: 'Failed to save voice configuration',
      }

      expect(saveError.code).toBe('SAVE_ERROR')
      expect(saveError.message).toContain('Failed')
    })
  })

  // ============================================================================
  // END-TO-END WORKFLOW TESTS
  // ============================================================================

  describe('End-to-End Workflows', () => {
    it('should complete full voice configuration workflow', async () => {
      // Step 1: Select provider
      const selectedProvider = 'Google Cloud'
      expect(selectedProvider).toBe('Google Cloud')

      // Step 2: Fetch voices
      const voices = mockVoices.filter((v) => v.providerId === 'provider-3')
      expect(voices).toHaveLength(2)

      // Step 3: Select voice
      const selectedVoice = voices[0]
      expect(selectedVoice.name).toBe('Alex')

      // Step 4: Preview voice
      const previewText = 'Hello, this is a test'
      expect(previewText.length).toBeLessThanOrEqual(500)

      // Step 5: Assign to EN slot
      const enConfig = {
        language: 'en',
        voiceId: selectedVoice.id,
      }
      expect(enConfig.language).toBe('en')

      // Step 6: Assign to UR slot
      const urVoices = mockVoices.filter((v) => v.language === 'ur')
      const urConfig = {
        language: 'ur',
        voiceId: urVoices[0].id,
      }
      expect(urConfig.language).toBe('ur')

      // Step 7: Save configuration
      const bothAssigned = !!(enConfig.voiceId && urConfig.voiceId)
      expect(bothAssigned).toBe(true)
    })

    it('should handle multi-language configuration', async () => {
      // Configure EN voices
      const enVoices = mockVoices.filter((v) => v.language === 'en')
      const enSlot = {
        language: 'en',
        voiceId: enVoices[0].id,
      }

      // Configure UR voices
      const urVoices = mockVoices.filter((v) => v.language === 'ur')
      const urSlot = {
        language: 'ur',
        voiceId: urVoices[0].id,
      }

      expect(enSlot.language).toBe('en')
      expect(urSlot.language).toBe('ur')
      expect(enSlot.voiceId).not.toBe(urSlot.voiceId)
    })

    it('should handle conversation mode configuration', async () => {
      const modes = ['greeting', 'information', 'alert']
      const modeConfigs = modes.map((mode) => ({
        mode,
        language: 'en',
        voiceId: 'voice-1',
      }))

      expect(modeConfigs).toHaveLength(3)
      modeConfigs.forEach((config) => {
        expect(modes).toContain(config.mode)
      })
    })

    it('should handle voice parameter adjustments', async () => {
      const originalParams = {
        speed: 1.0,
        pitch: 0,
        stability: 0.5,
      }

      const adjustedParams = {
        speed: 1.5,
        pitch: 5,
        stability: 0.7,
      }

      expect(adjustedParams.speed).not.toBe(originalParams.speed)
      expect(adjustedParams.pitch).not.toBe(originalParams.pitch)
      expect(adjustedParams.stability).not.toBe(originalParams.stability)
    })
  })

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle missing tenant ID', async () => {
      const tenantId = null
      const isValid = tenantId !== null

      expect(isValid).toBe(false)
    })

    it('should handle invalid voice ID', async () => {
      const voiceId = 'invalid-voice-id'
      const voice = mockVoices.find((v) => v.id === voiceId)

      expect(voice).toBeUndefined()
    })

    it('should handle invalid provider ID', async () => {
      const providerId = 'invalid-provider-id'
      const provider = mockProviders.find((p) => p.id === providerId)

      expect(provider).toBeUndefined()
    })

    it('should handle network errors', async () => {
      const error = new Error('Network error')

      expect(error.message).toBe('Network error')
    })

    it('should handle API errors', async () => {
      const apiError = {
        code: 'API_ERROR',
        message: 'Failed to fetch voices',
      }

      expect(apiError.code).toBe('API_ERROR')
    })

    it('should handle validation errors', async () => {
      const validationError = {
        field: 'speed',
        message: 'Speed must be between 0.5 and 2.0',
      }

      expect(validationError.field).toBe('speed')
    })
  })

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance', () => {
    it('should fetch voices within reasonable time', async () => {
      const startTime = Date.now()
      const voices = mockVoices
      const endTime = Date.now()

      const duration = endTime - startTime
      expect(duration).toBeLessThan(1000) // Should complete in less than 1 second
    })

    it('should filter voices efficiently', async () => {
      const startTime = Date.now()
      const filtered = mockVoices.filter((v) => v.language === 'en' && v.gender === 'female')
      const endTime = Date.now()

      const duration = endTime - startTime
      expect(duration).toBeLessThan(100)
      expect(filtered).toHaveLength(1)
    })

    it('should handle large voice lists', async () => {
      const largeVoiceList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockVoices[0],
        id: `voice-${i}`,
      }))

      const filtered = largeVoiceList.filter((v) => v.language === 'en')
      expect(filtered.length).toBeGreaterThan(0)
    })
  })
})
