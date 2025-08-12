import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import CinematicEffects from '../environments/CinematicEffects'

export const kaleidoscopeMeta: VisualizerMeta = {
  id: 'kaleidoscope',
  name: 'Kaleidoscope',
  description: 'Symmetrical kaleidoscope pattern with triangular segments and mirrored audio-reactive visuals',
}

export const Kaleidoscope: VisualizerComponent = ({ analyserData, settings }) => {
  const groupRef = useRef<THREE.Group>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uRotation: { value: 0 },
    uBassEnergy: { value: 0 },
    uMidEnergy: { value: 0 },
    uHighEnergy: { value: 0 },
    uColorA: { value: new THREE.Color(settings.colorA) },
    uColorB: { value: new THREE.Color(settings.colorB) },
    uColorC: { value: new THREE.Color(0xff0080) },
    uSegments: { value: 6.0 },
    uMirrorIntensity: { value: 1.0 },
    uPatternScale: { value: 2.0 },
    uAudioReactivity: { value: 8.0 },
  }), [settings.colorA, settings.colorB])

  const prevEnergies = useRef({ bass: 0, mid: 0, high: 0 })
  const rotationSpeed = useRef(0)

  useFrame((_, delta) => {
    if (!materialRef.current) return

    // Update time
    uniforms.uTime.value += delta * settings.animationSpeed

    // Analyze frequency bands
    const freq = analyserData.frequency
    const freqLength = freq.length

    // Bass (0-20%)
    const bassEnd = Math.floor(freqLength * 0.2)
    let bassSum = 0
    for (let i = 0; i < bassEnd; i++) {
      bassSum += freq[i]
    }
    const bassEnergy = (bassSum / bassEnd) / 255

    // Mid (20-60%)
    const midStart = bassEnd
    const midEnd = Math.floor(freqLength * 0.6)
    let midSum = 0
    for (let i = midStart; i < midEnd; i++) {
      midSum += freq[i]
    }
    const midEnergy = (midSum / (midEnd - midStart)) / 255

    // High (60-100%)
    const highStart = midEnd
    let highSum = 0
    for (let i = highStart; i < freqLength; i++) {
      highSum += freq[i]
    }
    const highEnergy = (highSum / (freqLength - highStart)) / 255

    // Smooth transitions
    const smoothing = 0.15
    const momentum = 0.85
    prevEnergies.current.bass = prevEnergies.current.bass * momentum + bassEnergy * smoothing
    prevEnergies.current.mid = prevEnergies.current.mid * momentum + midEnergy * smoothing
    prevEnergies.current.high = prevEnergies.current.high * momentum + highEnergy * smoothing

    // Update uniforms
    uniforms.uBassEnergy.value = prevEnergies.current.bass
    uniforms.uMidEnergy.value = prevEnergies.current.mid
    uniforms.uHighEnergy.value = prevEnergies.current.high

    // Audio-reactive rotation
    rotationSpeed.current += (prevEnergies.current.bass + prevEnergies.current.mid) * 0.02
    uniforms.uRotation.value += delta * settings.animationSpeed * (0.2 + rotationSpeed.current * 0.3)

    // Dynamic kaleidoscope parameters
    uniforms.uSegments.value = 6.0 + Math.sin(uniforms.uTime.value * 0.5) * 2.0 + prevEnergies.current.high * 4.0
    uniforms.uPatternScale.value = 1.5 + prevEnergies.current.mid * 3.0
    uniforms.uMirrorIntensity.value = 0.8 + prevEnergies.current.bass * 0.4

    // Rotate the entire kaleidoscope group
    if (groupRef.current) {
      groupRef.current.rotation.z = uniforms.uRotation.value * 0.1
    }
  })

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 3]} fov={75} />
      <ambientLight intensity={0.3} />
      <Environment preset={'night' as any} />
      <OrbitControls 
        enablePan={false}
        enableZoom 
        enableRotate 
        enableDamping 
        dampingFactor={0.05}
        minDistance={1}
        maxDistance={6}
      />
      
      <group ref={groupRef}>
        {/* Central kaleidoscope plane */}
        <mesh>
          <planeGeometry args={[6, 6]} />
          <shaderMaterial
            ref={materialRef}
            transparent
            side={THREE.DoubleSide}
            uniforms={uniforms as any}
            vertexShader={`
              varying vec2 vUv;
              varying vec3 vPosition;
              
              void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              varying vec2 vUv;
              varying vec3 vPosition;
              
              uniform float uTime;
              uniform float uRotation;
              uniform float uBassEnergy;
              uniform float uMidEnergy;
              uniform float uHighEnergy;
              uniform vec3 uColorA;
              uniform vec3 uColorB;
              uniform vec3 uColorC;
              uniform float uSegments;
              uniform float uMirrorIntensity;
              uniform float uPatternScale;
              uniform float uAudioReactivity;
              
              #define PI 3.14159265359
              #define TAU 6.28318530718
              
              // Hash function for pseudo-random values
              float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
              }
              
              // Kaleidoscope function
              vec2 kaleidoscope(vec2 uv, float segments) {
                float angle = atan(uv.y, uv.x);
                float segmentAngle = TAU / segments;
                float segmentIndex = floor(angle / segmentAngle);
                float segmentPos = angle - segmentIndex * segmentAngle;
                
                // Mirror every other segment
                if (mod(segmentIndex, 2.0) > 0.5) {
                  segmentPos = segmentAngle - segmentPos;
                }
                
                float radius = length(uv);
                return vec2(cos(segmentPos), sin(segmentPos)) * radius;
              }
              
              // Pattern generation
              vec3 generatePattern(vec2 uv) {
                vec2 kUv = kaleidoscope(uv * uPatternScale, uSegments);
                
                // Create multiple pattern layers
                float pattern1 = sin(kUv.x * 8.0 + uTime * 2.0) * sin(kUv.y * 8.0 + uTime * 1.5);
                float pattern2 = sin(length(kUv) * 12.0 - uTime * 3.0);
                float pattern3 = sin((kUv.x + kUv.y) * 6.0 + uTime * 2.5);
                
                // Audio-reactive pattern modulation
                pattern1 += uBassEnergy * sin(kUv.x * 16.0 + uTime * 4.0) * 0.5;
                pattern2 += uMidEnergy * sin(kUv.y * 20.0 - uTime * 2.0) * 0.3;
                pattern3 += uHighEnergy * sin(length(kUv) * 24.0 + uTime * 5.0) * 0.4;
                
                // Combine patterns
                float combined = (pattern1 + pattern2 + pattern3) * 0.33;
                combined = smoothstep(-0.1, 0.1, combined);
                
                // Color mixing based on pattern and audio
                vec3 color1 = mix(uColorA, uColorB, abs(pattern1));
                vec3 color2 = mix(uColorB, uColorC, abs(pattern2));
                vec3 color3 = mix(uColorA, uColorC, abs(pattern3));
                
                vec3 finalColor = mix(color1, color2, abs(pattern2) * 0.5);
                finalColor = mix(finalColor, color3, abs(pattern3) * 0.3);
                
                // Audio-reactive brightness
                float brightness = 1.0 + (uBassEnergy + uMidEnergy + uHighEnergy) * 0.5;
                finalColor *= brightness * combined;
                
                return finalColor;
              }
              
              void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                
                // Apply rotation
                float rotation = uRotation + uBassEnergy * 2.0;
                mat2 rotMat = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation));
                uv = rotMat * uv;
                
                // Generate kaleidoscope pattern
                vec3 color = generatePattern(uv);
                
                // Add radial gradient for focus
                float radialGradient = 1.0 - length(uv * 0.7);
                radialGradient = pow(radialGradient, 1.5);
                color *= radialGradient;
                
                // Add some sparkle effects
                float sparkle = hash(floor(uv * 50.0)) * hash(floor(uv * 50.0 + 1.0));
                if (sparkle > 0.98 + uHighEnergy * 0.02) {
                  color += vec3(1.0) * (sparkle - 0.98) * 50.0 * uMirrorIntensity;
                }
                
                // Final alpha
                float alpha = max(0.1, length(color));
                alpha *= radialGradient;
                
                gl_FragColor = vec4(color, alpha);
              }
            `}
          />
        </mesh>
      </group>
      
      <CinematicEffects />
    </>
  )
}