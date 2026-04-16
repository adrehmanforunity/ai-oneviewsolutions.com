/**
 * Voice Management API Routes
 * GET /api/voices - List available voices for provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, queryOne } from '@/lib/db';
import { ProviderVoiceRow } from '@/lib/db/schema';

// ============================================================================
// GET /api/voices - List available voices for provider
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get tenant ID from request headers
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const providerId = searchParams.get('providerId');
    const language = searchParams.get('language');
    const gender = searchParams.get('gender');
    const tone = searchParams.get('tone');

    // Validate providerId is provided
    if (!providerId) {
      return NextResponse.json(
        { error: { code: 'MISSING_PROVIDER', message: 'providerId query parameter is required' } },
        { status: 400 }
      );
    }

    // Verify provider exists
    const provider = await queryOne(
      'SELECT id, name, provider_type FROM providers WHERE id = $1',
      [providerId]
    );

    if (!provider) {
      return NextResponse.json(
        { error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } },
        { status: 404 }
      );
    }

    // Build query to fetch voices
    let sql = `
      SELECT id, provider_id, voice_id, voice_name, gender, tone, language, sample_audio_url, created_at
      FROM provider_voices
      WHERE provider_id = $1
    `;
    const params: any[] = [providerId];
    let paramIndex = 2;

    // Add language filter if provided
    if (language) {
      sql += ` AND language = $${paramIndex}`;
      params.push(language);
      paramIndex++;
    }

    // Add gender filter if provided
    if (gender) {
      sql += ` AND gender = $${paramIndex}`;
      params.push(gender);
      paramIndex++;
    }

    // Add tone filter if provided
    if (tone) {
      sql += ` AND tone = $${paramIndex}`;
      params.push(tone);
      paramIndex++;
    }

    sql += ` ORDER BY voice_name ASC`;

    // Execute query
    const voices = await queryMany<ProviderVoiceRow>(sql, params);

    // Map to response format
    const responses = voices.map(voice => ({
      id: voice.id,
      voiceId: voice.voice_id,
      name: voice.voice_name,
      gender: voice.gender,
      tone: voice.tone,
      language: voice.language,
      sampleAudioUrl: voice.sample_audio_url,
      providerId: voice.provider_id,
      createdAt: voice.created_at,
    }));

    return NextResponse.json(
      { success: true, data: responses },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error listing voices:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
