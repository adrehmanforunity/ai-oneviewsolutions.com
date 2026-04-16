/**
 * Voice Configuration API Routes
 * GET /api/voice-config - Get current voice configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, queryOne } from '@/lib/db';
import { TenantVoiceConfigRow, ProviderVoiceRow } from '@/lib/db/schema';

// ============================================================================
// GET /api/voice-config - Get current voice configuration
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

    // Fetch all voice configurations for tenant
    const configs = await queryMany<TenantVoiceConfigRow>(
      `SELECT id, tenant_id, language, voice_id, speed, pitch, stability, similarity, style, conversation_mode, created_at, updated_at
       FROM tenant_voice_config
       WHERE tenant_id = $1
       ORDER BY language ASC, conversation_mode ASC`,
      [tenantId]
    );

    // Enrich with voice metadata
    const enrichedConfigs = await Promise.all(
      configs.map(async (config) => {
        const voice = await queryOne<ProviderVoiceRow>(
          `SELECT id, provider_id, voice_id, voice_name, gender, tone, language, sample_audio_url
           FROM provider_voices
           WHERE id = $1`,
          [config.voice_id]
        );

        const provider = voice
          ? await queryOne<{ id: string; name: string }>(
              'SELECT id, name FROM providers WHERE id = $1',
              [voice.provider_id]
            )
          : null;

        return {
          id: config.id,
          language: config.language,
          conversationMode: config.conversation_mode,
          voice: voice
            ? {
                id: voice.id,
                voiceId: voice.voice_id,
                name: voice.voice_name,
                gender: voice.gender,
                tone: voice.tone,
                language: voice.language,
                sampleAudioUrl: voice.sample_audio_url,
              }
            : null,
          provider: provider
            ? {
                id: provider.id,
                name: provider.name,
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
      })
    );

    // Group by language and mode
    const grouped = {
      en: {
        default: null as any,
        modes: {} as Record<string, any>,
      },
      ur: {
        default: null as any,
        modes: {} as Record<string, any>,
      },
    };

    enrichedConfigs.forEach((config) => {
      if (config.conversationMode) {
        grouped[config.language as 'en' | 'ur'].modes[config.conversationMode] = config;
      } else {
        grouped[config.language as 'en' | 'ur'].default = config;
      }
    });

    return NextResponse.json(
      { success: true, data: grouped },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching voice configuration:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
