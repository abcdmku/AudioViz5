import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import { Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import CinematicEffects from '../environments/CinematicEffects'

// eslint-disable-next-line react-refresh/only-export-components
export const waveformTunnelMeta: VisualizerMeta = {
  id: 'waveform-tunnel',
  name: 'Waveform Tunnel',
  description: 'Travel through a tunnel shaped by audio waveform data',
}

export const WaveformTunnel: VisualizerComponent = ({ analyserData, settings }) => {
  // Configurable parameters for waveform tunnel
  const TUNNEL_LENGTH = 80         // Tunnel depth
  const TUNNEL_RADIUS = 6          // Base tunnel radius
  const RADIAL_SEGMENTS = 64       // Circumference resolution
  const LENGTH_SEGMENTS = 256      // Length segments for smooth waveform
  const WAVEFORM_AMPLITUDE = 3.0   // How much waveform affects tunnel shape
  const TUNNEL_SPEED = 1.0         // Speed of traveling through tunnel
  const WAVEFORM_FREQUENCY = 8.0   // Frequency multiplier for waveform sampling

  // State management
  const tunnelOffset = useRef(0)

  // Create waveform texture
  const waveformTexture = useMemo(() => {
    const tex = new THREE.DataTexture(
      new Uint8Array(1024 * 4),
      1024,
      1,
      THREE.RGBAFormat
    )
    tex.needsUpdate = true
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.wrapS = THREE.RepeatWrapping
    return tex
  }, [])

  // Create uniforms
  const uniforms = useRef({
    uTime: { value: 0 },
    uTunnelOffset: { value: 0 },
    uColorA: { value: new THREE.Color(settings.colorA) },
    uColorB: { value: new THREE.Color(settings.colorB) },
    uWaveformTexture: { value: waveformTexture },
    uWaveformAmplitude: { value: WAVEFORM_AMPLITUDE },
    uWaveformFrequency: { value: WAVEFORM_FREQUENCY },
  })

  // Update waveform texture
  const updateWaveformTexture = () => {
    if (!analyserData) return
    
    const data = waveformTexture.image.data as Uint8Array
    const waveformArray = analyserData.waveform
    
    // Copy waveform data to texture
    for (let i = 0; i < 1024; i++) {
      const waveValue = i < waveformArray.length ? waveformArray[i] : 128
      const base = i * 4
      data[base + 0] = waveValue
      data[base + 1] = waveValue
      data[base + 2] = waveValue
      data[base + 3] = 255
    }
    
    waveformTexture.needsUpdate = true
  }

  useFrame((_, delta) => {
    uniforms.current.uTime.value += delta * settings.animationSpeed
    
    // Update waveform texture
    updateWaveformTexture()
    
    // Animate tunnel movement
    tunnelOffset.current += TUNNEL_SPEED * delta * settings.animationSpeed
    uniforms.current.uTunnelOffset.value = tunnelOffset.current
  })

  return (
    <>
      <PerspectiveCamera 
        makeDefault 
        position={[0, TUNNEL_LENGTH / 2 + 5, 0]} 
        fov={75}
      />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={1.0} />
      <Environment preset="night" />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        enableRotate={false}
        enableDamping
        dampingFactor={0.1}
        target={[0, 0, 0]}
      />
      
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry
          args={[
            TUNNEL_RADIUS,
            TUNNEL_RADIUS,
            TUNNEL_LENGTH,
            RADIAL_SEGMENTS,
            LENGTH_SEGMENTS,
            true
          ]}
        />
        <shaderMaterial
          side={THREE.BackSide}
          transparent
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          uniforms={uniforms.current as any}
          vertexShader={`
            varying vec2 vUv;
            varying float vWaveform;
            varying vec3 vNormal;
            uniform float uTime;
            uniform float uTunnelOffset;
            uniform sampler2D uWaveformTexture;
            uniform float uWaveformAmplitude;
            uniform float uWaveformFrequency;

            void main() {
              vUv = uv;
              vec3 pos = position;
              
              // Sample waveform based on position along tunnel and time
              float waveformPos = (vUv.y + uTunnelOffset * 0.1) * uWaveformFrequency;
              float waveformSample = texture2D(uWaveformTexture, vec2(waveformPos, 0.5)).r;
              
              // Convert from 0-255 to -1 to 1 range
              vWaveform = (waveformSample / 255.0 - 0.5) * 2.0;
              
              // Apply waveform displacement radially
              vec3 radialDirection = normalize(vec3(pos.x, 0.0, pos.z));
              float displacement = vWaveform * uWaveformAmplitude;
              
              // Modulate displacement by circumferential position for more variation
              float circumferentialFactor = sin(vUv.x * 6.28318) * 0.3 + 0.7;
              displacement *= circumferentialFactor;
              
              pos += radialDirection * displacement;
              
              // Calculate normal for lighting
              vNormal = normalMatrix * normalize(normal + radialDirection * displacement * 0.5);
              
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vUv;
            varying float vWaveform;
            varying vec3 vNormal;
            uniform vec3 uColorA;
            uniform vec3 uColorB;
            uniform float uTime;

            void main() {
              // Base color mixing
              vec3 color = mix(uColorA, uColorB, vUv.x);
              
              // Add waveform-based brightness
              float intensity = abs(vWaveform) * 2.0 + 0.3;
              color *= intensity;
              
              // Add some glow based on waveform amplitude
              color += abs(vWaveform) * 0.5 * vec3(1.0, 0.8, 0.6);
              
              // Simple lighting
              vec3 normal = normalize(vNormal);
              vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
              float light = max(dot(normal, lightDir), 0.0) * 0.5 + 0.5;
              color *= light;
              
              // Add depth fade
              float depth = 1.0 - vUv.y;
              color *= (0.3 + depth * 0.7);
              
              gl_FragColor = vec4(color, 0.8);
            }
          `}
        />
      </mesh>
      
      <CinematicEffects />
    </>
  )
}