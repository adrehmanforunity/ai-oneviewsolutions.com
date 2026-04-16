/**
 * Provider Configuration Routes
 * GET /api/providers - List all providers with models and voices
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';
import { ProviderRow, ProviderType } from '@/lib/db/schema';

// ============================================================================
// GET /api/providers - List all providers
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    // Optional filter by provider type
    const searchParams = request.nextUrl.searchParams;
    const providerType = searchParams.get('type') as ProviderType | null;

    // Validate provider type if provided
    const validTypes: ProviderType[] = ['LLM', 'STT', 'TTS'];
    if (providerType && !validTypes.includes(providerType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TYPE',
            message: `Invalid provider type. Must be one of: ${validTypes.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Build query
    let sql = `
      SELECT
        p.id,
        p.name,
        p.provider_type,
        p.api_endpoint,
        p.api_version,
        p.pricing_per_1k_tokens,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT pm.id) AS model_count,
        COUNT(DISTINCT pv.id) AS voice_count,
        COUNT(DISTINCT ak.id) FILTER (WHERE ak.tenant_id = $1 AND ak.active = true) AS active_key_count,
        COUNT(DISTINCT ak.id) FILTER (WHERE ak.tenant_id = $1) AS total_key_count
      FROM providers p
      LEFT JOIN provider_models pm ON pm.provider_id = p.id
      LEFT JOIN provider_voices pv ON pv.provider_id = p.id
      LEFT JOIN api_keys ak ON ak.provider_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (providerType) {
      sql += ` AND p.provider_type = $${paramIndex}`;
      params.push(providerType);
      paramIndex++;
    }

    sql += ` GROUP BY p.id ORDER BY p.name ASC`;

    const providers = await queryMany<
      ProviderRow & {
        model_count: string;
        voice_count: string;
        active_key_count: string;
        total_key_count: string;
      }
    >(sql, params);

    const responses = providers.map(p => ({
      id: p.id,
      name: p.name,
      providerType: p.provider_type,
      apiEndpoint: p.api_endpoint,
      apiVersion: p.api_version,
      pricingPer1kTokens: p.pricing_per_1k_tokens,
      modelCount: parseInt(p.model_count, 10),
      voiceCount: parseInt(p.voice_count, 10),
      activeKeyCount: parseInt(p.active_key_count, 10),
      totalKeyCount: parseInt(p.total_key_count, 10),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return NextResponse.json({ success: true, data: responses }, { status: 200 });
  } catch (error) {
    console.error('Error listing providers:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
