import type { ReactNode } from 'react'
import type * as THREE from 'three'

export type VisualizerId = string

export interface VisualizerProps {
  analyser: THREE.AudioAnalyser | null
  analyserData: {
    frequency: Uint8Array
    waveform: Uint8Array
    rms: number
    beat: {
      isOnset: boolean
      confidence: number
    }
    bands?: {
      lowAvg: number
      midAvg: number
      highAvg: number
      onsets: {
        kick: boolean
        snare: boolean
        hat: boolean
      }
    }
  }
  /** Scene-wide user controls */
  settings: {
    colorA: string
    colorB: string
    particleCount: number
    animationSpeed: number
    wireframe: boolean
  }
  /** Optional camera/orbit preferences a preset can render */
  cameraControls?: {
    enablePan?: boolean
    enableZoom?: boolean
    enableRotate?: boolean
    damping?: number
    autoRotate?: boolean
    autoRotateSpeed?: number
    target?: [number, number, number]
    position?: [number, number, number]
  }
}

export interface VisualizerMeta {
  id: VisualizerId
  name: string
  description?: string
  author?: string
  /** Optional config UI as ReactNode (e.g., controls) */
  controls?: ReactNode
}

export type VisualizerComponent = (props: VisualizerProps) => ReactNode


