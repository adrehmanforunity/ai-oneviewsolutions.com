/**
 * Unit Tests for VoiceStudio Component
 * Tests component rendering, state management, and user interactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VoiceStudio from './VoiceStudio'

// Mock fetch
global.fetch = vi.fn()

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// ============================================================================
// TEST SETUP
// ============================================================================

const mockVoices = [
  {
    id: 'voice-1',
    providerId: 'provider-1',
    voiceId: 'en-US-Neural2-A',
    voiceName: 'Alex',
    gender: 'male',
    tone: 'professional',
    language: 'en',
    sampleAudioUrl: 'https://example.com/sample1.mp3',
    createdAt: new Date(),
    providerName: 'Google Cloud',
  },
  {
    id: 'voice-2',
    providerId: 'provider-1',
    voiceId: 'en-US-Neural2-C',
    voiceName: 'Emma',
    gender: 'female',
    tone: 'warm',
    language: 'en',
    sampleAudioUrl: 'https://example.com/sample2.mp3',
    createdAt: new Date(),
    providerName: 'Google Cloud',
  },
  {
    id: 'voice-3',
    providerId: 'provider-2',
    voiceId: 'ur-PK-Neural-1',
    voiceName: 'Zara',
    gender: 'female',
    tone: 'neutral',
    language: 'ur',
    sampleAudioUrl: 'https://example.com/sample3.mp3',
    createdAt: new Date(),
    providerName: 'Uplift AI',
  },
]

describe('VoiceStudio Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    localStorageMock.setItem('tenantId', 'test-tenant')
  })

  // ============================================================================
  // RENDERING TESTS
  // ============================================================================

  describe('Component Rendering', () => {
    it('should render the Voice Studio header', () => {
      render(<VoiceStudio />)
      expect(screen.getByText('Voice Studio')).toBeInTheDocument()
      expect(screen.getByText('Configure TTS voices for your tenant')).toBeInTheDocument()
    })

    it('should render provider selector section', () => {
      render(<VoiceStudio />)
      expect(screen.getByText('1. Select Provider')).toBeInTheDocument()
      expect(screen.getByText('Uplift AI')).toBeInTheDocument()
      expect(screen.getByText('ElevenLabs')).toBeInTheDocument()
      expect(screen.getByText('Google Cloud')).toBeInTheDocument()
      expect(screen.getByText('OpenAI')).toBeInTheDocument()
      expect(screen.getByText('Amazon Polly')).toBeInTheDocument()
    })

    it('should not render voice selection section initially', () => {
      render(<VoiceStudio />)
      expect(screen.queryByText('2. Select Voice')).not.toBeInTheDocument()
    })
  })

  // ============================================================================
  // PROVIDER SELECTION TESTS
  // ============================================================================

  describe('Provider Selection', () => {
    it('should show voice selection section when provider is selected', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockVoices.slice(0, 2) }),
      })

      render(<VoiceStudio />)
      const googleCloudButton = screen.getByText('Google Cloud')

      fireEvent.click(googleCloudButton)

      await waitFor(() => {
        expect(screen.getByText('2. Select Voice')).toBeInTheDocument()
      })
    })

    it('should fetch voices when provider is selected', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockVoices.slice(0, 2) }),
      })

      render(<VoiceStudio />)
      const googleCloudButton = screen.getByText('Google Cloud')

      fireEvent.click(googleCloudButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/voices?providerId='),
          expect.objectContaining({
            headers: expect.objectContaining({
              'x-tenant-id': 'test-tenant',
            }),
          })
        )
      })
    })

    it('should highlight selected provider button', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockVoices.slice(0, 2) }),
      })

      render(<VoiceStudio />)
      const googleCloudButton = screen.getByText('Google Cloud')

      fireEvent.click(googleCloudButton)

      await waitFor(() => {
        expect(googleCloudButton).toHaveClass('active')
      })
    })

    it('should handle fetch error gracefully', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Failed to fetch voices' } }),
      })

      render(<VoiceStudio />)
      const googleCloudButton = screen.getByText('Google Cloud')

      fireEvent.click(googleCloudButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch voices')).toBeInTheDocument()
      })
    })
  })

  // ============================================================================
  // VOICE LIST AND FILTERING TESTS
  // ============================================================================

  describe('Voice List and Filtering', () => {
    beforeEach(async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockVoices }),
      })

      render(<VoiceStudio />)
      const googleCloudButton = screen.getByText('Google Cloud')
      fireEvent.click(googleCloudButton)

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
      })
    })

    it('should display all voices from provider', async () => {
      expect(screen.getByText('Alex')).toBeInTheDocument()
      expect(screen.getByText('Emma')).toBeInTheDocument()
      expect(screen.getByText('Zara')).toBeInTheDocument()
    })

    it('should filter voices by language', async () => {
      const languageFilter = screen.getByDisplayValue('All Languages')
      fireEvent.change(languageFilter, { target: { value: 'en' } })

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
        expect(screen.getByText('Emma')).toBeInTheDocument()
        expect(screen.queryByText('Zara')).not.toBeInTheDocument()
      })
    })

    it('should filter voices by gender', async () => {
      const genderFilter = screen.getByDisplayValue('All Genders')
      fireEvent.change(genderFilter, { target: { value: 'female' } })

      await waitFor(() => {
        expect(screen.queryByText('Alex')).not.toBeInTheDocument()
        expect(screen.getByText('Emma')).toBeInTheDocument()
        expect(screen.getByText('Zara')).toBeInTheDocument()
      })
    })

    it('should filter voices by tone', async () => {
      const toneFilter = screen.getByDisplayValue('All Tones')
      fireEvent.change(toneFilter, { target: { value: 'professional' } })

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
        expect(screen.queryByText('Emma')).not.toBeInTheDocument()
        expect(screen.queryByText('Zara')).not.toBeInTheDocument()
      })
    })

    it('should combine multiple filters', async () => {
      const languageFilter = screen.getByDisplayValue('All Languages')
      const genderFilter = screen.getByDisplayValue('All Genders')

      fireEvent.change(languageFilter, { target: { value: 'en' } })
      fireEvent.change(genderFilter, { target: { value: 'female' } })

      await waitFor(() => {
        expect(screen.queryByText('Alex')).not.toBeInTheDocument()
        expect(screen.getByText('Emma')).toBeInTheDocument()
        expect(screen.queryByText('Zara')).not.toBeInTheDocument()
      })
    })

    it('should select voice when clicked', async () => {
      const alexCard = screen.getByText('Alex').closest('div')
      fireEvent.click(alexCard!)

      await waitFor(() => {
        expect(alexCard).toHaveClass('selected')
      })
    })
  })

  // ============================================================================
  // VOICE PREVIEW TESTS
  // ============================================================================

  describe('Voice Preview', () => {
    beforeEach(async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockVoices.slice(0, 2) }),
      })

      render(<VoiceStudio />)
      const googleCloudButton = screen.getByText('Google Cloud')
      fireEvent.click(googleCloudButton)

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
      })

      const alexCard = screen.getByText('Alex').closest('div')
      fireEvent.click(alexCard!)
    })

    it('should show preview section when voice is selected', async () => {
      await waitFor(() => {
        expect(screen.getByText('3. Preview Voice')).toBeInTheDocument()
      })
    })

    it('should have preview text input with default text', async () => {
      const previewTextarea = screen.getByPlaceholderText('Enter text to preview...')
      expect(previewTextarea).toHaveValue('Hello, this is a sample voice preview.')
    })

    it('should support Urdu UTF-8 text input', async () => {
      const previewTextarea = screen.getByPlaceholderText('Enter text to preview...')
      const urduText = 'السلام عليكم ورحمة الله وبركاته'

      fireEvent.change(previewTextarea, { target: { value: urduText } })

      expect(previewTextarea).toHaveValue(urduText)
    })

    it('should enforce 500 character limit', async () => {
      const previewTextarea = screen.getByPlaceholderText('Enter text to preview...')
      const longText = 'a'.repeat(600)

      fireEvent.change(previewTextarea, { target: { value: longText } })

      // The textarea should have maxLength attribute
      expect(previewTextarea).toHaveAttribute('maxLength', '500')
    })

    it('should display character count', async () => {
      const previewTextarea = screen.getByPlaceholderText('Enter text to preview...')
      const text = 'Test text'

      fireEvent.change(previewTextarea, { target: { value: text } })

      await waitFor(() => {
        expect(screen.getByText('9/500')).toBeInTheDocument()
      })
    })

    it('should have language selector for preview', async () => {
      const languageSelect = screen.getByDisplayValue('English')
      expect(languageSelect).toBeInTheDocument()
    })

    it('should allow changing preview language', async () => {
      const languageSelect = screen.getByDisplayValue('English')
      fireEvent.change(languageSelect, { target: { value: 'ur' } })

      expect(languageSelect).toHaveValue('ur')
    })

    it('should have play button', async () => {
      const playButton = screen.getByText(/Play Sample/)
      expect(playButton).toBeInTheDocument()
    })

    it('should call preview API when play button is clicked', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { message: 'Preview generated' } }),
      })

      const playButton = screen.getByText(/Play Sample/)
      fireEvent.click(playButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/voices/preview',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'x-tenant-id': 'test-tenant',
            }),
          })
        )
      })
    })
  })

  // ============================================================================
  // VOICE PARAMETERS TESTS
  // ============================================================================

  describe('Voice Parameters', () => {
    beforeEach(async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockVoices.slice(0, 1) }),
      })

      render(<VoiceStudio />)
      const googleCloudButton = screen.getByText('Google Cloud')
      fireEvent.click(googleCloudButton)

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
      })

      const alexCard = screen.getByText('Alex').closest('div')
      fireEvent.click(alexCard!)
    })

    it('should show voice parameters section', async () => {
      await waitFor(() => {
        expect(screen.getByText('4. Voice Parameters')).toBeInTheDocument()
      })
    })

    it('should have speed parameter (0.5 - 2.0)', async () => {
      const speedSlider = screen.getByLabelText('Voice speed')
      expect(speedSlider).toHaveAttribute('min', '0.5')
      expect(speedSlider).toHaveAttribute('max', '2.0')
      expect(speedSlider).toHaveValue('1')
    })

    it('should have pitch parameter (-20 to +20)', async () => {
      const pitchSlider = screen.getByLabelText('Voice pitch')
      expect(pitchSlider).toHaveAttribute('min', '-20')
      expect(pitchSlider).toHaveAttribute('max', '20')
      expect(pitchSlider).toHaveValue('0')
    })

    it('should have stability parameter (0.0 - 1.0)', async () => {
      const stabilitySlider = screen.getByLabelText('Voice stability')
      expect(stabilitySlider).toHaveAttribute('min', '0.0')
      expect(stabilitySlider).toHaveAttribute('max', '1.0')
    })

    it('should have similarity parameter (0.0 - 1.0)', async () => {
      const similaritySlider = screen.getByLabelText('Voice similarity')
      expect(similaritySlider).toHaveAttribute('min', '0.0')
      expect(similaritySlider).toHaveAttribute('max', '1.0')
    })

    it('should have style parameter (0.0 - 1.0)', async () => {
      const styleSlider = screen.getByLabelText('Voice style')
      expect(styleSlider).toHaveAttribute('min', '0.0')
      expect(styleSlider).toHaveAttribute('max', '1.0')
    })

    it('should update speed parameter', async () => {
      const speedSlider = screen.getByLabelText('Voice speed')
      fireEvent.change(speedSlider, { target: { value: '1.5' } })

      await waitFor(() => {
        expect(screen.getByText(/Speed: 1.5x/)).toBeInTheDocument()
      })
    })

    it('should update pitch parameter', async () => {
      const pitchSlider = screen.getByLabelText('Voice pitch')
      fireEvent.change(pitchSlider, { target: { value: '5' } })

      await waitFor(() => {
        expect(screen.getByText(/Pitch: \+5/)).toBeInTheDocument()
      })
    })
  })

  // ============================================================================
  // LANGUAGE SLOT ASSIGNMENT TESTS
  // ============================================================================

  describe('Language Slot Assignment', () => {
    beforeEach(async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockVoices.slice(0, 1) }),
      })

      render(<VoiceStudio />)
      const googleCloudButton = screen.getByText('Google Cloud')
      fireEvent.click(googleCloudButton)

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
      })

      const alexCard = screen.getByText('Alex').closest('div')
      fireEvent.click(alexCard!)
    })

    it('should show language slot assignment section', async () => {
      await waitFor(() => {
        expect(screen.getByText('5. Language Slot Assignment')).toBeInTheDocument()
      })
    })

    it('should display EN and UR slots', async () => {
      await waitFor(() => {
        expect(screen.getByText('English (EN)')).toBeInTheDocument()
        expect(screen.getByText('Urdu (UR)')).toBeInTheDocument()
      })
    })

    it('should show "No voice assigned" initially', async () => {
      const noVoiceMessages = screen.getAllByText('No voice assigned')
      expect(noVoiceMessages.length).toBeGreaterThanOrEqual(2)
    })

    it('should assign voice to EN slot', async () => {
      const assignEnButton = screen.getAllByText('Assign to EN')[0]
      fireEvent.click(assignEnButton)

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
        expect(screen.getByText('Google Cloud')).toBeInTheDocument()
      })
    })

    it('should assign voice to UR slot', async () => {
      const assignUrButton = screen.getAllByText('Assign to UR')[0]
      fireEvent.click(assignUrButton)

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
      })
    })
  })

  // ============================================================================
  // CONVERSATION MODE ASSIGNMENT TESTS
  // ============================================================================

  describe('Conversation Mode Assignment', () => {
    beforeEach(async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockVoices.slice(0, 1) }),
      })

      render(<VoiceStudio />)
      const googleCloudButton = screen.getByText('Google Cloud')
      fireEvent.click(googleCloudButton)

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
      })

      const alexCard = screen.getByText('Alex').closest('div')
      fireEvent.click(alexCard!)
    })

    it('should show conversation mode assignment section', async () => {
      await waitFor(() => {
        expect(screen.getByText('6. Conversation Mode Assignment')).toBeInTheDocument()
      })
    })

    it('should display all conversation modes', async () => {
      const modes = ['Greeting', 'Information', 'Alert', 'Validation', 'Farewell', 'Error', 'Transfer']
      for (const mode of modes) {
        expect(screen.getByText(mode)).toBeInTheDocument()
      }
    })

    it('should have language selector for each mode', async () => {
      const languageSelects = screen.getAllByDisplayValue('English')
      expect(languageSelects.length).toBeGreaterThan(0)
    })

    it('should allow assigning voice to conversation mode', async () => {
      const assignButtons = screen.getAllByText('Assign')
      fireEvent.click(assignButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
      })
    })
  })

  // ============================================================================
  // SAVE FUNCTIONALITY TESTS
  // ============================================================================

  describe('Save Functionality', () => {
    beforeEach(async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockVoices.slice(0, 2) }),
      })

      render(<VoiceStudio />)
      const googleCloudButton = screen.getByText('Google Cloud')
      fireEvent.click(googleCloudButton)

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
      })

      const alexCard = screen.getByText('Alex').closest('div')
      fireEvent.click(alexCard!)
    })

    it('should show save button when voice is selected', async () => {
      await waitFor(() => {
        expect(screen.getByText(/Save Configuration/)).toBeInTheDocument()
      })
    })

    it('should validate that both EN and UR slots have voices', async () => {
      ;(global.fetch as any).mockClear()

      const saveButton = screen.getByText(/Save Configuration/)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/Both English \(EN\) and Urdu \(UR\) language slots must have voices assigned/)).toBeInTheDocument()
      })
    })

    it('should save configuration when both slots have voices', async () => {
      ;(global.fetch as any).mockClear()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      })

      // Assign to EN slot
      const assignEnButtons = screen.getAllByText('Assign to EN')
      fireEvent.click(assignEnButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
      })

      // Assign to UR slot
      const assignUrButtons = screen.getAllByText('Assign to UR')
      fireEvent.click(assignUrButtons[0])

      // Click save
      const saveButton = screen.getByText(/Save Configuration/)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/voice-config/'),
          expect.any(Object)
        )
      })
    })

    it('should show success message after saving', async () => {
      ;(global.fetch as any).mockClear()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      })

      // Assign to both slots
      const assignEnButtons = screen.getAllByText('Assign to EN')
      fireEvent.click(assignEnButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
      })

      const assignUrButtons = screen.getAllByText('Assign to UR')
      fireEvent.click(assignUrButtons[0])

      // Save
      const saveButton = screen.getByText(/Save Configuration/)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/Voice configuration saved successfully/)).toBeInTheDocument()
      })
    })

    it('should handle save errors', async () => {
      ;(global.fetch as any).mockClear()
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Failed to save' } }),
      })

      // Assign to both slots
      const assignEnButtons = screen.getAllByText('Assign to EN')
      fireEvent.click(assignEnButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument()
      })

      const assignUrButtons = screen.getAllByText('Assign to UR')
      fireEvent.click(assignUrButtons[0])

      // Save
      const saveButton = screen.getByText(/Save Configuration/)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/Failed to save/)).toBeInTheDocument()
      })
    })
  })

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<VoiceStudio />)
      expect(screen.getByLabelText('Select Google Cloud provider')).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockVoices.slice(0, 1) }),
      })

      render(<VoiceStudio />)
      const googleCloudButton = screen.getByText('Google Cloud')
      googleCloudButton.focus()

      fireEvent.keyDown(googleCloudButton, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.getByText('2. Select Voice')).toBeInTheDocument()
      })
    })
  })
})
