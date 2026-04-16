/**
 * API Key Sharing List Route
 * GET /api/keys/:id/sharing - Get sharing list (Super Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryMany } from '@/lib/db';
import { ApiKeyRow } from '@/lib/db/schema';

// ============================================================================
// GET /api/keys/:id/sharing - Get sharing list
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userRole = request.headers.get('x-user-role') as 'Tenant Admin' | 'Super Admin' | 'Flow Designer' | null;
    const keyId = params.id;

    if (!tenantId) {
      return NextResponse.json(
        { error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    // Only Super Admin can view sharing list
    if (userRole !== 'Super Admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only Super Admin can view sharing list' } },
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

    // Get all active sharing records
    const sharingRecords = await queryMany<{
      id: string;
      shared_tenant_id: string;
      shared_by_user_id: string;
      shared_at: Date;
    }>(
      `SELECT id, shared_tenant_id, shared_by_user_id, shared_at
       FROM key_sharing
       WHERE key_id = $1 AND revoked_at IS NULL
       ORDER BY shared_at DESC`,
      [keyId]
    );

    // Get tenant names for each shared tenant
    const sharingList = await Promise.all(
      sharingRecords.map(async (record) => {
        const tenant = await queryOne<{ id: string; name: string }>(
          `SELECT id, name FROM tenants WHERE id = $1`,
          [record.shared_tenant_id]
        );

        return {
          tenantId: record.shared_tenant_id,
          tenantName: tenant?.name || 'Unknown',
          sharedAt: record.shared_at,
          sharedByUserId: record.shared_by_user_id,
        };
      })
    );

    return NextResponse.json(
      { success: true, data: sharingList },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting sharing list:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
