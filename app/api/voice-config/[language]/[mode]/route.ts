/**
 * Voice Configuration by Language and Mode API Route
 * PUT /api/voice-config/:language/:mode - Configure voice for conversation mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { ProviderVoiceRow, TenantVoiceConfigRow, ConversationMode } from '@/lib/db/schema';

const VALID_MODES: ConversationMode[] = [
  'greeting',
  'information',
  'alert',
  'validation',
  'farewell',
  'error',
  'transfer',
];

// ============================================================================
// PUT /api/voice-config/:language/:mode - Configure voice for conversation mode
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { language: string; mode: string } }
) {
  try {
    // Get tenant ID from request headers
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    const language = params.language?.toLowerCase();
    const mode = params.mode?.toLowerCase();

    // Validate language
    if (!['en', 'ur'].includes(language)) {
      return NextResponse.json(
        { error: { code: 'INVALID_LANGUAGE', message: 'Language must be "en" or "ur"' } },
        { status: 400 }
      );
    }

    // Validate conversation mode
    if (!VALID_MODES.includes(mode as ConversationMode)) {
      return NextResponse.json(
        { error: { code: 'INVALID_MODE', message: `Mode must be one of: ${VALID_MODES.join(', ')}` } },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { voiceId, parameters } = body;

    if (!voiceId) {
      return NextResponse.json(
        { error: { code: 'MISSING_VOICE_ID', message: 'voiceId is required' } },
        { status: 400 }
      );
    }

    // Verify voice exists
    const voice = await queryOne<ProviderVoiceRow>(
      'SELECT id, provider_id FROM provider_voices WHERE id = $1',
      [voiceId]
    );

    if (!voice) {
      return NextResponse.json(
        { error: { code: 'VOICE_NOT_FOUND', message: 'Voice not found' } },
        { status: 404 }
      );
    }

    // Validate voice parameters if provided
    if (parameters) {
      const paramValidation = validateVoiceParameters(parameters);
      if (!paramValidation.valid) {
        return NextResponse.json(
          { error: { code: 'INVALID_PARAMETERS', message: paramValidation.error } },
          { status: 400 }
        );
      }
    }

    // Upsert voice configuration for conversation mode
    const result = await query<TenantVoiceConfigRow>(
      `INSERT INTO tenant_voice_config (
        id, tenant_id, language, voice_id, speed, pitch, stability, similarity, style, conversation_mode, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      )
      ON CONFLICT (tenant_id, language, conversation_mode) 
      WHERE conversation_mode = $9
      DO UPDATE SET
        voice_id = $3,
        speed = $4,
        pitch = $5,
        stability = $6,
        similarity = $7,
        style = $8,
        updated_at = NOW()
      RETURNING *`,
      [
        tenantId,
        language,
        voiceId,
        parameters?.speed ?? 1.0,
        parameters?.pitch ?? 0,
        parameters?.stability ?? null,
        parameters?.similarity ?? null,
        parameters?.style ?? null,
        mode,
      ]
    );

    if (!result.rows[0]) {
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to save voice configuration' } },
        { status: 500 }
      );
    }

    const config = result.rows[0];

    // Fetch voice metadata for response
    const voiceMetadata = await queryOne<ProviderVoiceRow>(
      'SELECT id, voice_id, voice_name, gender, tone, language, sample_audio_url FROM provider_voices WHERE id = $1',
      [config.voice_id]
    );

    const response = {
      id: config.id,
      language: config.language,
      conversationMode: config.conversation_mode,
      voice: voiceMetadata
        ? {
            id: voiceMetadata.id,
            voiceId: voiceMetadata.voice_id,
            name: voiceMetadata.voice_name,
            gender: voiceMetadata.gender,
            tone: voiceMetadata.tone,
            language: voiceMetadata.language,
            sampleAudioUrl: voiceMetadata.sample_audio_url,
          }
        : null,
      parameters: {
        speed: config.speed,
        pitch: config.pitch,
        stability: config.stability,
        similarity: config.similarity,
        style: config.style,
      },
      createdAt: config.created_at,
      updatedAt: config.updated_at,
    };

    return NextResponse.json(
      { success: true, data: response },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating voice configuration:', error);
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
 * Validate voice parameters
 */
function validateVoiceParameters(parameters: Record<string, any>): { valid: boolean; error?: string } {
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

  return { valid: true };
}
