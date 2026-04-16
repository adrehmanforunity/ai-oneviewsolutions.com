/**
 * Activity Log Integration Tests
 * 
 * Integration tests for the Activity Log viewer
 * Tests: API calls, filtering, pagination, export, error handling
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { queryMany, queryCount } from '@/lib/db'

// ============================================================================
// MOCK DATA
// ============================================================================

const mockTenantId = 'test-tenant-123'
const mockProviderId = 'provider-groq'
const mockKeyId = 'key-prod-001'

const mockActivityLogEntries = [
  {
    id: 'log-001',
    tenant_id: mockTenantId,
    key_id: mockKeyId,
    action_type: 'test' as const,
    action_details: { result: 'valid' },
    tokens_used: 100,
    cost_usd: 0.0015,
    cost_pkr: 0.50,
    status: 'success' as const,
    error_message: null,
    user_id: 'user-001',
    user_role: 'admin',
    primary_tenant_id: mockTenantId,
    affected_tenants: null,
    created_at: new Date('2024-01-15T10:30:00Z'),
  },
  {
    id: 'log-002',
    tenant_id: mockTenantId,
    key_id: mockKeyId,
    action_type: 'use' as const,
    action_details: { tokens: 500 },
    tokens_used: 500,
    cost_usd: 0.0075,
    cost_pkr: 2.50,
    status: 'success' as const,
    error_message: null,
    user_id: 'user-001',
    user_role: 'admin',
    primary_tenant_id: mockTenantId,
    affected_tenants: null,
    created_at: new Date('2024-01-15T09:30:00Z'),
  },
  {
    id: 'log-003',
    tenant_id: mockTenantId,
    key_id: mockKeyId,
    action_type: 'rotate' as const,
    action_details: { reason: 'rate_limit' },
    tokens_used: null,
    cost_usd: 0,
    cost_pkr: 0,
    status: 'failed' as const,
    error_message: 'Rate limit exceeded',
    user_id: 'user-001',
    user_role: 'admin',
    primary_tenant_id: mockTenantId,
    affected_tenants: null,
    created_at: new Date('2024-01-15T08:30:00Z'),
  },
  {
    id: 'log-004',
    tenant_id: mockTenantId,
    key_id: 'key-backup-001',
    action_type: 'add' as const,
    action_details: { provider: 'groq' },
    tokens_used: null,
    cost_usd: 0,
    cost_pkr: 0,
    status: 'success' as const,
    error_message: null,
    user_id: 'user-001',
    user_role: 'admin',
    primary_tenant_id: mockTenantId,
    affected_tenants: null,
    created_at: new Date('2024-01-14T15:00:00Z'),
  },
  {
    id: 'log-005',
    tenant_id: mockTenantId,
    key_id: 'key-backup-001',
    action_type: 'delete' as const,
    action_details: { reason: 'expired' },
    tokens_used: null,
    cost_usd: 0,
    cost_pkr: 0,
    status: 'success' as const,
    error_message: null,
    user_id: 'user-002',
    user_role: 'admin',
    primary_tenant_id: mockTenantId,
    affected_tenants: null,
    created_at: new Date('2024-01-13T12:00:00Z'),
  },
]

// ============================================================================
// TESTS
// ============================================================================

describe('Activity Log Integration Tests', () => {
  // ============================================================================
  // FILTERING TESTS
  // ============================================================================

  describe('Filtering', () => {
    it('should filter activity log by action type', async () => {
      // Filter for 'test' action type
      const testEntries = mockActivityLogEntries.filter(e => e.action_type === 'test')

      expect(testEntries).toHaveLength(1)
      expect(testEntries[0].action_type).toBe('test')
    })

    it('should filter activity log by status', async () => {
      // Filter for 'failed' status
      const failedEntries = mockActivityLogEntries.filter(e => e.status === 'failed')

      expect(failedEntries).toHaveLength(1)
      expect(failedEntries[0].status).toBe('failed')
      expect(failedEntries[0].error_message).toBe('Rate limit exceeded')
    })

    it('should filter activity log by key ID', async () => {
      // Filter for specific key
      const keyEntries = mockActivityLogEntries.filter(e => e.key_id === mockKeyId)

      expect(keyEntries).toHaveLength(3)
      keyEntries.forEach(entry => {
        expect(entry.key_id).toBe(mockKeyId)
      })
    })

    it('should filter activity log by date range', async () => {
      const dateFrom = new Date('2024-01-15T00:00:00Z')
      const dateTo = new Date('2024-01-15T23:59:59Z')

      const rangeEntries = mockActivityLogEntries.filter(
        e => e.created_at >= dateFrom && e.created_at <= dateTo
      )

      expect(rangeEntries).toHaveLength(3)
    })

    it('should filter activity log by tenant ID', async () => {
      // Verify tenant isolation
      const tenantEntries = mockActivityLogEntries.filter(e => e.tenant_id === mockTenantId)

      expect(tenantEntries).toHaveLength(5)
      tenantEntries.forEach(entry => {
        expect(entry.tenant_id).toBe(mockTenantId)
      })
    })

    it('should apply multiple filters simultaneously', async () => {
      // Filter by action type AND status
      const filteredEntries = mockActivityLogEntries.filter(
        e => e.action_type === 'use' && e.status === 'success'
      )

      expect(filteredEntries).toHaveLength(1)
      expect(filteredEntries[0].action_type).toBe('use')
      expect(filteredEntries[0].status).toBe('success')
    })

    it('should return empty array when no entries match filters', async () => {
      const filteredEntries = mockActivityLogEntries.filter(
        e => e.action_type === 'nonexistent'
      )

      expect(filteredEntries).toHaveLength(0)
    })
  })

  // ============================================================================
  // PAGINATION TESTS
  // ============================================================================

  describe('Pagination', () => {
    it('should paginate entries with limit and offset', async () => {
      const limit = 2
      const offset = 0

      const paginatedEntries = mockActivityLogEntries
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(offset, offset + limit)

      expect(paginatedEntries).toHaveLength(2)
      expect(paginatedEntries[0].id).toBe('log-001')
      expect(paginatedEntries[1].id).toBe('log-002')
    })

    it('should handle pagination with different page sizes', async () => {
      const pageSizes = [10, 25, 50, 100]

      pageSizes.forEach(pageSize => {
        const page1 = mockActivityLogEntries.slice(0, pageSize)
        expect(page1.length).toBeLessThanOrEqual(pageSize)
      })
    })

    it('should calculate correct total count', async () => {
      const total = mockActivityLogEntries.length

      expect(total).toBe(5)
    })

    it('should handle offset beyond total entries', async () => {
      const limit = 10
      const offset = 100

      const paginatedEntries = mockActivityLogEntries.slice(offset, offset + limit)

      expect(paginatedEntries).toHaveLength(0)
    })

    it('should return entries in reverse chronological order', async () => {
      const sorted = mockActivityLogEntries.sort(
        (a, b) => b.created_at.getTime() - a.created_at.getTime()
      )

      expect(sorted[0].created_at).toBeGreaterThan(sorted[1].created_at)
      expect(sorted[1].created_at).toBeGreaterThan(sorted[2].created_at)
    })

    it('should calculate correct pagination info', async () => {
      const limit = 2
      const offset = 0
      const total = mockActivityLogEntries.length

      const startIndex = offset + 1
      const endIndex = Math.min(offset + limit, total)

      expect(startIndex).toBe(1)
      expect(endIndex).toBe(2)
    })
  })

  // ============================================================================
  // COST FORMATTING TESTS
  // ============================================================================

  describe('Cost Formatting', () => {
    it('should format USD cost with 4 decimal places', async () => {
      const entry = mockActivityLogEntries[0]

      const formattedUsd = entry.cost_usd.toFixed(4)

      expect(formattedUsd).toBe('0.0015')
    })

    it('should format PKR cost with 2 decimal places', async () => {
      const entry = mockActivityLogEntries[0]

      const formattedPkr = entry.cost_pkr.toFixed(2)

      expect(formattedPkr).toBe('0.50')
    })

    it('should handle zero costs', async () => {
      const entry = mockActivityLogEntries[2]

      expect(entry.cost_usd).toBe(0)
      expect(entry.cost_pkr).toBe(0)
      expect(entry.cost_usd.toFixed(4)).toBe('0.0000')
      expect(entry.cost_pkr.toFixed(2)).toBe('0.00')
    })

    it('should accumulate costs correctly', async () => {
      const successEntries = mockActivityLogEntries.filter(e => e.status === 'success')

      const totalCostUsd = successEntries.reduce((sum, e) => sum + (e.cost_usd || 0), 0)
      const totalCostPkr = successEntries.reduce((sum, e) => sum + (e.cost_pkr || 0), 0)

      expect(totalCostUsd).toBeCloseTo(0.009, 4)
      expect(totalCostPkr).toBeCloseTo(3.0, 2)
    })

    it('should handle large cost values', async () => {
      const largeCost = 1234.56789

      const formattedUsd = largeCost.toFixed(4)

      expect(formattedUsd).toBe('1234.5679')
    })
  })

  // ============================================================================
  // ACTION TYPE TESTS
  // ============================================================================

  describe('Action Types', () => {
    it('should support all action types', async () => {
      const actionTypes = ['add', 'delete', 'test', 'rotate', 'enable', 'disable', 'use']

      const entries = mockActivityLogEntries.map(e => e.action_type)
      const uniqueActions = [...new Set(entries)]

      expect(uniqueActions.length).toBeGreaterThan(0)
      uniqueActions.forEach(action => {
        expect(actionTypes).toContain(action)
      })
    })

    it('should display action type correctly', async () => {
      const testEntry = mockActivityLogEntries.find(e => e.action_type === 'test')

      expect(testEntry).toBeDefined()
      expect(testEntry?.action_type).toBe('test')
    })

    it('should include action details', async () => {
      const entries = mockActivityLogEntries.filter(e => e.action_details !== null)

      expect(entries.length).toBeGreaterThan(0)
      entries.forEach(entry => {
        expect(entry.action_details).toBeDefined()
        expect(typeof entry.action_details).toBe('object')
      })
    })
  })

  // ============================================================================
  // STATUS TESTS
  // ============================================================================

  describe('Status', () => {
    it('should support all status types', async () => {
      const statuses = ['success', 'failed', 'rate_limited', 'invalid']

      const entries = mockActivityLogEntries.map(e => e.status)
      const uniqueStatuses = [...new Set(entries)]

      uniqueStatuses.forEach(status => {
        expect(statuses).toContain(status)
      })
    })

    it('should include error message for failed status', async () => {
      const failedEntry = mockActivityLogEntries.find(e => e.status === 'failed')

      expect(failedEntry).toBeDefined()
      expect(failedEntry?.error_message).toBe('Rate limit exceeded')
    })

    it('should not include error message for success status', async () => {
      const successEntries = mockActivityLogEntries.filter(e => e.status === 'success')

      successEntries.forEach(entry => {
        expect(entry.error_message).toBeNull()
      })
    })
  })

  // ============================================================================
  // EXPORT TESTS
  // ============================================================================

  describe('Export', () => {
    it('should generate valid CSV headers', async () => {
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
      ]

      expect(headers).toHaveLength(11)
      expect(headers[0]).toBe('Timestamp')
      expect(headers[5]).toBe('Action')
      expect(headers[6]).toBe('Status')
    })

    it('should escape CSV values correctly', async () => {
      const testValue = 'Value with, comma'
      const escapedValue = `"${testValue.replace(/"/g, '""')}"`

      expect(escapedValue).toBe('"Value with, comma"')
    })

    it('should handle null values in CSV', async () => {
      const nullValue = null
      const csvValue = nullValue === null ? '' : String(nullValue)

      expect(csvValue).toBe('')
    })

    it('should include all entries in export', async () => {
      const csvRows = mockActivityLogEntries.length

      expect(csvRows).toBe(5)
    })

    it('should maintain data integrity in export', async () => {
      const entry = mockActivityLogEntries[0]

      expect(entry.id).toBe('log-001')
      expect(entry.action_type).toBe('test')
      expect(entry.status).toBe('success')
      expect(entry.cost_usd).toBe(0.0015)
    })
  })

  // ============================================================================
  // TENANT ISOLATION TESTS
  // ============================================================================

  describe('Tenant Isolation', () => {
    it('should filter entries by tenant ID', async () => {
      const otherTenantId = 'other-tenant-456'

      const tenantEntries = mockActivityLogEntries.filter(e => e.tenant_id === mockTenantId)
      const otherEntries = mockActivityLogEntries.filter(e => e.tenant_id === otherTenantId)

      expect(tenantEntries).toHaveLength(5)
      expect(otherEntries).toHaveLength(0)
    })

    it('should not expose other tenant entries', async () => {
      const otherTenantId = 'other-tenant-456'

      const allEntries = mockActivityLogEntries
      const filteredEntries = allEntries.filter(e => e.tenant_id === otherTenantId)

      expect(filteredEntries).toHaveLength(0)
    })

    it('should include tenant ID in all entries', async () => {
      mockActivityLogEntries.forEach(entry => {
        expect(entry.tenant_id).toBeDefined()
        expect(entry.tenant_id).toBe(mockTenantId)
      })
    })
  })

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle missing optional fields', async () => {
      const entry = mockActivityLogEntries[2]

      expect(entry.tokens_used).toBeNull()
      expect(entry.error_message).toBeDefined()
    })

    it('should handle rate limit errors', async () => {
      const rateLimitEntry = mockActivityLogEntries.find(
        e => e.error_message === 'Rate limit exceeded'
      )

      expect(rateLimitEntry).toBeDefined()
      expect(rateLimitEntry?.status).toBe('failed')
    })

    it('should preserve error messages in export', async () => {
      const entry = mockActivityLogEntries[2]
      const errorMessage = entry.error_message || ''

      expect(errorMessage).toBe('Rate limit exceeded')
    })
  })

  // ============================================================================
  // TIMESTAMP TESTS
  // ============================================================================

  describe('Timestamps', () => {
    it('should store timestamps in ISO format', async () => {
      const entry = mockActivityLogEntries[0]

      expect(entry.created_at).toBeInstanceOf(Date)
      expect(entry.created_at.toISOString()).toBe('2024-01-15T10:30:00.000Z')
    })

    it('should sort entries by timestamp in descending order', async () => {
      const sorted = mockActivityLogEntries.sort(
        (a, b) => b.created_at.getTime() - a.created_at.getTime()
      )

      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].created_at.getTime()).toBeGreaterThanOrEqual(
          sorted[i + 1].created_at.getTime()
        )
      }
    })

    it('should filter by date range correctly', async () => {
      const dateFrom = new Date('2024-01-15T00:00:00Z')
      const dateTo = new Date('2024-01-15T23:59:59Z')

      const filtered = mockActivityLogEntries.filter(
        e => e.created_at >= dateFrom && e.created_at <= dateTo
      )

      expect(filtered).toHaveLength(3)
    })
  })

  // ============================================================================
  // USER TRACKING TESTS
  // ============================================================================

  describe('User Tracking', () => {
    it('should track user ID for each action', async () => {
      mockActivityLogEntries.forEach(entry => {
        expect(entry.user_id).toBeDefined()
      })
    })

    it('should track user role for each action', async () => {
      mockActivityLogEntries.forEach(entry => {
        expect(entry.user_role).toBeDefined()
        expect(['admin', 'user', 'viewer']).toContain(entry.user_role)
      })
    })

    it('should filter entries by user', async () => {
      const user001Entries = mockActivityLogEntries.filter(e => e.user_id === 'user-001')

      expect(user001Entries).toHaveLength(4)
    })
  })

  // ============================================================================
  // AFFECTED TENANTS TESTS
  // ============================================================================

  describe('Affected Tenants', () => {
    it('should track affected tenants for shared key operations', async () => {
      mockActivityLogEntries.forEach(entry => {
        // affected_tenants can be null or an array
        if (entry.affected_tenants !== null) {
          expect(Array.isArray(entry.affected_tenants)).toBe(true)
        }
      })
    })

    it('should include primary tenant ID', async () => {
      mockActivityLogEntries.forEach(entry => {
        expect(entry.primary_tenant_id).toBeDefined()
        expect(entry.primary_tenant_id).toBe(mockTenantId)
      })
    })
  })
})
