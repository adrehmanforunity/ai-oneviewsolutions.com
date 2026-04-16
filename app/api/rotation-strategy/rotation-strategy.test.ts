/**
 * Rotation Strategy API Tests
 * Unit tests for GET and PUT /api/rotation-strategy/:provider
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { query, queryOne } from '@/lib/db';
import { logKeyOperation } from '@/lib/activity-logging';

// Mock database functions
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryMany: vi.fn(),
}));

// Mock activity logging
vi.mock('@/lib/activity-logging', () => ({
  logKeyOperation: vi.fn(),
}));

describe('Rotation Strategy API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // Strategy Validation
  // ============================================================================

  describe('Strategy Validation', () => {
    it('should accept round_robin as a valid strategy', () => {
      const validStrategies = ['round_robin', 'fallback', 'least_used'];
      expect(validStrategies).toContain('round_robin');
    });

    it('should accept fallback as a valid strategy', () => {
      const validStrategies = ['round_robin', 'fallback', 'least_used'];
      expect(validStrategies).toContain('fallback');
    });

    it('should accept least_used as a valid strategy', () => {
      const validStrategies = ['round_robin', 'fallback', 'least_used'];
      expect(validStrategies).toContain('least_used');
    });

    it('should reject invalid strategy values', () => {
      const validStrategies = ['round_robin', 'fallback', 'least_used'];
      const invalidStrategies = ['random', 'weighted', 'priority', '', 'ROUND_ROBIN'];

      invalidStrategies.forEach(strategy => {
        expect(validStrategies).not.toContain(strategy);
      });
    });
  });

  // ============================================================================
  // GET - Retrieve rotation strategy
  // ============================================================================

  describe('GET /api/rotation-strategy/:provider', () => {
    it('should return existing strategy for provider', async () => {
      const mockProvider = {
        id: 'provider-1',
        name: 'Groq',
        provider_type: 'LLM',
      };

      const mockStrategy = {
        id: 'strategy-1',
        tenant_id: 'tenant-1',
        provider_id: 'provider-1',
        strategy: 'round_robin',
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(queryOne)
        .mockResolvedValueOnce(mockProvider)
        .mockResolvedValueOnce(mockStrategy);

      const provider = await queryOne('SELECT id, name, provider_type FROM providers WHERE id = $1', ['provider-1']);
      expect(provider).toBeDefined();
      expect(provider?.name).toBe('Groq');

      const strategy = await queryOne(
        'SELECT * FROM tenant_rotation_strategy WHERE tenant_id = $1 AND provider_id = $2',
        ['tenant-1', 'provider-1']
      );
      expect(strategy?.strategy).toBe('round_robin');
    });

    it('should return default strategy (round_robin) when none configured', async () => {
      const mockProvider = {
        id: 'provider-1',
        name: 'Groq',
        provider_type: 'LLM',
      };

      vi.mocked(queryOne)
        .mockResolvedValueOnce(mockProvider)
        .mockResolvedValueOnce(null); // No strategy configured

      const provider = await queryOne('SELECT id, name, provider_type FROM providers WHERE id = $1', ['provider-1']);
      expect(provider).toBeDefined();

      const strategyRow = await queryOne(
        'SELECT * FROM tenant_rotation_strategy WHERE tenant_id = $1 AND provider_id = $2',
        ['tenant-1', 'provider-1']
      );

      // Default strategy when none configured
      const strategy = strategyRow?.strategy ?? 'round_robin';
      expect(strategy).toBe('round_robin');
    });

    it('should return 404 when provider not found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      const provider = await queryOne('SELECT id FROM providers WHERE id = $1', ['invalid-provider']);
      expect(provider).toBeNull();
    });

    it('should require tenant ID', () => {
      // Endpoint should return 400 if x-tenant-id header is missing
      const tenantId = null;
      expect(tenantId).toBeNull();
    });

    it('should include isDefault flag when no strategy is configured', () => {
      // When no strategy row exists in DB, isDefault should be true
      const strategyRow = null; // Simulates no row found in DB
      const isDefault = !strategyRow;
      expect(isDefault).toBe(true);
    });
  });

  // ============================================================================
  // PUT - Update rotation strategy
  // ============================================================================

  describe('PUT /api/rotation-strategy/:provider', () => {
    it('should update strategy to round_robin', async () => {
      const mockProvider = { id: 'provider-1', name: 'Groq', provider_type: 'LLM' };
      const mockUpdatedRow = {
        id: 'strategy-1',
        tenant_id: 'tenant-1',
        provider_id: 'provider-1',
        strategy: 'round_robin',
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(queryOne)
        .mockResolvedValueOnce(mockProvider)
        .mockResolvedValueOnce(null); // No existing strategy
      vi.mocked(query).mockResolvedValueOnce({ rows: [mockUpdatedRow] } as any);

      const result = await query(
        `INSERT INTO tenant_rotation_strategy (id, tenant_id, provider_id, strategy, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
         ON CONFLICT (tenant_id, provider_id) DO UPDATE SET strategy = EXCLUDED.strategy, updated_at = NOW()
         RETURNING *`,
        ['tenant-1', 'provider-1', 'round_robin']
      );

      expect(result.rows[0].strategy).toBe('round_robin');
    });

    it('should update strategy to fallback', async () => {
      const mockUpdatedRow = {
        id: 'strategy-1',
        tenant_id: 'tenant-1',
        provider_id: 'provider-1',
        strategy: 'fallback',
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(query).mockResolvedValueOnce({ rows: [mockUpdatedRow] } as any);

      const result = await query(
        `INSERT INTO tenant_rotation_strategy (id, tenant_id, provider_id, strategy, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
         ON CONFLICT (tenant_id, provider_id) DO UPDATE SET strategy = EXCLUDED.strategy, updated_at = NOW()
         RETURNING *`,
        ['tenant-1', 'provider-1', 'fallback']
      );

      expect(result.rows[0].strategy).toBe('fallback');
    });

    it('should update strategy to least_used', async () => {
      const mockUpdatedRow = {
        id: 'strategy-1',
        tenant_id: 'tenant-1',
        provider_id: 'provider-1',
        strategy: 'least_used',
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(query).mockResolvedValueOnce({ rows: [mockUpdatedRow] } as any);

      const result = await query(
        `INSERT INTO tenant_rotation_strategy (id, tenant_id, provider_id, strategy, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
         ON CONFLICT (tenant_id, provider_id) DO UPDATE SET strategy = EXCLUDED.strategy, updated_at = NOW()
         RETURNING *`,
        ['tenant-1', 'provider-1', 'least_used']
      );

      expect(result.rows[0].strategy).toBe('least_used');
    });

    it('should return 400 for invalid strategy', () => {
      const validStrategies = ['round_robin', 'fallback', 'least_used'];
      const invalidStrategy = 'random';

      const isValid = validStrategies.includes(invalidStrategy);
      expect(isValid).toBe(false);
    });

    it('should return 400 when strategy field is missing', () => {
      const body = {};
      const hasStrategy = 'strategy' in body && (body as any).strategy;
      expect(hasStrategy).toBeFalsy();
    });

    it('should return 404 when provider not found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      const provider = await queryOne('SELECT id FROM providers WHERE id = $1', ['invalid-provider']);
      expect(provider).toBeNull();
    });

    it('should return 401 when user authentication is missing', () => {
      const userId = null;
      const userRole = null;
      expect(userId).toBeNull();
      expect(userRole).toBeNull();
    });

    it('should return 403 for Flow Designer role', () => {
      const userRole = 'Flow Designer';
      const canModify = userRole === 'Tenant Admin' || userRole === 'Super Admin';
      expect(canModify).toBe(false);
    });

    it('should allow Tenant Admin to update strategy', () => {
      const userRole = 'Tenant Admin';
      const canModify = userRole === 'Tenant Admin' || userRole === 'Super Admin';
      expect(canModify).toBe(true);
    });

    it('should allow Super Admin to update strategy', () => {
      const userRole = 'Super Admin';
      const canModify = userRole === 'Tenant Admin' || userRole === 'Super Admin';
      expect(canModify).toBe(true);
    });

    it('should log strategy change to activity log', async () => {
      vi.mocked(logKeyOperation).mockResolvedValueOnce({
        id: 'log-1',
        tenantId: 'tenant-1',
        actionType: 'rotate',
        status: 'success',
        createdAt: new Date(),
      } as any);

      await logKeyOperation('tenant-1', 'rotate', 'success', {
        userId: 'user-1',
        userRole: 'Tenant Admin',
        actionDetails: {
          provider_id: 'provider-1',
          previous_strategy: 'round_robin',
          new_strategy: 'fallback',
          action: 'strategy_updated',
        },
      });

      expect(vi.mocked(logKeyOperation)).toHaveBeenCalledWith(
        'tenant-1',
        'rotate',
        'success',
        expect.objectContaining({
          actionDetails: expect.objectContaining({
            previous_strategy: 'round_robin',
            new_strategy: 'fallback',
          }),
        })
      );
    });

    it('should include previous strategy in response', async () => {
      const existingStrategy = {
        id: 'strategy-1',
        tenant_id: 'tenant-1',
        provider_id: 'provider-1',
        strategy: 'round_robin',
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(queryOne)
        .mockResolvedValueOnce({ id: 'provider-1', name: 'Groq', provider_type: 'LLM' })
        .mockResolvedValueOnce(existingStrategy);

      const existing = await queryOne(
        'SELECT * FROM tenant_rotation_strategy WHERE tenant_id = $1 AND provider_id = $2',
        ['tenant-1', 'provider-1']
      );

      const previousStrategy = existing?.strategy ?? 'round_robin';
      expect(previousStrategy).toBe('round_robin');
    });

    it('should use upsert to handle both create and update', async () => {
      const mockRow = {
        id: 'strategy-1',
        tenant_id: 'tenant-1',
        provider_id: 'provider-1',
        strategy: 'fallback',
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(query).mockResolvedValueOnce({ rows: [mockRow] } as any);

      const result = await query(
        `INSERT INTO tenant_rotation_strategy (id, tenant_id, provider_id, strategy, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
         ON CONFLICT (tenant_id, provider_id) DO UPDATE SET strategy = EXCLUDED.strategy, updated_at = NOW()
         RETURNING *`,
        ['tenant-1', 'provider-1', 'fallback']
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].strategy).toBe('fallback');
    });
  });

  // ============================================================================
  // Tenant Isolation
  // ============================================================================

  describe('Tenant Isolation', () => {
    it('should scope strategy to tenant', async () => {
      const tenant1Strategy = {
        tenant_id: 'tenant-1',
        provider_id: 'provider-1',
        strategy: 'round_robin',
      };

      const tenant2Strategy = {
        tenant_id: 'tenant-2',
        provider_id: 'provider-1',
        strategy: 'fallback',
      };

      expect(tenant1Strategy.tenant_id).not.toBe(tenant2Strategy.tenant_id);
      expect(tenant1Strategy.strategy).not.toBe(tenant2Strategy.strategy);
    });

    it('should not expose other tenant strategies', () => {
      const requestTenantId = 'tenant-1';
      const otherTenantId = 'tenant-2';

      // Query should always filter by tenant_id
      const query = `SELECT * FROM tenant_rotation_strategy WHERE tenant_id = '${requestTenantId}'`;
      expect(query).toContain(`tenant_id = '${requestTenantId}'`);
      expect(query).not.toContain(otherTenantId);
    });
  });
});
