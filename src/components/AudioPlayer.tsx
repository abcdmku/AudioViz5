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
    return () => setAudioElement(null)
  }, [setAudioElement])

  return (
    <div className="w-full">
      <audio
        ref={audioRef}
        src={src}
        controls
        className="w-full mt-2"
        crossOrigin="anonymous"
      />
    </div>
  )
}

export default AudioPlayer


