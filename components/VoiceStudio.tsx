'use client'

import React, { useState, useEffect, useCallback } from 'react'
import styles from './VoiceStudio.module.css'
import { ProviderVoice, ConversationMode, LanguageCode } from '@/lib/db/schema'

// ============================================================================
// TYPES
// ============================================================================

interface VoiceWithProvider extends ProviderVoice {
  providerName: string
}

interface VoiceConfig {
  voiceId: string
  speed: number
  pitch: number
  stability?: number
  similarity?: number
  style?: number
}

interface LanguageSlotConfig {
  language: LanguageCode
  voiceId?: string
  voiceName?: string
  providerName?: string
  parameters: VoiceConfig
}

interface ConversationModeConfig {
  mode: ConversationMode
  language: LanguageCode
  voiceId?: string
  voiceName?: string
  providerName?: string
  parameters: VoiceConfig
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TTS_PROVIDERS = ['Uplift AI', 'ElevenLabs', 'Google Cloud', 'OpenAI', 'Amazon Polly']

const CONVERSATION_MODES: ConversationMode[] = [
  'greeting',
  'information',
  'alert',
  'validation',
  'farewell',
  'error',
  'transfer',
]

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  voiceId: '',
  speed: 1.0,
  pitch: 0,
  stability: 0.5,
  similarity: 0.75,
  style: 0.0,
}

// ============================================================================
// VOICE STUDIO COMPONENT
// ============================================================================

export default function VoiceStudio() {
  // State management
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [voices, setVoices] = useState<VoiceWithProvider[]>([])
  const [filteredVoices, setFilteredVoices] = useState<VoiceWithProvider[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [languageFilter, setLanguageFilter] = useState<string>('')
  const [genderFilter, setGenderFilter] = useState<string>('')
  const [toneFilter, setToneFilter] = useState<string>('')

  // Preview state
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState<string>('Hello, this is a sample voice preview.')
  const [previewLanguage, setPreviewLanguage] = useState<LanguageCode>('en')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Voice parameter state
  const [voiceParameters, setVoiceParameters] = useState<VoiceConfig>(DEFAULT_VOICE_CONFIG)

  // Language slot configuration
  const [enSlotConfig, setEnSlotConfig] = useState<LanguageSlotConfig>({
    language: 'en',
    parameters: DEFAULT_VOICE_CONFIG,
  })
  const [urSlotConfig, setUrSlotConfig] = useState<LanguageSlotConfig>({
    language: 'ur',
    parameters: DEFAULT_VOICE_CONFIG,
  })

  // Conversation mode configuration
  const [modeConfigs, setModeConfigs] = useState<Record<ConversationMode, ConversationModeConfig>>({
    greeting: { mode: 'greeting', language: 'en', parameters: DEFAULT_VOICE_CONFIG },
    information: { mode: 'information', language: 'en', parameters: DEFAULT_VOICE_CONFIG },
    alert: { mode: 'alert', language: 'en', parameters: DEFAULT_VOICE_CONFIG },
    validation: { mode: 'validation', language: 'en', parameters: DEFAULT_VOICE_CONFIG },
    farewell: { mode: 'farewell', language: 'en', parameters: DEFAULT_VOICE_CONFIG },
    error: { mode: 'error', language: 'en', parameters: DEFAULT_VOICE_CONFIG },
    transfer: { mode: 'transfer', language: 'en', parameters: DEFAULT_VOICE_CONFIG },
  })

  // Saving state
  const [saving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Fetch voices when provider changes
  useEffect(() => {
    if (selectedProvider) {
      fetchVoices(selectedProvider)
    }
  }, [selectedProvider])

  // Apply filters to voices
  useEffect(() => {
    let filtered = voices

    if (languageFilter) {
      filtered = filtered.filter((v) => v.language === languageFilter)
    }

    if (genderFilter) {
      filtered = filtered.filter((v) => v.gender === genderFilter)
    }

    if (toneFilter) {
      filtered = filtered.filter((v) => v.tone === toneFilter)
    }

    setFilteredVoices(filtered)
  }, [voices, languageFilter, genderFilter, toneFilter])

  // ============================================================================
  // API CALLS
  // ============================================================================

  const fetchVoices = useCallback(async (providerId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/voices?providerId=${providerId}`, {
        headers: {
          'x-tenant-id': getTenantId(),
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch voices')
      }

      const data = await response.json()
      const voicesWithProvider = data.data.map((voice: any) => ({
        ...voice,
        providerName: selectedProvider,
      }))

      setVoices(voicesWithProvider)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch voices')
    } finally {
      setLoading(false)
    }
  }, [selectedProvider])

  const previewVoice = useCallback(async (voiceId: string, text: string, language: LanguageCode) => {
    setPreviewLoading(true)
    setPreviewError(null)

    try {
      const response = await fetch('/api/voices/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({
          voiceId,
          text: text || undefined,
          language,
          parameters: voiceParameters,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate voice preview')
      }

      const data = await response.json()
      // In a real implementation, this would play audio
      // For now, we'll just show a success message
      console.log('Voice preview generated:', data.data)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to generate preview')
    } finally {
      setPreviewLoading(false)
    }
  }, [voiceParameters])

  const saveVoiceConfiguration = useCallback(async () => {
    // Validate that both EN and UR slots have voices
    if (!enSlotConfig.voiceId || !urSlotConfig.voiceId) {
      setSaveError('Both English (EN) and Urdu (UR) language slots must have voices assigned')
      return
    }

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      // Save EN slot
      await saveLanguageSlot('en', enSlotConfig)

      // Save UR slot
      await saveLanguageSlot('ur', urSlotConfig)

      // Save conversation modes
      for (const mode of CONVERSATION_MODES) {
        const config = modeConfigs[mode]
        if (config.voiceId) {
          await saveConversationMode(config.language, mode, config)
        }
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save voice configuration')
    } finally {
      setIsSaving(false)
    }
  }, [enSlotConfig, urSlotConfig, modeConfigs])

  const saveLanguageSlot = async (language: LanguageCode, config: LanguageSlotConfig) => {
    const response = await fetch(`/api/voice-config/${language}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': getTenantId(),
      },
      body: JSON.stringify({
        voiceId: config.voiceId,
        parameters: config.parameters,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to save ${language.toUpperCase()} voice configuration`)
    }
  }

  const saveConversationMode = async (
    language: LanguageCode,
    mode: ConversationMode,
    config: ConversationModeConfig
  ) => {
    const response = await fetch(`/api/voice-config/${language}/${mode}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': getTenantId(),
      },
      body: JSON.stringify({
        voiceId: config.voiceId,
        parameters: config.parameters,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to save ${mode} voice configuration`)
    }
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleVoiceSelect = (voice: VoiceWithProvider) => {
    setPreviewVoiceId(voice.id)
    setVoiceParameters({
      voiceId: voice.id,
      speed: 1.0,
      pitch: 0,
      stability: 0.5,
      similarity: 0.75,
      style: 0.0,
    })
  }

  const handleAssignToLanguageSlot = (language: LanguageCode) => {
    if (!previewVoiceId) return

    const voice = voices.find((v) => v.id === previewVoiceId)
    if (!voice) return

    const config: LanguageSlotConfig = {
      language,
      voiceId: voice.id,
      voiceName: voice.voiceName,
      providerName: voice.providerName,
      parameters: voiceParameters,
    }

    if (language === 'en') {
      setEnSlotConfig(config)
    } else {
      setUrSlotConfig(config)
    }
  }

  const handleAssignToConversationMode = (mode: ConversationMode, language: LanguageCode) => {
    if (!previewVoiceId) return

    const voice = voices.find((v) => v.id === previewVoiceId)
    if (!voice) return

    setModeConfigs((prev) => ({
      ...prev,
      [mode]: {
        mode,
        language,
        voiceId: voice.id,
        voiceName: voice.voiceName,
        providerName: voice.providerName,
        parameters: voiceParameters,
      },
    }))
  }

  const handleParameterChange = (param: keyof VoiceConfig, value: number) => {
    setVoiceParameters((prev) => ({
      ...prev,
      [param]: value,
    }))
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Voice Studio</h1>
        <p className={styles.subtitle}>Configure TTS voices for your tenant</p>
      </div>

      <div className={styles.content}>
        {/* Provider Selector */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Select Provider</h2>
          <div className={styles.providerGrid}>
            {TTS_PROVIDERS.map((provider) => (
              <button
                key={provider}
                className={`${styles.providerButton} ${selectedProvider === provider ? styles.active : ''}`}
                onClick={() => setSelectedProvider(provider)}
                aria-label={`Select ${provider} provider`}
              >
                {provider}
              </button>
            ))}
          </div>
        </section>

        {selectedProvider && (
          <>
            {/* Voice List with Filters */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>2. Select Voice</h2>

              {/* Filters */}
              <div className={styles.filterContainer}>
                <div className={styles.filterGroup}>
                  <label htmlFor="language-filter" className={styles.filterLabel}>
                    Language
                  </label>
                  <select
                    id="language-filter"
                    value={languageFilter}
                    onChange={(e) => setLanguageFilter(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="">All Languages</option>
                    <option value="en">English</option>
                    <option value="ur">Urdu</option>
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label htmlFor="gender-filter" className={styles.filterLabel}>
                    Gender
                  </label>
                  <select
                    id="gender-filter"
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="">All Genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label htmlFor="tone-filter" className={styles.filterLabel}>
                    Tone
                  </label>
                  <select
                    id="tone-filter"
                    value={toneFilter}
                    onChange={(e) => setToneFilter(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="">All Tones</option>
                    <option value="professional">Professional</option>
                    <option value="warm">Warm</option>
                    <option value="neutral">Neutral</option>
                    <option value="friendly">Friendly</option>
                  </select>
                </div>
              </div>

              {/* Voice List */}
              {loading ? (
                <div className={styles.loadingMessage}>Loading voices...</div>
              ) : error ? (
                <div className={styles.errorMessage}>{error}</div>
              ) : (
                <div className={styles.voiceList}>
                  {filteredVoices.length === 0 ? (
                    <div className={styles.emptyMessage}>No voices found matching your filters</div>
                  ) : (
                    filteredVoices.map((voice) => (
                      <div
                        key={voice.id}
                        className={`${styles.voiceCard} ${previewVoiceId === voice.id ? styles.selected : ''}`}
                        onClick={() => handleVoiceSelect(voice)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleVoiceSelect(voice)
                          }
                        }}
                      >
                        <div className={styles.voiceCardHeader}>
                          <h3 className={styles.voiceName}>{voice.voiceName}</h3>
                          <span className={styles.voiceLanguage}>{voice.language.toUpperCase()}</span>
                        </div>
                        <div className={styles.voiceCardMeta}>
                          {voice.gender && <span className={styles.voiceMeta}>{voice.gender}</span>}
                          {voice.tone && <span className={styles.voiceMeta}>{voice.tone}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>

            {/* Voice Preview */}
            {previewVoiceId && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>3. Preview Voice</h2>

                <div className={styles.previewContainer}>
                  {/* Preview Text Input */}
                  <div className={styles.previewInputGroup}>
                    <label htmlFor="preview-text" className={styles.label}>
                      Preview Text (supports Urdu UTF-8)
                    </label>
                    <textarea
                      id="preview-text"
                      value={previewText}
                      onChange={(e) => setPreviewText(e.target.value)}
                      className={styles.previewTextarea}
                      placeholder="Enter text to preview..."
                      maxLength={500}
                    />
                    <div className={styles.charCount}>{previewText.length}/500</div>
                  </div>

                  {/* Preview Language */}
                  <div className={styles.previewInputGroup}>
                    <label htmlFor="preview-language" className={styles.label}>
                      Preview Language
                    </label>
                    <select
                      id="preview-language"
                      value={previewLanguage}
                      onChange={(e) => setPreviewLanguage(e.target.value as LanguageCode)}
                      className={styles.filterSelect}
                    >
                      <option value="en">English</option>
                      <option value="ur">Urdu</option>
                    </select>
                  </div>

                  {/* Play Button */}
                  <button
                    onClick={() => previewVoice(previewVoiceId, previewText, previewLanguage)}
                    disabled={previewLoading}
                    className={styles.playButton}
                    aria-label="Play voice preview"
                  >
                    {previewLoading ? 'Playing...' : '▶ Play Sample'}
                  </button>

                  {previewError && <div className={styles.errorMessage}>{previewError}</div>}
                </div>
              </section>
            )}

            {/* Voice Parameters */}
            {previewVoiceId && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>4. Voice Parameters</h2>

                <div className={styles.parametersGrid}>
                  {/* Speed */}
                  <div className={styles.parameterGroup}>
                    <label htmlFor="speed" className={styles.parameterLabel}>
                      Speed: {voiceParameters.speed.toFixed(1)}x
                    </label>
                    <input
                      id="speed"
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={voiceParameters.speed}
                      onChange={(e) => handleParameterChange('speed', parseFloat(e.target.value))}
                      className={styles.slider}
                      aria-label="Voice speed"
                    />
                    <div className={styles.parameterRange}>0.5x - 2.0x</div>
                  </div>

                  {/* Pitch */}
                  <div className={styles.parameterGroup}>
                    <label htmlFor="pitch" className={styles.parameterLabel}>
                      Pitch: {voiceParameters.pitch > 0 ? '+' : ''}{voiceParameters.pitch}
                    </label>
                    <input
                      id="pitch"
                      type="range"
                      min="-20"
                      max="20"
                      step="1"
                      value={voiceParameters.pitch}
                      onChange={(e) => handleParameterChange('pitch', parseInt(e.target.value))}
                      className={styles.slider}
                      aria-label="Voice pitch"
                    />
                    <div className={styles.parameterRange}>-20 to +20</div>
                  </div>

                  {/* Stability (ElevenLabs) */}
                  <div className={styles.parameterGroup}>
                    <label htmlFor="stability" className={styles.parameterLabel}>
                      Stability: {voiceParameters.stability?.toFixed(2)}
                    </label>
                    <input
                      id="stability"
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={voiceParameters.stability ?? 0.5}
                      onChange={(e) => handleParameterChange('stability', parseFloat(e.target.value))}
                      className={styles.slider}
                      aria-label="Voice stability"
                    />
                    <div className={styles.parameterRange}>0.0 - 1.0</div>
                  </div>

                  {/* Similarity (ElevenLabs) */}
                  <div className={styles.parameterGroup}>
                    <label htmlFor="similarity" className={styles.parameterLabel}>
                      Similarity: {voiceParameters.similarity?.toFixed(2)}
                    </label>
                    <input
                      id="similarity"
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={voiceParameters.similarity ?? 0.75}
                      onChange={(e) => handleParameterChange('similarity', parseFloat(e.target.value))}
                      className={styles.slider}
                      aria-label="Voice similarity"
                    />
                    <div className={styles.parameterRange}>0.0 - 1.0</div>
                  </div>

                  {/* Style (ElevenLabs) */}
                  <div className={styles.parameterGroup}>
                    <label htmlFor="style" className={styles.parameterLabel}>
                      Style: {voiceParameters.style?.toFixed(2)}
                    </label>
                    <input
                      id="style"
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={voiceParameters.style ?? 0.0}
                      onChange={(e) => handleParameterChange('style', parseFloat(e.target.value))}
                      className={styles.slider}
                      aria-label="Voice style"
                    />
                    <div className={styles.parameterRange}>0.0 - 1.0</div>
                  </div>
                </div>
              </section>
            )}

            {/* Language Slot Assignment */}
            {previewVoiceId && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>5. Language Slot Assignment</h2>

                <div className={styles.slotGrid}>
                  {/* EN Slot */}
                  <div className={styles.slotCard}>
                    <h3 className={styles.slotTitle}>English (EN)</h3>
                    {enSlotConfig.voiceId ? (
                      <div className={styles.slotAssigned}>
                        <p className={styles.slotVoiceName}>{enSlotConfig.voiceName}</p>
                        <p className={styles.slotProvider}>{enSlotConfig.providerName}</p>
                      </div>
                    ) : (
                      <p className={styles.slotEmpty}>No voice assigned</p>
                    )}
                    <button
                      onClick={() => handleAssignToLanguageSlot('en')}
                      className={styles.assignButton}
                      disabled={!previewVoiceId}
                    >
                      Assign to EN
                    </button>
                  </div>

                  {/* UR Slot */}
                  <div className={styles.slotCard}>
                    <h3 className={styles.slotTitle}>Urdu (UR)</h3>
                    {urSlotConfig.voiceId ? (
                      <div className={styles.slotAssigned}>
                        <p className={styles.slotVoiceName}>{urSlotConfig.voiceName}</p>
                        <p className={styles.slotProvider}>{urSlotConfig.providerName}</p>
                      </div>
                    ) : (
                      <p className={styles.slotEmpty}>No voice assigned</p>
                    )}
                    <button
                      onClick={() => handleAssignToLanguageSlot('ur')}
                      className={styles.assignButton}
                      disabled={!previewVoiceId}
                    >
                      Assign to UR
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Conversation Mode Assignment */}
            {previewVoiceId && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>6. Conversation Mode Assignment</h2>

                <div className={styles.modesGrid}>
                  {CONVERSATION_MODES.map((mode) => (
                    <div key={mode} className={styles.modeCard}>
                      <h4 className={styles.modeName}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</h4>

                      <div className={styles.modeLanguageSelect}>
                        <label htmlFor={`mode-lang-${mode}`} className={styles.modeLabel}>
                          Language
                        </label>
                        <select
                          id={`mode-lang-${mode}`}
                          value={modeConfigs[mode].language}
                          onChange={(e) => {
                            setModeConfigs((prev) => ({
                              ...prev,
                              [mode]: {
                                ...prev[mode],
                                language: e.target.value as LanguageCode,
                              },
                            }))
                          }}
                          className={styles.modeSelect}
                        >
                          <option value="en">English</option>
                          <option value="ur">Urdu</option>
                        </select>
                      </div>

                      {modeConfigs[mode].voiceId ? (
                        <div className={styles.modeAssigned}>
                          <p className={styles.modeVoiceName}>{modeConfigs[mode].voiceName}</p>
                          <p className={styles.modeProvider}>{modeConfigs[mode].providerName}</p>
                        </div>
                      ) : (
                        <p className={styles.modeEmpty}>No voice assigned</p>
                      )}

                      <button
                        onClick={() =>
                          handleAssignToConversationMode(mode, modeConfigs[mode].language)
                        }
                        className={styles.modeAssignButton}
                        disabled={!previewVoiceId}
                      >
                        Assign
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Save Button */}
            {previewVoiceId && (
              <section className={styles.section}>
                <div className={styles.saveContainer}>
                  {saveError && <div className={styles.errorMessage}>{saveError}</div>}
                  {saveSuccess && (
                    <div className={styles.successMessage}>Voice configuration saved successfully!</div>
                  )}

                  <button
                    onClick={saveVoiceConfiguration}
                    disabled={saving}
                    className={styles.saveButton}
                    aria-label="Save voice configuration"
                  >
                    {saving ? 'Saving...' : '💾 Save Configuration'}
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get tenant ID from localStorage or environment
 * In a real app, this would come from auth context
 */
function getTenantId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('tenantId') || 'default-tenant'
  }
  return 'default-tenant'
}
