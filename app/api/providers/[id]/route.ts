/**
 * Provider Detail Routes
 * GET /api/providers/:id - Get provider details
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryMany } from '@/lib/db';
import { ProviderRow, ProviderModelRow, ProviderVoiceRow } from '@/lib/db/schema';

// ============================================================================
// GET /api/providers/:id - Get provider details
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

    // Get provider with key counts for this tenant
    const provider = await queryOne<
      ProviderRow & {
        active_key_count: string;
        total_key_count: string;
      }
    >(
      `SELECT
        p.*,
        COUNT(DISTINCT ak.id) FILTER (WHERE ak.active = true) AS active_key_count,
        COUNT(DISTINCT ak.id) AS total_key_count
       FROM providers p
       LEFT JOIN api_keys ak ON ak.provider_id = p.id AND ak.tenant_id = $2
       WHERE p.id = $1
       GROUP BY p.id`,
      [providerId, tenantId]
    );

    if (!provider) {
      return NextResponse.json(
        { success: false, error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } },
        { status: 404 }
      );
    }

    // Get models for this provider
    const models = await queryMany<ProviderModelRow>(
      `SELECT id, provider_id, model_name, model_id, pricing_per_1k_tokens, context_window, created_at
       FROM provider_models
       WHERE provider_id = $1
       ORDER BY model_name ASC`,
      [providerId]
    );

    // Get voices for this provider
    const voices = await queryMany<ProviderVoiceRow>(
      `SELECT id, provider_id, voice_id, voice_name, gender, tone, language, sample_audio_url, created_at
       FROM provider_voices
       WHERE provider_id = $1
       ORDER BY voice_name ASC`,
      [providerId]
    );

    // Get rotation strategy for this tenant + provider
    const strategyRow = await queryOne<{ strategy: string }>(
      `SELECT strategy FROM tenant_rotation_strategy
       WHERE tenant_id = $1 AND provider_id = $2`,
      [tenantId, providerId]
    );

    const response = {
      id: provider.id,
      name: provider.name,
      providerType: provider.provider_type,
      apiEndpoint: provider.api_endpoint,
      apiVersion: provider.api_version,
      pricingPer1kTokens: provider.pricing_per_1k_tokens,
      activeKeyCount: parseInt(provider.active_key_count, 10),
      totalKeyCount: parseInt(provider.total_key_count, 10),
      rotationStrategy: strategyRow?.strategy ?? 'round_robin',
      models: models.map(m => ({
        id: m.id,
        providerId: m.provider_id,
        modelName: m.model_name,
        modelId: m.model_id,
        pricingPer1kTokens: m.pricing_per_1k_tokens,
        contextWindow: m.context_window,
        createdAt: m.created_at,
      })),
      voices: voices.map(v => ({
        id: v.id,
        providerId: v.provider_id,
        voiceId: v.voice_id,
        voiceName: v.voice_name,
        gender: v.gender,
        tone: v.tone,
        language: v.language,
        sampleAudioUrl: v.sample_audio_url,
        createdAt: v.created_at,
      })),
      createdAt: provider.created_at,
      updatedAt: provider.updated_at,
    };

    return NextResponse.json({ success: true, data: response }, { status: 200 });
  } catch (error) {
    console.error('Error getting provider details:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
