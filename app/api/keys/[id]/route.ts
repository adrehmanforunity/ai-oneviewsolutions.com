/**
 * Individual API Key Routes
 * GET /api/keys/:id - Get single key
 * PUT /api/keys/:id - Update key
 * DELETE /api/keys/:id - Delete key
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query, verifyResourceAccess } from '@/lib/db';
import { maskApiKey } from '@/lib/masking';
import { validateEmail } from '@/lib/email-validation';
import { logKeyDeleted, logKeyOperation } from '@/lib/activity-logging';
import { ApiKeyRow, ApiKeyResponse, UpdateApiKeyRequest } from '@/lib/db/schema';

// ============================================================================
// GET /api/keys/:id - Get single key
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const keyId = params.id;

    if (!tenantId) {
      return NextResponse.json(
        { error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    // Verify tenant has access to this key (owned or shared)
    const hasAccess = await verifyResourceAccess(keyId, tenantId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Get the key
    const keyRow = await queryOne<ApiKeyRow>(
      `SELECT * FROM api_keys WHERE id = $1`,
      [keyId]
    );

    if (!keyRow) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Key not found' } },
        { status: 404 }
      );
    }

    // Return masked response
    const response: ApiKeyResponse = {
      id: keyRow.id,
      tenantId: keyRow.tenant_id,
      providerId: keyRow.provider_id,
      maskedKey: `...${keyRow.key_value_encrypted.slice(-4)}`,
      emailAddress: keyRow.email_address,
      label: keyRow.label,
      active: keyRow.active,
      createdAt: keyRow.created_at,
      updatedAt: keyRow.updated_at,
      lastUsedAt: keyRow.last_used_at,
      dailyUsageTokens: keyRow.daily_usage_tokens,
      monthlyUsageTokens: keyRow.monthly_usage_tokens,
      healthStatus: keyRow.health_status,
      usagePercentage: calculateUsagePercentage(keyRow.monthly_usage_tokens),
    };

    return NextResponse.json({ success: true, data: response }, { status: 200 });
  } catch (error) {
    console.error('Error getting API key:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/keys/:id - Update key
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as 'Tenant Admin' | 'Super Admin' | 'Flow Designer' | null;
    const keyId = params.id;

    if (!tenantId || !userId || !userRole) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'User authentication required' } },
        { status: 401 }
      );
    }

    // Get the key
    const keyRow = await queryOne<ApiKeyRow>(
      `SELECT * FROM api_keys WHERE id = $1`,
      [keyId]
    );

    if (!keyRow) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Key not found' } },
        { status: 404 }
      );
    }

    // Check if key is shared (only Super Admin can modify shared keys)
    const isShared = await queryOne<{ id: string }>(
      `SELECT id FROM key_sharing WHERE key_id = $1 AND revoked_at IS NULL`,
      [keyId]
    );

    if (isShared && keyRow.tenant_id !== tenantId && userRole !== 'Super Admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only Super Admin can modify shared keys' } },
        { status: 403 }
      );
    }

    // Verify tenant ownership or Super Admin
    if (keyRow.tenant_id !== tenantId && userRole !== 'Super Admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Parse request body
    const body: UpdateApiKeyRequest = await request.json();

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.label !== undefined) {
      updates.push(`label = $${paramIndex}`);
      values.push(body.label);
      paramIndex++;
    }

    if (body.emailAddress !== undefined) {
      // Validate email format
      const emailValidation = validateEmail(body.emailAddress);
      if (!emailValidation.valid) {
        return NextResponse.json(
          { error: { code: 'INVALID_EMAIL', message: emailValidation.error } },
          { status: 400 }
        );
      }
      updates.push(`email_address = $${paramIndex}`);
      values.push(body.emailAddress);
      paramIndex++;
    }

    if (body.active !== undefined) {
      updates.push(`active = $${paramIndex}`);
      values.push(body.active);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'No fields to update' } },
        { status: 400 }
      );
    }

    // Add updated_at
    updates.push(`updated_at = NOW()`);

    // Add key ID to values
    values.push(keyId);

    // Execute update
    const result = await query<ApiKeyRow>(
      `UPDATE api_keys SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (!result.rows[0]) {
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to update API key' } },
        { status: 500 }
      );
    }

    const updatedKey = result.rows[0];

    // Log the operation
    try {
      await logKeyOperation(tenantId, 'add', 'success', {
        keyId,
        userId,
        userRole,
        actionDetails: {
          provider_id: updatedKey.provider_id,
          updated_fields: Object.keys(body),
        },
      });
    } catch (error) {
      console.error('Logging error:', error);
    }

    // Return masked response
    const response: ApiKeyResponse = {
      id: updatedKey.id,
      tenantId: updatedKey.tenant_id,
      providerId: updatedKey.provider_id,
      maskedKey: `...${updatedKey.key_value_encrypted.slice(-4)}`,
      emailAddress: updatedKey.email_address,
      label: updatedKey.label,
      active: updatedKey.active,
      createdAt: updatedKey.created_at,
      updatedAt: updatedKey.updated_at,
      lastUsedAt: updatedKey.last_used_at,
      dailyUsageTokens: updatedKey.daily_usage_tokens,
      monthlyUsageTokens: updatedKey.monthly_usage_tokens,
      healthStatus: updatedKey.health_status,
      usagePercentage: calculateUsagePercentage(updatedKey.monthly_usage_tokens),
    };

    return NextResponse.json({ success: true, data: response }, { status: 200 });
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/keys/:id - Delete key
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as 'Tenant Admin' | 'Super Admin' | 'Flow Designer' | null;
    const keyId = params.id;

    if (!tenantId || !userId || !userRole) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'User authentication required' } },
        { status: 401 }
      );
    }

    // Get the key
    const keyRow = await queryOne<ApiKeyRow>(
      `SELECT * FROM api_keys WHERE id = $1`,
      [keyId]
    );

    if (!keyRow) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Key not found' } },
        { status: 404 }
      );
    }

    // Check if key is shared (only Super Admin can delete shared keys)
    const isShared = await queryOne<{ id: string }>(
      `SELECT id FROM key_sharing WHERE key_id = $1 AND revoked_at IS NULL`,
      [keyId]
    );

    if (isShared && keyRow.tenant_id !== tenantId && userRole !== 'Super Admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only Super Admin can delete shared keys' } },
        { status: 403 }
      );
    }

    // Verify tenant ownership or Super Admin
    if (keyRow.tenant_id !== tenantId && userRole !== 'Super Admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Delete the key
    await query(
      `DELETE FROM api_keys WHERE id = $1`,
      [keyId]
    );

    // Log the deletion (preserve email in log)
    try {
      await logKeyDeleted(tenantId, keyId, keyRow.provider_id, keyRow.email_address, userId, userRole);
    } catch (error) {
      console.error('Logging error:', error);
    }

    return NextResponse.json({ success: true, message: 'Key deleted' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateUsagePercentage(tokensUsed: number): number {
  const monthlyQuota = 1000000;
  return Math.min(100, Math.round((tokensUsed / monthlyQuota) * 100));
}
