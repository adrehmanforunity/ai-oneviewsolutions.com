/**
 * Provider Voices Routes
 * GET /api/providers/:id/voices - Get available voices for provider (from DB + optionally fetch from API)
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryMany } from '@/lib/db';
import { ProviderVoiceRow } from '@/lib/db/schema';

// ============================================================================
// GET /api/providers/:id/voices - Get available voices for provider
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    const providerId = params.id;

    // Verify provider exists
    const provider = await queryOne<{ id: string; name: string; provider_type: string }>(
      'SELECT id, name, provider_type FROM providers WHERE id = $1',
      [providerId]
    );

    if (!provider) {
      return NextResponse.json(
        { success: false, error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } },
        { status: 404 }
      );
    }

    // Only TTS providers have voices
    if (provider.provider_type !== 'TTS') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_TTS_PROVIDER',
            message: 'Voices are only available for TTS providers',
          },
        },
        { status: 400 }
      );
    }

    // Get optional filters from query params
    const searchParams = request.nextUrl.searchParams;
    const language = searchParams.get('language');
    const gender = searchParams.get('gender');
    const tone = searchParams.get('tone');

    // Build query with optional filters
    let sql = `
      SELECT id, provider_id, voice_id, voice_name, gender, tone, language, sample_audio_url, created_at
      FROM provider_voices
      WHERE provider_id = $1
    `;
    const queryParams: any[] = [providerId];
    let paramIndex = 2;

    if (language) {
      sql += ` AND language = $${paramIndex}`;
      queryParams.push(language);
      paramIndex++;
    }

    if (gender) {
      sql += ` AND gender = $${paramIndex}`;
      queryParams.push(gender);
      paramIndex++;
    }

    if (tone) {
      sql += ` AND tone = $${paramIndex}`;
      queryParams.push(tone);
      paramIndex++;
    }

    sql += ` ORDER BY voice_name ASC`;

    const voices = await queryMany<ProviderVoiceRow>(sql, queryParams);

    const responses = voices.map(v => ({
      id: v.id,
      providerId: v.provider_id,
      voiceId: v.voice_id,
      voiceName: v.voice_name,
      gender: v.gender,
      tone: v.tone,
      language: v.language,
      sampleAudioUrl: v.sample_audio_url,
      createdAt: v.created_at,
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          providerId,
          providerName: provider.name,
          voices: responses,
          total: responses.length,
          filters: {
            language: language ?? null,
            gender: gender ?? null,
            tone: tone ?? null,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting provider voices:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
