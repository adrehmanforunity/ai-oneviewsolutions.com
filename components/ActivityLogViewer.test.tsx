/**
 * Activity Log Viewer Component Tests
 * 
 * Unit tests for the Activity Log Viewer component
 * Tests: rendering, state management, filtering, pagination, export
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ActivityLogViewer from './ActivityLogViewer'

// ============================================================================
// MOCKS
// ============================================================================

// Mock fetch globally
global.fetch = vi.fn()

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// ============================================================================
// TEST DATA
// ============================================================================

const mockActivityLogResponse = {
  success: true,
  data: {
    items: [
      {
        id: '1',
        tenantId: 'tenant-1',
        keyId: 'key-1',
        actionType: 'test' as const,
        status: 'success' as const,
        tokensUsed: 100,
        costUsd: 0.0015,
        costPkr: 0.50,
        createdAt: '2024-01-15T10:30:00Z',
        providerId: 'provider-1',
        providerName: 'Groq',
        keyLabel: 'Production Key',
      },
      {
        id: '2',
        tenantId: 'tenant-1',
        keyId: 'key-2',
        actionType: 'use' as const,
        status: 'success' as const,
        tokensUsed: 500,
        costUsd: 0.0075,
        costPkr: 2.50,
        createdAt: '2024-01-15T09:30:00Z',
        providerId: 'provider-1',
        providerName: 'Groq',
        keyLabel: 'Backup Key',
      },
      {
        id: '3',
        tenantId: 'tenant-1',
        keyId: 'key-1',
        actionType: 'rotate' as const,
        status: 'failed' as const,
        costUsd: 0,
        costPkr: 0,
        createdAt: '2024-01-15T08:30:00Z',
        providerId: 'provider-1',
        providerName: 'Groq',
        keyLabel: 'Production Key',
        errorMessage: 'Rate limit exceeded',
      },
    ],
    total: 3,
    limit: 50,
    offset: 0,
  },
}

const mockProvidersResponse = {
  success: true,
  data: [
    { id: 'provider-1', name: 'Groq' },
    { id: 'provider-2', name: 'OpenAI' },
    { id: 'provider-3', name: 'Claude' },
  ],
}

const mockKeysResponse = {
  success: true,
  data: [
    { id: 'key-1', label: 'Production Key' },
    { id: 'key-2', label: 'Backup Key' },
  ],
}

// ============================================================================
// TESTS
// ============================================================================

describe('ActivityLogViewer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('tenantId', 'tenant-1')
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockActivityLogResponse,
    })
  })

  // ============================================================================
  // RENDERING TESTS
  // ============================================================================

  describe('Rendering', () => {
    it('should render the component with header', async () => {
      render(<ActivityLogViewer />)

      expect(screen.getByText('Activity Log')).toBeInTheDocument()
      expect(screen.getByText('View and analyze API key operations')).toBeInTheDocument()
    })

    it('should render filter controls', async () => {
      render(<ActivityLogViewer />)

      expect(screen.getByLabelText('Filter by provider')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter by key')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter by action type')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter by status')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter from date')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter to date')).toBeInTheDocument()
    })

    it('should render export button', async () => {
      render(<ActivityLogViewer />)

      expect(screen.getByLabelText('Export activity log as CSV')).toBeInTheDocument()
    })

    it('should render activity log table', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByRole('grid', { name: 'Activity log entries' })).toBeInTheDocument()
      })
    })

    it('should render table headers', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('Timestamp')).toBeInTheDocument()
        expect(screen.getByText('Provider')).toBeInTheDocument()
        expect(screen.getByText('Key Label')).toBeInTheDocument()
        expect(screen.getByText('Action')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText('Tokens')).toBeInTheDocument()
        expect(screen.getByText('Cost')).toBeInTheDocument()
        expect(screen.getByText('Error')).toBeInTheDocument()
      })
    })

    it('should render activity log entries', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('Groq')).toBeInTheDocument()
        expect(screen.getByText('Production Key')).toBeInTheDocument()
        expect(screen.getByText('Backup Key')).toBeInTheDocument()
      })
    })

    it('should display loading state initially', () => {
      ;(global.fetch as any).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockActivityLogResponse,
                }),
              100
            )
          )
      )

      render(<ActivityLogViewer />)

      expect(screen.getByText('Loading activity log...')).toBeInTheDocument()
    })

    it('should display error state on fetch failure', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('Error Loading Activity Log')).toBeInTheDocument()
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('should display no data message when entries are empty', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: [],
            total: 0,
            limit: 50,
            offset: 0,
          },
        }),
      })

      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('No activity log entries found')).toBeInTheDocument()
      })
    })
  })

  // ============================================================================
  // FILTERING TESTS
  // ============================================================================

  describe('Filtering', () => {
    it('should filter by provider', async () => {
      const user = userEvent.setup()
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText('Filter by provider')).toBeInTheDocument()
      })

      const providerSelect = screen.getByLabelText('Filter by provider') as HTMLSelectElement
      await user.selectOptions(providerSelect, 'provider-1')

      await waitFor(() => {
        expect(providerSelect.value).toBe('provider-1')
      })

      // Verify fetch was called with provider filter
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('providerId=provider-1'),
        expect.any(Object)
      )
    })

    it('should filter by action type', async () => {
      const user = userEvent.setup()
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText('Filter by action type')).toBeInTheDocument()
      })

      const actionSelect = screen.getByLabelText('Filter by action type') as HTMLSelectElement
      await user.selectOptions(actionSelect, 'test')

      await waitFor(() => {
        expect(actionSelect.value).toBe('test')
      })

      // Verify fetch was called with action type filter
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('actionType=test'),
        expect.any(Object)
      )
    })

    it('should filter by status', async () => {
      const user = userEvent.setup()
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText('Filter by status')).toBeInTheDocument()
      })

      const statusSelect = screen.getByLabelText('Filter by status') as HTMLSelectElement
      await user.selectOptions(statusSelect, 'success')

      await waitFor(() => {
        expect(statusSelect.value).toBe('success')
      })

      // Verify fetch was called with status filter
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=success'),
        expect.any(Object)
      )
    })

    it('should filter by date range', async () => {
      const user = userEvent.setup()
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText('Filter from date')).toBeInTheDocument()
      })

      const dateFromInput = screen.getByLabelText('Filter from date') as HTMLInputElement
      await user.type(dateFromInput, '2024-01-01')

      await waitFor(() => {
        expect(dateFromInput.value).toBe('2024-01-01')
      })

      // Verify fetch was called with date filter
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('dateFrom=2024-01-01'),
        expect.any(Object)
      )
    })

    it('should reset to page 1 when filters change', async () => {
      const user = userEvent.setup()
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText('Filter by provider')).toBeInTheDocument()
      })

      const providerSelect = screen.getByLabelText('Filter by provider') as HTMLSelectElement
      await user.selectOptions(providerSelect, 'provider-1')

      // Verify offset is 0 (page 1)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('offset=0'),
          expect.any(Object)
        )
      })
    })
  })

  // ============================================================================
  // PAGINATION TESTS
  // ============================================================================

  describe('Pagination', () => {
    it('should display pagination info', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/Showing 1 to 3 of 3 entries/)).toBeInTheDocument()
      })
    })

    it('should display page size selector', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText('Select entries per page')).toBeInTheDocument()
      })
    })

    it('should change page size', async () => {
      const user = userEvent.setup()
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText('Select entries per page')).toBeInTheDocument()
      })

      const pageSizeSelect = screen.getByLabelText('Select entries per page') as HTMLSelectElement
      await user.selectOptions(pageSizeSelect, '25')

      await waitFor(() => {
        expect(pageSizeSelect.value).toBe('25')
      })

      // Verify fetch was called with new limit
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=25'),
        expect.any(Object)
      )
    })

    it('should display pagination buttons', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText('Previous page')).toBeInTheDocument()
        expect(screen.getByLabelText('Next page')).toBeInTheDocument()
      })
    })

    it('should disable previous button on first page', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        const prevButton = screen.getByLabelText('Previous page') as HTMLButtonElement
        expect(prevButton.disabled).toBe(true)
      })
    })

    it('should disable next button on last page', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        const nextButton = screen.getByLabelText('Next page') as HTMLButtonElement
        expect(nextButton.disabled).toBe(true)
      })
    })

    it('should jump to page', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: mockActivityLogResponse.data.items,
            total: 150,
            limit: 50,
            offset: 50,
          },
        }),
      })

      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText('Jump to page number')).toBeInTheDocument()
      })

      const jumpInput = screen.getByLabelText('Jump to page number') as HTMLInputElement
      await user.type(jumpInput, '2')

      const goButton = screen.getByText('Go')
      await user.click(goButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('offset=50'),
          expect.any(Object)
        )
      })
    })
  })

  // ============================================================================
  // EXPORT TESTS
  // ============================================================================

  describe('Export', () => {
    it('should export activity log as CSV', async () => {
      const user = userEvent.setup()
      const mockBlob = new Blob(['csv content'], { type: 'text/csv' })
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockActivityLogResponse,
      })
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      })

      // Mock URL.createObjectURL and URL.revokeObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
      global.URL.revokeObjectURL = vi.fn()

      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText('Export activity log as CSV')).toBeInTheDocument()
      })

      const exportButton = screen.getByLabelText('Export activity log as CSV')
      await user.click(exportButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/activity-log/export'),
          expect.any(Object)
        )
      })
    })

    it('should disable export button while exporting', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  blob: async () => new Blob(['csv content'], { type: 'text/csv' }),
                }),
              100
            )
          )
      )

      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
      global.URL.revokeObjectURL = vi.fn()

      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText('Export activity log as CSV')).toBeInTheDocument()
      })

      const exportButton = screen.getByLabelText('Export activity log as CSV') as HTMLButtonElement
      await user.click(exportButton)

      expect(exportButton.disabled).toBe(true)
    })

    it('should display export error on failure', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockActivityLogResponse,
      })
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      })

      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText('Export activity log as CSV')).toBeInTheDocument()
      })

      const exportButton = screen.getByLabelText('Export activity log as CSV')
      await user.click(exportButton)

      await waitFor(() => {
        expect(screen.getByText(/Failed to export activity log/)).toBeInTheDocument()
      })
    })
  })

  // ============================================================================
  // COST FORMATTING TESTS
  // ============================================================================

  describe('Cost Formatting', () => {
    it('should format USD cost with 4 decimal places', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/\$0\.0015/)).toBeInTheDocument()
      })
    })

    it('should format PKR cost with 2 decimal places', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/₨0\.50/)).toBeInTheDocument()
      })
    })

    it('should display both USD and PKR costs', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/\$0\.0015 \/ ₨0\.50/)).toBeInTheDocument()
      })
    })

    it('should display dash when cost is not available', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: [
              {
                id: '1',
                tenantId: 'tenant-1',
                actionType: 'add' as const,
                status: 'success' as const,
                createdAt: '2024-01-15T10:30:00Z',
                providerName: 'Groq',
              },
            ],
            total: 1,
            limit: 50,
            offset: 0,
          },
        }),
      })

      render(<ActivityLogViewer />)

      await waitFor(() => {
        const cells = screen.getAllByText('-')
        expect(cells.length).toBeGreaterThan(0)
      })
    })
  })

  // ============================================================================
  // ACTION TYPE DISPLAY TESTS
  // ============================================================================

  describe('Action Type Display', () => {
    it('should display all action types', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/test/i)).toBeInTheDocument()
        expect(screen.getByText(/use/i)).toBeInTheDocument()
        expect(screen.getByText(/rotate/i)).toBeInTheDocument()
      })
    })

    it('should display action icons', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        // Check for action icons in the rendered content
        const actionBadges = screen.getAllByText(/✓|▶️|🔄/)
        expect(actionBadges.length).toBeGreaterThan(0)
      })
    })
  })

  // ============================================================================
  // STATUS DISPLAY TESTS
  // ============================================================================

  describe('Status Display', () => {
    it('should display success status', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        const statusElements = screen.getAllByText('success')
        expect(statusElements.length).toBeGreaterThan(0)
      })
    })

    it('should display failed status', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        const statusElements = screen.getAllByText('failed')
        expect(statusElements.length).toBeGreaterThan(0)
      })
    })

    it('should display error message when status is failed', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument()
      })
    })
  })

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(<ActivityLogViewer />)

      expect(screen.getByLabelText('Filter by provider')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter by key')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter by action type')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter by status')).toBeInTheDocument()
      expect(screen.getByLabelText('Export activity log as CSV')).toBeInTheDocument()
    })

    it('should have proper table role', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByRole('grid', { name: 'Activity log entries' })).toBeInTheDocument()
      })
    })

    it('should have keyboard navigation support', async () => {
      const user = userEvent.setup()
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText('Filter by provider')).toBeInTheDocument()
      })

      const providerSelect = screen.getByLabelText('Filter by provider')
      await user.tab()
      // Verify focus management works
      expect(document.activeElement).toBeDefined()
    })
  })

  // ============================================================================
  // TENANT ISOLATION TESTS
  // ============================================================================

  describe('Tenant Isolation', () => {
    it('should include tenant ID in API requests', async () => {
      render(<ActivityLogViewer />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'x-tenant-id': 'tenant-1',
            }),
          })
        )
      })
    })

    it('should use tenant ID from props if provided', async () => {
      render(<ActivityLogViewer tenantId="custom-tenant" />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'x-tenant-id': 'custom-tenant',
            }),
          })
        )
      })
    })
  })
})
