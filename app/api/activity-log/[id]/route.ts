/**
 * Activity Log Single Entry Route
 * GET /api/activity-log/:id - Get single log entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { ActivityLogRow } from '@/lib/db/schema';

// ============================================================================
// GET /api/activity-log/:id - Get single log entry
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get tenant ID from request headers
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    const entryId = params.id;

    if (!entryId) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Entry ID is required' } },
        { status: 400 }
      );
    }

    // Query the activity log entry
    const entry = await queryOne<
      ActivityLogRow & {
        provider_id?: string;
        provider_name?: string;
        key_label?: string;
        user_name?: string;
      }
    >(
      `
      SELECT 
        al.id,
        al.tenant_id,
        al.key_id,
        al.action_type,
        al.action_details,
        al.tokens_used,
        al.cost_usd,
        al.cost_pkr,
        al.status,
        al.error_message,
        al.user_id,
        al.user_role,
        al.primary_tenant_id,
        al.affected_tenants,
        al.created_at,
        ak.provider_id,
        p.name as provider_name,
        ak.label as key_label
      FROM activity_log al
      LEFT JOIN api_keys ak ON al.key_id = ak.id
      LEFT JOIN providers p ON ak.provider_id = p.id
      WHERE al.id = $1 AND al.tenant_id = $2
      `,
      [entryId, tenantId]
    );

    if (!entry) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Activity log entry not found' } },
        { status: 404 }
      );
    }

    // Map to response format
    const response = {
      id: entry.id,
      tenantId: entry.tenant_id,
      keyId: entry.key_id,
      actionType: entry.action_type,
      actionDetails: entry.action_details,
      tokensUsed: entry.tokens_used,
      costUsd: entry.cost_usd,
      costPkr: entry.cost_pkr,
      status: entry.status,
      errorMessage: entry.error_message,
      userId: entry.user_id,
      userRole: entry.user_role,
      primaryTenantId: entry.primary_tenant_id,
      affectedTenants: entry.affected_tenants,
      createdAt: entry.created_at,
      providerId: entry.provider_id,
      providerName: entry.provider_name,
      keyLabel: entry.key_label,
    };

    return NextResponse.json({ success: true, data: response }, { status: 200 });
  } catch (error) {
    console.error('Error retrieving activity log entry:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
