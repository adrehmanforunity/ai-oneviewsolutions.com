/**
 * Activity Logging Service Tests
 * Comprehensive unit tests for activity logging functionality
 * 
 * Test Coverage:
 * - Log creation for all operation types (add, delete, test, rotate, enable, disable, use, share, unshare)
 * - Log immutability (verify no editing/deletion)
 * - Log filtering and querying
 * - Statistics calculation
 * - CSV/JSON export
 * - Multi-tenant isolation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as activityLogging from './index';
import { query, queryOne, queryMany } from '../db/index';

// Mock database functions
vi.mock('../db/index', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryMany: vi.fn(),
  withTransaction: vi.fn(),
  transactionQuery: vi.fn(),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const mockTenantId = '550e8400-e29b-41d4-a716-446655440000';
const mockKeyId = '550e8400-e29b-41d4-a716-446655440001';
const mockProviderId = '550e8400-e29b-41d4-a716-446655440002';
const mockUserId = '550e8400-e29b-41d4-a716-446655440003';

const mockActivityLogRow = {
  id: '550e8400-e29b-41d4-a716-446655440004',
  tenant_id: mockTenantId,
  key_id: mockKeyId,
  action_type: 'add' as const,
  action_details: { provider_id: mockProviderId },
  tokens_used: 100,
  cost_usd: 0.001,
  cost_pkr: 0.15,
  status: 'success' as const,
  error_message: null,
  user_id: mockUserId,
  user_role: 'Tenant Admin' as const,
  primary_tenant_id: null,
  affected_tenants: null,
  created_at: new Date('2024-01-15T10:00:00Z'),
};

// ============================================================================
// UNIT TESTS: LOG CREATION
// ============================================================================

describe('Activity Logging - Log Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log key creation', async () => {
    const mockResult = [mockActivityLogRow];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyCreated(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      'test@example.com',
      mockUserId,
      'Tenant Admin'
    );

    expect(result).toBeDefined();
    expect(result.actionType).toBe('add');
    expect(result.status).toBe('success');
    expect(result.keyId).toBe(mockKeyId);
    expect(query).toHaveBeenCalled();
  });

  it('should log key deletion', async () => {
    const mockResult = [{ ...mockActivityLogRow, action_type: 'delete' }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyDeleted(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      'test@example.com',
      mockUserId,
      'Tenant Admin'
    );

    expect(result.actionType).toBe('delete');
    expect(result.status).toBe('success');
  });

  it('should log key test with valid status', async () => {
    const mockResult = [{ ...mockActivityLogRow, action_type: 'test' }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyTested(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      'valid',
      150,
      undefined,
      mockUserId,
      'Tenant Admin'
    );

    expect(result.actionType).toBe('test');
    expect(result.status).toBe('success');
  });

  it('should log key test with invalid status', async () => {
    const mockResult = [{ ...mockActivityLogRow, action_type: 'test', status: 'invalid' }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyTested(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      'invalid',
      200,
      'Unauthorized',
      mockUserId,
      'Tenant Admin'
    );

    expect(result.actionType).toBe('test');
    expect(result.status).toBe('invalid');
  });

  it('should log key test with rate_limited status', async () => {
    const mockResult = [{ ...mockActivityLogRow, action_type: 'test', status: 'rate_limited' }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyTested(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      'rate_limited',
      100,
      'Rate limit exceeded',
      mockUserId,
      'Tenant Admin'
    );

    expect(result.actionType).toBe('test');
    expect(result.status).toBe('rate_limited');
  });

  it('should log key rotation', async () => {
    const newKeyId = '550e8400-e29b-41d4-a716-446655440005';
    const mockResult = [{ ...mockActivityLogRow, action_type: 'rotate', key_id: newKeyId }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyRotated(
      mockTenantId,
      mockKeyId,
      newKeyId,
      mockProviderId,
      'rate_limited'
    );

    expect(result.actionType).toBe('rotate');
    expect(result.status).toBe('success');
  });

  it('should log key enable', async () => {
    const mockResult = [{ ...mockActivityLogRow, action_type: 'enable' }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyEnabled(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      mockUserId,
      'Tenant Admin'
    );

    expect(result.actionType).toBe('enable');
    expect(result.status).toBe('success');
  });

  it('should log key disable', async () => {
    const mockResult = [{ ...mockActivityLogRow, action_type: 'disable' }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyDisabled(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      'Invalid key',
      mockUserId,
      'Tenant Admin'
    );

    expect(result.actionType).toBe('disable');
    expect(result.status).toBe('success');
  });

  it('should log key usage', async () => {
    const mockResult = [{ ...mockActivityLogRow, action_type: 'use', tokens_used: 1000, cost_usd: 0.01, cost_pkr: 1.5 }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyUsed(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      1000,
      0.01,
      1.5,
      'success'
    );

    expect(result.actionType).toBe('use');
    expect(result.status).toBe('success');
    expect(result.tokensUsed).toBe(1000);
    expect(result.costUsd).toBe(0.01);
  });

  it('should log key usage with failure status', async () => {
    const mockResult = [{ ...mockActivityLogRow, action_type: 'use', status: 'failed' }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyUsed(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      0,
      0,
      0,
      'failed',
      'Connection timeout'
    );

    expect(result.actionType).toBe('use');
    expect(result.status).toBe('failed');
  });

  it('should log key sharing', async () => {
    const sharedTenantIds = ['tenant-2', 'tenant-3'];
    const mockResult = [{ ...mockActivityLogRow, action_type: 'share', affected_tenants: sharedTenantIds }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyShared(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      sharedTenantIds,
      mockUserId,
      'Super Admin'
    );

    expect(result.actionType).toBe('share');
    expect(result.status).toBe('success');
  });

  it('should log key unsharing', async () => {
    const revokedTenantIds = ['tenant-2'];
    const mockResult = [{ ...mockActivityLogRow, action_type: 'unshare', affected_tenants: revokedTenantIds }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyUnshared(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      revokedTenantIds,
      mockUserId,
      'Super Admin'
    );

    expect(result.actionType).toBe('unshare');
    expect(result.status).toBe('success');
  });
});

// ============================================================================
// UNIT TESTS: LOG RETRIEVAL
// ============================================================================

describe('Activity Logging - Log Retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve activity log for tenant', async () => {
    const mockResults = [mockActivityLogRow];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await activityLogging.getActivityLog(mockTenantId);

    expect(result).toHaveLength(1);
    expect(result[0].tenantId).toBe(mockTenantId);
    expect(queryMany).toHaveBeenCalled();
  });

  it('should retrieve activity log with action type filter', async () => {
    const mockResults = [mockActivityLogRow];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await activityLogging.getActivityLog(mockTenantId, {
      actionType: 'add',
    });

    expect(result).toHaveLength(1);
    expect(queryMany).toHaveBeenCalledWith(
      expect.stringContaining('action_type'),
      expect.arrayContaining([mockTenantId, 'add'])
    );
  });

  it('should retrieve activity log with status filter', async () => {
    const mockResults = [mockActivityLogRow];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await activityLogging.getActivityLog(mockTenantId, {
      status: 'success',
    });

    expect(result).toHaveLength(1);
    expect(queryMany).toHaveBeenCalledWith(
      expect.stringContaining('status'),
      expect.arrayContaining([mockTenantId, 'success'])
    );
  });

  it('should retrieve activity log with date range filter', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    const mockResults = [mockActivityLogRow];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await activityLogging.getActivityLog(mockTenantId, {
      startDate,
      endDate,
    });

    expect(result).toHaveLength(1);
    expect(queryMany).toHaveBeenCalledWith(
      expect.stringContaining('created_at'),
      expect.arrayContaining([mockTenantId, startDate, endDate])
    );
  });

  it('should retrieve activity log with pagination', async () => {
    const mockResults = [mockActivityLogRow];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await activityLogging.getActivityLog(mockTenantId, {
      limit: 10,
      offset: 0,
    });

    expect(result).toHaveLength(1);
    expect(queryMany).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT'),
      expect.arrayContaining([mockTenantId, 10])
    );
  });

  it('should retrieve single activity log entry', async () => {
    (queryOne as any).mockResolvedValue(mockActivityLogRow);

    const result = await activityLogging.getActivityLogEntry(mockTenantId, mockActivityLogRow.id);

    expect(result).toBeDefined();
    expect(result?.id).toBe(mockActivityLogRow.id);
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id'),
      [mockActivityLogRow.id, mockTenantId]
    );
  });

  it('should return null for non-existent entry', async () => {
    (queryOne as any).mockResolvedValue(null);

    const result = await activityLogging.getActivityLogEntry(mockTenantId, 'non-existent-id');

    expect(result).toBeNull();
  });
});

// ============================================================================
// UNIT TESTS: STATISTICS
// ============================================================================

describe('Activity Logging - Statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate activity log statistics', async () => {
    const mockResults = [
      mockActivityLogRow,
      { ...mockActivityLogRow, action_type: 'use', tokens_used: 500, cost_usd: 0.005 },
      { ...mockActivityLogRow, action_type: 'delete', status: 'success' },
    ];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await activityLogging.getActivityLogStats(mockTenantId);

    expect(result.totalOperations).toBe(3);
    expect(result.operationsByType.add).toBe(1);
    expect(result.operationsByType.use).toBe(1);
    expect(result.operationsByType.delete).toBe(1);
    expect(result.successRate).toBe(100);
    expect(result.failureRate).toBe(0);
  });

  it('should calculate statistics with mixed success/failure', async () => {
    const mockResults = [
      mockActivityLogRow,
      { ...mockActivityLogRow, status: 'failed' },
      { ...mockActivityLogRow, status: 'rate_limited' },
    ];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await activityLogging.getActivityLogStats(mockTenantId);

    expect(result.totalOperations).toBe(3);
    expect(result.operationsByStatus.success).toBe(1);
    expect(result.operationsByStatus.failed).toBe(1);
    expect(result.operationsByStatus.rate_limited).toBe(1);
    expect(result.successRate).toBeCloseTo(33.33, 1);
    expect(result.failureRate).toBeCloseTo(66.67, 1);
  });

  it('should calculate total costs correctly', async () => {
    const mockResults = [
      { ...mockActivityLogRow, cost_usd: 0.001, cost_pkr: 0.15 },
      { ...mockActivityLogRow, cost_usd: 0.002, cost_pkr: 0.30 },
      { ...mockActivityLogRow, cost_usd: 0.003, cost_pkr: 0.45 },
    ];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await activityLogging.getActivityLogStats(mockTenantId);

    expect(result.totalCostUsd).toBeCloseTo(0.006, 4);
    expect(result.totalCostPkr).toBeCloseTo(0.90, 2);
    expect(result.averageCostUsd).toBeCloseTo(0.002, 4);
  });

  it('should handle empty activity log', async () => {
    (queryMany as any).mockResolvedValue([]);

    const result = await activityLogging.getActivityLogStats(mockTenantId);

    expect(result.totalOperations).toBe(0);
    expect(result.successRate).toBe(0);
    expect(result.failureRate).toBe(0);
    expect(result.averageCostUsd).toBe(0);
  });
});

// ============================================================================
// UNIT TESTS: EXPORT
// ============================================================================

describe('Activity Logging - Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export activity log as CSV', async () => {
    const mockResults = [mockActivityLogRow];
    (queryMany as any).mockResolvedValue(mockResults);

    const csv = await activityLogging.exportActivityLogAsCSV(mockTenantId);

    expect(csv).toContain('ID');
    expect(csv).toContain('Timestamp');
    expect(csv).toContain('Action Type');
    expect(csv).toContain('Status');
    expect(csv).toContain(mockActivityLogRow.id);
    expect(csv).toContain('add');
    expect(csv).toContain('success');
  });

  it('should escape CSV values with commas', async () => {
    const mockResults = [
      {
        ...mockActivityLogRow,
        error_message: 'Error with, comma',
      },
    ];
    (queryMany as any).mockResolvedValue(mockResults);

    const csv = await activityLogging.exportActivityLogAsCSV(mockTenantId);

    expect(csv).toContain('"Error with, comma"');
  });

  it('should escape CSV values with quotes', async () => {
    const mockResults = [
      {
        ...mockActivityLogRow,
        error_message: 'Error with "quotes"',
      },
    ];
    (queryMany as any).mockResolvedValue(mockResults);

    const csv = await activityLogging.exportActivityLogAsCSV(mockTenantId);

    expect(csv).toContain('"Error with ""quotes"""');
  });

  it('should export activity log as JSON', async () => {
    const mockResults = [mockActivityLogRow];
    (queryMany as any).mockResolvedValue(mockResults);

    const json = await activityLogging.exportActivityLogAsJSON(mockTenantId);
    const parsed = JSON.parse(json);

    expect(parsed.entries).toHaveLength(1);
    expect(parsed.totalCount).toBe(1);
    expect(parsed.tenantId).toBe(mockTenantId);
    expect(parsed.exportedAt).toBeDefined();
  });

  it('should include all entry fields in JSON export', async () => {
    const mockResults = [mockActivityLogRow];
    (queryMany as any).mockResolvedValue(mockResults);

    const json = await activityLogging.exportActivityLogAsJSON(mockTenantId);
    const parsed = JSON.parse(json);

    const entry = parsed.entries[0];
    expect(entry.id).toBe(mockActivityLogRow.id);
    expect(entry.tenantId).toBe(mockActivityLogRow.tenant_id);
    expect(entry.keyId).toBe(mockActivityLogRow.key_id);
    expect(entry.actionType).toBe(mockActivityLogRow.action_type);
    expect(entry.status).toBe(mockActivityLogRow.status);
  });
});

// ============================================================================
// UNIT TESTS: IMMUTABILITY
// ============================================================================

describe('Activity Logging - Immutability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify activity log immutability', async () => {
    (queryOne as any).mockResolvedValue(mockActivityLogRow);

    const result = await activityLogging.verifyActivityLogImmutability(
      mockTenantId,
      mockActivityLogRow.id
    );

    expect(result).toBe(true);
  });

  it('should return false for non-existent entry', async () => {
    (queryOne as any).mockResolvedValue(null);

    const result = await activityLogging.verifyActivityLogImmutability(
      mockTenantId,
      'non-existent-id'
    );

    expect(result).toBe(false);
  });
});

// ============================================================================
// UNIT TESTS: MULTI-TENANT ISOLATION
// ============================================================================

describe('Activity Logging - Multi-Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should only retrieve logs for specified tenant', async () => {
    const mockResults = [mockActivityLogRow];
    (queryMany as any).mockResolvedValue(mockResults);

    const result = await activityLogging.getActivityLog(mockTenantId);

    expect(queryMany).toHaveBeenCalledWith(
      expect.stringContaining('tenant_id = $1'),
      expect.arrayContaining([mockTenantId])
    );
  });

  it('should not retrieve logs from other tenants', async () => {
    const otherTenantId = '550e8400-e29b-41d4-a716-446655440099';
    (queryMany as any).mockResolvedValue([]);

    const result = await activityLogging.getActivityLog(otherTenantId);

    expect(result).toHaveLength(0);
    expect(queryMany).toHaveBeenCalledWith(
      expect.stringContaining('tenant_id = $1'),
      expect.arrayContaining([otherTenantId])
    );
  });

  it('should filter by tenant when retrieving single entry', async () => {
    (queryOne as any).mockResolvedValue(mockActivityLogRow);

    await activityLogging.getActivityLogEntry(mockTenantId, mockActivityLogRow.id);

    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('tenant_id = $2'),
      [mockActivityLogRow.id, mockTenantId]
    );
  });
});

// ============================================================================
// UNIT TESTS: ERROR HANDLING
// ============================================================================

describe('Activity Logging - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle database errors gracefully', async () => {
    const error = new Error('Database connection failed');
    (query as any).mockRejectedValue(error);

    await expect(
      activityLogging.logKeyCreated(
        mockTenantId,
        mockKeyId,
        mockProviderId,
        'test@example.com'
      )
    ).rejects.toThrow('Database connection failed');
  });

  it('should handle empty query results', async () => {
    (query as any).mockResolvedValue([]);

    await expect(
      activityLogging.logKeyCreated(
        mockTenantId,
        mockKeyId,
        mockProviderId,
        'test@example.com'
      )
    ).rejects.toThrow('Failed to create activity log entry');
  });

  it('should handle retrieval errors gracefully', async () => {
    const error = new Error('Query failed');
    (queryMany as any).mockRejectedValue(error);

    await expect(
      activityLogging.getActivityLog(mockTenantId)
    ).rejects.toThrow('Query failed');
  });
});

// ============================================================================
// UNIT TESTS: ACTION DETAILS
// ============================================================================

describe('Activity Logging - Action Details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include provider_id in action details', async () => {
    const mockResult = [mockActivityLogRow];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyCreated(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      'test@example.com'
    );

    expect(result.actionDetails?.provider_id).toBe(mockProviderId);
  });

  it('should include email in action details for key creation', async () => {
    const mockResult = [{ ...mockActivityLogRow, action_details: { provider_id: mockProviderId, email_address: 'test@example.com' } }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyCreated(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      'test@example.com'
    );

    expect(result.actionDetails?.email_address).toBe('test@example.com');
  });

  it('should include rotation reason in action details', async () => {
    const newKeyId = '550e8400-e29b-41d4-a716-446655440005';
    const mockResult = [{ ...mockActivityLogRow, action_type: 'rotate', action_details: { provider_id: mockProviderId, previous_key_id: mockKeyId, new_key_id: newKeyId, reason: 'rate_limited' } }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyRotated(
      mockTenantId,
      mockKeyId,
      newKeyId,
      mockProviderId,
      'rate_limited'
    );

    expect(result.actionDetails?.reason).toBe('rate_limited');
    expect(result.actionDetails?.previous_key_id).toBe(mockKeyId);
    expect(result.actionDetails?.new_key_id).toBe(newKeyId);
  });

  it('should include test response time in action details', async () => {
    const mockResult = [{ ...mockActivityLogRow, action_type: 'test', action_details: { provider_id: mockProviderId, test_status: 'valid', response_time_ms: 250 } }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyTested(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      'valid',
      250
    );

    expect(result.actionDetails?.response_time_ms).toBe(250);
  });
});

// ============================================================================
// UNIT TESTS: COST TRACKING
// ============================================================================

describe('Activity Logging - Cost Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log costs in both USD and PKR', async () => {
    const mockResult = [mockActivityLogRow];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyUsed(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      1000,
      0.01,
      1.50,
      'success'
    );

    expect(result.costUsd).toBe(0.001);
    expect(result.costPkr).toBe(0.15);
  });

  it('should handle zero costs', async () => {
    const mockResult = [{ ...mockActivityLogRow, cost_usd: null, cost_pkr: null }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyUsed(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      0,
      0,
      0,
      'success'
    );

    expect(result.costUsd).toBeNull();
    expect(result.costPkr).toBeNull();
  });
});

// ============================================================================
// UNIT TESTS: USER ROLE TRACKING
// ============================================================================

describe('Activity Logging - User Role Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track Tenant Admin role', async () => {
    const mockResult = [mockActivityLogRow];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyCreated(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      'test@example.com',
      mockUserId,
      'Tenant Admin'
    );

    expect(result.userRole).toBe('Tenant Admin');
  });

  it('should track Super Admin role', async () => {
    const mockResult = [{ ...mockActivityLogRow, user_role: 'Super Admin' }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyCreated(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      'test@example.com',
      mockUserId,
      'Super Admin'
    );

    expect(result.userRole).toBe('Super Admin');
  });

  it('should track affected tenants for shared key operations', async () => {
    const affectedTenants = ['tenant-2', 'tenant-3'];
    const mockResult = [{ ...mockActivityLogRow, affected_tenants: affectedTenants }];
    (query as any).mockResolvedValue(mockResult);

    const result = await activityLogging.logKeyShared(
      mockTenantId,
      mockKeyId,
      mockProviderId,
      affectedTenants,
      mockUserId,
      'Super Admin'
    );

    expect(result.affectedTenants).toEqual(affectedTenants);
  });
});
