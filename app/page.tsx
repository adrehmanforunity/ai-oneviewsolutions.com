import dynamic from 'next/dynamic'

const Scene = dynamic(() => import('@/components/Scene'), { ssr: false })

export default function Home() {
  return (
    <main className="w-full h-screen bg-black">
      <Scene />
      <div className="absolute bottom-8 left-8 text-white z-10">
        <h1 className="text-3xl font-bold text-cyan-400">AgenticVR</h1>
        <p className="text-sm text-gray-400 mt-2">AI Provider Management</p>
      </div>
      <div className="absolute top-8 right-8 text-white z-10 text-right">
        <p className="text-sm text-gray-400">Coming Soon</p>
        <p className="text-xs text-gray-500 mt-1">aidemo.oneviewsolutions.com</p>
      </div>
    </main>
  )
}
