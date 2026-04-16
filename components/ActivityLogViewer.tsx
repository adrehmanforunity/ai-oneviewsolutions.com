'use client'

import React, { useState, useEffect } from 'react'
import styles from './ActivityLogViewer.module.css'

// ============================================================================
// TYPES
// ============================================================================

interface ActivityLogEntry {
  id: string
  tenantId: string
  keyId?: string
  actionType: 'add' | 'delete' | 'test' | 'rotate' | 'enable' | 'disable' | 'use'
  actionDetails?: Record<string, any>
  tokensUsed?: number
  costUsd?: number
  costPkr?: number
  status: 'success' | 'failed' | 'rate_limited' | 'invalid'
  errorMessage?: string
  userId?: string
  userRole?: string
  primaryTenantId?: string
  affectedTenants?: string[]
  createdAt: string
  providerId?: string
  providerName?: string
  keyLabel?: string
}

interface ActivityLogResponse {
  success: boolean
  data: {
    items: ActivityLogEntry[]
    total: number
    limit: number
    offset: number
  }
}

interface FilterState {
  provider: string
  key: string
  dateFrom: string
  dateTo: string
  actionType: string
  status: string
}

interface ActivityLogViewerProps {
  tenantId?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ACTION_TYPES = ['add', 'delete', 'test', 'rotate', 'enable', 'disable', 'use']
const STATUSES = ['success', 'failed', 'rate_limited', 'invalid']
const PAGE_SIZES = [10, 25, 50, 100]
const DEFAULT_PAGE_SIZE = 50

const STATUS_COLORS: Record<string, string> = {
  success: '#00ff88',
  failed: '#ff6b6b',
  rate_limited: '#ffaa00',
  invalid: '#ff6b6b',
}

const ACTION_ICONS: Record<string, string> = {
  add: '➕',
  delete: '🗑️',
  test: '✓',
  rotate: '🔄',
  enable: '✅',
  disable: '❌',
  use: '▶️',
}

// ============================================================================
// ACTIVITY LOG VIEWER COMPONENT
// ============================================================================

export default function ActivityLogViewer({ tenantId: propTenantId }: ActivityLogViewerProps) {
  // State management
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    provider: '',
    key: '',
    dateFrom: '',
    dateTo: '',
    actionType: '',
    status: '',
  })

  // Available options for filters
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([])
  const [keys, setKeys] = useState<Array<{ id: string; label: string }>>([])

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    fetchActivityLog()
    fetchFilterOptions()
  }, [currentPage, pageSize, filters])

  // ============================================================================
  // API CALLS
  // ============================================================================

  /**
   * Fetch activity log entries from API
   */
  const fetchActivityLog = async () => {
    try {
      setLoading(true)
      setError(null)

      const tenantId = propTenantId || getTenantId()
      const offset = (currentPage - 1) * pageSize

      // Build query parameters
      const params = new URLSearchParams()
      params.append('limit', pageSize.toString())
      params.append('offset', offset.toString())

      if (filters.provider) params.append('providerId', filters.provider)
      if (filters.key) params.append('keyId', filters.key)
      if (filters.actionType) params.append('actionType', filters.actionType)
      if (filters.status) params.append('status', filters.status)
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.append('dateTo', filters.dateTo)

      const response = await fetch(`/api/activity-log?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch activity log: ${response.statusText}`)
      }

      const data: ActivityLogResponse = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch activity log')
      }

      setEntries(data.data.items)
      setTotalCount(data.data.total)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error fetching activity log:', err)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Fetch filter options (providers and keys)
   */
  const fetchFilterOptions = async () => {
    try {
      const tenantId = propTenantId || getTenantId()

      // Fetch providers
      const providersResponse = await fetch('/api/providers', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
      })

      if (providersResponse.ok) {
        const providersData = await providersResponse.json()
        if (providersData.success && providersData.data) {
          setProviders(providersData.data)
        }
      }

      // Fetch keys
      const keysResponse = await fetch('/api/keys', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
      })

      if (keysResponse.ok) {
        const keysData = await keysResponse.json()
        if (keysData.success && keysData.data) {
          setKeys(keysData.data)
        }
      }
    } catch (err) {
      console.error('Error fetching filter options:', err)
    }
  }

  /**
   * Export activity log as CSV
   */
  const handleExport = async () => {
    try {
      setExporting(true)
      setExportError(null)

      const tenantId = propTenantId || getTenantId()

      // Build query parameters
      const params = new URLSearchParams()
      params.append('format', 'csv')

      if (filters.provider) params.append('providerId', filters.provider)
      if (filters.key) params.append('keyId', filters.key)
      if (filters.actionType) params.append('actionType', filters.actionType)
      if (filters.status) params.append('status', filters.status)
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.append('dateTo', filters.dateTo)

      const response = await fetch(`/api/activity-log/export?${params.toString()}`, {
        method: 'POST',
        headers: {
          'x-tenant-id': tenantId,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to export activity log: ${response.statusText}`)
      }

      // Get the CSV content
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setExportError(errorMessage)
      console.error('Error exporting activity log:', err)
    } finally {
      setExporting(false)
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handle filter change
   */
  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }))
    setCurrentPage(1) // Reset to first page when filters change
  }

  /**
   * Handle page size change
   */
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1) // Reset to first page when page size changes
  }

  /**
   * Handle page change
   */
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  /**
   * Handle jump to page
   */
  const handleJumpToPage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const pageInput = parseInt(formData.get('jumpPage') as string)
    const maxPage = Math.ceil(totalCount / pageSize)

    if (pageInput >= 1 && pageInput <= maxPage) {
      setCurrentPage(pageInput)
    }
  }

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * Format timestamp
   */
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  /**
   * Format cost with proper decimal places
   */
  const formatCost = (usd?: number, pkr?: number): string => {
    if (usd === undefined && pkr === undefined) return '-'
    const usdStr = usd !== undefined ? `$${usd.toFixed(4)}` : ''
    const pkrStr = pkr !== undefined ? `₨${pkr.toFixed(2)}` : ''
    return [usdStr, pkrStr].filter(Boolean).join(' / ')
  }

  /**
   * Get status badge color
   */
  const getStatusColor = (status: string): string => {
    return STATUS_COLORS[status] || '#888888'
  }

  /**
   * Get action icon
   */
  const getActionIcon = (action: string): string => {
    return ACTION_ICONS[action] || '•'
  }

  /**
   * Get tenant ID from localStorage or session
   */
  function getTenantId(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tenantId') || ''
    }
    return ''
  }

  // ============================================================================
  // PAGINATION CALCULATIONS
  // ============================================================================

  const totalPages = Math.ceil(totalCount / pageSize)
  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalCount)

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Activity Log</h1>
        <p className={styles.subtitle}>View and analyze API key operations</p>
      </div>

      <div className={styles.content}>
        {/* Filter Controls */}
        <div className={styles.filterSection}>
          <div className={styles.filterGrid}>
            {/* Provider Filter */}
            <div className={styles.filterGroup}>
              <label htmlFor="provider-filter" className={styles.filterLabel}>
                Provider
              </label>
              <select
                id="provider-filter"
                className={styles.filterInput}
                value={filters.provider}
                onChange={e => handleFilterChange('provider', e.target.value)}
                aria-label="Filter by provider"
              >
                <option value="">All Providers</option>
                {providers.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Key Filter */}
            <div className={styles.filterGroup}>
              <label htmlFor="key-filter" className={styles.filterLabel}>
                Key
              </label>
              <select
                id="key-filter"
                className={styles.filterInput}
                value={filters.key}
                onChange={e => handleFilterChange('key', e.target.value)}
                aria-label="Filter by key"
              >
                <option value="">All Keys</option>
                {keys.map(key => (
                  <option key={key.id} value={key.id}>
                    {key.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Type Filter */}
            <div className={styles.filterGroup}>
              <label htmlFor="action-filter" className={styles.filterLabel}>
                Action Type
              </label>
              <select
                id="action-filter"
                className={styles.filterInput}
                value={filters.actionType}
                onChange={e => handleFilterChange('actionType', e.target.value)}
                aria-label="Filter by action type"
              >
                <option value="">All Actions</option>
                {ACTION_TYPES.map(action => (
                  <option key={action} value={action}>
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className={styles.filterGroup}>
              <label htmlFor="status-filter" className={styles.filterLabel}>
                Status
              </label>
              <select
                id="status-filter"
                className={styles.filterInput}
                value={filters.status}
                onChange={e => handleFilterChange('status', e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All Statuses</option>
                {STATUSES.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From Filter */}
            <div className={styles.filterGroup}>
              <label htmlFor="date-from-filter" className={styles.filterLabel}>
                From Date
              </label>
              <input
                id="date-from-filter"
                type="date"
                className={styles.filterInput}
                value={filters.dateFrom}
                onChange={e => handleFilterChange('dateFrom', e.target.value)}
                aria-label="Filter from date"
              />
            </div>

            {/* Date To Filter */}
            <div className={styles.filterGroup}>
              <label htmlFor="date-to-filter" className={styles.filterLabel}>
                To Date
              </label>
              <input
                id="date-to-filter"
                type="date"
                className={styles.filterInput}
                value={filters.dateTo}
                onChange={e => handleFilterChange('dateTo', e.target.value)}
                aria-label="Filter to date"
              />
            </div>
          </div>

          {/* Export Button */}
          <div className={styles.exportButtonContainer}>
            <button
              className={styles.exportButton}
              onClick={handleExport}
              disabled={exporting || loading}
              aria-label="Export activity log as CSV"
            >
              {exporting ? 'Exporting...' : '📥 Export CSV'}
            </button>
          </div>

          {exportError && <div className={styles.exportError}>{exportError}</div>}
        </div>

        {/* Loading State */}
        {loading && (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner} />
            <p>Loading activity log...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className={styles.errorContainer}>
            <h2>Error Loading Activity Log</h2>
            <p>{error}</p>
            <button className={styles.retryButton} onClick={fetchActivityLog}>
              Retry
            </button>
          </div>
        )}

        {/* Activity Log Table */}
        {!loading && !error && (
          <>
            <div className={styles.tableSection}>
              <div className={styles.tableContainer}>
                <table className={styles.table} role="grid" aria-label="Activity log entries">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Provider</th>
                      <th>Key Label</th>
                      <th>Action</th>
                      <th>Status</th>
                      <th>Tokens</th>
                      <th>Cost</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr>
                        <td colSpan={8} className={styles.noData}>
                          No activity log entries found
                        </td>
                      </tr>
                    ) : (
                      entries.map(entry => (
                        <tr key={entry.id}>
                          <td>{formatTimestamp(entry.createdAt)}</td>
                          <td>{entry.providerName || '-'}</td>
                          <td>{entry.keyLabel || '-'}</td>
                          <td>
                            <span className={styles.actionBadge}>
                              {getActionIcon(entry.actionType)} {entry.actionType}
                            </span>
                          </td>
                          <td>
                            <span
                              className={styles.statusBadge}
                              style={{ color: getStatusColor(entry.status) }}
                            >
                              {entry.status}
                            </span>
                          </td>
                          <td>{entry.tokensUsed || '-'}</td>
                          <td>{formatCost(entry.costUsd, entry.costPkr)}</td>
                          <td className={styles.errorCell}>{entry.errorMessage || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalCount > 0 && (
              <div className={styles.paginationSection}>
                <div className={styles.paginationInfo}>
                  Showing {startIndex} to {endIndex} of {totalCount} entries
                </div>

                <div className={styles.paginationControls}>
                  {/* Previous Button */}
                  <button
                    className={styles.paginationButton}
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    ← Previous
                  </button>

                  {/* Page Numbers */}
                  <div className={styles.pageNumbers}>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          className={`${styles.pageButton} ${
                            currentPage === pageNum ? styles.pageButtonActive : ''
                          }`}
                          onClick={() => handlePageChange(pageNum)}
                          aria-label={`Go to page ${pageNum}`}
                          aria-current={currentPage === pageNum ? 'page' : undefined}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>

                  {/* Next Button */}
                  <button
                    className={styles.paginationButton}
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                  >
                    Next →
                  </button>
                </div>

                {/* Jump to Page */}
                <form className={styles.jumpToPageForm} onSubmit={handleJumpToPage}>
                  <label htmlFor="jump-page-input" className={styles.jumpToPageLabel}>
                    Jump to page:
                  </label>
                  <input
                    id="jump-page-input"
                    type="number"
                    name="jumpPage"
                    min="1"
                    max={totalPages}
                    className={styles.jumpToPageInput}
                    placeholder="Page #"
                    aria-label="Jump to page number"
                  />
                  <button type="submit" className={styles.jumpToPageButton}>
                    Go
                  </button>
                </form>

                {/* Page Size Selector */}
                <div className={styles.pageSizeSelector}>
                  <label htmlFor="page-size-select" className={styles.pageSizeLabel}>
                    Entries per page:
                  </label>
                  <select
                    id="page-size-select"
                    className={styles.pageSizeSelect}
                    value={pageSize}
                    onChange={e => handlePageSizeChange(parseInt(e.target.value))}
                    aria-label="Select entries per page"
                  >
                    {PAGE_SIZES.map(size => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
