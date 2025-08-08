import { useMemo } from 'react'
import { AudioAnalyserProvider, useAudioAnalyser } from './providers/AudioAnalyserProvider'
import Controls from './components/Controls'
import AudioPlayer from './components/AudioPlayer'
import { useSettings } from './store/useSettings'
import { visualizers } from './visualizers'
import { Canvas } from '@react-three/fiber'

function App() {
  const settings = useSettings()
  const selected = useMemo(() => visualizers[settings.selectedId] ?? null, [settings.selectedId])

  function VisualizerMount() {
    const { threeAnalyser, data } = useAudioAnalyser()
    if (!selected?.Component) return null
    return (
      <selected.Component
        analyser={threeAnalyser}
        analyserData={data as any}
        settings={{
          colorA: settings.colorA,
          colorB: settings.colorB,
          particleCount: settings.particleCount,
          animationSpeed: settings.animationSpeed,
          wireframe: settings.wireframe,
        }}
      />
    )
  }

  return (
    <AudioAnalyserProvider>
      <div className="relative h-screen w-screen overflow-hidden">
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 8], fov: 60 }} style={{ position: 'absolute', inset: 0 }}>
          <color attach="background" args={[0x0a0a0a]} />
          <VisualizerMount />
        </Canvas>
        {/* Top-left glass panel */}
        <div className="pointer-events-auto absolute top-4 left-4 right-4 md:right-auto md:w-[420px] z-10">
          <Controls />
        </div>
        {/* Bottom glass player */}
        <div className="pointer-events-auto absolute bottom-4 left-4 right-4 z-10">
          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800/70 rounded-xl shadow-lg p-3 flex items-center justify-between">
            <div className="text-sm text-neutral-300">Selected: {selected?.meta.name}</div>
            <AudioPlayer />
          </div>
        </div>
      </div>
    </AudioAnalyserProvider>
  )
}

export default App
