/**
 * API Key Sharing Route
 * POST /api/keys/:id/share - Share key with tenants (Super Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query, queryMany } from '@/lib/db';
import { logKeyShared } from '@/lib/activity-logging';
import { ApiKeyRow, ShareKeyRequest } from '@/lib/db/schema';

// ============================================================================
// POST /api/keys/:id/share - Share key with tenants
// ============================================================================

export async function POST(
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

    // Only Super Admin can share keys
    if (userRole !== 'Super Admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only Super Admin can share keys' } },
        { status: 403 }
      );
    }

    // Parse request body
    const body: ShareKeyRequest = await request.json();

    if (!body.tenantIds || !Array.isArray(body.tenantIds) || body.tenantIds.length === 0) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'tenantIds array is required' } },
        { status: 400 }
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

    const primaryTenantId = keyRow.tenant_id;

    // Validate tenant IDs
    for (const sharedTenantId of body.tenantIds) {
      // Cannot share with primary tenant
      if (sharedTenantId === primaryTenantId) {
        return NextResponse.json(
          { error: { code: 'INVALID_INPUT', message: 'Cannot share key with primary tenant' } },
          { status: 400 }
        );
      }

      // Verify tenant exists
      const tenant = await queryOne(
        `SELECT id FROM tenants WHERE id = $1`,
        [sharedTenantId]
      );

      if (!tenant) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: `Tenant ${sharedTenantId} not found` } },
          { status: 404 }
        );
      }

      // Check if already shared
      const existing = await queryOne(
        `SELECT id FROM key_sharing WHERE key_id = $1 AND shared_tenant_id = $2 AND revoked_at IS NULL`,
        [keyId, sharedTenantId]
      );

      if (existing) {
        return NextResponse.json(
          { error: { code: 'CONFLICT', message: `Key already shared with tenant ${sharedTenantId}` } },
          { status: 409 }
        );
      }
    }

    // Create key_sharing records
    for (const sharedTenantId of body.tenantIds) {
      await query(
        `INSERT INTO key_sharing (id, key_id, primary_tenant_id, shared_tenant_id, shared_by_user_id, shared_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
        [keyId, primaryTenantId, sharedTenantId, userId]
      );
    }

    // Log the operation
    try {
      await logKeyShared(
        primaryTenantId,
        keyId,
        keyRow.provider_id,
        body.tenantIds,
        userId,
        userRole
      );
    } catch (error) {
      console.error('Logging error:', error);
    }

    return NextResponse.json(
      { success: true, message: 'Key shared successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sharing API key:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
