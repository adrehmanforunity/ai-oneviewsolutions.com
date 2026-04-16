/**
 * Cost Records Endpoint
 * GET /api/cost/records - Get cost records with filtering and pagination
 * 
 * Query Parameters:
 * - dateFrom: Start date (ISO 8601)
 * - dateTo: End date (ISO 8601)
 * - providerId: Filter by provider ID
 * - gateId: Filter by gate number (1-4)
 * - topicId: Filter by topic ID
 * - limit: Number of records to return (default: 50, max: 500)
 * - offset: Number of records to skip (default: 0)
 * 
 * Returns:
 * - Array of cost records with timestamp, provider, gate, topic, tokens, cost_usd, cost_pkr
 * - Pagination info (total, limit, offset)
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCostRecords } from '@/lib/cost-tracking';
import { CostRecordFilter } from '@/lib/db/schema';
import { queryCount } from '@/lib/db';

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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const providerId = searchParams.get('providerId');
    const gateId = searchParams.get('gateId');
    const topicId = searchParams.get('topicId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build filter
    const filter: CostRecordFilter = {
      providerId: providerId || undefined,
      gateNumber: gateId ? parseInt(gateId) : undefined,
      topicId: topicId || undefined,
      startDate: dateFrom ? new Date(dateFrom) : undefined,
      endDate: dateTo ? new Date(dateTo) : undefined,
      limit,
      offset,
    };

    // Get cost records
    const records = await getCostRecords(tenantId, filter);

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as count FROM cost_records WHERE tenant_id = $1';
    const countParams: any[] = [tenantId];
    let paramIndex = 2;

    if (filter.providerId) {
      countSql += ` AND provider_id = $${paramIndex}`;
      countParams.push(filter.providerId);
      paramIndex++;
    }

    if (filter.gateNumber) {
      countSql += ` AND gate_number = $${paramIndex}`;
      countParams.push(filter.gateNumber);
      paramIndex++;
    }

    if (filter.topicId) {
      countSql += ` AND topic_id = $${paramIndex}`;
      countParams.push(filter.topicId);
      paramIndex++;
    }

    if (filter.startDate) {
      countSql += ` AND created_at >= $${paramIndex}`;
      countParams.push(filter.startDate);
      paramIndex++;
    }

    if (filter.endDate) {
      countSql += ` AND created_at <= $${paramIndex}`;
      countParams.push(filter.endDate);
      paramIndex++;
    }

    const countResult = await queryCount(countSql, countParams);
    const total = countResult || 0;

    return NextResponse.json(
      {
        success: true,
        data: {
          items: records,
          total,
          limit,
          offset,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting cost records:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
