/**
 * Provider Models Routes
 * GET /api/providers/:id/models - Get available models for provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryMany } from '@/lib/db';
import { ProviderModelRow } from '@/lib/db/schema';

// ============================================================================
// GET /api/providers/:id/models - Get available models for provider
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

    // Get models for this provider
    const models = await queryMany<ProviderModelRow>(
      `SELECT id, provider_id, model_name, model_id, pricing_per_1k_tokens, context_window, created_at
       FROM provider_models
       WHERE provider_id = $1
       ORDER BY model_name ASC`,
      [providerId]
    );

    const responses = models.map(m => ({
      id: m.id,
      providerId: m.provider_id,
      modelName: m.model_name,
      modelId: m.model_id,
      pricingPer1kTokens: m.pricing_per_1k_tokens,
      contextWindow: m.context_window,
      createdAt: m.created_at,
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          providerId,
          providerName: provider.name,
          providerType: provider.provider_type,
          models: responses,
          total: responses.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting provider models:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
