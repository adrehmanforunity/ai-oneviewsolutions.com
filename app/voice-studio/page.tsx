/**
 * Voice Studio Page
 * Main page for the Voice Studio interface
 */

import VoiceStudio from '@/components/VoiceStudio'

export const metadata = {
  title: 'Voice Studio - AI Provider Management',
  description: 'Configure TTS voices for your tenant',
}

export default function VoiceStudioPage() {
  return <VoiceStudio />
}
