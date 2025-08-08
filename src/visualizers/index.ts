import type { VisualizerComponent, VisualizerMeta } from '../types/visualizer'

// Re-export each visualizer here for discoverability
import { Bars3D, bars3DMeta } from './presets/Bars3D'
import { ParticleField, particleFieldMeta } from './presets/ParticleField'
import { WaveTunnel, waveTunnelMeta } from './presets/WaveTunnel'
import { PulseSphere, pulseSphereMeta } from './presets/PulseSphere'
import { AbstractBloom, abstractBloomMeta } from './presets/AbstractBloom'
import { WaveKnot, waveKnotMeta } from './presets/WaveKnot'

export const visualizers: Record<string, { Component: VisualizerComponent; meta: VisualizerMeta }> = {
  [bars3DMeta.id]: { Component: Bars3D, meta: bars3DMeta },
  [particleFieldMeta.id]: { Component: ParticleField, meta: particleFieldMeta },
  [waveTunnelMeta.id]: { Component: WaveTunnel, meta: waveTunnelMeta },
  [pulseSphereMeta.id]: { Component: PulseSphere, meta: pulseSphereMeta },
  [abstractBloomMeta.id]: { Component: AbstractBloom, meta: abstractBloomMeta },
  [waveKnotMeta.id]: { Component: WaveKnot, meta: waveKnotMeta },
}

export type AvailableVisualizerId = keyof typeof visualizers


