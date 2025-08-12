import type { VisualizerComponent, VisualizerMeta } from '../types/visualizer'

// Re-export each visualizer here for discoverability
import { Bars3D, bars3DMeta } from './presets/Bars3D'
import { Bars3DRadiate, bars3DRadiateMeta } from './presets/Bars3DRadiate'
import { ParticleField, particleFieldMeta } from './presets/ParticleField'
import { WaveTunnel, waveTunnelMeta } from './presets/WaveTunnel'
import { PulseSphere, pulseSphereMeta } from './presets/PulseSphere'
import { AbstractBloom, abstractBloomMeta } from './presets/AbstractBloom'
import { WaveKnot, waveKnotMeta } from './presets/WaveKnot'
import { WaveKnotFat, waveKnotFatMeta } from './presets/WaveKnotFat'
import { WaveKnotOrganic, waveKnotOrganicMeta } from './presets/WaveKnotOrganic'

import { WaveKnotFatParam, waveKnotFatParamMeta } from './presets/WaveKnotFatParam'
import { TunnelRipple, tunnelRippleMeta } from './presets/TunnelRipple'
import { WaveformTunnel, waveformTunnelMeta } from './presets/WaveformTunnel'
import { MorphingContours, morphingContoursMeta } from './presets/MorphingContours'

export const visualizers: Record<string, { Component: VisualizerComponent; meta: VisualizerMeta }> = {
  [bars3DMeta.id]: { Component: Bars3D, meta: bars3DMeta },
  [bars3DRadiateMeta.id]: { Component: Bars3DRadiate, meta: bars3DRadiateMeta },
  [particleFieldMeta.id]: { Component: ParticleField, meta: particleFieldMeta },
  [waveTunnelMeta.id]: { Component: WaveTunnel, meta: waveTunnelMeta },
  [pulseSphereMeta.id]: { Component: PulseSphere, meta: pulseSphereMeta },
  [abstractBloomMeta.id]: { Component: AbstractBloom, meta: abstractBloomMeta },
  [waveKnotMeta.id]: { Component: WaveKnot, meta: waveKnotMeta },
  [waveKnotFatMeta.id]: { Component: WaveKnotFat, meta: waveKnotFatMeta },
  [waveKnotOrganicMeta.id]: { Component: WaveKnotOrganic, meta: waveKnotOrganicMeta },
  [waveKnotFatParamMeta.id]: { Component: WaveKnotFatParam, meta: waveKnotFatParamMeta },
  [tunnelRippleMeta.id]: { Component: TunnelRipple, meta: tunnelRippleMeta },
  [waveformTunnelMeta.id]: { Component: WaveformTunnel, meta: waveformTunnelMeta },
  [morphingContoursMeta.id]: { Component: MorphingContours, meta: morphingContoursMeta },
}

export type AvailableVisualizerId = keyof typeof visualizers


