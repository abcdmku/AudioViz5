import { useRef } from 'react'
import { visualizers } from '../visualizers'
import { useSettings } from '../store/useSettings'
import { useAudioAnalyser } from '../providers/AudioAnalyserProvider'
import React from 'react'

export function Controls() {
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const { setAudioElement, audioElement } = useAudioAnalyser()
  const [selectedFileName, setSelectedFileName] = React.useState('Choose File');

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setSelectedFileName(file.name)
    if (!audioElement) return
    audioElement.src = url
    audioElement.play().catch(() => {})
  }

  return (
    <div className="card p-4 flex flex-col gap-2 max-w-xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-lg font-semibold">AudioViz</h2>
          <p className="text-xs text-neutral-400">Real-time audio visualizer</p>
        </div>
        <label className="flex flex-col gap-1 min-w-[140px]">
          <span className="text-xs text-neutral-400">Upload Audio</span>
          <div className="relative w-full">
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              onChange={onFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <button
              type="button"
              className="w-full px-3 py-1 rounded bg-neutral-800 text-neutral-200 font-medium shadow hover:bg-neutral-700 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-neutral-600 text-xs text-left overflow-hidden whitespace-nowrap"
              onClick={() => fileRef.current?.click()}
            >
              {selectedFileName.length > 18
                  ? selectedFileName.substring(0, 15) + '...'
                  : selectedFileName}
              </button>
          </div>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <label className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-xs text-neutral-400">Visualizer</span>
          <select
            className="select px-2 py-1 rounded bg-neutral-900 text-neutral-200 text-xs"
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

        <div className="flex gap-2 items-center">
          <label className="flex flex-col items-center gap-1">
            <span className="text-xs text-neutral-400">Color A</span>
            <input
              className="w-8 h-8 border border-neutral-700 shadow focus:ring-2 focus:ring-indigo-500 transition-all duration-150 cursor-pointer bg-neutral-900"
              type="color"
              value={settings.colorA}
              onChange={(e) => settings.update({ colorA: e.target.value })}
              aria-label="Color A"
            />
          </label>
          <label className="flex flex-col items-center gap-1">
            <span className="text-xs text-neutral-400">Color B</span>
            <input
              className="w-8 h-8 border border-neutral-700 shadow focus:ring-2 focus:ring-indigo-500 transition-all duration-150 cursor-pointer bg-neutral-900"
              type="color"
              value={settings.colorB}
              onChange={(e) => settings.update({ colorB: e.target.value })}
              aria-label="Color B"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 min-w-[90px]">
          <input
            type="checkbox"
            checked={settings.wireframe}
            onChange={(e) => settings.update({ wireframe: e.target.checked })}
            className="accent-neutral-700"
          />
          <span className="text-xs text-neutral-400">Wireframe (Not all presets support this)</span>
        </label>
      </div>
    </div>
  )
}

export default Controls


