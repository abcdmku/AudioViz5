import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import CinematicEffects from '../environments/CinematicEffects'
import { OrbitControls } from '@react-three/drei'

export const particleFieldMeta: VisualizerMeta = {
  id: 'particle-field',
  name: 'Particle Field',
  description: 'Floating particles pulsing to beats',
}

export const ParticleField: VisualizerComponent = ({ analyserData, settings }) => {
  const points = useRef<THREE.Points>(null)
  const count = Math.max(500, settings.particleCount)

  const { positions, bands, phases, hues } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const b = new Uint16Array(count)
    const ph = new Float32Array(count)
    const h = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 60
      pos[i * 3 + 1] = (Math.random() - 0.5) * 60
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60
      b[i] = Math.floor(Math.random() * 16)
      ph[i] = Math.random() * Math.PI * 2
      // assign vibrant hue per particle
      h[i] = Math.random()
    }
    return { positions: pos, bands: b, phases: ph, hues: h }
  }, [count])

  // Keep global colors for potential future blending; not used directly per-particle now
  // const colorA = useMemo(() => new THREE.Color(settings.colorA), [settings.colorA])
  // const colorB = useMemo(() => new THREE.Color(settings.colorB), [settings.colorB])

  const matRef = useRef<THREE.PointsMaterial>(null)
  const { camera, clock } = useThree()

  useFrame((_) => {
    if (!points.current) return

    const t = clock.getElapsedTime() * 0.15 * (settings.animationSpeed || 1)
    const radius = 50
    const height = Math.sin(t * 0.7) * 10
    // Keep camera within a shell around the swarm to avoid losing it
    camera.position.set(Math.cos(t) * (radius * 0.9), height, Math.sin(t) * (radius * 0.9))
    camera.lookAt(0, 0, 0)

    const freq = analyserData.frequency
    const bucketSize = Math.max(1, Math.floor(freq.length / 16))
    const geometry = points.current.geometry as THREE.BufferGeometry
    const arrPos = (geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array

    for (let i = 0; i < count; i++) {
      const band = bands[i]
      const start = band * bucketSize
      const end = Math.min(freq.length, start + bucketSize)
      let sum = 0
      for (let j = start; j < end; j++) sum += freq[j]
      const energy = (sum / (end - start)) / 255
      const baseX = positions[i * 3 + 0]
      const baseY = positions[i * 3 + 1]
      const baseZ = positions[i * 3 + 2]
      const phase = phases[i]

      const wobble = Math.sin(t * 2.0 + phase) * 0.6
      const push = 1.0 + energy * 1.4 + (analyserData.beat.isOnset ? 0.8 : 0)
      arrPos[i * 3 + 0] = baseX * push + wobble
      arrPos[i * 3 + 1] = baseY * push + wobble * 0.5
      arrPos[i * 3 + 2] = baseZ * push + wobble
    }

    ;(geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true

    const avg = freq.reduce((a, b) => a + b, 0) / freq.length / 255
    if (matRef.current) {
      const target = 0.35 + avg * 0.7 + (analyserData.beat.isOnset ? 1.2 : 0)
      matRef.current.size = THREE.MathUtils.lerp(matRef.current.size, target, 0.18)
    }

    // Per-particle vibrant colors based on band assignment and hue
    // We implement per-vertex color by creating/setting a color attribute once
    if (!geometry.getAttribute('color')) {
      const colors = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const hue = hues[i]
        const tmp = new THREE.Color().setHSL(hue, 0.85, 0.6)
        colors[i * 3 + 0] = tmp.r
        colors[i * 3 + 1] = tmp.g
        colors[i * 3 + 2] = tmp.b
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
  })

  return (
    <>
      <OrbitControls enablePan enableZoom enableRotate enableDamping dampingFactor={0.1} />
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
      <pointsMaterial ref={matRef} size={0.2} sizeAttenuation transparent opacity={0.9} vertexColors />
      </points>
      <CinematicEffects />
    </>
  )
}


