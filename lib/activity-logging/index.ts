/**
 * Activity Logging Service
 * Provides immutable append-only activity log for all key operations
 * 
 * Features:
 * - Log all key operations (add, delete, test, rotate, enable, disable, use, share, unshare)
 * - Include comprehensive metadata: tenant_id, timestamp, user_id, provider, key_id, action_type, status, cost
 * - Ensure logs cannot be edited or deleted (database triggers enforce immutability)
 * - Support filtering and querying logs by various criteria
 * - Integrate with all other services (key management, rotation, health monitoring)
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.8, 6.9
 */

import { query, queryOne, queryMany } from '../db/index';
import { ActivityLogRow, ActivityActionType, ActivityStatus, UserRole } from '../db/schema';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Activity log entry for API responses
 */
export interface ActivityLogEntry {
  id: string;
  tenantId: string;
  keyId?: string;
  actionType: ActivityActionType;
  actionDetails?: Record<string, any>;
  tokensUsed?: number;
  costUsd?: number;
  costPkr?: number;
  status: ActivityStatus;
  errorMessage?: string;
  userId?: string;
  userRole?: UserRole;
  primaryTenantId?: string;
  affectedTenants?: string[];
  createdAt: Date;
}

/**
 * Activity log filter options
 */
export interface ActivityLogFilter {
  providerId?: string;
  keyId?: string;
  actionType?: ActivityActionType;
  status?: ActivityStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Activity log statistics
 */
export interface ActivityLogStats {
  totalOperations: number;
  operationsByType: Record<ActivityActionType, number>;
  operationsByStatus: Record<ActivityStatus, number>;
  operationsByProvider: Record<string, number>;
  successRate: number;  // percentage
  failureRate: number;  // percentage
  averageCostUsd: number;
  totalCostUsd: number;
  totalCostPkr: number;
}

/**
 * Activity log export data
 */
export interface ActivityLogExport {
  entries: ActivityLogEntry[];
  totalCount: number;
  exportedAt: Date;
  tenantId: string;
}

// ============================================================================
// MAIN LOGGING FUNCTIONS
// ============================================================================

/**
 * Log a key operation to the activity log
 * Main function used by all other logging functions
 * 
 * @param tenantId Tenant ID
 * @param actionType Type of action (add, delete, test, rotate, enable, disable, use, share, unshare)
 * @param status Status of the operation (success, failed, rate_limited, invalid)
 * @param options Additional options (keyId, userId, userRole, cost, tokens, etc.)
 * @returns Created activity log entry
 */
export async function logKeyOperation(
  tenantId: string,
  actionType: ActivityActionType,
  status: ActivityStatus,
  options?: {
    keyId?: string;
    userId?: string;
    userRole?: UserRole;
    primaryTenantId?: string;
    affectedTenants?: string[];
    tokensUsed?: number;
    costUsd?: number;
    costPkr?: number;
    errorMessage?: string;
    actionDetails?: Record<string, any>;
  }
): Promise<ActivityLogEntry> {
  try {
    const result = await query<ActivityLogRow>(
      `INSERT INTO activity_log (
        id, tenant_id, key_id, action_type, status, 
        user_id, user_role, primary_tenant_id, affected_tenants,
        tokens_used, cost_usd, cost_pkr, error_message, action_details, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
      )
      RETURNING *`,
      [
        tenantId,
        options?.keyId || null,
        actionType,
        status,
        options?.userId || null,
        options?.userRole || null,
        options?.primaryTenantId || null,
        options?.affectedTenants || null,
        options?.tokensUsed || null,
        options?.costUsd || null,
        options?.costPkr || null,
        options?.errorMessage || null,
        options?.actionDetails ? JSON.stringify(options.actionDetails) : null,
      ]
    );

    if (!result || result.rows.length === 0) {
      throw new Error('Failed to create activity log entry');
    }

    return rowToEntry(result.rows[0]);
  } catch (error) {
    console.error('Error logging key operation:', error);
    throw error;
  }
}

/**
 * Log key creation
 * 
 * @param tenantId Tenant ID
 * @param keyId API key ID
 * @param providerId Provider ID
 * @param emailAddress Email address associated with key
 * @param userId User ID (optional)
 * @param userRole User role (optional)
 * @returns Created activity log entry
 */
export async function logKeyCreated(
  tenantId: string,
  keyId: string,
  providerId: string,
  emailAddress: string,
  userId?: string,
  userRole?: UserRole
): Promise<ActivityLogEntry> {
  return logKeyOperation(tenantId, 'add', 'success', {
    keyId,
    userId,
    userRole,
    actionDetails: {
      provider_id: providerId,
      email_address: emailAddress,
    },
  });
}

/**
 * Log key deletion
 * 
 * @param tenantId Tenant ID
 * @param keyId API key ID
 * @param providerId Provider ID
 * @param emailAddress Email address (preserved for audit)
 * @param userId User ID (optional)
 * @param userRole User role (optional)
 * @returns Created activity log entry
 */
export async function logKeyDeleted(
  tenantId: string,
  keyId: string,
  providerId: string,
  emailAddress: string,
  userId?: string,
  userRole?: UserRole
): Promise<ActivityLogEntry> {
  return logKeyOperation(tenantId, 'delete', 'success', {
    keyId,
    userId,
    userRole,
    actionDetails: {
      provider_id: providerId,
      email_address: emailAddress,
    },
  });
}

/**
 * Log key test
 * 
 * @param tenantId Tenant ID
 * @param keyId API key ID
 * @param providerId Provider ID
 * @param testStatus Test result status (valid, invalid, rate_limited)
 * @param responseTimeMs Response time in milliseconds
 * @param errorMessage Error message (if applicable)
 * @param userId User ID (optional)
 * @param userRole User role (optional)
 * @returns Created activity log entry
 */
export async function logKeyTested(
  tenantId: string,
  keyId: string,
  providerId: string,
  testStatus: 'valid' | 'invalid' | 'rate_limited',
  responseTimeMs: number,
  errorMessage?: string,
  userId?: string,
  userRole?: UserRole
): Promise<ActivityLogEntry> {
  const status: ActivityStatus = testStatus === 'valid' ? 'success' : testStatus;
  
  return logKeyOperation(tenantId, 'test', status, {
    keyId,
    userId,
    userRole,
    errorMessage,
    actionDetails: {
      provider_id: providerId,
      test_status: testStatus,
      response_time_ms: responseTimeMs,
    },
  });
}

/**
 * Log key rotation (switching to next key due to rate limiting or failure)
 * 
 * @param tenantId Tenant ID
 * @param previousKeyId Previous key ID
 * @param newKeyId New key ID
 * @param providerId Provider ID
 * @param reason Reason for rotation (rate_limited, quota_exhausted, invalid, etc.)
 * @returns Created activity log entry
 */
export async function logKeyRotated(
  tenantId: string,
  previousKeyId: string,
  newKeyId: string,
  providerId: string,
  reason: string
): Promise<ActivityLogEntry> {
  return logKeyOperation(tenantId, 'rotate', 'success', {
    keyId: newKeyId,
    actionDetails: {
      provider_id: providerId,
      previous_key_id: previousKeyId,
      new_key_id: newKeyId,
      reason,
    },
  });
}

/**
 * Log key enable
 * 
 * @param tenantId Tenant ID
 * @param keyId API key ID
 * @param providerId Provider ID
 * @param userId User ID (optional)
 * @param userRole User role (optional)
 * @param affectedTenants Affected tenant IDs (for shared keys)
 * @param primaryTenantId Primary tenant ID (for shared keys)
 * @returns Created activity log entry
 */
export async function logKeyEnabled(
  tenantId: string,
  keyId: string,
  providerId: string,
  userId?: string,
  userRole?: UserRole,
  affectedTenants?: string[],
  primaryTenantId?: string
): Promise<ActivityLogEntry> {
  return logKeyOperation(tenantId, 'enable', 'success', {
    keyId,
    userId,
    userRole,
    primaryTenantId,
    affectedTenants,
    actionDetails: {
      provider_id: providerId,
    },
  });
}

/**
 * Log key disable
 * 
 * @param tenantId Tenant ID
 * @param keyId API key ID
 * @param providerId Provider ID
 * @param reason Reason for disabling (optional)
 * @param userId User ID (optional)
 * @param userRole User role (optional)
 * @param affectedTenants Affected tenant IDs (for shared keys)
 * @param primaryTenantId Primary tenant ID (for shared keys)
 * @returns Created activity log entry
 */
export async function logKeyDisabled(
  tenantId: string,
  keyId: string,
  providerId: string,
  reason?: string,
  userId?: string,
  userRole?: UserRole,
  affectedTenants?: string[],
  primaryTenantId?: string
): Promise<ActivityLogEntry> {
  return logKeyOperation(tenantId, 'disable', 'success', {
    keyId,
    userId,
    userRole,
    primaryTenantId,
    affectedTenants,
    errorMessage: reason,
    actionDetails: {
      provider_id: providerId,
    },
  });
}

/**
 * Log key usage (AI call made with this key)
 * 
 * @param tenantId Tenant ID
 * @param keyId API key ID
 * @param providerId Provider ID
 * @param tokensUsed Tokens used in the call
 * @param costUsd Cost in USD
 * @param costPkr Cost in PKR
 * @param status Status of the call (success, failed, rate_limited, invalid)
 * @param errorMessage Error message (if applicable)
 * @returns Created activity log entry
 */
export async function logKeyUsed(
  tenantId: string,
  keyId: string,
  providerId: string,
  tokensUsed: number,
  costUsd: number,
  costPkr: number,
  status: ActivityStatus = 'success',
  errorMessage?: string
): Promise<ActivityLogEntry> {
  return logKeyOperation(tenantId, 'use', status, {
    keyId,
    tokensUsed,
    costUsd,
    costPkr,
    errorMessage,
    actionDetails: {
      provider_id: providerId,
    },
  });
}

/**
 * Log key sharing (Super Admin shares key with other tenants)
 * 
 * @param tenantId Primary tenant ID
 * @param keyId API key ID
 * @param providerId Provider ID
 * @param sharedTenantIds Tenant IDs to share with
 * @param userId User ID
 * @param userRole User role
 * @returns Created activity log entry
 */
export async function logKeyShared(
  tenantId: string,
  keyId: string,
  providerId: string,
  sharedTenantIds: string[],
  userId: string,
  userRole: UserRole
): Promise<ActivityLogEntry> {
  return logKeyOperation(tenantId, 'share', 'success', {
    keyId,
    userId,
    userRole,
    primaryTenantId: tenantId,
    affectedTenants: sharedTenantIds,
    actionDetails: {
      provider_id: providerId,
      shared_tenant_ids: sharedTenantIds,
    },
  });
}

/**
 * Log key unsharing (Super Admin revokes key from tenants)
 * 
 * @param tenantId Primary tenant ID
 * @param keyId API key ID
 * @param providerId Provider ID
 * @param revokedTenantIds Tenant IDs to revoke from
 * @param userId User ID
 * @param userRole User role
 * @returns Created activity log entry
 */
export async function logKeyUnshared(
  tenantId: string,
  keyId: string,
  providerId: string,
  revokedTenantIds: string[],
  userId: string,
  userRole: UserRole
): Promise<ActivityLogEntry> {
  return logKeyOperation(tenantId, 'unshare', 'success', {
    keyId,
    userId,
    userRole,
    primaryTenantId: tenantId,
    affectedTenants: revokedTenantIds,
    actionDetails: {
      provider_id: providerId,
      revoked_tenant_ids: revokedTenantIds,
    },
  });
}

// ============================================================================
// RETRIEVAL FUNCTIONS
// ============================================================================

/**
 * Get activity log entries with filtering
 * 
 * @param tenantId Tenant ID
 * @param filter Filter options
 * @returns Array of activity log entries
 */
export async function getActivityLog(
  tenantId: string,
  filter?: ActivityLogFilter
): Promise<ActivityLogEntry[]> {
  try {
    let sql = `SELECT * FROM activity_log WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    // Add optional filters
    if (filter?.keyId) {
      sql += ` AND key_id = $${paramIndex}`;
      params.push(filter.keyId);
      paramIndex++;
    }

    if (filter?.actionType) {
      sql += ` AND action_type = $${paramIndex}`;
      params.push(filter.actionType);
      paramIndex++;
    }

    if (filter?.status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(filter.status);
      paramIndex++;
    }

    if (filter?.startDate) {
      sql += ` AND created_at >= $${paramIndex}`;
      params.push(filter.startDate);
      paramIndex++;
    }

    if (filter?.endDate) {
      sql += ` AND created_at <= $${paramIndex}`;
      params.push(filter.endDate);
      paramIndex++;
    }

    // Order by created_at descending (most recent first)
    sql += ` ORDER BY created_at DESC`;

    // Add pagination
    if (filter?.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(filter.limit);
      paramIndex++;
    }

    if (filter?.offset) {
      sql += ` OFFSET $${paramIndex}`;
      params.push(filter.offset);
      paramIndex++;
    }

    const results = await queryMany<ActivityLogRow>(sql, params);
    return results.map(rowToEntry);
  } catch (error) {
    console.error('Error retrieving activity log:', error);
    throw error;
  }
}

/**
 * Get single activity log entry
 * 
 * @param tenantId Tenant ID
 * @param entryId Entry ID
 * @returns Activity log entry or null if not found
 */
export async function getActivityLogEntry(
  tenantId: string,
  entryId: string
): Promise<ActivityLogEntry | null> {
  try {
    const result = await queryOne<ActivityLogRow>(
      `SELECT * FROM activity_log WHERE id = $1 AND tenant_id = $2`,
      [entryId, tenantId]
    );

    return result ? rowToEntry(result) : null;
  } catch (error) {
    console.error('Error retrieving activity log entry:', error);
    throw error;
  }
}

/**
 * Get activity log statistics
 * 
 * @param tenantId Tenant ID
 * @param filter Optional filter (date range, action type, etc.)
 * @returns Activity log statistics
 */
export async function getActivityLogStats(
  tenantId: string,
  filter?: ActivityLogFilter
): Promise<ActivityLogStats> {
  try {
    // Get all entries for the tenant (with optional filters)
    const entries = await getActivityLog(tenantId, {
      ...filter,
      limit: 10000,  // Get up to 10k entries for stats
    });

    // Calculate statistics
    const totalOperations = entries.length;
    const operationsByType: Record<ActivityActionType, number> = {
      add: 0,
      delete: 0,
      test: 0,
      rotate: 0,
      enable: 0,
      disable: 0,
      use: 0,
      share: 0,
      unshare: 0,
    };
    const operationsByStatus: Record<ActivityStatus, number> = {
      success: 0,
      failed: 0,
      rate_limited: 0,
      invalid: 0,
    };
    const operationsByProvider: Record<string, number> = {};

    let totalCostUsd = 0;
    let totalCostPkr = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const entry of entries) {
      // Count by type
      operationsByType[entry.actionType]++;

      // Count by status
      operationsByStatus[entry.status]++;

      // Count by provider (from action_details)
      if (entry.actionDetails?.provider_id) {
        const providerId = entry.actionDetails.provider_id;
        operationsByProvider[providerId] = (operationsByProvider[providerId] || 0) + 1;
      }

      // Sum costs
      if (entry.costUsd) totalCostUsd += entry.costUsd;
      if (entry.costPkr) totalCostPkr += entry.costPkr;

      // Count success/failure
      if (entry.status === 'success') {
        successCount++;
      } else {
        failureCount++;
      }
    }

    const successRate = totalOperations > 0 ? (successCount / totalOperations) * 100 : 0;
    const failureRate = totalOperations > 0 ? (failureCount / totalOperations) * 100 : 0;
    const averageCostUsd = totalOperations > 0 ? totalCostUsd / totalOperations : 0;

    return {
      totalOperations,
      operationsByType,
      operationsByStatus,
      operationsByProvider,
      successRate,
      failureRate,
      averageCostUsd,
      totalCostUsd,
      totalCostPkr,
    };
  } catch (error) {
    console.error('Error calculating activity log statistics:', error);
    throw error;
  }
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export activity log as CSV
 * 
 * @param tenantId Tenant ID
 * @param filter Optional filter (date range, action type, etc.)
 * @returns CSV string
 */
export async function exportActivityLogAsCSV(
  tenantId: string,
  filter?: ActivityLogFilter
): Promise<string> {
  try {
    const entries = await getActivityLog(tenantId, {
      ...filter,
      limit: 100000,  // Export up to 100k entries
    });

    // CSV header
    const headers = [
      'ID',
      'Timestamp',
      'Action Type',
      'Status',
      'Key ID',
      'Provider ID',
      'Tokens Used',
      'Cost USD',
      'Cost PKR',
      'Error Message',
      'User ID',
      'User Role',
    ];

    const rows = entries.map(entry => [
      entry.id,
      entry.createdAt.toISOString(),
      entry.actionType,
      entry.status,
      entry.keyId || '',
      entry.actionDetails?.provider_id || '',
      entry.tokensUsed || '',
      entry.costUsd || '',
      entry.costPkr || '',
      entry.errorMessage || '',
      entry.userId || '',
      entry.userRole || '',
    ]);

    // Escape CSV values
    const escapedHeaders = headers.map(escapeCSVValue);
    const escapedRows = rows.map(row => row.map(escapeCSVValue));

    // Build CSV
    const csv = [
      escapedHeaders.join(','),
      ...escapedRows.map(row => row.join(',')),
    ].join('\n');

    return csv;
  } catch (error) {
    console.error('Error exporting activity log as CSV:', error);
    throw error;
  }
}

/**
 * Export activity log as JSON
 * 
 * @param tenantId Tenant ID
 * @param filter Optional filter (date range, action type, etc.)
 * @returns JSON string
 */
export async function exportActivityLogAsJSON(
  tenantId: string,
  filter?: ActivityLogFilter
): Promise<string> {
  try {
    const entries = await getActivityLog(tenantId, {
      ...filter,
      limit: 100000,  // Export up to 100k entries
    });

    const exportData: ActivityLogExport = {
      entries,
      totalCount: entries.length,
      exportedAt: new Date(),
      tenantId,
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('Error exporting activity log as JSON:', error);
    throw error;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert database row to ActivityLogEntry
 * 
 * @param row Database row
 * @returns ActivityLogEntry
 */
function rowToEntry(row: ActivityLogRow): ActivityLogEntry {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    keyId: row.key_id,
    actionType: row.action_type,
    actionDetails: row.action_details,
    tokensUsed: row.tokens_used,
    costUsd: row.cost_usd,
    costPkr: row.cost_pkr,
    status: row.status,
    errorMessage: row.error_message,
    userId: row.user_id,
    userRole: row.user_role,
    primaryTenantId: row.primary_tenant_id,
    affectedTenants: row.affected_tenants,
    createdAt: row.created_at,
  };
}

/**
 * Escape CSV value (handle quotes and commas)
 * 
 * @param value Value to escape
 * @returns Escaped value
 */
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Verify that activity log is immutable (no updates or deletes)
 * This is enforced by database triggers, but we can verify it here
 * 
 * @param tenantId Tenant ID
 * @param entryId Entry ID
 * @returns true if entry exists and is immutable
 */
export async function verifyActivityLogImmutability(
  tenantId: string,
  entryId: string
): Promise<boolean> {
  try {
    const entry = await getActivityLogEntry(tenantId, entryId);
    return entry !== null;
  } catch (error) {
    console.error('Error verifying activity log immutability:', error);
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  logKeyOperation,
  logKeyCreated,
  logKeyDeleted,
  logKeyTested,
  logKeyRotated,
  logKeyEnabled,
  logKeyDisabled,
  logKeyUsed,
  logKeyShared,
  logKeyUnshared,
  getActivityLog,
  getActivityLogEntry,
  getActivityLogStats,
  exportActivityLogAsCSV,
  exportActivityLogAsJSON,
  verifyActivityLogImmutability,
};
