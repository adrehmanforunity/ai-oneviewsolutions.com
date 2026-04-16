/**
 * Activity Log Page
 * 
 * This page displays the Activity Log viewer for Tenant Admins
 * to view and analyze API key operations.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
 */

import ActivityLogViewer from '@/components/ActivityLogViewer'

export const metadata = {
  title: 'Activity Log',
  description: 'View and analyze API key operations',
}

export default function ActivityLogPage() {
  return <ActivityLogViewer />
}
