import { useRef } from 'react'
import { visualizers } from '../visualizers'
import { useSettings } from '../store/useSettings'
import { useAudioAnalyser } from '../providers/AudioAnalyserProvider'

export function Controls() {
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const { setAudioElement, audioElement } = useAudioAnalyser()

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    if (!audioElement) return
    audioElement.src = url
    audioElement.play().catch(() => {})
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">AudioViz</h2>
          <p className="text-xs text-neutral-400">Real-time audio visualizer</p>
        </div>
        <button className="btn" onClick={() => document.documentElement.classList.toggle('dark')}>
          Toggle Dark
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-300">Visualizer</span>
          <select
            className="select"
            value={settings.selectedId}
            onChange={(e) => settings.setSelectedId(e.target.value)}
          >
            {Object.values(visualizers).map(({ meta }) => (
              <option key={meta.id} value={meta.id}>
                {meta.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-300">Upload Audio</span>
          <input ref={fileRef} type="file" accept="audio/*" onChange={onFileChange} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-300">Color A</span>
          <input
            className="select"
            type="color"
            value={settings.colorA}
            onChange={(e) => settings.update({ colorA: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-300">Color B</span>
          <input
            className="select"
            type="color"
            value={settings.colorB}
            onChange={(e) => settings.update({ colorB: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-300">Particles</span>
          <input
            className="select"
            type="range"
            min={250}
            max={6000}
            value={settings.particleCount}
            onChange={(e) => settings.update({ particleCount: Number(e.target.value) })}
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.wireframe}
            onChange={(e) => settings.update({ wireframe: e.target.checked })}
          />
          <span className="text-sm text-neutral-300">Wireframe</span>
        </label>
      </div>
    </div>
  )
}

export default Controls


