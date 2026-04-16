'use client'

import React, { useState, useEffect } from 'react'
import styles from './CostIntelligence.module.css'
import { CostSummary } from '@/lib/db/schema'

// ============================================================================
// TYPES
// ============================================================================

interface CostIntelligenceDashboardProps {
  tenantId?: string
}

interface ExportOptions {
  format: 'csv' | 'pdf'
  dateFrom?: string
  dateTo?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = ['#00d4ff', '#0066cc', '#00ff88', '#ffaa00', '#ff6b6b', '#9d4edd', '#3a86ff']

const TREND_ICONS = {
  up: '↑',
  down: '↓',
  stable: '→',
}

const TREND_COLORS = {
  up: '#ff6b6b',
  down: '#00ff88',
  stable: '#ffaa00',
}

// ============================================================================
// COST INTELLIGENCE DASHBOARD COMPONENT
// ============================================================================

export default function CostIntelligence({ tenantId: propTenantId }: CostIntelligenceDashboardProps) {
  // State management
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    fetchCostSummary()
  }, [])

  // ============================================================================
  // API CALLS
  // ============================================================================

  /**
   * Fetch cost summary from API
   */
  const fetchCostSummary = async () => {
    try {
      setLoading(true)
      setError(null)

      const tenantId = propTenantId || getTenantId()

      const response = await fetch('/api/cost/summary', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch cost summary: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch cost summary')
      }

      setCostSummary(data.data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error fetching cost summary:', err)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Export cost data as CSV or PDF
   */
  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setExporting(true)
      setExportError(null)

      const tenantId = propTenantId || getTenantId()

      // Get current month date range
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const monthEnd = new Date()
      monthEnd.setHours(23, 59, 59, 999)

      const response = await fetch('/api/cost/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          format,
          dateFrom: monthStart.toISOString(),
          dateTo: monthEnd.toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to export cost data: ${response.statusText}`)
      }

      // Get the file content
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cost-report-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setExportError(errorMessage)
      console.error('Error exporting cost data:', err)
    } finally {
      setExporting(false)
    }
  }

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading cost intelligence data...</p>
        </div>
      </div>
    )
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h2>Error Loading Cost Intelligence</h2>
          <p>{error}</p>
          <button className={styles.retryButton} onClick={fetchCostSummary}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!costSummary) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h2>No Data Available</h2>
          <p>No cost data available for this period.</p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER MAIN DASHBOARD
  // ============================================================================

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Cost Intelligence Dashboard</h1>
        <p className={styles.subtitle}>Track and analyze your AI service costs</p>
      </div>

      <div className={styles.content}>
        {/* Summary Cards */}
        <div className={styles.summaryCardsSection}>
          <div className={styles.summaryCard}>
            <div className={styles.cardLabel}>Total Spend This Month</div>
            <div className={styles.cardValue}>${costSummary.totalSpendThisMonth.toFixed(4)}</div>
            <div className={styles.cardSubtext}>USD</div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.cardLabel}>Last Month</div>
            <div className={styles.cardValue}>${costSummary.totalSpendLastMonth.toFixed(4)}</div>
            <div className={styles.cardSubtext}>USD</div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.cardLabel}>Trend</div>
            <div
              className={styles.trendIndicator}
              style={{ color: TREND_COLORS[costSummary.trendIndicator] }}
            >
              {TREND_ICONS[costSummary.trendIndicator]}
            </div>
            <div className={styles.cardSubtext}>{costSummary.trendIndicator}</div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.cardLabel}>Projected Month-End</div>
            <div className={styles.cardValue}>${costSummary.projectedMonthEndCost.toFixed(4)}</div>
            <div className={styles.cardSubtext}>USD</div>
          </div>
        </div>

        {/* Cost Breakdown Charts */}
        <div className={styles.chartsSection}>
          <div className={styles.chartContainer}>
            <h2 className={styles.chartTitle}>Cost by Provider</h2>
            {costSummary.costByProvider.length > 0 ? (
              <div className={styles.simpleChart}>
                {costSummary.costByProvider.map((provider, index) => (
                  <div key={index} className={styles.chartBar}>
                    <div className={styles.barLabel}>{provider.providerName}</div>
                    <div className={styles.barContainer}>
                      <div
                        className={styles.bar}
                        style={{
                          width: `${provider.percentage}%`,
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      >
                        <span className={styles.barValue}>${provider.costUsd.toFixed(4)}</span>
                      </div>
                    </div>
                    <div className={styles.barPercentage}>{provider.percentage.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.noData}>No provider cost data available</p>
            )}
          </div>

          <div className={styles.chartContainer}>
            <h2 className={styles.chartTitle}>Cost by Gate</h2>
            {costSummary.costByGate.length > 0 ? (
              <div className={styles.pieChart}>
                {costSummary.costByGate.map((gate, index) => (
                  <div key={index} className={styles.pieSlice}>
                    <div
                      className={styles.pieColor}
                      style={{
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    ></div>
                    <div className={styles.pieLabel}>
                      Gate {gate.gateNumber}: {gate.percentage.toFixed(1)}%
                    </div>
                    <div className={styles.pieCost}>${gate.costUsd.toFixed(4)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.noData}>No gate cost data available</p>
            )}
          </div>

          <div className={styles.chartContainer}>
            <h2 className={styles.chartTitle}>Cost by Topic</h2>
            {costSummary.costByTopic.length > 0 ? (
              <div className={styles.simpleChart}>
                {costSummary.costByTopic.map((topic, index) => (
                  <div key={index} className={styles.chartBar}>
                    <div className={styles.barLabel}>{topic.topicName}</div>
                    <div className={styles.barContainer}>
                      <div
                        className={styles.bar}
                        style={{
                          width: `${topic.percentage}%`,
                          backgroundColor: COLORS[(index + 2) % COLORS.length],
                        }}
                      >
                        <span className={styles.barValue}>${topic.costUsd.toFixed(4)}</span>
                      </div>
                    </div>
                    <div className={styles.barPercentage}>{topic.percentage.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.noData}>No topic cost data available</p>
            )}
          </div>
        </div>

        {/* Metrics Display */}
        <div className={styles.metricsSection}>
          <h2 className={styles.sectionTitle}>Key Metrics</h2>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Cost per Conversation</div>
              <div className={styles.metricValue}>${costSummary.costPerConversation.toFixed(4)}</div>
              <div className={styles.metricUnit}>USD (average)</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>AI Call Rate</div>
              <div className={styles.metricValue}>{costSummary.aiCallRate.toFixed(2)}%</div>
              <div className={styles.metricUnit}>of total calls</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Cache Hit Rate</div>
              <div className={styles.metricValue}>{costSummary.cacheHitRate.toFixed(2)}%</div>
              <div className={styles.metricUnit}>of cached calls</div>
            </div>
          </div>
        </div>

        {/* Quality vs Cost Analysis Table */}
        <div className={styles.qualityAnalysisSection}>
          <h2 className={styles.sectionTitle}>Quality vs Cost Analysis</h2>
          {costSummary.qualityVsCostAnalysis.length > 0 ? (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>QA Score</th>
                    <th>Cost per 1K Calls</th>
                    <th>Quality/$ Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {costSummary.qualityVsCostAnalysis.map((analysis, index) => (
                    <tr key={index}>
                      <td>{analysis.providerName}</td>
                      <td>{analysis.qaScore.toFixed(2)}</td>
                      <td>${analysis.costPer1kCalls.toFixed(4)}</td>
                      <td>{analysis.qualityPerDollar.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.noData}>No quality analysis data available</p>
          )}
        </div>

        {/* Recommendations Section */}
        <div className={styles.recommendationsSection}>
          <h2 className={styles.sectionTitle}>Optimization Recommendations</h2>
          {costSummary.recommendations.length > 0 ? (
            <div className={styles.recommendationsList}>
              {costSummary.recommendations.map((recommendation, index) => (
                <div key={index} className={styles.recommendationItem}>
                  <div className={styles.recommendationIcon}>💡</div>
                  <div className={styles.recommendationText}>{recommendation}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.noData}>No recommendations available</p>
          )}
        </div>

        {/* Export Section */}
        <div className={styles.exportSection}>
          <h2 className={styles.sectionTitle}>Export Report</h2>
          <div className={styles.exportButtons}>
            <button
              className={styles.exportButton}
              onClick={() => handleExport('csv')}
              disabled={exporting}
              aria-label="Export as CSV"
            >
              {exporting ? 'Exporting...' : '📊 Export as CSV'}
            </button>
            <button
              className={styles.exportButton}
              onClick={() => handleExport('pdf')}
              disabled={exporting}
              aria-label="Export as PDF"
            >
              {exporting ? 'Exporting...' : '📄 Export as PDF'}
            </button>
          </div>
          {exportError && <div className={styles.exportError}>{exportError}</div>}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get tenant ID from localStorage or environment
 */
function getTenantId(): string {
  if (typeof window !== 'undefined') {
    const tenantId = localStorage.getItem('tenantId')
    if (tenantId) {
      return tenantId
    }
  }

  // Fallback to environment variable or empty string
  return process.env.NEXT_PUBLIC_TENANT_ID || ''
}
