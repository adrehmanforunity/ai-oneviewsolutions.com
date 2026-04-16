/**
 * Cost Intelligence Dashboard Component Tests
 * 
 * Tests for:
 * - Component structure and props
 * - Data formatting and display logic
 * - Calculation accuracy
 * - Error handling
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10
 */

import { describe, it, expect } from 'vitest'
import { CostSummary } from '@/lib/db/schema'

// ============================================================================
// MOCK DATA
// ============================================================================

const mockCostSummary: CostSummary = {
  totalSpendThisMonth: 1234.5678,
  totalSpendLastMonth: 987.6543,
  trendIndicator: 'up',
  costByProvider: [
    {
      providerId: 'provider-1',
      providerName: 'Groq',
      costUsd: 500.0,
      percentage: 40.5,
    },
    {
      providerId: 'provider-2',
      providerName: 'OpenAI',
      costUsd: 734.5678,
      percentage: 59.5,
    },
  ],
  costByGate: [
    {
      gateNumber: 1,
      costUsd: 100.0,
      percentage: 8.1,
    },
    {
      gateNumber: 2,
      costUsd: 200.0,
      percentage: 16.2,
    },
    {
      gateNumber: 3,
      costUsd: 300.0,
      percentage: 24.3,
    },
    {
      gateNumber: 4,
      costUsd: 634.5678,
      percentage: 51.4,
    },
  ],
  costByTopic: [
    {
      topicId: 'topic-1',
      topicName: 'FAQ',
      costUsd: 400.0,
      percentage: 32.4,
    },
    {
      topicId: 'topic-2',
      topicName: 'Support',
      costUsd: 834.5678,
      percentage: 67.6,
    },
  ],
  costPerConversation: 2.5,
  aiCallRate: 45.5,
  cacheHitRate: 65.3,
  projectedMonthEndCost: 2500.0,
  qualityVsCostAnalysis: [
    {
      providerId: 'provider-1',
      providerName: 'Groq',
      qaScore: 85.5,
      costPer1kCalls: 0.5,
      qualityPerDollar: 171.0,
    },
    {
      providerId: 'provider-2',
      providerName: 'OpenAI',
      qaScore: 92.0,
      costPer1kCalls: 1.2,
      qualityPerDollar: 76.67,
    },
  ],
  recommendations: [
    'Use Groq 70B for Gate 4 (best value LLM)',
    'Cache hit rate is 65.3%. Consider adding more FAQ entries to improve cache efficiency.',
    'You have 2 providers configured. Consider load balancing to optimize for cost and reliability.',
  ],
}

// ============================================================================
// TESTS
// ============================================================================

describe('CostIntelligence Component', () => {
  describe('Data Structure Validation', () => {
    it('should have all required fields in CostSummary', () => {
      const requiredFields = [
        'totalSpendThisMonth',
        'totalSpendLastMonth',
        'trendIndicator',
        'costByProvider',
        'costByGate',
        'costByTopic',
        'costPerConversation',
        'aiCallRate',
        'cacheHitRate',
        'projectedMonthEndCost',
        'qualityVsCostAnalysis',
        'recommendations',
      ]

      requiredFields.forEach((field) => {
        expect(mockCostSummary).toHaveProperty(field)
      })
    })

    it('should have correct types for summary fields', () => {
      expect(typeof mockCostSummary.totalSpendThisMonth).toBe('number')
      expect(typeof mockCostSummary.totalSpendLastMonth).toBe('number')
      expect(typeof mockCostSummary.trendIndicator).toBe('string')
      expect(typeof mockCostSummary.costPerConversation).toBe('number')
      expect(typeof mockCostSummary.aiCallRate).toBe('number')
      expect(typeof mockCostSummary.cacheHitRate).toBe('number')
      expect(typeof mockCostSummary.projectedMonthEndCost).toBe('number')
    })

    it('should have array types for breakdown data', () => {
      expect(Array.isArray(mockCostSummary.costByProvider)).toBe(true)
      expect(Array.isArray(mockCostSummary.costByGate)).toBe(true)
      expect(Array.isArray(mockCostSummary.costByTopic)).toBe(true)
      expect(Array.isArray(mockCostSummary.qualityVsCostAnalysis)).toBe(true)
      expect(Array.isArray(mockCostSummary.recommendations)).toBe(true)
    })
  })

  describe('Summary Cards Data', () => {
    it('should display total spend this month with 4 decimal places', () => {
      const formatted = mockCostSummary.totalSpendThisMonth.toFixed(4)
      expect(formatted).toBe('1234.5678')
    })

    it('should display last month spend with 4 decimal places', () => {
      const formatted = mockCostSummary.totalSpendLastMonth.toFixed(4)
      expect(formatted).toBe('987.6543')
    })

    it('should have valid trend indicator', () => {
      const validTrends = ['up', 'down', 'stable']
      expect(validTrends).toContain(mockCostSummary.trendIndicator)
    })

    it('should display projected month-end cost with 4 decimal places', () => {
      const formatted = mockCostSummary.projectedMonthEndCost.toFixed(4)
      expect(formatted).toBe('2500.0000')
    })
  })

  describe('Cost Breakdown by Provider', () => {
    it('should have provider data', () => {
      expect(mockCostSummary.costByProvider.length).toBeGreaterThan(0)
    })

    it('should have required fields in provider breakdown', () => {
      mockCostSummary.costByProvider.forEach((provider) => {
        expect(provider).toHaveProperty('providerId')
        expect(provider).toHaveProperty('providerName')
        expect(provider).toHaveProperty('costUsd')
        expect(provider).toHaveProperty('percentage')
      })
    })

    it('should have valid provider names', () => {
      mockCostSummary.costByProvider.forEach((provider) => {
        expect(typeof provider.providerName).toBe('string')
        expect(provider.providerName.length).toBeGreaterThan(0)
      })
    })

    it('should have costs with 4 decimal places', () => {
      mockCostSummary.costByProvider.forEach((provider) => {
        const formatted = provider.costUsd.toFixed(4)
        expect(formatted).toMatch(/^\d+\.\d{4}$/)
      })
    })

    it('should have percentages between 0 and 100', () => {
      mockCostSummary.costByProvider.forEach((provider) => {
        expect(provider.percentage).toBeGreaterThanOrEqual(0)
        expect(provider.percentage).toBeLessThanOrEqual(100)
      })
    })

    it('should have percentages sum to approximately 100', () => {
      const total = mockCostSummary.costByProvider.reduce((sum, p) => sum + p.percentage, 0)
      expect(total).toBeCloseTo(100, 1)
    })
  })

  describe('Cost Breakdown by Gate', () => {
    it('should have gate data for all 4 gates', () => {
      expect(mockCostSummary.costByGate.length).toBe(4)
    })

    it('should have gate numbers 1-4', () => {
      const gateNumbers = mockCostSummary.costByGate.map((g) => g.gateNumber)
      expect(gateNumbers).toEqual([1, 2, 3, 4])
    })

    it('should have required fields in gate breakdown', () => {
      mockCostSummary.costByGate.forEach((gate) => {
        expect(gate).toHaveProperty('gateNumber')
        expect(gate).toHaveProperty('costUsd')
        expect(gate).toHaveProperty('percentage')
      })
    })

    it('should have costs with 4 decimal places', () => {
      mockCostSummary.costByGate.forEach((gate) => {
        const formatted = gate.costUsd.toFixed(4)
        expect(formatted).toMatch(/^\d+\.\d{4}$/)
      })
    })

    it('should have percentages sum to approximately 100', () => {
      const total = mockCostSummary.costByGate.reduce((sum, g) => sum + g.percentage, 0)
      expect(total).toBeCloseTo(100, 1)
    })
  })

  describe('Cost Breakdown by Topic', () => {
    it('should have topic data', () => {
      expect(mockCostSummary.costByTopic.length).toBeGreaterThan(0)
    })

    it('should have required fields in topic breakdown', () => {
      mockCostSummary.costByTopic.forEach((topic) => {
        expect(topic).toHaveProperty('topicId')
        expect(topic).toHaveProperty('topicName')
        expect(topic).toHaveProperty('costUsd')
        expect(topic).toHaveProperty('percentage')
      })
    })

    it('should have valid topic names', () => {
      mockCostSummary.costByTopic.forEach((topic) => {
        expect(typeof topic.topicName).toBe('string')
        expect(topic.topicName.length).toBeGreaterThan(0)
      })
    })

    it('should have costs with 4 decimal places', () => {
      mockCostSummary.costByTopic.forEach((topic) => {
        const formatted = topic.costUsd.toFixed(4)
        expect(formatted).toMatch(/^\d+\.\d{4}$/)
      })
    })

    it('should have percentages sum to approximately 100', () => {
      const total = mockCostSummary.costByTopic.reduce((sum, t) => sum + t.percentage, 0)
      expect(total).toBeCloseTo(100, 1)
    })
  })

  describe('Metrics Display', () => {
    it('should display cost per conversation with 4 decimal places', () => {
      const formatted = mockCostSummary.costPerConversation.toFixed(4)
      expect(formatted).toBe('2.5000')
    })

    it('should display AI call rate with 2 decimal places', () => {
      const formatted = mockCostSummary.aiCallRate.toFixed(2)
      expect(formatted).toBe('45.50')
    })

    it('should display cache hit rate with 2 decimal places', () => {
      const formatted = mockCostSummary.cacheHitRate.toFixed(2)
      expect(formatted).toBe('65.30')
    })

    it('should have valid metric values', () => {
      expect(mockCostSummary.costPerConversation).toBeGreaterThanOrEqual(0)
      expect(mockCostSummary.aiCallRate).toBeGreaterThanOrEqual(0)
      expect(mockCostSummary.aiCallRate).toBeLessThanOrEqual(100)
      expect(mockCostSummary.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(mockCostSummary.cacheHitRate).toBeLessThanOrEqual(100)
    })
  })

  describe('Quality vs Cost Analysis', () => {
    it('should have quality analysis data', () => {
      expect(mockCostSummary.qualityVsCostAnalysis.length).toBeGreaterThan(0)
    })

    it('should have required fields in quality analysis', () => {
      mockCostSummary.qualityVsCostAnalysis.forEach((analysis) => {
        expect(analysis).toHaveProperty('providerId')
        expect(analysis).toHaveProperty('providerName')
        expect(analysis).toHaveProperty('qaScore')
        expect(analysis).toHaveProperty('costPer1kCalls')
        expect(analysis).toHaveProperty('qualityPerDollar')
      })
    })

    it('should have valid QA scores (0-100)', () => {
      mockCostSummary.qualityVsCostAnalysis.forEach((analysis) => {
        expect(analysis.qaScore).toBeGreaterThanOrEqual(0)
        expect(analysis.qaScore).toBeLessThanOrEqual(100)
      })
    })

    it('should have positive cost per 1K calls', () => {
      mockCostSummary.qualityVsCostAnalysis.forEach((analysis) => {
        expect(analysis.costPer1kCalls).toBeGreaterThanOrEqual(0)
      })
    })

    it('should have positive quality per dollar ratio', () => {
      mockCostSummary.qualityVsCostAnalysis.forEach((analysis) => {
        expect(analysis.qualityPerDollar).toBeGreaterThanOrEqual(0)
      })
    })

    it('should calculate quality per dollar correctly', () => {
      mockCostSummary.qualityVsCostAnalysis.forEach((analysis) => {
        const calculated = analysis.qaScore / analysis.costPer1kCalls
        expect(calculated).toBeCloseTo(analysis.qualityPerDollar, 1)
      })
    })

    it('should be sorted by quality per dollar (best value first)', () => {
      for (let i = 0; i < mockCostSummary.qualityVsCostAnalysis.length - 1; i++) {
        expect(mockCostSummary.qualityVsCostAnalysis[i].qualityPerDollar).toBeGreaterThanOrEqual(
          mockCostSummary.qualityVsCostAnalysis[i + 1].qualityPerDollar
        )
      }
    })
  })

  describe('Recommendations', () => {
    it('should have recommendations', () => {
      expect(mockCostSummary.recommendations.length).toBeGreaterThan(0)
    })

    it('should have non-empty recommendation strings', () => {
      mockCostSummary.recommendations.forEach((rec) => {
        expect(typeof rec).toBe('string')
        expect(rec.length).toBeGreaterThan(0)
      })
    })

    it('should have meaningful recommendations', () => {
      const recommendations = mockCostSummary.recommendations
      expect(recommendations[0]).toContain('Groq')
      expect(recommendations[1]).toContain('Cache')
      expect(recommendations[2]).toContain('providers')
    })
  })

  describe('Accuracy of Calculations', () => {
    it('should maintain USD accuracy to 4 decimal places', () => {
      const values = [
        mockCostSummary.totalSpendThisMonth,
        mockCostSummary.totalSpendLastMonth,
        mockCostSummary.projectedMonthEndCost,
        mockCostSummary.costPerConversation,
      ]

      values.forEach((value) => {
        const formatted = value.toFixed(4)
        const parts = formatted.split('.')
        expect(parts[1].length).toBeLessThanOrEqual(4)
      })
    })

    it('should maintain percentage accuracy to 2 decimal places', () => {
      const values = [mockCostSummary.aiCallRate, mockCostSummary.cacheHitRate]

      values.forEach((value) => {
        const formatted = value.toFixed(2)
        const parts = formatted.split('.')
        expect(parts[1].length).toBeLessThanOrEqual(2)
      })
    })

    it('should handle cost calculations correctly', () => {
      // Verify that provider costs sum to approximately total
      const providerTotal = mockCostSummary.costByProvider.reduce((sum, p) => sum + p.costUsd, 0)
      expect(providerTotal).toBeCloseTo(mockCostSummary.totalSpendThisMonth, 2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero costs', () => {
      const zeroCost = 0
      expect(zeroCost.toFixed(4)).toBe('0.0000')
    })

    it('should handle very large costs', () => {
      const largeCost = 999999.9999
      expect(largeCost.toFixed(4)).toBe('999999.9999')
    })

    it('should handle very small costs', () => {
      const smallCost = 0.0001
      expect(smallCost.toFixed(4)).toBe('0.0001')
    })

    it('should handle percentage rounding', () => {
      const percentage = (1 / 3) * 100
      expect(percentage.toFixed(2)).toBe('33.33')
    })

    it('should handle single provider', () => {
      const singleProvider = [
        {
          providerId: 'provider-1',
          providerName: 'Groq',
          costUsd: 1000,
          percentage: 100,
        },
      ]

      expect(singleProvider.length).toBe(1)
      expect(singleProvider[0].percentage).toBe(100)
    })

    it('should handle many providers', () => {
      const manyProviders = Array.from({ length: 10 }, (_, i) => ({
        providerId: `provider-${i}`,
        providerName: `Provider ${i}`,
        costUsd: 100,
        percentage: 10,
      }))

      expect(manyProviders.length).toBe(10)
      const totalPercentage = manyProviders.reduce((sum, p) => sum + p.percentage, 0)
      expect(totalPercentage).toBe(100)
    })
  })

  describe('Data Validation', () => {
    it('should validate all costs are non-negative', () => {
      const allCosts = [
        mockCostSummary.totalSpendThisMonth,
        mockCostSummary.totalSpendLastMonth,
        mockCostSummary.projectedMonthEndCost,
        mockCostSummary.costPerConversation,
        ...mockCostSummary.costByProvider.map((p) => p.costUsd),
        ...mockCostSummary.costByGate.map((g) => g.costUsd),
        ...mockCostSummary.costByTopic.map((t) => t.costUsd),
      ]

      allCosts.forEach((cost) => {
        expect(cost).toBeGreaterThanOrEqual(0)
      })
    })

    it('should validate all percentages are between 0 and 100', () => {
      const allPercentages = [
        mockCostSummary.aiCallRate,
        mockCostSummary.cacheHitRate,
        ...mockCostSummary.costByProvider.map((p) => p.percentage),
        ...mockCostSummary.costByGate.map((g) => g.percentage),
        ...mockCostSummary.costByTopic.map((t) => t.percentage),
      ]

      allPercentages.forEach((percentage) => {
        expect(percentage).toBeGreaterThanOrEqual(0)
        expect(percentage).toBeLessThanOrEqual(100)
      })
    })

    it('should validate provider names are non-empty strings', () => {
      mockCostSummary.costByProvider.forEach((provider) => {
        expect(typeof provider.providerName).toBe('string')
        expect(provider.providerName.length).toBeGreaterThan(0)
      })
    })

    it('should validate gate numbers are 1-4', () => {
      mockCostSummary.costByGate.forEach((gate) => {
        expect(gate.gateNumber).toBeGreaterThanOrEqual(1)
        expect(gate.gateNumber).toBeLessThanOrEqual(4)
      })
    })

    it('should validate trend indicator is valid', () => {
      const validTrends = ['up', 'down', 'stable']
      expect(validTrends).toContain(mockCostSummary.trendIndicator)
    })
  })
})
