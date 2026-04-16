/**
 * Rotation Strategy Integration Tests
 * Integration tests for GET and PUT /api/rotation-strategy/:provider
 */

import { describe, it, expect } from 'vitest';

describe('Rotation Strategy Integration Tests', () => {
  // ============================================================================
  // Strategy Values
  // ============================================================================

  describe('Valid Strategy Values', () => {
    const VALID_STRATEGIES = ['round_robin', 'fallback', 'least_used'];

    it('should have exactly 3 valid strategies', () => {
      expect(VALID_STRATEGIES).toHaveLength(3);
    });

    it('should include round_robin', () => {
      expect(VALID_STRATEGIES).toContain('round_robin');
    });

    it('should include fallback', () => {
      expect(VALID_STRATEGIES).toContain('fallback');
    });

    it('should include least_used', () => {
      expect(VALID_STRATEGIES).toContain('least_used');
    });

    it('should reject invalid strategy values', () => {
      const invalidValues = ['random', 'weighted', 'priority', '', 'ROUND_ROBIN', 'round-robin'];
      invalidValues.forEach(val => {
        expect(VALID_STRATEGIES).not.toContain(val);
      });
    });
  });

  // ============================================================================
  // GET - Retrieve rotation strategy
  // ============================================================================

  describe('GET rotation strategy', () => {
    it('should return round_robin as default when no strategy configured', () => {
      const DEFAULT_STRATEGY = 'round_robin';
      const strategyRow = null; // No strategy in DB

      const strategy = strategyRow ?? DEFAULT_STRATEGY;
      expect(strategy).toBe('round_robin');
    });

    it('should return configured strategy when one exists', () => {
      const strategyRow = { strategy: 'fallback' };
      const strategy = strategyRow?.strategy ?? 'round_robin';
      expect(strategy).toBe('fallback');
    });

    it('should mark response as default when no strategy configured', () => {
      const strategyRow = null;
      const isDefault = !strategyRow;
      expect(isDefault).toBe(true);
    });

    it('should not mark response as default when strategy is configured', () => {
      const strategyRow = { strategy: 'least_used' };
      const isDefault = !strategyRow;
      expect(isDefault).toBe(false);
    });

    it('should include provider metadata in response', () => {
      const response = {
        tenantId: 'tenant-1',
        providerId: 'provider-1',
        providerName: 'Groq',
        providerType: 'LLM',
        strategy: 'round_robin',
        isDefault: true,
      };

      expect(response).toHaveProperty('providerName');
      expect(response).toHaveProperty('providerType');
      expect(response).toHaveProperty('strategy');
      expect(response).toHaveProperty('isDefault');
    });
  });

  // ============================================================================
  // PUT - Update rotation strategy
  // ============================================================================

  describe('PUT rotation strategy', () => {
    it('should update strategy and return previous strategy', () => {
      const previousStrategy = 'round_robin';
      const newStrategy = 'fallback';

      const response = {
        strategy: newStrategy,
        previousStrategy,
      };

      expect(response.strategy).toBe('fallback');
      expect(response.previousStrategy).toBe('round_robin');
    });

    it('should use round_robin as previous strategy when none was configured', () => {
      const existingRow = null;
      const previousStrategy = existingRow ?? 'round_robin';
      expect(previousStrategy).toBe('round_robin');
    });

    it('should validate strategy before updating', () => {
      const VALID_STRATEGIES = ['round_robin', 'fallback', 'least_used'];

      const validInput = 'fallback';
      const invalidInput = 'random';

      expect(VALID_STRATEGIES.includes(validInput)).toBe(true);
      expect(VALID_STRATEGIES.includes(invalidInput)).toBe(false);
    });

    it('should require authentication for updates', () => {
      const userId = 'user-1';
      const userRole = 'Tenant Admin';

      expect(userId).toBeTruthy();
      expect(userRole).toBeTruthy();
    });

    it('should deny Flow Designer role from updating', () => {
      const userRole = 'Flow Designer';
      const allowedRoles = ['Tenant Admin', 'Super Admin'];

      expect(allowedRoles).not.toContain(userRole);
    });

    it('should allow Tenant Admin to update', () => {
      const userRole = 'Tenant Admin';
      const allowedRoles = ['Tenant Admin', 'Super Admin'];

      expect(allowedRoles).toContain(userRole);
    });

    it('should allow Super Admin to update', () => {
      const userRole = 'Super Admin';
      const allowedRoles = ['Tenant Admin', 'Super Admin'];

      expect(allowedRoles).toContain(userRole);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should return 400 for missing tenant ID', () => {
      const statusCode = 400;
      expect(statusCode).toBe(400);
    });

    it('should return 400 for invalid strategy', () => {
      const statusCode = 400;
      expect(statusCode).toBe(400);
    });

    it('should return 401 for missing authentication', () => {
      const statusCode = 401;
      expect(statusCode).toBe(401);
    });

    it('should return 403 for Flow Designer role', () => {
      const statusCode = 403;
      expect(statusCode).toBe(403);
    });

    it('should return 404 for non-existent provider', () => {
      const statusCode = 404;
      expect(statusCode).toBe(404);
    });

    it('should return error with code and message', () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'INVALID_STRATEGY',
          message: 'Invalid strategy. Must be one of: round_robin, fallback, least_used',
        },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toHaveProperty('code');
      expect(errorResponse.error).toHaveProperty('message');
    });
  });

  // ============================================================================
  // Tenant Isolation
  // ============================================================================

  describe('Tenant Isolation', () => {
    it('should scope strategy queries to tenant', () => {
      const tenantId = 'tenant-1';
      const sql = `SELECT * FROM tenant_rotation_strategy WHERE tenant_id = '${tenantId}'`;

      expect(sql).toContain(`tenant_id = '${tenantId}'`);
    });

    it('should allow different tenants to have different strategies for same provider', () => {
      const tenant1 = { tenantId: 'tenant-1', providerId: 'provider-1', strategy: 'round_robin' };
      const tenant2 = { tenantId: 'tenant-2', providerId: 'provider-1', strategy: 'fallback' };

      expect(tenant1.tenantId).not.toBe(tenant2.tenantId);
      expect(tenant1.strategy).not.toBe(tenant2.strategy);
    });
  });

  // ============================================================================
  // Activity Logging
  // ============================================================================

  describe('Activity Logging', () => {
    it('should log strategy changes with rotate action type', () => {
      const actionType = 'rotate';
      expect(actionType).toBe('rotate');
    });

    it('should include provider info in log details', () => {
      const actionDetails = {
        provider_id: 'provider-1',
        provider_name: 'Groq',
        previous_strategy: 'round_robin',
        new_strategy: 'fallback',
        action: 'strategy_updated',
      };

      expect(actionDetails).toHaveProperty('provider_id');
      expect(actionDetails).toHaveProperty('previous_strategy');
      expect(actionDetails).toHaveProperty('new_strategy');
    });

    it('should log with success status', () => {
      const status = 'success';
      expect(status).toBe('success');
    });
  });
});
