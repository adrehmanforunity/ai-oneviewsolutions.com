/**
 * API Key Testing Route
 * POST /api/keys/:id/test - Test key validity
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query, verifyResourceAccess } from '@/lib/db';
import { decryptApiKey } from '@/lib/encryption';
import { logKeyTested } from '@/lib/activity-logging';
import { ApiKeyRow, TestKeyResponse } from '@/lib/db/schema';

// ============================================================================
// POST /api/keys/:id/test - Test key validity
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as 'Tenant Admin' | 'Super Admin' | 'Flow Designer' | null;
    const keyId = params.id;

    if (!tenantId) {
      return NextResponse.json(
        { error: { code: 'MISSING_TENANT', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    // Verify tenant has access to this key
    const hasAccess = await verifyResourceAccess(keyId, tenantId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Get the key
    const keyRow = await queryOne<ApiKeyRow & { provider_name: string; api_endpoint: string }>(
      `SELECT ak.*, p.name as provider_name, p.api_endpoint
       FROM api_keys ak
       JOIN providers p ON ak.provider_id = p.id
       WHERE ak.id = $1`,
      [keyId]
    );

    if (!keyRow) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Key not found' } },
        { status: 404 }
      );
    }

    // Decrypt the key
    let decryptedKey: string;
    try {
      decryptedKey = decryptApiKey(keyRow.key_value_encrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      return NextResponse.json(
        { error: { code: 'DECRYPTION_ERROR', message: 'Failed to decrypt API key' } },
        { status: 500 }
      );
    }

    // Test the key with the provider API
    const startTime = Date.now();
    let testStatus: 'valid' | 'invalid' | 'rate_limited' = 'valid';
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    let rateLimitResetTime: Date | undefined;

    try {
      // Send minimal test request to provider API
      const testResponse = await testProviderKey(
        keyRow.provider_name,
        keyRow.api_endpoint,
        decryptedKey,
        3000  // 3 second timeout
      );

      testStatus = testResponse.status;
      errorCode = testResponse.errorCode;
      errorMessage = testResponse.errorMessage;
      rateLimitResetTime = testResponse.rateLimitResetTime;
    } catch (error) {
      testStatus = 'invalid';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    const responseTimeMs = Date.now() - startTime;

    // Log the test
    try {
      await logKeyTested(
        tenantId,
        keyId,
        keyRow.provider_id,
        testStatus,
        responseTimeMs,
        errorMessage,
        userId || undefined,
        userRole || undefined
      );
    } catch (error) {
      console.error('Logging error:', error);
    }

    // Return test result
    const response: TestKeyResponse = {
      status: testStatus,
      responseTimeMs,
      providerName: keyRow.provider_name,
      errorCode,
      errorMessage,
      rateLimitResetTime,
    };

    return NextResponse.json({ success: true, data: response }, { status: 200 });
  } catch (error) {
    console.error('Error testing API key:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

interface TestProviderResponse {
  status: 'valid' | 'invalid' | 'rate_limited';
  errorCode?: string;
  errorMessage?: string;
  rateLimitResetTime?: Date;
}

/**
 * Test API key with provider
 * Sends minimal test request to verify key validity
 */
async function testProviderKey(
  providerName: string,
  apiEndpoint: string,
  apiKey: string,
  timeoutMs: number
): Promise<TestProviderResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let testUrl: string;
    let testOptions: RequestInit;

    // Provider-specific test requests
    switch (providerName.toLowerCase()) {
      case 'groq':
        testUrl = `${apiEndpoint}chat/completions`;
        testOptions = {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 10,
          }),
          signal: controller.signal,
        };
        break;

      case 'openai':
        testUrl = `${apiEndpoint}chat/completions`;
        testOptions = {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 10,
          }),
          signal: controller.signal,
        };
        break;

      case 'claude':
        testUrl = `${apiEndpoint}messages`;
        testOptions = {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-opus-4-1-20250805',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'test' }],
          }),
          signal: controller.signal,
        };
        break;

      case 'elevenlabs':
        testUrl = `${apiEndpoint}voices`;
        testOptions = {
          method: 'GET',
          headers: {
            'xi-api-key': apiKey,
          },
          signal: controller.signal,
        };
        break;

      case 'uplift ai':
        testUrl = `${apiEndpoint}voices`;
        testOptions = {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          signal: controller.signal,
        };
        break;

      default:
        // Generic test for unknown providers
        testUrl = apiEndpoint;
        testOptions = {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          signal: controller.signal,
        };
    }

    const response = await fetch(testUrl, testOptions);

    // Check response status
    if (response.status === 200 || response.status === 201) {
      return { status: 'valid' };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        status: 'invalid',
        errorCode: String(response.status),
        errorMessage: 'Invalid API key',
      };
    }

    if (response.status === 429) {
      // Extract rate limit reset time if available
      const retryAfter = response.headers.get('retry-after');
      const rateLimitResetTime = retryAfter
        ? new Date(Date.now() + parseInt(retryAfter) * 1000)
        : undefined;

      return {
        status: 'rate_limited',
        errorCode: '429',
        errorMessage: 'Rate limited',
        rateLimitResetTime,
      };
    }

    // Other error status
    const errorText = await response.text().catch(() => 'Unknown error');
    return {
      status: 'invalid',
      errorCode: String(response.status),
      errorMessage: errorText || 'Provider API error',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        status: 'invalid',
        errorCode: 'TIMEOUT',
        errorMessage: 'Test request timeout',
      };
    }

    return {
      status: 'invalid',
      errorCode: 'NETWORK_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Network error',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
