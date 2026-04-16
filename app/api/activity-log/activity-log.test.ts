/**
 * Unit Tests for Activity Log API Endpoints
 * Tests for GET /api/activity-log, GET /api/activity-log/:id, POST /api/activity-log/export
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { queryMany, queryCount, queryOne } from '@/lib/db';

// Mock the database module
vi.mock('@/lib/db', () => ({
  queryMany: vi.fn(),
  queryCount: vi.fn(),
  queryOne: vi.fn(),
  query: vi.fn(),
}));

describe('Activity Log API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/activity-log - List activity log entries', () => {
    it('should return 400 if tenant ID is missing', async () => {
      const { GET } = await import('./route');
      const request = new Request('http://localhost:3000/api/activity-log', {
        method: 'GET',
      });

      const response = await GET(request as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('MISSING_TENANT');
    });

    it('should return activity log entries for a tenant', async () => {
      const mockEntries = [
        {
          id: '1',
          tenant_id: 'tenant-1',
          key_id: 'key-1',
          action_type: 'use',
          action_details: { provider_id: 'provider-1' },
          tokens_used: 100,
          cost_usd: 0.001,
          cost_pkr: 0.15,
          status: 'success',
          error_message: null,
          user_id: 'user-1',
          user_role: 'Tenant Admin',
          primary_tenant_id: null,
          affected_tenants: null,
          created_at: new Date('2024-01-01'),
          provider_id: 'provider-1',
          provider_name: 'Groq',
          key_label: 'Production Key',
        },
      ];

      (queryMany as any).mockResolvedValue(mockEntries);
      (queryCount as any).mockResolvedValue(1);

      const { GET } = await import('./route');
      const request = new Request('http://localhost:3000/api/activity-log', {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-1',
        },
      });

      const response = await GET(request as any);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.items).toHaveLength(1);
      expect(data.data.items[0].actionType).toBe('use');
      expect(data.data.total).toBe(1);
    });

    it('should filter by provider ID', async () => {
      const mockEntries = [
        {
          id: '1',
          tenant_id: 'tenant-1',
          key_id: 'key-1',
          action_type: 'use',
          action_details: { provider_id: 'provider-1' },
          tokens_used: 100,
          cost_usd: 0.001,
          cost_pkr: 0.15,
          status: 'success',
          error_message: null,
          user_id: 'user-1',
          user_role: 'Tenant Admin',
          primary_tenant_id: null,
          affected_tenants: null,
          created_at: new Date('2024-01-01'),
          provider_id: 'provider-1',
          provider_name: 'Groq',
          key_label: 'Production Key',
        },
      ];

      (queryMany as any).mockResolvedValue(mockEntries);
      (queryCount as any).mockResolvedValue(1);

      const { GET } = await import('./route');
      const request = new Request(
        'http://localhost:3000/api/activity-log?providerId=provider-1',
        {
          method: 'GET',
          headers: {
            'x-tenant-id': 'tenant-1',
          },
        }
      );

      const response = await GET(request as any);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.items).toHaveLength(1);
    });

    it('should filter by action type', async () => {
      const mockEntries = [
        {
          id: '1',
          tenant_id: 'tenant-1',
          key_id: 'key-1',
          action_type: 'test',
          action_details: { provider_id: 'provider-1' },
          tokens_used: null,
          cost_usd: null,
          cost_pkr: null,
          status: 'success',
          error_message: null,
          user_id: 'user-1',
          user_role: 'Tenant Admin',
          primary_tenant_id: null,
          affected_tenants: null,
          created_at: new Date('2024-01-01'),
          provider_id: 'provider-1',
          provider_name: 'Groq',
          key_label: 'Production Key',
        },
      ];

      (queryMany as any).mockResolvedValue(mockEntries);
      (queryCount as any).mockResolvedValue(1);

      const { GET } = await import('./route');
      const request = new Request(
        'http://localhost:3000/api/activity-log?actionType=test',
        {
          method: 'GET',
          headers: {
            'x-tenant-id': 'tenant-1',
          },
        }
      );

      const response = await GET(request as any);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.items[0].actionType).toBe('test');
    });

    it('should filter by status', async () => {
      const mockEntries = [
        {
          id: '1',
          tenant_id: 'tenant-1',
          key_id: 'key-1',
          action_type: 'use',
          action_details: { provider_id: 'provider-1' },
          tokens_used: 100,
          cost_usd: 0.001,
          cost_pkr: 0.15,
          status: 'failed',
          error_message: 'Rate limited',
          user_id: 'user-1',
          user_role: 'Tenant Admin',
          primary_tenant_id: null,
          affected_tenants: null,
          created_at: new Date('2024-01-01'),
          provider_id: 'provider-1',
          provider_name: 'Groq',
          key_label: 'Production Key',
        },
      ];

      (queryMany as any).mockResolvedValue(mockEntries);
      (queryCount as any).mockResolvedValue(1);

      const { GET } = await import('./route');
      const request = new Request(
        'http://localhost:3000/api/activity-log?status=failed',
        {
          method: 'GET',
          headers: {
            'x-tenant-id': 'tenant-1',
          },
        }
      );

      const response = await GET(request as any);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.items[0].status).toBe('failed');
    });

    it('should support pagination with limit and offset', async () => {
      const mockEntries = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        tenant_id: 'tenant-1',
        key_id: 'key-1',
        action_type: 'use',
        action_details: { provider_id: 'provider-1' },
        tokens_used: 100,
        cost_usd: 0.001,
        cost_pkr: 0.15,
        status: 'success',
        error_message: null,
        user_id: 'user-1',
        user_role: 'Tenant Admin',
        primary_tenant_id: null,
        affected_tenants: null,
        created_at: new Date('2024-01-01'),
        provider_id: 'provider-1',
        provider_name: 'Groq',
        key_label: 'Production Key',
      }));

      (queryMany as any).mockResolvedValue(mockEntries.slice(0, 10));
      (queryCount as any).mockResolvedValue(100);

      const { GET } = await import('./route');
      const request = new Request(
        'http://localhost:3000/api/activity-log?limit=10&offset=0',
        {
          method: 'GET',
          headers: {
            'x-tenant-id': 'tenant-1',
          },
        }
      );

      const response = await GET(request as any);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.items).toHaveLength(10);
      expect(data.data.limit).toBe(10);
      expect(data.data.offset).toBe(0);
      expect(data.data.total).toBe(100);
    });

    it('should filter by date range', async () => {
      const mockEntries = [
        {
          id: '1',
          tenant_id: 'tenant-1',
          key_id: 'key-1',
          action_type: 'use',
          action_details: { provider_id: 'provider-1' },
          tokens_used: 100,
          cost_usd: 0.001,
          cost_pkr: 0.15,
          status: 'success',
          error_message: null,
          user_id: 'user-1',
          user_role: 'Tenant Admin',
          primary_tenant_id: null,
          affected_tenants: null,
          created_at: new Date('2024-01-15'),
          provider_id: 'provider-1',
          provider_name: 'Groq',
          key_label: 'Production Key',
        },
      ];

      (queryMany as any).mockResolvedValue(mockEntries);
      (queryCount as any).mockResolvedValue(1);

      const { GET } = await import('./route');
      const request = new Request(
        'http://localhost:3000/api/activity-log?dateFrom=2024-01-01&dateTo=2024-01-31',
        {
          method: 'GET',
          headers: {
            'x-tenant-id': 'tenant-1',
          },
        }
      );

      const response = await GET(request as any);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.items).toHaveLength(1);
    });

    it('should include user role and affected tenants in response', async () => {
      const mockEntries = [
        {
          id: '1',
          tenant_id: 'tenant-1',
          key_id: 'key-1',
          action_type: 'share',
          action_details: { shared_tenant_ids: ['tenant-2', 'tenant-3'] },
          tokens_used: null,
          cost_usd: null,
          cost_pkr: null,
          status: 'success',
          error_message: null,
          user_id: 'user-1',
          user_role: 'Super Admin',
          primary_tenant_id: 'tenant-1',
          affected_tenants: ['tenant-2', 'tenant-3'],
          created_at: new Date('2024-01-01'),
          provider_id: 'provider-1',
          provider_name: 'Groq',
          key_label: 'Production Key',
        },
      ];

      (queryMany as any).mockResolvedValue(mockEntries);
      (queryCount as any).mockResolvedValue(1);

      const { GET } = await import('./route');
      const request = new Request('http://localhost:3000/api/activity-log', {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-1',
        },
      });

      const response = await GET(request as any);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.items[0].userRole).toBe('Super Admin');
      expect(data.data.items[0].affectedTenants).toEqual(['tenant-2', 'tenant-3']);
    });
  });

  describe('GET /api/activity-log/:id - Get single log entry', () => {
    it('should return 400 if tenant ID is missing', async () => {
      const { GET } = await import('./[id]/route');
      const request = new Request('http://localhost:3000/api/activity-log/1', {
        method: 'GET',
      });

      const response = await GET(request as any, { params: { id: '1' } });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('MISSING_TENANT');
    });

    it('should return 404 if entry not found', async () => {
      (queryOne as any).mockResolvedValue(null);

      const { GET } = await import('./[id]/route');
      const request = new Request('http://localhost:3000/api/activity-log/1', {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-1',
        },
      });

      const response = await GET(request as any, { params: { id: '1' } });
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should return single activity log entry', async () => {
      const mockEntry = {
        id: '1',
        tenant_id: 'tenant-1',
        key_id: 'key-1',
        action_type: 'use',
        action_details: { provider_id: 'provider-1' },
        tokens_used: 100,
        cost_usd: 0.001,
        cost_pkr: 0.15,
        status: 'success',
        error_message: null,
        user_id: 'user-1',
        user_role: 'Tenant Admin',
        primary_tenant_id: null,
        affected_tenants: null,
        created_at: new Date('2024-01-01'),
        provider_id: 'provider-1',
        provider_name: 'Groq',
        key_label: 'Production Key',
      };

      (queryOne as any).mockResolvedValue(mockEntry);

      const { GET } = await import('./[id]/route');
      const request = new Request('http://localhost:3000/api/activity-log/1', {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-1',
        },
      });

      const response = await GET(request as any, { params: { id: '1' } });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('1');
      expect(data.data.actionType).toBe('use');
    });

    it('should include user information and affected tenants', async () => {
      const mockEntry = {
        id: '1',
        tenant_id: 'tenant-1',
        key_id: 'key-1',
        action_type: 'share',
        action_details: { shared_tenant_ids: ['tenant-2'] },
        tokens_used: null,
        cost_usd: null,
        cost_pkr: null,
        status: 'success',
        error_message: null,
        user_id: 'user-1',
        user_role: 'Super Admin',
        primary_tenant_id: 'tenant-1',
        affected_tenants: ['tenant-2'],
        created_at: new Date('2024-01-01'),
        provider_id: 'provider-1',
        provider_name: 'Groq',
        key_label: 'Production Key',
      };

      (queryOne as any).mockResolvedValue(mockEntry);

      const { GET } = await import('./[id]/route');
      const request = new Request('http://localhost:3000/api/activity-log/1', {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-1',
        },
      });

      const response = await GET(request as any, { params: { id: '1' } });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.userId).toBe('user-1');
      expect(data.data.userRole).toBe('Super Admin');
      expect(data.data.affectedTenants).toEqual(['tenant-2']);
    });
  });

  describe('POST /api/activity-log/export - Export activity log as CSV', () => {
    it('should return 400 if tenant ID is missing', async () => {
      const { POST } = await import('./export/route');
      const request = new Request('http://localhost:3000/api/activity-log/export', {
        method: 'POST',
      });

      const response = await POST(request as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('MISSING_TENANT');
    });

    it('should return 400 if format is not CSV', async () => {
      const { POST } = await import('./export/route');
      const request = new Request(
        'http://localhost:3000/api/activity-log/export?format=json',
        {
          method: 'POST',
          headers: {
            'x-tenant-id': 'tenant-1',
          },
        }
      );

      const response = await POST(request as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('INVALID_FORMAT');
    });

    it('should export activity log as CSV', async () => {
      const mockEntries = [
        {
          id: '1',
          tenant_id: 'tenant-1',
          key_id: 'key-1',
          action_type: 'use',
          action_details: { provider_id: 'provider-1' },
          tokens_used: 100,
          cost_usd: 0.001,
          cost_pkr: 0.15,
          status: 'success',
          error_message: null,
          user_id: 'user-1',
          user_role: 'Tenant Admin',
          primary_tenant_id: null,
          affected_tenants: null,
          created_at: new Date('2024-01-01T00:00:00Z'),
          provider_id: 'provider-1',
          provider_name: 'Groq',
          key_label: 'Production Key',
          email_address: 'user@example.com',
        },
      ];

      (queryMany as any).mockResolvedValue(mockEntries);

      const { POST } = await import('./export/route');
      const request = new Request('http://localhost:3000/api/activity-log/export?format=csv', {
        method: 'POST',
        headers: {
          'x-tenant-id': 'tenant-1',
        },
      });

      const response = await POST(request as any);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/csv');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');

      const csv = await response.text();
      expect(csv).toContain('Timestamp');
      expect(csv).toContain('User');
      expect(csv).toContain('Role');
      expect(csv).toContain('Provider');
      expect(csv).toContain('Key Label');
      expect(csv).toContain('Action');
      expect(csv).toContain('Status');
      expect(csv).toContain('Tokens');
      expect(csv).toContain('Cost (USD)');
      expect(csv).toContain('Cost (PKR)');
      expect(csv).toContain('Error');
    });

    it('should filter by provider ID in export', async () => {
      const mockEntries = [
        {
          id: '1',
          tenant_id: 'tenant-1',
          key_id: 'key-1',
          action_type: 'use',
          action_details: { provider_id: 'provider-1' },
          tokens_used: 100,
          cost_usd: 0.001,
          cost_pkr: 0.15,
          status: 'success',
          error_message: null,
          user_id: 'user-1',
          user_role: 'Tenant Admin',
          primary_tenant_id: null,
          affected_tenants: null,
          created_at: new Date('2024-01-01T00:00:00Z'),
          provider_id: 'provider-1',
          provider_name: 'Groq',
          key_label: 'Production Key',
          email_address: 'user@example.com',
        },
      ];

      (queryMany as any).mockResolvedValue(mockEntries);

      const { POST } = await import('./export/route');
      const request = new Request(
        'http://localhost:3000/api/activity-log/export?format=csv&providerId=provider-1',
        {
          method: 'POST',
          headers: {
            'x-tenant-id': 'tenant-1',
          },
        }
      );

      const response = await POST(request as any);
      expect(response.status).toBe(200);
      const csv = await response.text();
      expect(csv).toContain('Groq');
    });

    it('should filter by date range in export', async () => {
      const mockEntries = [
        {
          id: '1',
          tenant_id: 'tenant-1',
          key_id: 'key-1',
          action_type: 'use',
          action_details: { provider_id: 'provider-1' },
          tokens_used: 100,
          cost_usd: 0.001,
          cost_pkr: 0.15,
          status: 'success',
          error_message: null,
          user_id: 'user-1',
          user_role: 'Tenant Admin',
          primary_tenant_id: null,
          affected_tenants: null,
          created_at: new Date('2024-01-15T00:00:00Z'),
          provider_id: 'provider-1',
          provider_name: 'Groq',
          key_label: 'Production Key',
          email_address: 'user@example.com',
        },
      ];

      (queryMany as any).mockResolvedValue(mockEntries);

      const { POST } = await import('./export/route');
      const request = new Request(
        'http://localhost:3000/api/activity-log/export?format=csv&dateFrom=2024-01-01&dateTo=2024-01-31',
        {
          method: 'POST',
          headers: {
            'x-tenant-id': 'tenant-1',
          },
        }
      );

      const response = await POST(request as any);
      expect(response.status).toBe(200);
      const csv = await response.text();
      expect(csv).toContain('2024-01-15');
    });

    it('should escape CSV values with commas and quotes', async () => {
      const mockEntries = [
        {
          id: '1',
          tenant_id: 'tenant-1',
          key_id: 'key-1',
          action_type: 'use',
          action_details: { provider_id: 'provider-1' },
          tokens_used: 100,
          cost_usd: 0.001,
          cost_pkr: 0.15,
          status: 'success',
          error_message: 'Error with "quotes" and, commas',
          user_id: 'user-1',
          user_role: 'Tenant Admin',
          primary_tenant_id: null,
          affected_tenants: null,
          created_at: new Date('2024-01-01T00:00:00Z'),
          provider_id: 'provider-1',
          provider_name: 'Groq',
          key_label: 'Production Key',
          email_address: 'user@example.com',
        },
      ];

      (queryMany as any).mockResolvedValue(mockEntries);

      const { POST } = await import('./export/route');
      const request = new Request('http://localhost:3000/api/activity-log/export?format=csv', {
        method: 'POST',
        headers: {
          'x-tenant-id': 'tenant-1',
        },
      });

      const response = await POST(request as any);
      expect(response.status).toBe(200);
      const csv = await response.text();
      // CSV should escape the error message
      expect(csv).toContain('"Error with ""quotes"" and, commas"');
    });
  });
});
