/**
 * Key Health Monitoring Service
 * Tracks API key status (active, rate_limited, invalid, expired)
 * Detects HTTP 429 and 401 responses
 * Implements automatic re-enabling when quota resets
 * Updates health status in real-time (within 1 second)
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import { query, queryOne, queryMany, withTransaction, PoolClient, transactionQuery } from '../db/index';
import { KeyHealthStatus, ApiKeyRow, ActivityLogRow } from '../db/schema';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Key health status information
 */
export interface KeyHealth {
  keyId: string;
  status: KeyHealthStatus;
  lastStatusChange?: Date;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  rateLimitResetTime?: Date;
  quotaPercentage?: number;
}

/**
 * HTTP response information for health detection
 */
export interface HttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: any;
  errorMessage?: string;
}

/**
 * Rate limit detection result
 */
export interface RateLimitDetection {
  isRateLimited: boolean;
  resetTime?: Date;
  retryAfter?: number;
}

/**
 * Invalid key detection result
 */
export interface InvalidKeyDetection {
  isInvalid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Health status update result
 */
export interface HealthStatusUpdate {
  keyId: string;
  previousStatus: KeyHealthStatus;
  newStatus: KeyHealthStatus;
  timestamp: Date;
  reason?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HTTP_RATE_LIMIT = 429;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;

const RATE_LIMIT_RESET_HEADER = 'retry-after';
const RATE_LIMIT_RESET_HEADER_ALT = 'x-ratelimit-reset';

// ============================================================================
// MAIN HEALTH TRACKING FUNCTION
// ============================================================================

/**
 * Track key health based on HTTP response
 * Detects rate limiting and invalid keys
 * Updates database status in real-time
 * 
 * @param keyId API key ID
 * @param tenantId Tenant ID
 * @param response HTTP response from provider API
 * @returns Health status update result
 */
export async function trackKeyHealth(
  keyId: string,
  tenantId: string,
  response: HttpResponse
): Promise<HealthStatusUpdate | null> {
  try {
    // Get current key status
    const currentKey = await queryOne<ApiKeyRow>(
      `SELECT * FROM api_keys WHERE id = $1 AND tenant_id = $2`,
      [keyId, tenantId]
    );

    if (!currentKey) {
      throw new Error(`Key not found: ${keyId}`);
    }

    const previousStatus = currentKey.health_status;
    let newStatus: KeyHealthStatus = previousStatus;
    let reason = '';

    // Detect rate limiting (HTTP 429)
    if (response.statusCode === HTTP_RATE_LIMIT) {
      const rateLimitDetection = detectRateLimit(response);
      if (rateLimitDetection.isRateLimited) {
        newStatus = 'rate_limited';
        reason = `Rate limited detected (HTTP 429)`;
      }
    }
    // Detect invalid key (HTTP 401)
    else if (response.statusCode === HTTP_UNAUTHORIZED) {
      const invalidDetection = detectInvalidKey(response);
      if (invalidDetection.isInvalid) {
        newStatus = 'invalid';
        reason = `Invalid key detected (HTTP 401): ${invalidDetection.errorMessage || 'Unauthorized'}`;
      }
    }
    // Detect other errors
    else if (response.statusCode === HTTP_FORBIDDEN) {
      newStatus = 'invalid';
      reason = `Forbidden (HTTP 403): ${response.errorMessage || 'Access denied'}`;
    }
    else if (response.statusCode === HTTP_NOT_FOUND) {
      newStatus = 'invalid';
      reason = `Not found (HTTP 404): ${response.errorMessage || 'Resource not found'}`;
    }
    else if (response.statusCode >= HTTP_SERVER_ERROR) {
      // Server errors don't change status, just log
      reason = `Server error (HTTP ${response.statusCode})`;
    }
    // Success response - mark as active if it was rate-limited
    else if (response.statusCode >= 200 && response.statusCode < 300) {
      if (previousStatus === 'rate_limited') {
        newStatus = 'active';
        reason = 'Quota reset, key recovered';
      }
    }

    // If status changed, update database
    if (newStatus !== previousStatus) {
      const update = await updateKeyHealth(keyId, tenantId, newStatus, reason);
      return update;
    }

    return null;
  } catch (error) {
    console.error('Error tracking key health:', error);
    throw error;
  }
}

// ============================================================================
// RATE LIMIT DETECTION
// ============================================================================

/**
 * Detect if HTTP response indicates rate limiting
 * Checks for HTTP 429 status code and rate limit headers
 * 
 * @param response HTTP response from provider API
 * @returns Rate limit detection result
 */
export function detectRateLimit(response: HttpResponse): RateLimitDetection {
  if (response.statusCode !== HTTP_RATE_LIMIT) {
    return { isRateLimited: false };
  }

  // Extract retry-after header (in seconds)
  const headers = response.headers || {};
  const retryAfterHeader = 
    headers[RATE_LIMIT_RESET_HEADER] || 
    headers[RATE_LIMIT_RESET_HEADER_ALT] ||
    headers['Retry-After'] ||
    headers['X-RateLimit-Reset'];

  let retryAfter: number | undefined;
  let resetTime: Date | undefined;

  if (retryAfterHeader) {
    // Try to parse as seconds (integer)
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) {
      retryAfter = seconds;
      resetTime = new Date(Date.now() + seconds * 1000);
    } else {
      // Try to parse as HTTP date
      const date = new Date(retryAfterHeader);
      if (!isNaN(date.getTime())) {
        resetTime = date;
        retryAfter = Math.ceil((date.getTime() - Date.now()) / 1000);
      }
    }
  }

  return {
    isRateLimited: true,
    resetTime,
    retryAfter,
  };
}

// ============================================================================
// INVALID KEY DETECTION
// ============================================================================

/**
 * Detect if HTTP response indicates invalid key
 * Checks for HTTP 401 status code and error messages
 * 
 * @param response HTTP response from provider API
 * @returns Invalid key detection result
 */
export function detectInvalidKey(response: HttpResponse): InvalidKeyDetection {
  if (response.statusCode !== HTTP_UNAUTHORIZED) {
    return { isInvalid: false };
  }

  // Extract error details from response body
  let errorCode = '';
  let errorMessage = response.errorMessage || 'Unauthorized';

  if (response.body) {
    if (typeof response.body === 'string') {
      errorMessage = response.body;
    } else if (typeof response.body === 'object') {
      errorCode = response.body.error_code || response.body.code || '';
      errorMessage = response.body.error_message || response.body.message || errorMessage;
    }
  }

  return {
    isInvalid: true,
    errorCode,
    errorMessage,
  };
}

// ============================================================================
// KEY STATUS MANAGEMENT
// ============================================================================

/**
 * Mark a key as rate-limited
 * Updates database and logs the event
 * 
 * @param keyId API key ID
 * @param tenantId Tenant ID
 * @param resetTime Optional time when quota resets
 * @returns Updated key health
 */
export async function markKeyRateLimited(
  keyId: string,
  tenantId: string,
  resetTime?: Date
): Promise<HealthStatusUpdate> {
  return updateKeyHealth(keyId, tenantId, 'rate_limited', 'Marked as rate-limited', resetTime);
}

/**
 * Disable an invalid key
 * Updates database and logs the event
 * 
 * @param keyId API key ID
 * @param tenantId Tenant ID
 * @param errorMessage Optional error message
 * @returns Updated key health
 */
export async function disableKey(
  keyId: string,
  tenantId: string,
  errorMessage?: string
): Promise<KeyHealth> {
  // Update key status to invalid and set active to false
  await query(
    `UPDATE api_keys 
     SET health_status = $1, active = false, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3`,
    ['invalid', keyId, tenantId]
  );

  // Log the event
  await logHealthStatusChange(
    keyId,
    tenantId,
    'invalid',
    `Key disabled: ${errorMessage || 'Invalid key detected'}`
  );

  return getKeyHealth(keyId, tenantId);
}

/**
 * Auto re-enable a key when quota resets
 * Checks if key was rate-limited and resets it to active
 * 
 * @param keyId API key ID
 * @param tenantId Tenant ID
 * @returns Updated key health
 */
export async function autoReenableKey(
  keyId: string,
  tenantId: string
): Promise<KeyHealth> {
  const key = await queryOne<ApiKeyRow>(
    `SELECT * FROM api_keys WHERE id = $1 AND tenant_id = $2`,
    [keyId, tenantId]
  );

  if (!key) {
    throw new Error(`Key not found: ${keyId}`);
  }

  // Only re-enable if currently rate-limited
  if (key.health_status === 'rate_limited') {
    await query(
      `UPDATE api_keys 
       SET health_status = $1, active = true, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      ['active', keyId, tenantId]
    );

    // Log the event
    await logHealthStatusChange(
      keyId,
      tenantId,
      'active',
      'Key re-enabled: quota reset'
    );
  }

  return getKeyHealth(keyId, tenantId);
}

// ============================================================================
// HEALTH STATUS RETRIEVAL
// ============================================================================

/**
 * Get current health status for a key
 * 
 * @param keyId API key ID
 * @param tenantId Tenant ID
 * @returns Key health information
 */
export async function getKeyHealth(
  keyId: string,
  tenantId: string
): Promise<KeyHealth> {
  const key = await queryOne<ApiKeyRow>(
    `SELECT * FROM api_keys WHERE id = $1 AND tenant_id = $2`,
    [keyId, tenantId]
  );

  if (!key) {
    throw new Error(`Key not found: ${keyId}`);
  }

  // Calculate quota percentage
  const quotaPercentage = key.daily_usage_tokens > 0 
    ? Math.min(100, (key.daily_usage_tokens / 1000000) * 100)
    : 0;

  return {
    keyId: key.id,
    status: key.health_status,
    lastStatusChange: key.updated_at,
    quotaPercentage,
  };
}

/**
 * Get health status for display in UI
 * Includes formatted status and warning indicators
 * 
 * @param keyId API key ID
 * @param tenantId Tenant ID
 * @returns Health status with display information
 */
export async function getHealthStatus(
  keyId: string,
  tenantId: string
): Promise<{
  status: KeyHealthStatus;
  statusLabel: string;
  statusColor: string;
  warningLevel: 'none' | 'warning' | 'critical';
  quotaPercentage: number;
  quotaLabel: string;
}> {
  const health = await getKeyHealth(keyId, tenantId);

  // Determine status label and color
  let statusLabel = 'Active';
  let statusColor = 'green';
  let warningLevel: 'none' | 'warning' | 'critical' = 'none';

  switch (health.status) {
    case 'active':
      statusLabel = 'Active';
      statusColor = 'green';
      break;
    case 'rate_limited':
      statusLabel = 'Rate Limited';
      statusColor = 'orange';
      warningLevel = 'warning';
      break;
    case 'invalid':
      statusLabel = 'Invalid';
      statusColor = 'red';
      warningLevel = 'critical';
      break;
    case 'expired':
      statusLabel = 'Expired';
      statusColor = 'red';
      warningLevel = 'critical';
      break;
  }

  // Determine quota warning level
  const quotaPercentage = health.quotaPercentage || 0;
  if (quotaPercentage >= 90) {
    warningLevel = 'critical';
  } else if (quotaPercentage >= 80) {
    warningLevel = 'warning';
  }

  const quotaLabel = `${Math.round(quotaPercentage)}% used`;

  return {
    status: health.status,
    statusLabel,
    statusColor,
    warningLevel,
    quotaPercentage,
    quotaLabel,
  };
}

// ============================================================================
// HEALTH STATUS UPDATE
// ============================================================================

/**
 * Update key health status in database
 * Updates status and logs the change
 * 
 * @param keyId API key ID
 * @param tenantId Tenant ID
 * @param newStatus New health status
 * @param reason Reason for status change
 * @param resetTime Optional rate limit reset time
 * @returns Health status update result
 */
export async function updateKeyHealth(
  keyId: string,
  tenantId: string,
  newStatus: KeyHealthStatus,
  reason?: string,
  resetTime?: Date
): Promise<HealthStatusUpdate> {
  return withTransaction(async (client) => {
    // Get current status
    const currentKey = await queryOne<ApiKeyRow>(
      `SELECT * FROM api_keys WHERE id = $1 AND tenant_id = $2`,
      [keyId, tenantId]
    );

    if (!currentKey) {
      throw new Error(`Key not found: ${keyId}`);
    }

    const previousStatus = currentKey.health_status;

    // Update key status
    await transactionQuery(
      client,
      `UPDATE api_keys 
       SET health_status = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [newStatus, keyId, tenantId]
    );

    // Log the status change
    await logHealthStatusChange(keyId, tenantId, newStatus, reason);

    const timestamp = new Date();

    return {
      keyId,
      previousStatus,
      newStatus,
      timestamp,
      reason,
    };
  });
}

// ============================================================================
// ACTIVITY LOGGING
// ============================================================================

/**
 * Log health status change to activity log
 * 
 * @param keyId API key ID
 * @param tenantId Tenant ID
 * @param newStatus New health status
 * @param reason Reason for status change
 */
async function logHealthStatusChange(
  keyId: string,
  tenantId: string,
  newStatus: KeyHealthStatus,
  reason?: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO activity_log (
        id, tenant_id, key_id, action_type, status, 
        action_details, error_message, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
      )`,
      [
        tenantId,
        keyId,
        'use',  // action_type
        'success',  // status
        JSON.stringify({ health_status: newStatus }),  // action_details
        reason || null,  // error_message
      ]
    );
  } catch (error) {
    console.error('Error logging health status change:', error);
    // Don't throw - logging failure shouldn't break the main flow
  }
}

// ============================================================================
// BATCH HEALTH OPERATIONS
// ============================================================================

/**
 * Get health status for all keys of a provider
 * 
 * @param tenantId Tenant ID
 * @param providerId Provider ID
 * @returns Array of key health information
 */
export async function getProviderKeyHealth(
  tenantId: string,
  providerId: string
): Promise<KeyHealth[]> {
  const keys = await queryMany<ApiKeyRow>(
    `SELECT * FROM api_keys 
     WHERE tenant_id = $1 AND provider_id = $2
     ORDER BY created_at ASC`,
    [tenantId, providerId]
  );

  return keys.map(key => ({
    keyId: key.id,
    status: key.health_status,
    lastStatusChange: key.updated_at,
    quotaPercentage: key.daily_usage_tokens > 0 
      ? Math.min(100, (key.daily_usage_tokens / 1000000) * 100)
      : 0,
  }));
}

/**
 * Get all rate-limited keys for a tenant
 * 
 * @param tenantId Tenant ID
 * @returns Array of rate-limited keys
 */
export async function getRateLimitedKeys(tenantId: string): Promise<KeyHealth[]> {
  const keys = await queryMany<ApiKeyRow>(
    `SELECT * FROM api_keys 
     WHERE tenant_id = $1 AND health_status = 'rate_limited'
     ORDER BY updated_at ASC`,
    [tenantId]
  );

  return keys.map(key => ({
    keyId: key.id,
    status: key.health_status,
    lastStatusChange: key.updated_at,
    quotaPercentage: key.daily_usage_tokens > 0 
      ? Math.min(100, (key.daily_usage_tokens / 1000000) * 100)
      : 0,
  }));
}

/**
 * Get all invalid keys for a tenant
 * 
 * @param tenantId Tenant ID
 * @returns Array of invalid keys
 */
export async function getInvalidKeys(tenantId: string): Promise<KeyHealth[]> {
  const keys = await queryMany<ApiKeyRow>(
    `SELECT * FROM api_keys 
     WHERE tenant_id = $1 AND health_status = 'invalid'
     ORDER BY updated_at ASC`,
    [tenantId]
  );

  return keys.map(key => ({
    keyId: key.id,
    status: key.health_status,
    lastStatusChange: key.updated_at,
    quotaPercentage: key.daily_usage_tokens > 0 
      ? Math.min(100, (key.daily_usage_tokens / 1000000) * 100)
      : 0,
  }));
}

/**
 * Get all active keys for a tenant
 * 
 * @param tenantId Tenant ID
 * @returns Array of active keys
 */
export async function getActiveKeys(tenantId: string): Promise<KeyHealth[]> {
  const keys = await queryMany<ApiKeyRow>(
    `SELECT * FROM api_keys 
     WHERE tenant_id = $1 AND health_status = 'active' AND active = true
     ORDER BY created_at ASC`,
    [tenantId]
  );

  return keys.map(key => ({
    keyId: key.id,
    status: key.health_status,
    lastStatusChange: key.updated_at,
    quotaPercentage: key.daily_usage_tokens > 0 
      ? Math.min(100, (key.daily_usage_tokens / 1000000) * 100)
      : 0,
  }));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  trackKeyHealth,
  detectRateLimit,
  detectInvalidKey,
  markKeyRateLimited,
  disableKey,
  autoReenableKey,
  getKeyHealth,
  getHealthStatus,
  updateKeyHealth,
  getProviderKeyHealth,
  getRateLimitedKeys,
  getInvalidKeys,
  getActiveKeys,
};


