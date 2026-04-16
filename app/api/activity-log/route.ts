/**
 * Activity Log API Routes
 * GET /api/activity-log - List activity log entries with filtering and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, queryCount } from '@/lib/db';
import { ActivityLogRow, ActivityActionType, ActivityStatus } from '@/lib/db/schema';

// ============================================================================
// GET /api/activity-log - List activity log entries
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get tenant ID from request headers
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    // Get query parameters for filtering and pagination
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const providerId = searchParams.get('providerId');
    const keyId = searchParams.get('keyId');
    const actionType = searchParams.get('actionType') as ActivityActionType | null;
    const status = searchParams.get('status') as ActivityStatus | null;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let sql = `
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
      WHERE al.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    // Add provider filter if provided
    if (providerId) {
      sql += ` AND ak.provider_id = $${paramIndex}`;
      params.push(providerId);
      paramIndex++;
    }

    // Add key filter if provided
    if (keyId) {
      sql += ` AND al.key_id = $${paramIndex}`;
      params.push(keyId);
      paramIndex++;
    }

    // Add action type filter if provided
    if (actionType) {
      sql += ` AND al.action_type = $${paramIndex}`;
      params.push(actionType);
      paramIndex++;
    }

    // Add status filter if provided
    if (status) {
      sql += ` AND al.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Add date range filters if provided
    if (dateFrom) {
      sql += ` AND al.created_at >= $${paramIndex}`;
      params.push(new Date(dateFrom));
      paramIndex++;
    }

    if (dateTo) {
      sql += ` AND al.created_at <= $${paramIndex}`;
      params.push(new Date(dateTo));
      paramIndex++;
    }

    // Get total count for pagination
    const countSql = sql.replace(
      /SELECT[\s\S]*?FROM/,
      'SELECT COUNT(*) as count FROM'
    );
    const countResult = await queryCount(countSql, params);
    const total = countResult;

    // Add ordering and pagination
    sql += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // Execute query
    const entries = await queryMany<
      ActivityLogRow & {
        provider_id?: string;
        provider_name?: string;
        key_label?: string;
      }
    >(sql, params);

    // Map to response format
    const responses = entries.map(entry => ({
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
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          items: responses,
          total,
          limit,
          offset,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error listing activity log:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
