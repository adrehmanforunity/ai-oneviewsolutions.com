/**
 * Quality vs Cost Analysis Endpoint
 * GET /api/cost/quality-analysis - Get quality vs cost analysis for providers
 * 
 * Returns:
 * - Array of providers with:
 *   - provider_id: Provider ID
 *   - provider_name: Provider name
 *   - qa_score: Quality assurance score (0-100)
 *   - cost_per_1k_calls: Cost per 1000 calls in USD
 *   - quality_per_dollar: Quality score per dollar spent
 * - Sorted by quality_per_dollar (best value first)
 * 
 * Requirements: 9.1, 9.7, 9.10
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQualityVsCostAnalysis } from '@/lib/cost-tracking';

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

    // Get current month start date
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Get quality vs cost analysis
    const analysis = await getQualityVsCostAnalysis(tenantId, monthStart);

    // Sort by quality_per_dollar (best value first)
    const sorted = analysis.sort((a, b) => b.qualityPerDollar - a.qualityPerDollar);

    return NextResponse.json(
      {
        success: true,
        data: sorted,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting quality analysis:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
