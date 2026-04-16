import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-[#0a0e27] to-black text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-[#00d4ff] to-[#0066cc] bg-clip-text text-transparent">
            AI Provider Management
          </h1>
          <p className="text-xl text-[#00d4ff] opacity-80">
            Manage your AI service providers, keys, voices, and costs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Voice Studio */}
          <Link href="/voice-studio" className="group">
            <div className="bg-[#0a0e27] border border-[#00d4ff]/20 rounded-xl p-8 hover:border-[#00d4ff]/50 hover:shadow-[0_0_30px_rgba(0,212,255,0.3)] transition-all duration-300 hover:-translate-y-2">
              <div className="text-4xl mb-4">🎙️</div>
              <h2 className="text-2xl font-bold mb-2 text-[#00d4ff]">Voice Studio</h2>
              <p className="text-gray-400">Configure TTS voices for English and Urdu with 5 providers</p>
            </div>
          </Link>

          {/* Cost Dashboard */}
          <Link href="/cost-dashboard" className="group">
            <div className="bg-[#0a0e27] border border-[#00d4ff]/20 rounded-xl p-8 hover:border-[#00d4ff]/50 hover:shadow-[0_0_30px_rgba(0,212,255,0.3)] transition-all duration-300 hover:-translate-y-2">
              <div className="text-4xl mb-4">📊</div>
              <h2 className="text-2xl font-bold mb-2 text-[#00d4ff]">Cost Intelligence</h2>
              <p className="text-gray-400">Track spending, analyze costs, and optimize provider selection</p>
            </div>
          </Link>

          {/* Activity Log */}
          <Link href="/activity-log" className="group">
            <div className="bg-[#0a0e27] border border-[#00d4ff]/20 rounded-xl p-8 hover:border-[#00d4ff]/50 hover:shadow-[0_0_30px_rgba(0,212,255,0.3)] transition-all duration-300 hover:-translate-y-2">
              <div className="text-4xl mb-4">📋</div>
              <h2 className="text-2xl font-bold mb-2 text-[#00d4ff]">Activity Log</h2>
              <p className="text-gray-400">View and analyze all API key operations and events</p>
            </div>
          </Link>
        </div>

        <div className="mt-16 text-center">
          <div className="inline-block bg-[#0a0e27] border border-[#00d4ff]/20 rounded-xl p-8">
            <h3 className="text-xl font-bold mb-4 text-[#00d4ff]">System Status</h3>
            <div className="grid grid-cols-2 gap-8 text-left">
              <div>
                <div className="text-sm text-gray-400 mb-1">Providers</div>
                <div className="text-2xl font-bold">11</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Models</div>
                <div className="text-2xl font-bold">12</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Voices</div>
                <div className="text-2xl font-bold">26</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Status</div>
                <div className="text-2xl font-bold text-[#00ff88]">✓ Live</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
