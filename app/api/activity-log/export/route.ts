/**
 * Activity Log Export Route
 * POST /api/activity-log/export - Export activity log as CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';
import { ActivityLogRow } from '@/lib/db/schema';

// ============================================================================
// POST /api/activity-log/export - Export activity log as CSV
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from request headers
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    // Get query parameters for filtering
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const format = searchParams.get('format') || 'csv';
    const providerId = searchParams.get('providerId');
    const keyId = searchParams.get('keyId');
    const actionType = searchParams.get('actionType');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Validate format
    if (format !== 'csv') {
      return NextResponse.json(
        { error: { code: 'INVALID_FORMAT', message: 'Only CSV format is supported' } },
        { status: 400 }
      );
    }

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
        ak.label as key_label,
        ak.email_address
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

    // Add ordering and limit
    sql += ` ORDER BY al.created_at DESC LIMIT 100000`;

    // Execute query
    const entries = await queryMany<
      ActivityLogRow & {
        provider_id?: string;
        provider_name?: string;
        key_label?: string;
        email_address?: string;
      }
    >(sql, params);

    // Generate CSV
    const csv = generateCSV(entries);

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="activity-log-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting activity log:', error);
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
 * Generate CSV from activity log entries
 */
function generateCSV(
  entries: Array<
    ActivityLogRow & {
      provider_id?: string;
      provider_name?: string;
      key_label?: string;
      email_address?: string;
    }
  >
): string {
  // CSV headers
  const headers = [
    'Timestamp',
    'User',
    'Role',
    'Provider',
    'Key Label',
    'Action',
    'Status',
    'Tokens',
    'Cost (USD)',
    'Cost (PKR)',
    'Error',
  ];

  // Map entries to CSV rows
  const rows = entries.map(entry => [
    entry.created_at.toISOString(),
    entry.user_id || '',
    entry.user_role || '',
    entry.provider_name || '',
    entry.key_label || '',
    entry.action_type,
    entry.status,
    entry.tokens_used || '',
    entry.cost_usd || '',
    entry.cost_pkr || '',
    entry.error_message || '',
  ]);

  // Escape CSV values
  const escapedHeaders = headers.map(escapeCSVValue);
  const escapedRows = rows.map(row => row.map(escapeCSVValue));

  // Build CSV
  const csv = [
    escapedHeaders.join(','),
    ...escapedRows.map(row => row.join(',')),
  ].join('\n');

  return csv;
}

/**
 * Escape CSV value (handle quotes and commas)
 */
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}
