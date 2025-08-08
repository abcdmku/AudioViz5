import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import Meyda from 'meyda'

export interface AudioAnalyserContextValue {
  audioElement: HTMLAudioElement | null
  setAudioElement: (el: HTMLAudioElement | null) => void
  audioContext: AudioContext | null
  analyserNode: AnalyserNode | null
  threeAnalyser: THREE.AudioAnalyser | null
  data: {
    frequency: Uint8Array
    waveform: Uint8Array
    rms: number
    beat: {
      isOnset: boolean
      confidence: number
    }
  }
}

const AudioAnalyserContext = createContext<AudioAnalyserContextValue | null>(null)

export function useAudioAnalyser() {
  const ctx = useContext(AudioAnalyserContext)
  if (!ctx) throw new Error('useAudioAnalyser must be used within AudioAnalyserProvider')
  return ctx
}

interface Props {
  children: React.ReactNode
}

export function AudioAnalyserProvider({ children }: Props) {
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)
  const [threeAnalyser, setThreeAnalyser] = useState<THREE.AudioAnalyser | null>(null)

  const frequency = useMemo(() => new Uint8Array(1024), [])
  const waveform = useMemo(() => new Uint8Array(1024), [])
  const [rms, setRms] = useState(0)
  const beatRef = useRef({ isOnset: false, confidence: 0 })

  useEffect(() => {
    if (!audioElement) return

    // Ensure a single AudioContext shared by Three.js and WebAudio nodes
    const listener = new THREE.AudioListener()
    const ctx = listener.context as AudioContext
    const source = ctx.createMediaElementSource(audioElement)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.85
    // Chain: source -> analyser -> destination
    source.connect(analyser)
    analyser.connect(ctx.destination)

    // Feed the same source into Three.js audio graph (same context)
    const threeAudio = new THREE.Audio(listener)
    threeAudio.setNodeSource(source)
    const threeAnalyserLocal = new THREE.AudioAnalyser(threeAudio, 2048)

    setAudioContext(ctx)
    setAnalyserNode(analyser)
    setThreeAnalyser(threeAnalyserLocal)

    let meydaAnalyzer: Meyda.MeydaAnalyzer | null = null
    try {
      meydaAnalyzer = Meyda.createMeydaAnalyzer({
        audioContext: ctx,
        source: source as unknown as AudioNode,
        bufferSize: 2048,
        featureExtractors: ['rms', 'perceptualSpread', 'perceptualSharpness'],
        callback: (features) => {
          setRms(features.rms ?? 0)
        },
      })
      meydaAnalyzer.start()
    } catch {
      // silent fail; meyda may not initialize if context is suspended
    }

    // Ensure context resumes on first user gesture
    const resume = () => {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    }
    window.addEventListener('click', resume, { once: true })
    audioElement.addEventListener('play', resume, { once: true })

    let raf = 0
    const tick = () => {
      analyser.getByteFrequencyData(frequency)
      analyser.getByteTimeDomainData(waveform)

      // simple onset detection based on RMS threshold and slope
      const currentRms = rms
      const avg = frequency.reduce((a, b) => a + b, 0) / frequency.length
      const isOnset = avg > 140 && currentRms > 0.08
      beatRef.current = {
        isOnset,
        confidence: Math.min(1, Math.max(0, (avg - 100) / 155)),
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      meydaAnalyzer?.stop()
      threeAnalyserLocal.analyser.disconnect()
      analyser.disconnect()
      source.disconnect()
      ctx.close()
      window.removeEventListener('click', resume)
      audioElement.removeEventListener('play', resume)
      setAudioContext(null)
      setAnalyserNode(null)
      setThreeAnalyser(null)
    }
  }, [audioElement])

  const value: AudioAnalyserContextValue = {
    audioElement,
    setAudioElement,
    audioContext,
    analyserNode,
    threeAnalyser,
    data: {
      frequency,
      waveform,
      rms,
      beat: beatRef.current,
    },
  }

  return (
    <AudioAnalyserContext.Provider value={value}>{children}</AudioAnalyserContext.Provider>
  )
}


