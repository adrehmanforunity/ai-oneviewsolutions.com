/**
 * API Key Management Routes
 * POST /api/keys - Create new API key
 * GET /api/keys - List all keys for tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryMany, query } from '@/lib/db';
import { encryptApiKey } from '@/lib/encryption';
import { maskApiKey } from '@/lib/masking';
import { validateEmail } from '@/lib/email-validation';
import { logKeyCreated } from '@/lib/activity-logging';
import { ApiKeyRow, ApiKeyResponse, CreateApiKeyRequest } from '@/lib/db/schema';

// ============================================================================
// POST /api/keys - Create new API key
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID and user info from request headers
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as 'Tenant Admin' | 'Super Admin' | 'Flow Designer' | null;

    if (!tenantId) {
      return NextResponse.json(
        { error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    if (!userId || !userRole) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'User authentication required' } },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CreateApiKeyRequest = await request.json();

    // Validate required fields
    if (!body.providerId || !body.keyValue || !body.emailAddress) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'providerId, keyValue, and emailAddress are required' } },
        { status: 400 }
      );
    }

    // Validate email format
    const emailValidation = validateEmail(body.emailAddress);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: { code: 'INVALID_EMAIL', message: emailValidation.error } },
        { status: 400 }
      );
    }

    // Verify provider exists
    const provider = await queryOne(
      'SELECT id FROM providers WHERE id = $1',
      [body.providerId]
    );

    if (!provider) {
      return NextResponse.json(
        { error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } },
        { status: 404 }
      );
    }

    // Encrypt the API key
    let encryptedKey: string;
    try {
      encryptedKey = encryptApiKey(body.keyValue);
    } catch (error) {
      console.error('Encryption error:', error);
      return NextResponse.json(
        { error: { code: 'ENCRYPTION_ERROR', message: 'Failed to encrypt API key' } },
        { status: 500 }
      );
    }

    // Insert the API key
    const result = await query<ApiKeyRow>(
      `INSERT INTO api_keys (
        id, tenant_id, provider_id, key_value_encrypted, email_address, label, 
        active, daily_usage_tokens, monthly_usage_tokens, health_status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, true, 0, 0, 'active', NOW(), NOW()
      )
      RETURNING *`,
      [tenantId, body.providerId, encryptedKey, body.emailAddress, body.label || null]
    );

    if (!result.rows[0]) {
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to create API key' } },
        { status: 500 }
      );
    }

    const keyRow = result.rows[0];

    // Log the operation
    try {
      await logKeyCreated(tenantId, keyRow.id, body.providerId, body.emailAddress, userId, userRole);
    } catch (error) {
      console.error('Logging error:', error);
      // Don't fail the request if logging fails
    }

    // Return masked response
    const response: ApiKeyResponse = {
      id: keyRow.id,
      tenantId: keyRow.tenant_id,
      providerId: keyRow.provider_id,
      maskedKey: maskApiKey(body.keyValue),
      emailAddress: keyRow.email_address,
      label: keyRow.label,
      active: keyRow.active,
      createdAt: keyRow.created_at,
      updatedAt: keyRow.updated_at,
      lastUsedAt: keyRow.last_used_at,
      dailyUsageTokens: keyRow.daily_usage_tokens,
      monthlyUsageTokens: keyRow.monthly_usage_tokens,
      healthStatus: keyRow.health_status,
      usagePercentage: 0,
    };

    return NextResponse.json({ success: true, data: response }, { status: 201 });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/keys - List all keys for tenant
// ============================================================================

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

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const providerId = searchParams.get('providerId');
    const activeOnly = searchParams.get('active') === 'true';

    // Build query
    let sql = `
      SELECT ak.*, p.name as provider_name
      FROM api_keys ak
      JOIN providers p ON ak.provider_id = p.id
      WHERE ak.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    // Add provider filter if provided
    if (providerId) {
      sql += ` AND ak.provider_id = $${paramIndex}`;
      params.push(providerId);
      paramIndex++;
    }

    // Add active filter if requested
    if (activeOnly) {
      sql += ` AND ak.active = true`;
    }

    sql += ` ORDER BY ak.created_at DESC`;

    // Execute query
    const keys = await queryMany<ApiKeyRow & { provider_name: string }>(sql, params);

    // Map to response format (mask all keys)
    const responses: ApiKeyResponse[] = keys.map(key => ({
      id: key.id,
      tenantId: key.tenant_id,
      providerId: key.provider_id,
      maskedKey: `...${key.key_value_encrypted.slice(-4)}`,  // Show last 4 chars of encrypted value
      emailAddress: key.email_address,
      label: key.label,
      active: key.active,
      createdAt: key.created_at,
      updatedAt: key.updated_at,
      lastUsedAt: key.last_used_at,
      dailyUsageTokens: key.daily_usage_tokens,
      monthlyUsageTokens: key.monthly_usage_tokens,
      healthStatus: key.health_status,
      usagePercentage: calculateUsagePercentage(key.monthly_usage_tokens),
    }));

    return NextResponse.json({ success: true, data: responses }, { status: 200 });
  } catch (error) {
    console.error('Error listing API keys:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate usage percentage (0-100)
 * Assumes monthly quota of 1,000,000 tokens
 */
function calculateUsagePercentage(tokensUsed: number): number {
  const monthlyQuota = 1000000;
  return Math.min(100, Math.round((tokensUsed / monthlyQuota) * 100));
}
