/**
 * Cost Recommendations Endpoint
 * GET /api/cost/recommendations - Get cost optimization recommendations
 * 
 * Returns:
 * - Array of recommendations with:
 *   - recommendation: Text description of the recommendation
 *   - priority: Priority level (high, medium, low)
 *   - potential_savings_usd: Estimated savings in USD (if applicable)
 *   - category: Category of recommendation (provider, cache, load_balancing, monitoring)
 * 
 * Examples:
 * - "Use Groq 70B for Gate 4 (best value LLM)"
 * - "Add 20 more FAQs to cache to reduce AI calls"
 * - "Consider load balancing across multiple providers"
 * - "Set up cost alerts for monthly budget threshold"
 * 
 * Requirements: 9.1, 9.8, 9.10
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCostRecommendations,
  getCostByProvider,
  calculateCacheHitRate,
  getProjectedMonthlyCost,
  getQualityVsCostAnalysis,
} from '@/lib/cost-tracking';

interface Recommendation {
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  potential_savings_usd?: number;
  category: 'provider' | 'cache' | 'load_balancing' | 'monitoring';
}

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

    // Get recommendations from service
    const baseRecommendations = await getCostRecommendations(tenantId, monthStart);

    // Build detailed recommendations with priority and category
    const recommendations: Recommendation[] = [];

    // Get additional data for enhanced recommendations
    const costByProvider = await getCostByProvider(tenantId, monthStart);
    const cacheHitRate = await calculateCacheHitRate(tenantId, monthStart);
    const projectedCost = await getProjectedMonthlyCost(tenantId);
    const qualityAnalysis = await getQualityVsCostAnalysis(tenantId, monthStart);

    // Recommendation 1: Provider optimization
    if (costByProvider.length > 0 && costByProvider[0].percentage > 70) {
      const topProvider = costByProvider[0];
      const potentialSavings = topProvider.costUsd * 0.2; // Assume 20% savings by switching

      recommendations.push({
        recommendation: `${topProvider.providerName} accounts for ${topProvider.percentage}% of spending. Consider using alternative providers to reduce costs.`,
        priority: 'high',
        potential_savings_usd: Number(potentialSavings.toFixed(4)),
        category: 'provider',
      });
    }

    // Recommendation 2: Cache optimization
    if (cacheHitRate < 20) {
      const potentialSavings = projectedCost * 0.15; // Assume 15% savings by improving cache

      recommendations.push({
        recommendation: `Cache hit rate is only ${cacheHitRate}%. Add more FAQ entries to reduce AI calls and save costs.`,
        priority: 'high',
        potential_savings_usd: Number(potentialSavings.toFixed(4)),
        category: 'cache',
      });
    } else if (cacheHitRate < 50) {
      const potentialSavings = projectedCost * 0.08; // Assume 8% savings

      recommendations.push({
        recommendation: `Cache hit rate is ${cacheHitRate}%. Consider adding more FAQ entries to improve cache efficiency.`,
        priority: 'medium',
        potential_savings_usd: Number(potentialSavings.toFixed(4)),
        category: 'cache',
      });
    }

    // Recommendation 3: Load balancing
    if (costByProvider.length > 1) {
      recommendations.push({
        recommendation: `You have ${costByProvider.length} providers configured. Consider load balancing to optimize for cost and reliability.`,
        priority: 'medium',
        category: 'load_balancing',
      });
    }

    // Recommendation 4: Quality vs cost optimization
    if (qualityAnalysis.length > 1) {
      const bestValue = qualityAnalysis[0];
      const worstValue = qualityAnalysis[qualityAnalysis.length - 1];

      if (bestValue.qualityPerDollar > worstValue.qualityPerDollar * 1.5) {
        recommendations.push({
          recommendation: `${bestValue.providerName} offers the best quality-to-cost ratio. Consider using it for more workloads.`,
          priority: 'medium',
          category: 'provider',
        });
      }
    }

    // Recommendation 5: Cost monitoring
    if (projectedCost > 1000) {
      recommendations.push({
        recommendation: `Projected monthly cost is $${projectedCost.toFixed(2)}. Set up cost alerts to monitor spending.`,
        priority: 'medium',
        category: 'monitoring',
      });
    }

    // Recommendation 6: Budget optimization
    if (projectedCost > 5000) {
      recommendations.push({
        recommendation: `High projected monthly cost ($${projectedCost.toFixed(2)}). Consider negotiating volume discounts with providers.`,
        priority: 'low',
        category: 'provider',
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: recommendations,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
