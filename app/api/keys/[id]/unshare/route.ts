/**
 * API Key Unsharing Route
 * POST /api/keys/:id/unshare - Revoke key from tenants (Super Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query, queryMany } from '@/lib/db';
import { logKeyUnshared } from '@/lib/activity-logging';
import { ApiKeyRow, UnshareKeyRequest } from '@/lib/db/schema';

// ============================================================================
// POST /api/keys/:id/unshare - Revoke key from tenants
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

    // Only Super Admin can unshare keys
    if (userRole !== 'Super Admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only Super Admin can unshare keys' } },
        { status: 403 }
      );
    }

    // Parse request body
    const body: UnshareKeyRequest = await request.json();

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

    // Revoke key_sharing records
    for (const sharedTenantId of body.tenantIds) {
      // Check if sharing exists
      const sharing = await queryOne<{ id: string }>(
        `SELECT id FROM key_sharing WHERE key_id = $1 AND shared_tenant_id = $2 AND revoked_at IS NULL`,
        [keyId, sharedTenantId]
      );

      if (!sharing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: `Key is not shared with tenant ${sharedTenantId}` } },
          { status: 404 }
        );
      }

      // Revoke the sharing
      await query(
        `UPDATE key_sharing SET revoked_at = NOW(), revoked_by_user_id = $1 
         WHERE key_id = $2 AND shared_tenant_id = $3`,
        [userId, keyId, sharedTenantId]
      );
    }

    // Log the operation
    try {
      await logKeyUnshared(
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
      { success: true, message: 'Key unshared successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error unsharing API key:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
