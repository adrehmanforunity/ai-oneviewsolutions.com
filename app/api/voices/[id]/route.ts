/**
 * Voice Detail API Route
 * GET /api/voices/:id - Get voice metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { ProviderVoiceRow } from '@/lib/db/schema';

// ============================================================================
// GET /api/voices/:id - Get voice metadata
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const voiceId = params.id;

    if (!voiceId) {
      return NextResponse.json(
        { error: { code: 'MISSING_VOICE_ID', message: 'Voice ID is required' } },
        { status: 400 }
      );
    }

    // Fetch voice metadata
    const voice = await queryOne<ProviderVoiceRow>(
      `SELECT id, provider_id, voice_id, voice_name, gender, tone, language, sample_audio_url, created_at
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

    // Fetch provider details to include supported parameters
    const provider = await queryOne<{ id: string; name: string; provider_type: string }>(
      'SELECT id, name, provider_type FROM providers WHERE id = $1',
      [voice.provider_id]
    );

    if (!provider) {
      return NextResponse.json(
        { error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } },
        { status: 404 }
      );
    }

    // Determine supported parameters based on provider
    const supportedParameters = getSupportedParameters(provider.name);

    const response = {
      id: voice.id,
      voiceId: voice.voice_id,
      name: voice.voice_name,
      gender: voice.gender,
      tone: voice.tone,
      language: voice.language,
      sampleAudioUrl: voice.sample_audio_url,
      providerId: voice.provider_id,
      providerName: provider.name,
      supportedParameters,
      createdAt: voice.created_at,
    };

    return NextResponse.json(
      { success: true, data: response },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching voice:', error);
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
 * Get supported voice parameters for a provider
 */
function getSupportedParameters(providerName: string): string[] {
  const baseParameters = ['speed', 'pitch'];

  switch (providerName.toLowerCase()) {
    case 'elevenlabs':
      return [...baseParameters, 'stability', 'similarity', 'style'];
    case 'google cloud':
    case 'amazon polly':
    case 'openai':
    case 'uplift ai':
      return baseParameters;
    default:
      return baseParameters;
  }
}
