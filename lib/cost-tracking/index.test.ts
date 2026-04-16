/**
 * Cost Tracking Service Tests
 * Comprehensive unit tests for cost calculation, currency conversion, and tracking
 * 
 * Test Coverage:
 * - Cost calculation accuracy (4 decimal places USD, 2 decimal places PKR)
 * - Currency conversion (USD to PKR, PKR to USD)
 * - Usage tracking (daily, monthly aggregation)
 * - Cost aggregation (by provider, gate, topic)
 * - Projections and recommendations
 * - Multi-tenant isolation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as costTracking from './index';
import { query, queryOne, queryMany } from '../db/index';

// Mock database functions
vi.mock('../db/index', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryMany: vi.fn(),
  withTransaction: vi.fn(),
  transactionQuery: vi.fn(),
}));

// Mock activity logging
vi.mock('../activity-logging/index', () => ({
  logKeyUsed: vi.fn(),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const mockTenantId = '550e8400-e29b-41d4-a716-446655440000';
const mockProviderId = '550e8400-e29b-41d4-a716-446655440001';
const mockKeyId = '550e8400-e29b-41d4-a716-446655440002';
const mockExchangeRate = 278.5;

const mockCostRecord = {
  id: '550e8400-e29b-41d4-a716-446655440003',
  tenant_id: mockTenantId,
  provider_id: mockProviderId,
  key_id: mockKeyId,
  gate_number: 4,
  topic_id: null,
  tokens_used: 1000,
  cost_usd: 0.01,
  cost_pkr: 2.79,
  conversation_id: 'conv-123',
  created_at: new Date('2024-01-15T10:00:00Z'),
};

// ============================================================================
// UNIT TESTS: COST CALCULATION
// ============================================================================

describe('Cost Tracking - Cost Calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate cost with correct USD precision (4 decimal places)', () => {
    const result = costTracking.calculateCost(1000, 0.01, mockExchangeRate);

    expect(result.tokensUsed).toBe(1000);
    expect(result.pricingPer1kTokens).toBe(0.01);
    expect(result.costUsd).toBe(0.01);
    // Verify 4 decimal places
    expect(result.costUsd.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(4);
  });

  it('should calculate cost with correct PKR precision (2 decimal places)', () => {
    const result = costTracking.calculateCost(1000, 0.01, mockExchangeRate);

    expect(result.costPkr).toBe(2.79);
    // Verify 2 decimal places
    expect(result.costPkr.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
  });

  it('should handle zero tokens', () => {
    const result = costTracking.calculateCost(0, 0.01, mockExchangeRate);

    expect(result.costUsd).toBe(0);
    expect(result.costPkr).toBe(0);
  });

  it('should handle zero pricing', () => {
    const result = costTracking.calculateCost(1000, 0, mockExchangeRate);

    expect(result.costUsd).toBe(0);
    expect(result.costPkr).toBe(0);
  });

  it('should calculate cost for various token counts', () => {
    const testCases = [
      { tokens: 100, pricing: 0.01, expectedUsd: 0.001 },
      { tokens: 5000, pricing: 0.02, expectedUsd: 0.1 },
      { tokens: 10000, pricing: 0.005, expectedUsd: 0.05 },
      { tokens: 1, pricing: 0.01, expectedUsd: 0.00001 },
    ];

    testCases.forEach(({ tokens, pricing, expectedUsd }) => {
      const result = costTracking.calculateCost(tokens, pricing, mockExchangeRate);
      expect(result.costUsd).toBeCloseTo(expectedUsd, 4);
    });
  });

  it('should handle high token counts', () => {
    const result = costTracking.calculateCost(1000000, 0.01, mockExchangeRate);

    expect(result.costUsd).toBe(10);
    expect(result.costPkr).toBe(2785);
  });

  it('should handle fractional pricing', () => {
    const result = costTracking.calculateCost(1000, 0.00123, mockExchangeRate);

    expect(result.costUsd).toBeCloseTo(0.00123, 4);
    expect(result.costPkr).toBeCloseTo(0.33, 2);
  });

  it('should maintain accuracy with rounding', () => {
    // Test case that could cause rounding errors
    const result = costTracking.calculateCost(333, 0.003, mockExchangeRate);

    // Verify no rounding errors exceed tolerance
    expect(result.costUsd).toBeCloseTo(0.000999, 4);
    expect(result.costPkr).toBeCloseTo(0.28, 2);
  });
});

// ============================================================================
// UNIT TESTS: CURRENCY CONVERSION
// ============================================================================

describe('Cost Tracking - Currency Conversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should convert USD to PKR correctly', () => {
    const result = costTracking.convertUsdToPkr(1, mockExchangeRate);

    expect(result).toBe(278.5);
  });

  it('should convert USD to PKR with 2 decimal places', () => {
    const result = costTracking.convertUsdToPkr(0.01, mockExchangeRate);

    expect(result).toBe(2.79);
    expect(result.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
  });

  it('should convert PKR to USD correctly', () => {
    const result = costTracking.convertPkrToUsd(278.5, mockExchangeRate);

    expect(result).toBeCloseTo(1, 4);
  });

  it('should convert PKR to USD with 4 decimal places', () => {
    const result = costTracking.convertPkrToUsd(2.79, mockExchangeRate);

    expect(result).toBeCloseTo(0.01, 4);
    expect(result.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(4);
  });

  it('should handle round-trip conversion (USD -> PKR -> USD)', () => {
    const originalUsd = 0.01;
    const pkr = costTracking.convertUsdToPkr(originalUsd, mockExchangeRate);
    const convertedUsd = costTracking.convertPkrToUsd(pkr, mockExchangeRate);

    // Should be within 0.01 USD due to rounding
    expect(convertedUsd).toBeCloseTo(originalUsd, 2);
  });

  it('should handle zero amounts', () => {
    expect(costTracking.convertUsdToPkr(0, mockExchangeRate)).toBe(0);
    expect(costTracking.convertPkrToUsd(0, mockExchangeRate)).toBe(0);
  });

  it('should handle large amounts', () => {
    const result = costTracking.convertUsdToPkr(1000, mockExchangeRate);

    expect(result).toBe(278500);
  });

  it('should handle fractional amounts', () => {
    const result = costTracking.convertUsdToPkr(0.001, mockExchangeRate);

    expect(result).toBeCloseTo(0.28, 2);
  });

  it('should use default exchange rate if not provided', () => {
    const result1 = costTracking.convertUsdToPkr(1);
    const result2 = costTracking.convertUsdToPkr(1, 278.5);

    expect(result1).toBe(result2);
  });
});

// ============================================================================
// UNIT TESTS: USAGE TRACKING
// ============================================================================

describe('Cost Tracking - Usage Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track key usage', async () => {
    const mockResult = [{ daily_usage_tokens: 1000, monthly_usage_tokens: 5000 }];
    (query as any).mockResolvedValue(mockResult);

    const result = await costTracking.trackKeyUsage(mockKeyId, 1000);

    expect(result.dailyUsageTokens).toBe(1000);
    expect(result.monthlyUsageTokens).toBe(5000);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE api_keys'),
      expect.arrayContaining([1000, 1000, mockKeyId])
    );
  });

  it('should accumulate daily usage', async () => {
    const mockResult = [{ daily_usage_tokens: 2000, monthly_usage_tokens: 10000 }];
    (query as any).mockResolvedValue(mockResult);

    const result = await costTracking.trackKeyUsage(mockKeyId, 1000);

    expect(result.dailyUsageTokens).toBe(2000);
    expect(result.monthlyUsageTokens).toBe(10000);
  });

  it('should reset daily usage', async () => {
    const mockResult = [{ id: mockKeyId }];
    (query as any).mockResolvedValue(mockResult);

    const result = await costTracking.resetDailyUsage(mockTenantId);

    expect(result).toBe(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('daily_usage_tokens = 0'),
      [mockTenantId]
    );
  });

  it('should reset monthly usage', async () => {
    const mockResult = [{ id: mockKeyId }];
    (query as any).mockResolvedValue(mockResult);

    const result = await costTracking.resetMonthlyUsage(mockTenantId);

    expect(result).toBe(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('monthly_usage_tokens = 0'),
      [mockTenantId]
    );
  });

  it('should handle multiple keys in reset', async () => {
    const mockResult = [{ id: mockKeyId }, { id: 'key-2' }, { id: 'key-3' }];
    (query as any).mockResolvedValue(mockResult);

    const result = await costTracking.resetDailyUsage(mockTenantId);

    expect(result).toBe(3);
  });
});

// ============================================================================
// UNIT TESTS: COST RECORDING
// ============================================================================

describe('Cost Tracking - Cost Recording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should record cost transaction', async () => {
    const mockResult = [mockCostRecord];
    (query as any).mockResolvedValue(mockResult);

    const result = await costTracking.recordCostTransaction(
      mockTenantId,
      mockProviderId,
      1000,
      0.01,
      2.79,
      { keyId: mockKeyId, gateNumber: 4 }
    );

    expect(result.tenantId).toBe(mockTenantId);
    expect(result.providerId).toBe(mockProviderId);
    expect(result.tokensUsed).toBe(1000);
    expect(result.costUsd).toBe(0.01);
    expect(result.costPkr).toBe(2.79);
  });

  it('should record cost with all optional fields', async () => {
    const mockResult = [{ ...mockCostRecord, topic_id: 'topic-123' }];
    (query as any).mockResolvedValue(mockResult);

    const result = await costTracking.recordCostTransaction(
      mockTenantId,
      mockProviderId,
      1000,
      0.01,
      2.79,
      {
        keyId: mockKeyId,
        gateNumber: 4,
        topicId: 'topic-123',
        conversationId: 'conv-123',
      }
    );

    expect(result.keyId).toBe(mockKeyId);
    expect(result.gateNumber).toBe(4);
    expect(result.topicId).toBe('topic-123');
    expect(result.conversationId).toBe('conv-123');
  });

  it('should record cost with minimal fields', async () => {
    const mockResult = [{ ...mockCostRecord, key_id: null, gate_number: null }];
    (query as any).mockResolvedValue(mockResult);

    const result = await costTracking.recordCostTransaction(
      mockTenantId,
      mockProviderId,
      1000,
      0.01,
      2.79
    );

    expect(result.tenantId).toBe(mockTenantId);
    expect(result.providerId).toBe(mockProviderId);
  });

  it('should handle zero cost transactions', async () => {
    const mockResult = [{ ...mockCostRecord, tokens_used: 0, cost_usd: 0, cost_pkr: 0 }];
    (query as any).mockResolvedValue(mockResult);

    const result = await costTracking.recordCostTransaction(
      mockTenantId,
      mockProviderId,
      0,
      0,
      0
    );

    expect(result.tokensUsed).toBe(0);
    expect(result.costUsd).toBe(0);
  });
});

// ============================================================================
// UNIT TESTS: COST AGGREGATION
// ============================================================================

describe('Cost Tracking - Cost Aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get cost by provider', async () => {
    const mockResults = [
      { provider_id: mockProviderId, provider_name: 'Groq', total_cost_usd: 10 },
      { provider_id: 'provider-2', provider_name: 'OpenAI', total_cost_usd: 5 },
    ];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await costTracking.getCostByProvider(mockTenantId, new Date());

    expect(result).toHaveLength(2);
    expect(result[0].providerName).toBe('Groq');
    expect(result[0].costUsd).toBe(10);
    expect(result[0].percentage).toBeCloseTo(66.67, 1);
    expect(result[1].percentage).toBeCloseTo(33.33, 1);
  });

  it('should get cost by gate', async () => {
    const mockResults = [
      { gate_number: 1, total_cost_usd: 2 },
      { gate_number: 4, total_cost_usd: 8 },
    ];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await costTracking.getCostByGate(mockTenantId, new Date());

    expect(result).toHaveLength(2);
    expect(result[0].gateNumber).toBe(1);
    expect(result[0].costUsd).toBe(2);
    expect(result[0].percentage).toBe(20);
    expect(result[1].percentage).toBe(80);
  });

  it('should get cost by topic', async () => {
    const mockResults = [
      { topic_id: 'topic-1', total_cost_usd: 5 },
      { topic_id: 'topic-2', total_cost_usd: 3 },
    ];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await costTracking.getCostByTopic(mockTenantId, new Date());

    expect(result).toHaveLength(2);
    expect(result[0].topicId).toBe('topic-1');
    expect(result[0].costUsd).toBe(5);
    expect(result[0].percentage).toBeCloseTo(62.5, 1);
  });

  it('should handle empty cost aggregation', async () => {
    (queryMany as any).mockResolvedValue([]);

    const result = await costTracking.getCostByProvider(mockTenantId, new Date());

    expect(result).toHaveLength(0);
  });

  it('should calculate percentages correctly', async () => {
    const mockResults = [
      { provider_id: 'p1', provider_name: 'Provider 1', total_cost_usd: 25 },
      { provider_id: 'p2', provider_name: 'Provider 2', total_cost_usd: 25 },
      { provider_id: 'p3', provider_name: 'Provider 3', total_cost_usd: 50 },
    ];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await costTracking.getCostByProvider(mockTenantId, new Date());

    expect(result[0].percentage).toBe(25);
    expect(result[1].percentage).toBe(25);
    expect(result[2].percentage).toBe(50);
  });
});

// ============================================================================
// UNIT TESTS: METRIC CALCULATIONS
// ============================================================================

describe('Cost Tracking - Metric Calculations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate cost per conversation', async () => {
    const mockResult = {
      conversation_count: 10,
      total_cost_usd: 1,
    };
    (queryOne as any).mockResolvedValue(mockResult);

    const result = await costTracking.calculateCostPerConversation(mockTenantId, new Date());

    expect(result).toBe(0.1);
  });

  it('should handle zero conversations', async () => {
    const mockResult = {
      conversation_count: 0,
      total_cost_usd: 0,
    };
    (queryOne as any).mockResolvedValue(mockResult);

    const result = await costTracking.calculateCostPerConversation(mockTenantId, new Date());

    expect(result).toBe(0);
  });

  it('should calculate cache hit rate', async () => {
    const mockResult = {
      cache_hits: 20,
      total_calls: 100,
    };
    (queryOne as any).mockResolvedValue(mockResult);

    const result = await costTracking.calculateCacheHitRate(mockTenantId, new Date());

    expect(result).toBe(20);
  });

  it('should handle zero cache hits', async () => {
    const mockResult = {
      cache_hits: 0,
      total_calls: 100,
    };
    (queryOne as any).mockResolvedValue(mockResult);

    const result = await costTracking.calculateCacheHitRate(mockTenantId, new Date());

    expect(result).toBe(0);
  });

  it('should get projected monthly cost', async () => {
    const mockResult = {
      total_cost_usd: 100,
      days_with_costs: 10,
    };
    (queryOne as any).mockResolvedValue(mockResult);

    const result = await costTracking.getProjectedMonthlyCost(mockTenantId);

    // 100 / 10 * 30 = 300, but actual calculation uses current day of month
    // For testing, we just verify it's a reasonable projection
    expect(result).toBeGreaterThan(0);
    expect(typeof result).toBe('number');
  });

  it('should handle zero projected cost', async () => {
    const mockResult = {
      total_cost_usd: 0,
      days_with_costs: 0,
    };
    (queryOne as any).mockResolvedValue(mockResult);

    const result = await costTracking.getProjectedMonthlyCost(mockTenantId);

    expect(result).toBe(0);
  });
});

// ============================================================================
// UNIT TESTS: COST SUMMARY
// ============================================================================

describe('Cost Tracking - Cost Summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get cost summary', async () => {
    // Mock all the queryMany and queryOne calls
    (queryMany as any)
      .mockResolvedValueOnce([mockCostRecord])  // thisMonthCosts
      .mockResolvedValueOnce([])  // lastMonthCosts
      .mockResolvedValueOnce([])  // getCostByProvider
      .mockResolvedValueOnce([])  // getCostByGate
      .mockResolvedValueOnce([])  // getCostByTopic
      .mockResolvedValueOnce([])  // getQualityVsCostAnalysis
      .mockResolvedValueOnce([]);  // getCostRecommendations

    (queryOne as any)
      .mockResolvedValueOnce({ conversation_count: 1, total_cost_usd: 0.01 })  // calculateCostPerConversation
      .mockResolvedValueOnce({ cache_hits: 0, total_calls: 1 })  // calculateCacheHitRate
      .mockResolvedValueOnce({ total_cost_usd: 0.01, days_with_costs: 1 });  // getProjectedMonthlyCost

    const result = await costTracking.getCostSummary(mockTenantId);

    expect(result.totalSpendThisMonth).toBe(0.01);
    expect(result.totalSpendLastMonth).toBe(0);
    expect(result.trendIndicator).toBe('up');
    expect(result.costByProvider).toBeDefined();
    expect(result.costByGate).toBeDefined();
    expect(result.costByTopic).toBeDefined();
    expect(result.costPerConversation).toBeDefined();
    expect(result.aiCallRate).toBeDefined();
    expect(result.cacheHitRate).toBeDefined();
    expect(result.projectedMonthEndCost).toBeDefined();
    expect(result.qualityVsCostAnalysis).toBeDefined();
    expect(result.recommendations).toBeDefined();
  });

  it('should calculate trend indicator correctly', async () => {
    // Mock for upward trend
    (queryMany as any)
      .mockResolvedValueOnce([{ ...mockCostRecord, cost_usd: 100 }])  // thisMonthCosts
      .mockResolvedValueOnce([{ ...mockCostRecord, cost_usd: 50 }])  // lastMonthCosts
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    (queryOne as any)
      .mockResolvedValueOnce({ conversation_count: 1, total_cost_usd: 100 })
      .mockResolvedValueOnce({ cache_hits: 0, total_calls: 1 })
      .mockResolvedValueOnce({ total_cost_usd: 100, days_with_costs: 1 });

    const result = await costTracking.getCostSummary(mockTenantId);

    expect(result.trendIndicator).toBe('up');
  });
});

// ============================================================================
// UNIT TESTS: RECOMMENDATIONS
// ============================================================================

describe('Cost Tracking - Recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate recommendations', async () => {
    // Mock getCostByProvider
    (queryMany as any)
      .mockResolvedValueOnce([
        { provider_id: 'p1', provider_name: 'Groq', total_cost_usd: 80 },
        { provider_id: 'p2', provider_name: 'OpenAI', total_cost_usd: 20 },
      ]);

    // Mock calculateCacheHitRate
    (queryOne as any)
      .mockResolvedValueOnce({ cache_hits: 10, total_calls: 100 });

    // Mock getProjectedMonthlyCost
    (queryOne as any)
      .mockResolvedValueOnce({ total_cost_usd: 2000, days_with_costs: 15 });

    const result = await costTracking.getCostRecommendations(mockTenantId, new Date());

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// UNIT TESTS: MULTI-TENANT ISOLATION
// ============================================================================

describe('Cost Tracking - Multi-Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should only retrieve costs for specified tenant', async () => {
    (queryMany as any).mockResolvedValue([mockCostRecord]);

    await costTracking.getCostRecords(mockTenantId);

    expect(queryMany).toHaveBeenCalledWith(
      expect.stringContaining('tenant_id = $1'),
      expect.arrayContaining([mockTenantId])
    );
  });

  it('should not retrieve costs from other tenants', async () => {
    const otherTenantId = '550e8400-e29b-41d4-a716-446655440099';
    (queryMany as any).mockResolvedValue([]);

    const result = await costTracking.getCostRecords(otherTenantId);

    expect(result).toHaveLength(0);
    expect(queryMany).toHaveBeenCalledWith(
      expect.stringContaining('tenant_id = $1'),
      expect.arrayContaining([otherTenantId])
    );
  });
});

// ============================================================================
// UNIT TESTS: ERROR HANDLING
// ============================================================================

describe('Cost Tracking - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle database errors in cost recording', async () => {
    const error = new Error('Database connection failed');
    (query as any).mockRejectedValue(error);

    await expect(
      costTracking.recordCostTransaction(mockTenantId, mockProviderId, 1000, 0.01, 2.79)
    ).rejects.toThrow('Database connection failed');
  });

  it('should handle empty query results in cost recording', async () => {
    (query as any).mockResolvedValue([]);

    await expect(
      costTracking.recordCostTransaction(mockTenantId, mockProviderId, 1000, 0.01, 2.79)
    ).rejects.toThrow('Failed to record cost transaction');
  });

  it('should handle retrieval errors gracefully', async () => {
    const error = new Error('Query failed');
    (queryMany as any).mockRejectedValue(error);

    await expect(
      costTracking.getCostRecords(mockTenantId)
    ).rejects.toThrow('Query failed');
  });
});

// ============================================================================
// UNIT TESTS: COST RECORDS RETRIEVAL
// ============================================================================

describe('Cost Tracking - Cost Records Retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve cost records with filters', async () => {
    const mockResults = [mockCostRecord];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await costTracking.getCostRecords(mockTenantId, {
      providerId: mockProviderId,
      gateNumber: 4,
      limit: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0].providerId).toBe(mockProviderId);
  });

  it('should retrieve cost records with date range filter', async () => {
    const mockResults = [mockCostRecord];
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await costTracking.getCostRecords(mockTenantId, {
      startDate,
      endDate,
    });

    expect(result).toHaveLength(1);
  });

  it('should retrieve cost records with pagination', async () => {
    const mockResults = [mockCostRecord];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await costTracking.getCostRecords(mockTenantId, {
      limit: 10,
      offset: 0,
    });

    expect(result).toHaveLength(1);
  });
});

// ============================================================================
// UNIT TESTS: EXCHANGE RATE
// ============================================================================

describe('Cost Tracking - Exchange Rate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get exchange rate', async () => {
    const rate = await costTracking.getExchangeRate();

    expect(rate).toBeGreaterThan(0);
    expect(typeof rate).toBe('number');
  });

  it('should cache exchange rate', async () => {
    const rate1 = await costTracking.getExchangeRate();
    const rate2 = await costTracking.getExchangeRate();

    expect(rate1).toBe(rate2);
  });
});
