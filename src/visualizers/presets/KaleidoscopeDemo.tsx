import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import Kaleidoscope from '../environments/Kaleidoscope'
import { PerspectiveCamera } from '@react-three/drei'

export const kaleidoscopeDemoMeta: VisualizerMeta = {
  id: 'kaleidoscope-demo',
  name: 'Kaleidoscope Waves',
  description: 'Smooth geometric forms with radiating color waves',
}

export const KaleidoscopeDemo: VisualizerComponent = ({ analyserData, settings }) => {
  // === ADJUSTABLE PARAMETERS ===
  
  // Wave System
  const WAVE_SPEED = 2                    // Speed of wave propagation
  const WAVE_DECAY = 0.95                 // Wave intensity decay rate (0-1)
  const WAVE_SCALE_IMPACT = 3           // Max scale increase from wave
  const WAVE_GLOW_IMPACT = 1.5            // Max glow increase from wave
  
  // Audio Reactivity
  const AUDIO_SCALE_RESPONSE = 0.1       // RMS scale response
  const AUDIO_GLOW_RESPONSE = 0.25        // RMS glow response
  const BASS_ROTATION_BOOST = 0.02        // Bass rotation speed boost
  const FREQ_SCALE_RESPONSE = 0.05        // Per-frequency scale response
  const HIGH_FREQ_OPACITY = 0.1           // High frequency opacity response
  
  // Animation Speeds
  const BASE_ROTATION_SPEED = 0.05        // Main group rotation
  const TORUS_ROTATION_X = 0.1            // Torus X rotation
  const TORUS_ROTATION_Z = 0.05           // Torus Z rotation
  const SATELLITE_ROTATION_X = 0.2        // Satellite X rotation
  const SATELLITE_ROTATION_Y = 0.15       // Satellite Y rotation
  const ORBIT_SPEED = 0.1                 // Satellite orbit speed
  
  // Geometry
  const SATELLITE_RADIUS = 1.2            // Orbital radius for satellites
  const INNER_RING_RADIUS = 0.5           // Radius for inner ring
  const TORUS_BREATHING = 0.02            // Natural breathing amplitude
  
  // Kaleidoscope
  const KALEIDOSCOPE_SEGMENTS = 6         // Number of mirror segments
  const KALEIDOSCOPE_REFLECTIONS = 2      // Internal reflections
  const KALEIDOSCOPE_BASE_SPEED = 0.02    // Base rotation speed
  const KALEIDOSCOPE_AUDIO_SPEED = 4   // Audio rotation boost
  const KALEIDOSCOPE_ZOOM_RESPONSE = 0.2 // Audio zoom response
  
  // === END ADJUSTABLE PARAMETERS ===
  
  const groupRef = useRef<THREE.Group>(null)
  const meshRefs = useRef<THREE.Mesh[]>([])
  const torusRef = useRef<THREE.Mesh>(null)
  const innerMeshRefs = useRef<THREE.Mesh[]>([])
  
  // Wave animation state
  const waveTime = useRef(0)
  const waveIntensity = useRef(0)
  const glowPulse = useRef(0)
  
  useFrame((state, delta) => {
    if (!groupRef.current) return
    
    const time = state.clock.elapsedTime
    const rms = analyserData.rms
    
    // Calculate subtle frequency response
    const bassEnd = Math.floor(analyserData.frequency.length * 0.15)
    let bassEnergy = 0
    for (let i = 0; i < bassEnd; i++) {
      bassEnergy += analyserData.frequency[i]
    }
    bassEnergy = (bassEnergy / bassEnd) / 255
    
    // Trigger wave on beat
    if (analyserData.beat.isOnset) {
      waveTime.current = 0
      waveIntensity.current = analyserData.beat.confidence
      glowPulse.current = 1
    }
    
    // Update wave animation
    waveTime.current += delta * WAVE_SPEED
    waveIntensity.current *= WAVE_DECAY
    glowPulse.current = THREE.MathUtils.lerp(glowPulse.current, 0, 0.05)
    
    // Very slow rotation with subtle audio influence
    groupRef.current.rotation.y += delta * (BASE_ROTATION_SPEED + bassEnergy * BASS_ROTATION_BOOST) * settings.animationSpeed
    
    // Smooth torus animation
    if (torusRef.current) {
      // Gentle breathing with subtle audio response
      const scale = 1 + Math.sin(time * 0.3) * TORUS_BREATHING + rms * AUDIO_SCALE_RESPONSE + bassEnergy * 0.03
      torusRef.current.scale.setScalar(scale)
      
      // Very slow rotation with minor audio influence
      torusRef.current.rotation.x += delta * (TORUS_ROTATION_X + rms * 0.05) * settings.animationSpeed
      torusRef.current.rotation.z += delta * (TORUS_ROTATION_Z + bassEnergy * BASS_ROTATION_BOOST) * settings.animationSpeed
      
      // Update material glow with subtle audio response
      const material = torusRef.current.material as THREE.MeshPhysicalMaterial
      material.emissiveIntensity = 0.1 + glowPulse.current * 0.5 + rms * AUDIO_GLOW_RESPONSE + bassEnergy * 0.1
    }
    
    // Animate satellite meshes with wave effect
    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      
      // Calculate distance from center for wave
      const angle = (i * 60) * Math.PI / 180
      
      // Wave effect - ripples outward from center
      const waveDistance = waveTime.current - (i * 0.1) // Stagger the wave
      const waveEffect = Math.max(0, Math.cos(waveDistance * 2) * Math.exp(-waveDistance * 0.5))
      
      // Get subtle frequency response for this mesh
      const freqIndex = Math.floor((i / 6) * analyserData.frequency.length)
      const freqValue = analyserData.frequency[freqIndex] / 255
      
      // Smooth scale with wave and subtle frequency response
      const scale = 1 + waveEffect * waveIntensity.current * WAVE_SCALE_IMPACT + rms * AUDIO_SCALE_RESPONSE + freqValue * FREQ_SCALE_RESPONSE
      mesh.scale.setScalar(scale)
      
      // Very slow rotation with minor frequency influence
      mesh.rotation.x += delta * (SATELLITE_ROTATION_X + freqValue * 0.03) * settings.animationSpeed
      mesh.rotation.y += delta * (SATELLITE_ROTATION_Y + freqValue * 0.02) * settings.animationSpeed
      
      // Gentle orbital motion with subtle audio drift
      const orbitAngle = angle + time * ORBIT_SPEED + bassEnergy * 0.5
      const audioRadius = SATELLITE_RADIUS + freqValue * 0.05
      mesh.position.x = Math.cos(orbitAngle) * audioRadius
      mesh.position.z = Math.sin(orbitAngle) * audioRadius
      mesh.position.y = Math.sin(i * Math.PI / 3) * 0.1 + freqValue * 0.02
      
      // Update material glow with wave and subtle audio
      const material = mesh.material as THREE.MeshStandardMaterial
      material.emissiveIntensity = 0.1 + waveEffect * waveIntensity.current * WAVE_GLOW_IMPACT + rms * 0.15 + freqValue * 0.1
    })
    
    // Animate inner ring with delayed wave
    innerMeshRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      
      // Delayed wave for inner ring
      const waveDistance = waveTime.current - 0.8 - (i * 0.05)
      const waveEffect = Math.max(0, Math.cos(waveDistance * 3) * Math.exp(-waveDistance * 0.3))
      
      // Gentle pulse with subtle high frequency response
      const highFreqIdx = Math.floor(analyserData.frequency.length * 0.8) + i
      const highFreq = analyserData.frequency[Math.min(highFreqIdx, analyserData.frequency.length - 1)] / 255
      mesh.scale.setScalar(1 + waveEffect * waveIntensity.current * 0.2 + highFreq * 0.03)
      
      // Update opacity with wave and subtle audio
      const material = mesh.material as THREE.MeshBasicMaterial
      material.opacity = 0.3 + waveEffect * waveIntensity.current * 0.5 + rms * 0.15 + highFreq * HIGH_FREQ_OPACITY
    })
  })
  
  return (
    <>
      <color attach="background" args={['#050505']} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.4} />
      <pointLight position={[0, 0, 0]} intensity={0.2} color={settings.colorA} />
      <PerspectiveCamera makeDefault position={[0, 0, 2.5]} fov={75} />

      <group ref={groupRef}>
        {/* Central torus knot */}
        <mesh ref={torusRef}>
          <torusKnotGeometry args={[0.6, 0.15, 128, 32, 2, 3]} />
          <meshPhysicalMaterial
            color={settings.colorA}
            emissive={settings.colorB}
            emissiveIntensity={0.1}
            metalness={0.6}
            roughness={0.4}
            clearcoat={0.3}
            clearcoatRoughness={0.3}
            wireframe={settings.wireframe}
          />
        </mesh>
        
        {/* Ring of geometric shapes */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const rad = (angle * Math.PI) / 180
          const x = Math.cos(rad) * SATELLITE_RADIUS
          const z = Math.sin(rad) * SATELLITE_RADIUS
          const y = Math.sin(i * Math.PI / 3) * 0.1
          
          // Alternate between different geometries
          const GeometryComponent = [
            <dodecahedronGeometry args={[0.15, 0]} />,
            <octahedronGeometry args={[0.18, 0]} />,
            <tetrahedronGeometry args={[0.2, 0]} />,
          ][i % 3]
          
          return (
            <mesh
              key={i}
              ref={el => el && (meshRefs.current[i] = el)}
              position={[x, y, z]}
            >
              {GeometryComponent}
              <meshStandardMaterial
                color={i % 2 === 0 ? settings.colorB : settings.colorA}
                emissive={i % 2 === 0 ? settings.colorA : settings.colorB}
                emissiveIntensity={0.1}
                metalness={0.4}
                roughness={0.5}
              />
            </mesh>
          )
        })}
        
        {/* Inner detail ring */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2
          const radius = INNER_RING_RADIUS
          
          return (
            <mesh
              key={`inner-${i}`}
              ref={el => el && (innerMeshRefs.current[i] = el)}
              position={[
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
              ]}
            >
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshBasicMaterial
                color={settings.colorB}
                opacity={0.3}
                transparent
              />
            </mesh>
          )
        })}
      </group>
      
      {/* Kaleidoscope effect - smooth and subtle */}
      <Kaleidoscope 
        segments={KALEIDOSCOPE_SEGMENTS}
        rotationSpeed={KALEIDOSCOPE_BASE_SPEED + analyserData.rms * KALEIDOSCOPE_AUDIO_SPEED}
        internalReflections={KALEIDOSCOPE_REFLECTIONS}
        zoom={1.0 + analyserData.rms * KALEIDOSCOPE_ZOOM_RESPONSE}
        animated={true}
      />
    </>
  )
}