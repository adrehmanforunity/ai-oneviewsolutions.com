/**
 * Cost Intelligence Dashboard Page
 * 
 * This page displays the Cost Intelligence dashboard for Tenant Admins
 * to track and analyze AI service costs.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10
 */

import CostIntelligence from '@/components/CostIntelligence'

export const metadata = {
  title: 'Cost Intelligence Dashboard',
  description: 'Track and analyze your AI service costs',
}

export default function CostDashboardPage() {
  return <CostIntelligence />
}
