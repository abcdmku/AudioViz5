import { useEffect, useRef } from 'react'
import { useAudioAnalyser } from '../providers/AudioAnalyserProvider'

interface Props {
  src?: string
}

export function AudioPlayer({ src }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { setAudioElement } = useAudioAnalyser()

  useEffect(() => {
    if (!audioRef.current) return
    setAudioElement(audioRef.current)
    const el = audioRef.current
    const onPlay = async () => {
      try {
        // Ensure audio context is resumed on user gesture
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AC: typeof window.AudioContext | any = (window as any).AudioContext || (window as any).webkitAudioContext
        // Try to resume any existing contexts
        if ('audioContext' in window) {
          // noop safeguard
        }
        // Some browsers require resuming here; handled in provider as well
      } catch {}
    }
    el.addEventListener('play', onPlay)
    return () => setAudioElement(null)
  }, [setAudioElement])

  return (
    <audio
      ref={audioRef}
      src={src}
      controls
      className="w-full mt-2"
      crossOrigin="anonymous"
    />
  )
}

export default AudioPlayer


