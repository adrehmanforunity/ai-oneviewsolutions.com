/**
 * Rotation Strategy Configuration Routes
 * GET /api/rotation-strategy/:provider - Get current rotation strategy for provider
 * PUT /api/rotation-strategy/:provider - Update rotation strategy
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { logKeyOperation } from '@/lib/activity-logging';
import {
  RotationStrategyRow,
  RotationStrategyType,
  ProviderRow,
} from '@/lib/db/schema';

// Valid rotation strategies
const VALID_STRATEGIES: RotationStrategyType[] = ['round_robin', 'fallback', 'least_used'];

// Default strategy when none is configured
const DEFAULT_STRATEGY: RotationStrategyType = 'round_robin';

// ============================================================================
// GET /api/rotation-strategy/:provider - Get current rotation strategy
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    const providerId = params.provider;

    // Verify provider exists
    const provider = await queryOne<ProviderRow>(
      'SELECT id, name, provider_type FROM providers WHERE id = $1',
      [providerId]
    );

    if (!provider) {
      return NextResponse.json(
        { success: false, error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } },
        { status: 404 }
      );
    }

    // Get rotation strategy for this tenant + provider
    const strategyRow = await queryOne<RotationStrategyRow>(
      `SELECT * FROM tenant_rotation_strategy
       WHERE tenant_id = $1 AND provider_id = $2`,
      [tenantId, providerId]
    );

    // Return existing strategy or default
    const strategy = strategyRow?.strategy ?? DEFAULT_STRATEGY;

    return NextResponse.json(
      {
        success: true,
        data: {
          tenantId,
          providerId,
          providerName: provider.name,
          providerType: provider.provider_type,
          strategy,
          isDefault: !strategyRow,
          createdAt: strategyRow?.created_at ?? null,
          updatedAt: strategyRow?.updated_at ?? null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting rotation strategy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/rotation-strategy/:provider - Update rotation strategy
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as
      | 'Tenant Admin'
      | 'Super Admin'
      | 'Flow Designer'
      | null;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    if (!userId || !userRole) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User authentication required' },
        },
        { status: 401 }
      );
    }

    // Only Tenant Admin and Super Admin can update rotation strategy
    if (userRole === 'Flow Designer') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Flow Designers cannot modify rotation strategy',
          },
        },
        { status: 403 }
      );
    }

    const providerId = params.provider;

    // Verify provider exists
    const provider = await queryOne<ProviderRow>(
      'SELECT id, name, provider_type FROM providers WHERE id = $1',
      [providerId]
    );

    if (!provider) {
      return NextResponse.json(
        { success: false, error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } },
        { status: 404 }
      );
    }

    // Parse and validate request body
    let body: { strategy: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    if (!body.strategy) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_STRATEGY', message: 'strategy field is required' },
        },
        { status: 400 }
      );
    }

    if (!VALID_STRATEGIES.includes(body.strategy as RotationStrategyType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STRATEGY',
            message: `Invalid strategy. Must be one of: ${VALID_STRATEGIES.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    const newStrategy = body.strategy as RotationStrategyType;

    // Get previous strategy for logging
    const existingRow = await queryOne<RotationStrategyRow>(
      `SELECT * FROM tenant_rotation_strategy WHERE tenant_id = $1 AND provider_id = $2`,
      [tenantId, providerId]
    );

    const previousStrategy = existingRow?.strategy ?? DEFAULT_STRATEGY;

    // Upsert rotation strategy
    const result = await query<RotationStrategyRow>(
      `INSERT INTO tenant_rotation_strategy (id, tenant_id, provider_id, strategy, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       ON CONFLICT (tenant_id, provider_id)
       DO UPDATE SET strategy = EXCLUDED.strategy, updated_at = NOW()
       RETURNING *`,
      [tenantId, providerId, newStrategy]
    );

    if (!result.rows[0]) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to update rotation strategy' },
        },
        { status: 500 }
      );
    }

    const updatedRow = result.rows[0];

    // Log the strategy change to activity log
    try {
      await logKeyOperation(tenantId, 'rotate', 'success', {
        userId: userId ?? undefined,
        userRole: userRole ?? undefined,
        actionDetails: {
          provider_id: providerId,
          provider_name: provider.name,
          previous_strategy: previousStrategy,
          new_strategy: newStrategy,
          action: 'strategy_updated',
        },
      });
    } catch (logError) {
      console.error('Logging error:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          tenantId,
          providerId,
          providerName: provider.name,
          providerType: provider.provider_type,
          strategy: updatedRow.strategy,
          previousStrategy,
          createdAt: updatedRow.created_at,
          updatedAt: updatedRow.updated_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating rotation strategy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
