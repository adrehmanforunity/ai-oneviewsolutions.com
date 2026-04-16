/**
 * Cost Projection Endpoint
 * GET /api/cost/projection - Get projected month-end cost based on current burn rate
 * 
 * Returns:
 * - projected_cost_usd: Projected total cost for the month in USD
 * - projected_cost_pkr: Projected total cost for the month in PKR
 * - confidence_level: Confidence level of projection (0-100%)
 * - daily_burn_rate_usd: Average daily burn rate in USD
 * - days_remaining: Days remaining in the month
 * - days_elapsed: Days elapsed in the current month
 * 
 * Requirements: 9.1, 9.6, 9.10
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProjectedMonthlyCost, getExchangeRate, convertUsdToPkr } from '@/lib/cost-tracking';
import { queryOne } from '@/lib/db';

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

    // Get projected month-end cost
    const projectedCostUsd = await getProjectedMonthlyCost(tenantId);

    // Get exchange rate for PKR conversion
    const exchangeRate = await getExchangeRate();
    const projectedCostPkr = convertUsdToPkr(projectedCostUsd, exchangeRate);

    // Calculate daily burn rate and days remaining
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const result = await queryOne<any>(
      `SELECT 
        SUM(cost_usd) as total_cost_usd,
        COUNT(DISTINCT DATE(created_at)) as days_with_costs
       FROM cost_records
       WHERE tenant_id = $1 AND created_at >= $2`,
      [tenantId, monthStart]
    );

    const currentCostUsd = result?.total_cost_usd || 0;
    const daysWithCosts = result?.days_with_costs || 0;
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const daysElapsed = new Date().getDate();
    const daysRemaining = daysInMonth - daysElapsed;

    // Calculate daily burn rate
    const dailyBurnRateUsd = daysWithCosts > 0 ? currentCostUsd / daysWithCosts : 0;

    // Calculate confidence level (higher confidence if more days have passed)
    const confidenceLevel = Math.min(100, Math.round((daysElapsed / daysInMonth) * 100));

    return NextResponse.json(
      {
        success: true,
        data: {
          projected_cost_usd: Number(projectedCostUsd.toFixed(4)),
          projected_cost_pkr: Number(projectedCostPkr.toFixed(2)),
          confidence_level: confidenceLevel,
          daily_burn_rate_usd: Number(dailyBurnRateUsd.toFixed(4)),
          days_remaining: daysRemaining,
          days_elapsed: daysElapsed,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting cost projection:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
