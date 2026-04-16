/**
 * Voice Preview API Route
 * POST /api/voices/preview - Preview voice with sample or custom text
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { ProviderVoiceRow } from '@/lib/db/schema';

// ============================================================================
// POST /api/voices/preview - Preview voice with sample or custom text
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from request headers
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { voiceId, text, language = 'en', parameters } = body;

    if (!voiceId) {
      return NextResponse.json(
        { error: { code: 'MISSING_VOICE_ID', message: 'voiceId is required' } },
        { status: 400 }
      );
    }

    // Validate language
    if (!['en', 'ur'].includes(language)) {
      return NextResponse.json(
        { error: { code: 'INVALID_LANGUAGE', message: 'Language must be "en" or "ur"' } },
        { status: 400 }
      );
    }

    // Fetch voice metadata
    const voice = await queryOne<ProviderVoiceRow>(
      `SELECT id, provider_id, voice_id, voice_name, language, created_at
       FROM provider_voices
       WHERE id = $1`,
      [voiceId]
    );

    if (!voice) {
      return NextResponse.json(
        { error: { code: 'VOICE_NOT_FOUND', message: 'Voice not found' } },
        { status: 404 }
      );
    }

    // Fetch provider details
    const provider = await queryOne<{ id: string; name: string; api_endpoint: string }>(
      'SELECT id, name, api_endpoint FROM providers WHERE id = $1',
      [voice.provider_id]
    );

    if (!provider) {
      return NextResponse.json(
        { error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } },
        { status: 404 }
      );
    }

    // Fetch API key for provider
    const apiKey = await queryOne<{ key_value_encrypted: string }>(
      `SELECT key_value_encrypted FROM api_keys
       WHERE tenant_id = $1 AND provider_id = $2 AND active = true
       LIMIT 1`,
      [tenantId, provider.id]
    );

    if (!apiKey) {
      return NextResponse.json(
        { error: { code: 'NO_ACTIVE_KEY', message: 'No active API key found for this provider' } },
        { status: 400 }
      );
    }

    // Determine preview text
    const previewText = text || getDefaultSampleText(language);

    // Validate text length
    if (previewText.length > 500) {
      return NextResponse.json(
        { error: { code: 'TEXT_TOO_LONG', message: 'Preview text must be 500 characters or less' } },
        { status: 400 }
      );
    }

    // Validate voice parameters if provided
    if (parameters) {
      const paramValidation = validateVoiceParameters(parameters, provider.name);
      if (!paramValidation.valid) {
        return NextResponse.json(
          { error: { code: 'INVALID_PARAMETERS', message: paramValidation.error } },
          { status: 400 }
        );
      }
    }

    // Generate TTS preview (this would call the provider API)
    // For now, return a placeholder response indicating the preview would be generated
    const response = {
      voiceId: voice.id,
      voiceName: voice.voice_name,
      text: previewText,
      language,
      parameters: parameters || {},
      message: 'Voice preview would be generated here',
      // In a real implementation, this would return audio data
      // audioUrl: 'data:audio/mp3;base64,...',
      // duration: 2.5,
    };

    return NextResponse.json(
      { success: true, data: response },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error generating voice preview:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get default sample text for a language
 */
function getDefaultSampleText(language: string): string {
  switch (language) {
    case 'ur':
      return 'السلام عليكم ورحمة الله وبركاته';
    case 'en':
    default:
      return 'Hello, this is a sample voice preview.';
  }
}

/**
 * Validate voice parameters
 */
function validateVoiceParameters(
  parameters: Record<string, any>,
  providerName: string
): { valid: boolean; error?: string } {
  // Validate speed (0.5 - 2.0)
  if (parameters.speed !== undefined) {
    if (typeof parameters.speed !== 'number' || parameters.speed < 0.5 || parameters.speed > 2.0) {
      return { valid: false, error: 'Speed must be between 0.5 and 2.0' };
    }
  }

  // Validate pitch (-20 to +20)
  if (parameters.pitch !== undefined) {
    if (typeof parameters.pitch !== 'number' || parameters.pitch < -20 || parameters.pitch > 20) {
      return { valid: false, error: 'Pitch must be between -20 and +20' };
    }
  }

  // Validate ElevenLabs-specific parameters
  if (providerName.toLowerCase() === 'elevenlabs') {
    // Validate stability (0.0 - 1.0)
    if (parameters.stability !== undefined) {
      if (typeof parameters.stability !== 'number' || parameters.stability < 0.0 || parameters.stability > 1.0) {
        return { valid: false, error: 'Stability must be between 0.0 and 1.0' };
      }
    }

    // Validate similarity (0.0 - 1.0)
    if (parameters.similarity !== undefined) {
      if (typeof parameters.similarity !== 'number' || parameters.similarity < 0.0 || parameters.similarity > 1.0) {
        return { valid: false, error: 'Similarity must be between 0.0 and 1.0' };
      }
    }

    // Validate style (0.0 - 1.0)
    if (parameters.style !== undefined) {
      if (typeof parameters.style !== 'number' || parameters.style < 0.0 || parameters.style > 1.0) {
        return { valid: false, error: 'Style must be between 0.0 and 1.0' };
      }
    }
  }

  return { valid: true };
}
