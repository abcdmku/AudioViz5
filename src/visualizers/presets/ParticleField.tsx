import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import CinematicEffects from '../environments/CinematicEffects'

export const particleFieldMeta: VisualizerMeta = {
  id: 'particle-field',
  name: 'Particle Field',
  description: 'Floating particles pulsing to beats',
}

export const ParticleField: VisualizerComponent = ({ analyserData, settings }) => {
  // --- Editable Parameters ---
  const points = useRef<THREE.Points>(null)
  const matRef = useRef<THREE.PointsMaterial>(null)
  const freq = analyserData.frequency
  // Number of particles
  const particleCount = 512 * 16 // Change this value to set the number of particles
  const count = particleCount
  // Sphere shape
  const baseRadius = 28
  const radiusVariance = 10
  // Particle shell limits
  const minParticleRadius = 18
  const maxParticleRadius = 38
  // Color
  const colorSaturation = 3
  const colorLightness = .5
  // Axis randomness
  const axisRandomness = 0.1
  // Speed range
  const minSpeed = 0.0001
  const maxSpeed = 0.001
  // Orbit camera
  const cameraOrbitRadius = 55
  const cameraOrbitYOffset = 8
  const cameraOrbitYStrength = 18
  const cameraOrbitSpeed = 0.18
  // Particle size
  const baseParticleSize = 0.1
  // Color lerp to white
  const colorLerpStrength = 0
  
  // --- Particle Generation ---
  const { positions, colors, axes, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const cols = new Float32Array(count * 3)
    const axesArr = []
    const speedsArr = []
  for (let i = 0; i < count; i++) {
      // Spherical coordinates for even distribution
      const phi = Math.acos(1 - 2 * (i + 0.5) / count)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i
      const r = baseRadius + Math.sin(i * 0.7) * radiusVariance
      pos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
      // Color by frequency bin (HSL gradient)
      const hue = i / count
      const color = new THREE.Color().setHSL(hue, colorSaturation, colorLightness)
      cols[i * 3 + 0] = color.r
      cols[i * 3 + 1] = color.g
      cols[i * 3 + 2] = color.b
      // Random axis for rotation
      const axis = new THREE.Vector3(
        Math.random() * 2 * axisRandomness - axisRandomness,
        Math.random() * 2 * axisRandomness - axisRandomness,
        Math.random() * 2 * axisRandomness - axisRandomness
      ).normalize()
      axesArr.push(axis)
      // Random speed for rotation
      speedsArr.push(minSpeed + Math.random() * (maxSpeed - minSpeed))
    }
    return { positions: pos, colors: cols, axes: axesArr, speeds: speedsArr }
  }, [count, baseRadius, radiusVariance, colorSaturation, colorLightness, axisRandomness, minSpeed, maxSpeed])

  // Camera animation
  const camAngle = useRef(0)
  useFrame(({ camera }, delta) => {
    camAngle.current += delta * cameraOrbitSpeed * (settings.animationSpeed || 1)
    camera.position.set(
      Math.cos(camAngle.current) * cameraOrbitRadius,
      Math.sin(camAngle.current * 0.7) * cameraOrbitYStrength + cameraOrbitYOffset,
      Math.sin(camAngle.current) * cameraOrbitRadius
    )
    camera.lookAt(0, 0, 0)

    if (!points.current) return
    const geometry = points.current.geometry as THREE.BufferGeometry
    const arrPos = (geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    const arrCol = (geometry.getAttribute('color') as THREE.BufferAttribute).array as Float32Array

    for (let i = 0; i < count; i++) {
      // Loudness for this bin
      // If there are more particles than frequency bins, wrap around
      const loud = freq[i % freq.length] / 255
      // Animate position with audio and electron-like orbit
      const base = new THREE.Vector3(
        positions[i * 3 + 0],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      )
      // Rotation axis and speed
      const axis = axes[i]
      const speed = speeds[i]
      // Compute rotation angle
      const angle = camAngle.current * speed + loud * Math.sin(camAngle.current * 2 + i * 0.13) * 0.7
      // Create quaternion for rotation
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angle)
      const rotated = base.clone().applyQuaternion(q)
      // Compute target radius based on loudness
      const baseLen = rotated.length()
      const targetRadius = THREE.MathUtils.lerp(minParticleRadius, maxParticleRadius, loud)
      const scale = targetRadius / (baseLen || 1)
      // Pulse outwards with loudness, but clamp to shell
      arrPos[i * 3 + 0] = rotated.x * scale
      arrPos[i * 3 + 1] = rotated.y * scale
      arrPos[i * 3 + 2] = rotated.z * scale
      // Brightness by loudness
      const baseColor = new THREE.Color(arrCol[i * 3 + 0], arrCol[i * 3 + 1], arrCol[i * 3 + 2])
      baseColor.lerp(new THREE.Color(1,1,1), loud * colorLerpStrength)
      arrCol[i * 3 + 0] = baseColor.r
      arrCol[i * 3 + 1] = baseColor.g
      arrCol[i * 3 + 2] = baseColor.b
    }

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    if (colAttr) colAttr.needsUpdate = true;

    // Particle size remains constant
    if (matRef.current) {
      matRef.current.size = baseParticleSize
    }
  })

  return (
    <>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={matRef}
          size={baseParticleSize}
          sizeAttenuation
          transparent
          opacity={0.92}
          vertexColors
        />
      </points>
      <CinematicEffects />
    </>
  )
}


