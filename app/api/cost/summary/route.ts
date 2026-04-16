/**
 * Cost Intelligence Summary Endpoint
 * GET /api/cost/summary - Get cost summary with breakdown by provider, gate, topic
 * 
 * Returns:
 * - Total spend this month and last month
 * - Trend indicator (up, down, stable)
 * - Cost breakdown by provider, gate, topic
 * - Metrics: cost per conversation, AI call rate, cache hit rate
 * - Projected month-end cost
 * - Quality vs cost analysis
 * - Recommendations
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCostSummary } from '@/lib/cost-tracking';

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

    // Get cost summary
    const summary = await getCostSummary(tenantId);

    return NextResponse.json({ success: true, data: summary }, { status: 200 });
  } catch (error) {
    console.error('Error getting cost summary:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
