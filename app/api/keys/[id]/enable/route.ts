/**
 * API Key Enable Route
 * POST /api/keys/:id/enable - Enable key
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query, verifyResourceAccess, queryMany } from '@/lib/db';
import { logKeyEnabled } from '@/lib/activity-logging';
import { ApiKeyRow } from '@/lib/db/schema';

// ============================================================================
// POST /api/keys/:id/enable - Enable key
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

    // Verify tenant has access to this key
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

    // Check if already enabled
    if (keyRow.active) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'Key is already enabled' } },
        { status: 409 }
      );
    }

    // Enable the key
    const result = await query<ApiKeyRow>(
      `UPDATE api_keys SET active = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [keyId]
    );

    if (!result.rows[0]) {
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to enable key' } },
        { status: 500 }
      );
    }

    // Get affected tenants (for shared keys)
    const affectedTenants = await getAffectedTenants(keyId, keyRow.tenant_id);

    // Log the operation
    try {
      await logKeyEnabled(
        tenantId,
        keyId,
        keyRow.provider_id,
        userId,
        userRole,
        affectedTenants,
        keyRow.tenant_id
      );
    } catch (error) {
      console.error('Logging error:', error);
    }

    return NextResponse.json(
      { success: true, message: 'Key enabled' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error enabling API key:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all affected tenants for a key (primary + shared)
 */
async function getAffectedTenants(keyId: string, primaryTenantId: string): Promise<string[]> {
  const sharedTenants = await queryMany<{ shared_tenant_id: string }>(
    `SELECT shared_tenant_id FROM key_sharing WHERE key_id = $1 AND revoked_at IS NULL`,
    [keyId]
  );

  const affectedTenants = [primaryTenantId, ...sharedTenants.map(t => t.shared_tenant_id)];
  const uniqueTenants = Array.from(new Set(affectedTenants));  // Remove duplicates
  return uniqueTenants;
}
