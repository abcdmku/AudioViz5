import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import { Environment, OrbitControls } from '@react-three/drei'
import CinematicEffects from '../environments/CinematicEffects'

export const bars3DRadiateMeta: VisualizerMeta = {
  id: 'bars-3d-radiate',
  name: '3D Radiating Bars',
  description: 'Top-down grid, audio radiates from center, color = frequency, height = loudness, frequency compensation',
}

export const Bars3DRadiate: VisualizerComponent = ({ analyserData, settings }) => {
  const group = useRef<THREE.Group>(null)
  const gridSize = 128
  const total = gridSize * gridSize
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const meshRef = useRef<THREE.InstancedMesh>(null)

  // Pulse/ripple system (time-domain onset radiance)
  const MAX_PULSES = 128
  const RIPPLE_SIGMA = 5 // Controls ripple width
  const RIPPLE_STRENGTH = 3 // Controls ripple amplitude
  const RIPPLE_DECAY = 7 // Pulse amplitude half-life (seconds)
  const RIPPLE_TRAVEL_SPEED = 150 // Speed of pulses (grid units per second)
  const PULSE_MIN_AMP = 0.0002 // Minimum amplitude before pulse is removed
  const pulses = useRef<{ radius: number; amp: number; sigma?: number }[]>([])
  const prevRms = useRef(0)

  // Color gradient for frequency
  const colorA = new THREE.Color(settings.colorA)
  const colorB = new THREE.Color(settings.colorB)
  const colors = useMemo(() => new Float32Array(total * 3), [total])

  useMemo(() => {
    for (let i = 0; i < total; i++) {
      // Color by frequency index (radial distance)
      const t = i / total
      const c = colorA.clone().lerp(colorB, t)
      colors[i * 3 + 0] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
  }, [colors, total, colorA, colorB])

  useFrame((_, delta) => {
    if (!meshRef.current || !analyserData?.frequency) return
    const freq = analyserData.frequency
    // Onset detection (time domain)
    const rms = analyserData.rms
    const rmsSpike = rms > prevRms.current * 1.22 && rms > 0.04
    // Calculate spectral centroid (weighted average frequency)
    let centroid = 0, total = 0
    for (let i = 0; i < freq.length; i++) {
      centroid += i * freq[i]
      total += freq[i]
    }
    centroid = total > 0 ? centroid / total : 0
    // Normalize centroid to [0,1]
    const centroidNorm = freq.length > 0 ? centroid / freq.length : 0
    // Boost pulse amplitude if centroid is high (mids/highs)
    // Also trigger extra ripples for strong mids/highs
    const onset = analyserData.beat.isOnset || rmsSpike
    if (onset) {
      // Always trigger a strong pulse for beat/rms spike
      const ampBoost = 1.5 + centroidNorm * 3.5 // up to 5x for highs
      // Bass = wider, highs = narrower
      const sigma = 7 - centroidNorm * 5 // 7 for bass, 2 for highs
      pulses.current.unshift({ radius: 0, amp: ampBoost, sigma })
      // If centroid is high, trigger additional ripples for mids/highs
      if (centroidNorm > 0.45) {
        pulses.current.unshift({ radius: 0, amp: ampBoost * 0.8, sigma: Math.max(2, sigma * 0.7) })
      }
      if (centroidNorm > 0.7) {
        pulses.current.unshift({ radius: 0, amp: ampBoost * 0.6, sigma: Math.max(2, sigma * 0.5) })
      }
      // Do not filter pulses immediately, allow overlap for fast BPM
      while (pulses.current.length > MAX_PULSES) pulses.current.pop()
    }
    prevRms.current = rms
    // Move pulses and decay amplitude
    for (const p of pulses.current) {
      p.radius += RIPPLE_TRAVEL_SPEED * delta
      p.amp *= Math.pow(0.5, delta / RIPPLE_DECAY)
    }
    // Remove weak pulses
    pulses.current = pulses.current.filter((p) => p.amp > PULSE_MIN_AMP)

    let i = 0
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        // Center coordinates
        const cx = x - gridSize / 2 + 0.5
        const cy = y - gridSize / 2 + 0.5
        // Radial distance from center
        const r = Math.sqrt(cx * cx + cy * cy)
        // Only radial ripples: bar height is sum of all pulses at this radius
        let rippleSum = 0
        for (const p of pulses.current) {
          const sigma = p.sigma || RIPPLE_SIGMA
          const d = Math.abs(r - p.radius)
          const g = Math.exp(- (d * d) / (sigma * sigma))
          rippleSum += g * p.amp
        }
        const v = rippleSum * RIPPLE_STRENGTH
        dummy.position.set(cx, v / 2, cy)
        dummy.scale.set(0.7, Math.max(0.05, v), 0.7)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
        i++
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    // Rotate group around a dynamic axis for non-linear effect
    if (group.current) {
      const t = performance.now() * 0.0002
      group.current.rotation.x = Math.PI / 2 + Math.sin(t) * 0.3
      group.current.rotation.y = Math.sin(t * 1.7) * 0.7
      group.current.rotation.z = Math.cos(t * 1.3) * 0.5
    }
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[0, 10, 0]} intensity={1.2} />
      <Environment preset={'city' as any} />
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        enableDamping
        dampingFactor={0.1}
        autoRotate
        autoRotateSpeed={0.5}
        target={[0, 0, 0]}
      />
      <group ref={group}>
        <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, total]}>
          <boxGeometry args={[1, 1, 1]}>
            <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
          </boxGeometry>
          <meshStandardMaterial vertexColors wireframe={settings.wireframe} />
        </instancedMesh>
      </group>
      <CinematicEffects />
    </>
  )
}
