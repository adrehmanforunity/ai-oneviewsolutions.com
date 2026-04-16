/**
 * Cost Tracking and Calculation Service
 * Provides cost calculation, currency conversion, and financial tracking for AI service usage
 * 
 * Features:
 * - Calculate costs based on token usage and provider pricing
 * - USD to PKR currency conversion with real-time rates
 * - Track daily and monthly usage tokens per API key
 * - Calculate cost per conversation, AI call rate, cache hit rate
 * - Maintain accuracy to 4 decimal places USD, 2 decimal places PKR
 * - Integrate with activity logging to record all cost transactions
 * - Support cost aggregation by provider, gate, topic
 * 
 * Requirements: 9.1, 9.10, 12.2
 */

import { query, queryOne, queryMany } from '../db/index';
import { CostRecord, CostRecordRow, CostSummary, CostRecordFilter } from '../db/schema';
import { logKeyUsed } from '../activity-logging/index';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Exchange rate data
 */
export interface ExchangeRate {
  usdToPkr: number;
  pkrToUsd: number;
  lastUpdated: Date;
}

/**
 * Cost calculation result
 */
export interface CostCalculationResult {
  tokensUsed: number;
  pricingPer1kTokens: number;  // USD
  costUsd: number;
  costPkr: number;
}

/**
 * Cost summary by provider
 */
export interface CostByProvider {
  providerId: string;
  providerName: string;
  costUsd: number;
  percentage: number;
}

/**
 * Cost summary by gate
 */
export interface CostByGate {
  gateNumber: number;
  costUsd: number;
  percentage: number;
}

/**
 * Cost summary by topic
 */
export interface CostByTopic {
  topicId: string;
  topicName: string;
  costUsd: number;
  percentage: number;
}

/**
 * Quality vs cost analysis
 */
export interface QualityVsCostAnalysis {
  providerId: string;
  providerName: string;
  qaScore: number;
  costPer1kCalls: number;
  qualityPerDollar: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Default exchange rate (PKR to USD) - will be updated from external source
const DEFAULT_EXCHANGE_RATE = 278.5;  // 1 USD = 278.5 PKR (approximate)

// Cache for exchange rate (update every 24 hours)
let cachedExchangeRate: ExchangeRate | null = null;

// ============================================================================
// COST CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate cost from tokens and pricing
 * Formula: (tokens / 1000) * pricing_per_1k_tokens
 * 
 * @param tokensUsed Number of tokens used
 * @param pricingPer1kTokens Pricing per 1000 tokens in USD
 * @param exchangeRate Exchange rate (USD to PKR)
 * @returns Cost calculation result with USD and PKR values
 */
export function calculateCost(
  tokensUsed: number,
  pricingPer1kTokens: number,
  exchangeRate: number = DEFAULT_EXCHANGE_RATE
): CostCalculationResult {
  // Calculate cost in USD (accurate to 4 decimal places)
  const costUsd = Number(((tokensUsed / 1000) * pricingPer1kTokens).toFixed(4));
  
  // Convert to PKR (accurate to 2 decimal places)
  const costPkr = Number((costUsd * exchangeRate).toFixed(2));
  
  return {
    tokensUsed,
    pricingPer1kTokens,
    costUsd,
    costPkr,
  };
}

/**
 * Convert USD to PKR
 * 
 * @param usdAmount Amount in USD
 * @param exchangeRate Exchange rate (USD to PKR)
 * @returns Amount in PKR (accurate to 2 decimal places)
 */
export function convertUsdToPkr(
  usdAmount: number,
  exchangeRate: number = DEFAULT_EXCHANGE_RATE
): number {
  return Number((usdAmount * exchangeRate).toFixed(2));
}

/**
 * Convert PKR to USD
 * 
 * @param pkrAmount Amount in PKR
 * @param exchangeRate Exchange rate (USD to PKR)
 * @returns Amount in USD (accurate to 4 decimal places)
 */
export function convertPkrToUsd(
  pkrAmount: number,
  exchangeRate: number = DEFAULT_EXCHANGE_RATE
): number {
  return Number((pkrAmount / exchangeRate).toFixed(4));
}

/**
 * Get current exchange rate (USD to PKR)
 * In production, this would fetch from an external API
 * For now, returns cached rate or default
 * 
 * @returns Exchange rate (USD to PKR)
 */
export async function getExchangeRate(): Promise<number> {
  // Check if cached rate is still valid (less than 24 hours old)
  if (cachedExchangeRate && new Date().getTime() - cachedExchangeRate.lastUpdated.getTime() < 24 * 60 * 60 * 1000) {
    return cachedExchangeRate.usdToPkr;
  }
  
  // In production, fetch from external API (e.g., exchangerate-api.com)
  // For now, return default rate
  const exchangeRate = DEFAULT_EXCHANGE_RATE;
  
  cachedExchangeRate = {
    usdToPkr: exchangeRate,
    pkrToUsd: 1 / exchangeRate,
    lastUpdated: new Date(),
  };
  
  return exchangeRate;
}

// ============================================================================
// USAGE TRACKING FUNCTIONS
// ============================================================================

/**
 * Track key usage (update daily and monthly tokens)
 * 
 * @param keyId API key ID
 * @param tokensUsed Tokens used in this call
 * @returns Updated key usage
 */
export async function trackKeyUsage(
  keyId: string,
  tokensUsed: number
): Promise<{ dailyUsageTokens: number; monthlyUsageTokens: number }> {
  try {
    // Update daily and monthly usage tokens
    const result = await query<any>(
      `UPDATE api_keys 
       SET daily_usage_tokens = daily_usage_tokens + $1,
           monthly_usage_tokens = monthly_usage_tokens + $2,
           last_used_at = NOW()
       WHERE id = $3
       RETURNING daily_usage_tokens, monthly_usage_tokens`,
      [tokensUsed, tokensUsed, keyId]
    );

    if (!result || result.rows.length === 0) {
      throw new Error('Failed to update key usage');
    }

    return {
      dailyUsageTokens: result.rows[0].daily_usage_tokens,
      monthlyUsageTokens: result.rows[0].monthly_usage_tokens,
    };
  } catch (error) {
    console.error('Error tracking key usage:', error);
    throw error;
  }
}

/**
 * Reset daily usage tokens (called at midnight)
 * 
 * @param tenantId Tenant ID
 * @returns Number of keys updated
 */
export async function resetDailyUsage(tenantId: string): Promise<number> {
  try {
    const result = await query<any>(
      `UPDATE api_keys 
       SET daily_usage_tokens = 0
       WHERE tenant_id = $1`,
      [tenantId]
    );

    return result.rowCount || 0;
  } catch (error) {
    console.error('Error resetting daily usage:', error);
    throw error;
  }
}

/**
 * Reset monthly usage tokens (called on first day of month)
 * 
 * @param tenantId Tenant ID
 * @returns Number of keys updated
 */
export async function resetMonthlyUsage(tenantId: string): Promise<number> {
  try {
    const result = await query<any>(
      `UPDATE api_keys 
       SET monthly_usage_tokens = 0
       WHERE tenant_id = $1`,
      [tenantId]
    );

    return result.rowCount || 0;
  } catch (error) {
    console.error('Error resetting monthly usage:', error);
    throw error;
  }
}

// ============================================================================
// COST RECORDING FUNCTIONS
// ============================================================================

/**
 * Record cost transaction in cost_records table
 * 
 * @param tenantId Tenant ID
 * @param providerId Provider ID
 * @param tokensUsed Tokens used
 * @param costUsd Cost in USD
 * @param costPkr Cost in PKR
 * @param options Additional options (keyId, gateNumber, topicId, conversationId)
 * @returns Created cost record
 */
export async function recordCostTransaction(
  tenantId: string,
  providerId: string,
  tokensUsed: number,
  costUsd: number,
  costPkr: number,
  options?: {
    keyId?: string;
    gateNumber?: number;
    topicId?: string;
    conversationId?: string;
  }
): Promise<CostRecord> {
  try {
    const result = await query<CostRecordRow>(
      `INSERT INTO cost_records (
        id, tenant_id, provider_id, key_id, gate_number, topic_id, 
        tokens_used, cost_usd, cost_pkr, conversation_id, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
      )
      RETURNING *`,
      [
        tenantId,
        providerId,
        options?.keyId || null,
        options?.gateNumber || null,
        options?.topicId || null,
        tokensUsed,
        costUsd,
        costPkr,
        options?.conversationId || null,
      ]
    );

    if (!result || result.rows.length === 0) {
      throw new Error('Failed to record cost transaction');
    }

    return rowToCostRecord(result.rows[0]);
  } catch (error) {
    console.error('Error recording cost transaction:', error);
    throw error;
  }
}

// ============================================================================
// COST SUMMARY FUNCTIONS
// ============================================================================

/**
 * Get cost summary for tenant
 * 
 * @param tenantId Tenant ID
 * @returns Cost summary with all metrics
 */
export async function getCostSummary(tenantId: string): Promise<CostSummary> {
  try {
    const exchangeRate = await getExchangeRate();
    
    // Get current month's costs
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    
    const thisMonthCosts = await queryMany<CostRecordRow>(
      `SELECT * FROM cost_records 
       WHERE tenant_id = $1 AND created_at >= $2
       ORDER BY created_at DESC`,
      [tenantId, thisMonthStart]
    );

    // Get last month's costs
    const lastMonthStart = new Date(thisMonthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    
    const lastMonthEnd = new Date(thisMonthStart);
    lastMonthEnd.setTime(lastMonthEnd.getTime() - 1);
    
    const lastMonthCosts = await queryMany<CostRecordRow>(
      `SELECT * FROM cost_records 
       WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [tenantId, lastMonthStart, lastMonthEnd]
    );

    // Calculate totals
    const totalThisMonth = thisMonthCosts.reduce((sum, record) => sum + (record.cost_usd || 0), 0);
    const totalLastMonth = lastMonthCosts.reduce((sum, record) => sum + (record.cost_usd || 0), 0);

    // Calculate trend
    const trendIndicator = totalThisMonth > totalLastMonth ? 'up' : totalThisMonth < totalLastMonth ? 'down' : 'stable';

    // Get cost by provider
    const costByProvider = await getCostByProvider(tenantId, thisMonthStart);

    // Get cost by gate
    const costByGate = await getCostByGate(tenantId, thisMonthStart);

    // Get cost by topic
    const costByTopic = await getCostByTopic(tenantId, thisMonthStart);

    // Calculate metrics
    const costPerConversation = await calculateCostPerConversation(tenantId, thisMonthStart);
    const aiCallRate = await calculateAiCallRate(tenantId, thisMonthStart);
    const cacheHitRate = await calculateCacheHitRate(tenantId, thisMonthStart);

    // Get projected month-end cost
    const projectedMonthEndCost = await getProjectedMonthlyCost(tenantId);

    // Get quality vs cost analysis
    const qualityVsCostAnalysis = await getQualityVsCostAnalysis(tenantId, thisMonthStart);

    // Get recommendations
    const recommendations = await getCostRecommendations(tenantId, thisMonthStart);

    return {
      totalSpendThisMonth: Number(totalThisMonth.toFixed(4)),
      totalSpendLastMonth: Number(totalLastMonth.toFixed(4)),
      trendIndicator,
      costByProvider,
      costByGate,
      costByTopic,
      costPerConversation,
      aiCallRate,
      cacheHitRate,
      projectedMonthEndCost,
      qualityVsCostAnalysis,
      recommendations,
    };
  } catch (error) {
    console.error('Error getting cost summary:', error);
    throw error;
  }
}

/**
 * Get costs broken down by provider
 * 
 * @param tenantId Tenant ID
 * @param startDate Start date for filtering
 * @returns Array of costs by provider
 */
export async function getCostByProvider(
  tenantId: string,
  startDate: Date
): Promise<CostByProvider[]> {
  try {
    const results = await queryMany<any>(
      `SELECT 
        p.id as provider_id,
        p.name as provider_name,
        SUM(cr.cost_usd) as total_cost_usd
       FROM cost_records cr
       JOIN providers p ON cr.provider_id = p.id
       WHERE cr.tenant_id = $1 AND cr.created_at >= $2
       GROUP BY p.id, p.name
       ORDER BY total_cost_usd DESC`,
      [tenantId, startDate]
    );

    // Calculate total for percentage
    const totalCost = results.reduce((sum, record) => sum + (record.total_cost_usd || 0), 0);

    return results.map(record => ({
      providerId: record.provider_id,
      providerName: record.provider_name,
      costUsd: Number((record.total_cost_usd || 0).toFixed(4)),
      percentage: totalCost > 0 ? Number(((record.total_cost_usd / totalCost) * 100).toFixed(2)) : 0,
    }));
  } catch (error) {
    console.error('Error getting cost by provider:', error);
    throw error;
  }
}

/**
 * Get costs broken down by gate
 * 
 * @param tenantId Tenant ID
 * @param startDate Start date for filtering
 * @returns Array of costs by gate
 */
export async function getCostByGate(
  tenantId: string,
  startDate: Date
): Promise<CostByGate[]> {
  try {
    const results = await queryMany<any>(
      `SELECT 
        gate_number,
        SUM(cost_usd) as total_cost_usd
       FROM cost_records
       WHERE tenant_id = $1 AND created_at >= $2 AND gate_number IS NOT NULL
       GROUP BY gate_number
       ORDER BY gate_number ASC`,
      [tenantId, startDate]
    );

    // Calculate total for percentage
    const totalCost = results.reduce((sum, record) => sum + (record.total_cost_usd || 0), 0);

    return results.map(record => ({
      gateNumber: record.gate_number,
      costUsd: Number((record.total_cost_usd || 0).toFixed(4)),
      percentage: totalCost > 0 ? Number(((record.total_cost_usd / totalCost) * 100).toFixed(2)) : 0,
    }));
  } catch (error) {
    console.error('Error getting cost by gate:', error);
    throw error;
  }
}

/**
 * Get costs broken down by topic
 * 
 * @param tenantId Tenant ID
 * @param startDate Start date for filtering
 * @returns Array of costs by topic
 */
export async function getCostByTopic(
  tenantId: string,
  startDate: Date
): Promise<CostByTopic[]> {
  try {
    const results = await queryMany<any>(
      `SELECT 
        topic_id,
        SUM(cost_usd) as total_cost_usd
       FROM cost_records
       WHERE tenant_id = $1 AND created_at >= $2 AND topic_id IS NOT NULL
       GROUP BY topic_id
       ORDER BY total_cost_usd DESC`,
      [tenantId, startDate]
    );

    // Calculate total for percentage
    const totalCost = results.reduce((sum, record) => sum + (record.total_cost_usd || 0), 0);

    return results.map(record => ({
      topicId: record.topic_id,
      topicName: `Topic ${record.topic_id}`,  // In production, fetch actual topic name
      costUsd: Number((record.total_cost_usd || 0).toFixed(4)),
      percentage: totalCost > 0 ? Number(((record.total_cost_usd / totalCost) * 100).toFixed(2)) : 0,
    }));
  } catch (error) {
    console.error('Error getting cost by topic:', error);
    throw error;
  }
}

// ============================================================================
// METRIC CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate average cost per conversation
 * 
 * @param tenantId Tenant ID
 * @param startDate Start date for filtering
 * @returns Average cost per conversation in USD
 */
export async function calculateCostPerConversation(
  tenantId: string,
  startDate: Date
): Promise<number> {
  try {
    const result = await queryOne<any>(
      `SELECT 
        COUNT(DISTINCT conversation_id) as conversation_count,
        SUM(cost_usd) as total_cost_usd
       FROM cost_records
       WHERE tenant_id = $1 AND created_at >= $2 AND conversation_id IS NOT NULL`,
      [tenantId, startDate]
    );

    if (!result || result.conversation_count === 0) {
      return 0;
    }

    return Number((result.total_cost_usd / result.conversation_count).toFixed(4));
  } catch (error) {
    console.error('Error calculating cost per conversation:', error);
    throw error;
  }
}

/**
 * Calculate AI call rate (percentage of conversations that used AI)
 * 
 * @param tenantId Tenant ID
 * @param startDate Start date for filtering
 * @returns AI call rate as percentage
 */
export async function calculateAiCallRate(
  tenantId: string,
  startDate: Date
): Promise<number> {
  try {
    const result = await queryOne<any>(
      `SELECT 
        COUNT(DISTINCT conversation_id) as ai_calls,
        (SELECT COUNT(DISTINCT conversation_id) FROM conversations 
         WHERE tenant_id = $1 AND created_at >= $2) as total_conversations
       FROM cost_records
       WHERE tenant_id = $1 AND created_at >= $2`,
      [tenantId, startDate]
    );

    if (!result || result.total_conversations === 0) {
      return 0;
    }

    return Number(((result.ai_calls / result.total_conversations) * 100).toFixed(2));
  } catch (error) {
    // If conversations table doesn't exist, return 0
    console.warn('Error calculating AI call rate:', error);
    return 0;
  }
}

/**
 * Calculate cache hit rate (percentage of calls that hit cache)
 * 
 * @param tenantId Tenant ID
 * @param startDate Start date for filtering
 * @returns Cache hit rate as percentage
 */
export async function calculateCacheHitRate(
  tenantId: string,
  startDate: Date
): Promise<number> {
  try {
    const result = await queryOne<any>(
      `SELECT 
        COUNT(*) FILTER (WHERE tokens_used = 0) as cache_hits,
        COUNT(*) as total_calls
       FROM cost_records
       WHERE tenant_id = $1 AND created_at >= $2`,
      [tenantId, startDate]
    );

    if (!result || result.total_calls === 0) {
      return 0;
    }

    return Number(((result.cache_hits / result.total_calls) * 100).toFixed(2));
  } catch (error) {
    console.error('Error calculating cache hit rate:', error);
    throw error;
  }
}

/**
 * Get projected month-end cost based on current burn rate
 * 
 * @param tenantId Tenant ID
 * @returns Projected cost for the month in USD
 */
export async function getProjectedMonthlyCost(tenantId: string): Promise<number> {
  try {
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

    if (!result || result.days_with_costs === 0) {
      return 0;
    }

    const currentCost = result.total_cost_usd || 0;
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const daysElapsed = new Date().getDate();
    
    // Project based on current burn rate
    const projectedCost = (currentCost / daysElapsed) * daysInMonth;

    return Number(projectedCost.toFixed(4));
  } catch (error) {
    console.error('Error getting projected monthly cost:', error);
    throw error;
  }
}

/**
 * Get quality vs cost analysis
 * 
 * @param tenantId Tenant ID
 * @param startDate Start date for filtering
 * @returns Array of quality vs cost analysis
 */
export async function getQualityVsCostAnalysis(
  tenantId: string,
  startDate: Date
): Promise<QualityVsCostAnalysis[]> {
  try {
    const results = await queryMany<any>(
      `SELECT 
        p.id as provider_id,
        p.name as provider_name,
        COUNT(*) as call_count,
        SUM(cr.cost_usd) as total_cost_usd
       FROM cost_records cr
       JOIN providers p ON cr.provider_id = p.id
       WHERE cr.tenant_id = $1 AND cr.created_at >= $2
       GROUP BY p.id, p.name`,
      [tenantId, startDate]
    );

    // In production, fetch QA scores from QA system
    // For now, return placeholder values
    return results.map(record => ({
      providerId: record.provider_id,
      providerName: record.provider_name,
      qaScore: 85,  // Placeholder
      costPer1kCalls: Number(((record.total_cost_usd / record.call_count) * 1000).toFixed(4)),
      qualityPerDollar: Number((85 / (record.total_cost_usd || 1)).toFixed(2)),
    }));
  } catch (error) {
    console.error('Error getting quality vs cost analysis:', error);
    throw error;
  }
}

/**
 * Get cost optimization recommendations
 * 
 * @param tenantId Tenant ID
 * @param startDate Start date for filtering
 * @returns Array of recommendations
 */
export async function getCostRecommendations(
  tenantId: string,
  startDate: Date
): Promise<string[]> {
  try {
    const recommendations: string[] = [];

    // Get cost by provider
    const costByProvider = await getCostByProvider(tenantId, startDate);
    
    // Recommendation 1: Suggest cheaper provider if one provider dominates
    if (costByProvider.length > 0 && costByProvider[0].percentage > 70) {
      recommendations.push(
        `Consider using ${costByProvider.length > 1 ? costByProvider[1].providerName : 'alternative providers'} to reduce costs. ${costByProvider[0].providerName} accounts for ${costByProvider[0].percentage}% of spending.`
      );
    }

    // Recommendation 2: Suggest cache optimization
    const cacheHitRate = await calculateCacheHitRate(tenantId, startDate);
    if (cacheHitRate < 20) {
      recommendations.push(
        `Increase cache hit rate (currently ${cacheHitRate}%) by adding more FAQ entries to reduce AI calls.`
      );
    }

    // Recommendation 3: Suggest load balancing
    if (costByProvider.length > 1) {
      recommendations.push(
        `Consider load balancing across multiple providers to optimize for cost and reliability.`
      );
    }

    // Recommendation 4: Suggest monitoring
    const projectedCost = await getProjectedMonthlyCost(tenantId);
    if (projectedCost > 1000) {
      recommendations.push(
        `Projected monthly cost is $${projectedCost.toFixed(2)}. Consider setting up cost alerts.`
      );
    }

    return recommendations;
  } catch (error) {
    console.error('Error getting cost recommendations:', error);
    throw error;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert database row to CostRecord
 * 
 * @param row Database row
 * @returns CostRecord
 */
function rowToCostRecord(row: CostRecordRow): CostRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    providerId: row.provider_id,
    keyId: row.key_id,
    gateNumber: row.gate_number,
    topicId: row.topic_id,
    tokensUsed: row.tokens_used,
    costUsd: row.cost_usd,
    costPkr: row.cost_pkr,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
  };
}

/**
 * Get cost records with filtering
 * 
 * @param tenantId Tenant ID
 * @param filter Filter options
 * @returns Array of cost records
 */
export async function getCostRecords(
  tenantId: string,
  filter?: CostRecordFilter
): Promise<CostRecord[]> {
  try {
    let sql = `SELECT * FROM cost_records WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filter?.providerId) {
      sql += ` AND provider_id = $${paramIndex}`;
      params.push(filter.providerId);
      paramIndex++;
    }

    if (filter?.gateNumber) {
      sql += ` AND gate_number = $${paramIndex}`;
      params.push(filter.gateNumber);
      paramIndex++;
    }

    if (filter?.topicId) {
      sql += ` AND topic_id = $${paramIndex}`;
      params.push(filter.topicId);
      paramIndex++;
    }

    if (filter?.startDate) {
      sql += ` AND created_at >= $${paramIndex}`;
      params.push(filter.startDate);
      paramIndex++;
    }

    if (filter?.endDate) {
      sql += ` AND created_at <= $${paramIndex}`;
      params.push(filter.endDate);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC`;

    if (filter?.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(filter.limit);
      paramIndex++;
    }

    if (filter?.offset) {
      sql += ` OFFSET $${paramIndex}`;
      params.push(filter.offset);
      paramIndex++;
    }

    const results = await queryMany<CostRecordRow>(sql, params);
    return results.map(rowToCostRecord);
  } catch (error) {
    console.error('Error getting cost records:', error);
    throw error;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  calculateCost,
  convertUsdToPkr,
  convertPkrToUsd,
  getExchangeRate,
  trackKeyUsage,
  resetDailyUsage,
  resetMonthlyUsage,
  recordCostTransaction,
  getCostSummary,
  getCostByProvider,
  getCostByGate,
  getCostByTopic,
  calculateCostPerConversation,
  calculateAiCallRate,
  calculateCacheHitRate,
  getProjectedMonthlyCost,
  getQualityVsCostAnalysis,
  getCostRecommendations,
  getCostRecords,
};
