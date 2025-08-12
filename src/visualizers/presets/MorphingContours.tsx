import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import CinematicEffects from '../environments/CinematicEffects'

export const morphingContoursMeta: VisualizerMeta = {
  id: 'morphing-contours',
  name: 'Morphing Contours',
  description: 'Organic flowing shapes with neon contour lines that morph based on audio',
}

export const MorphingContours: VisualizerComponent = ({ analyserData, settings }) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMorphPhase: { value: 0 },
    uBassEnergy: { value: 0 },
    uMidEnergy: { value: 0 },
    uHighEnergy: { value: 0 },
    uColorA: { value: new THREE.Color(settings.colorA) },
    uColorB: { value: new THREE.Color(settings.colorB) },
    uNoiseScale: { value: 2.5 },
    uDistortion: { value: 0.3 },
    uGlowIntensity: { value: 0.6 },
    uContourFrequency: { value: 8.0 },
    uContourSharpness: { value: 0.5 },
    uAudioReactivity: { value: 1.0 },
  }), [settings.colorA, settings.colorB])

  const prevEnergies = useRef({ bass: 0, mid: 0, high: 0 })
  const morphTargets = useRef({ bass: 0, mid: 0, high: 0 })

  useFrame((_, delta) => {
    if (!materialRef.current) return

    // Update time
    uniforms.uTime.value += delta * settings.animationSpeed * 0.5
    uniforms.uMorphPhase.value += delta * settings.animationSpeed * 0.3

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

    // Smooth transitions with momentum
    const smoothing = 0.12
    const momentum = 0.88
    morphTargets.current.bass = bassEnergy
    morphTargets.current.mid = midEnergy
    morphTargets.current.high = highEnergy

    prevEnergies.current.bass = prevEnergies.current.bass * momentum + morphTargets.current.bass * smoothing
    prevEnergies.current.mid = prevEnergies.current.mid * momentum + morphTargets.current.mid * smoothing
    prevEnergies.current.high = prevEnergies.current.high * momentum + morphTargets.current.high * smoothing

    // Update uniforms with smoothed values
    uniforms.uBassEnergy.value = prevEnergies.current.bass
    uniforms.uMidEnergy.value = prevEnergies.current.mid
    uniforms.uHighEnergy.value = prevEnergies.current.high

    // Dynamic parameters based on audio
    uniforms.uDistortion.value = 0.2 + prevEnergies.current.bass * 0.5
    uniforms.uNoiseScale.value = 2.0 + prevEnergies.current.mid * 3.0
    uniforms.uGlowIntensity.value = 0.4 + prevEnergies.current.high * 0.8
    uniforms.uContourFrequency.value = 6.0 + prevEnergies.current.mid * 8.0

    // Rotate mesh slowly
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.1 * settings.animationSpeed
      meshRef.current.rotation.y += delta * 0.15 * settings.animationSpeed
    }
  })

  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <Environment preset={'night' as any} />
      <OrbitControls 
        enablePan 
        enableZoom 
        enableRotate 
        enableDamping 
        dampingFactor={0.05}
        autoRotate
        autoRotateSpeed={0.5}
      />
      
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[2, 128]} />
        <shaderMaterial
          ref={materialRef}
          transparent
          side={THREE.DoubleSide}
          uniforms={uniforms as any}
          vertexShader={`
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying float vDistortion;
            
            uniform float uTime;
            uniform float uMorphPhase;
            uniform float uBassEnergy;
            uniform float uMidEnergy;
            uniform float uHighEnergy;
            uniform float uNoiseScale;
            uniform float uDistortion;
            uniform float uAudioReactivity;
            
            // Simplex 3D noise
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
            vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
            
            float snoise(vec3 v) {
              const vec2 C = vec2(1.0/6.0, 1.0/3.0);
              const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
              
              vec3 i = floor(v + dot(v, C.yyy));
              vec3 x0 = v - i + dot(i, C.xxx);
              
              vec3 g = step(x0.yzx, x0.xyz);
              vec3 l = 1.0 - g;
              vec3 i1 = min(g.xyz, l.zxy);
              vec3 i2 = max(g.xyz, l.zxy);
              
              vec3 x1 = x0 - i1 + C.xxx;
              vec3 x2 = x0 - i2 + C.yyy;
              vec3 x3 = x0 - D.yyy;
              
              i = mod289(i);
              vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                
              float n_ = 0.142857142857;
              vec3 ns = n_ * D.wyz - D.xzx;
              
              vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
              
              vec4 x_ = floor(j * ns.z);
              vec4 y_ = floor(j - 7.0 * x_);
              
              vec4 x = x_ *ns.x + ns.yyyy;
              vec4 y = y_ *ns.x + ns.yyyy;
              vec4 h = 1.0 - abs(x) - abs(y);
              
              vec4 b0 = vec4(x.xy, y.xy);
              vec4 b1 = vec4(x.zw, y.zw);
              
              vec4 s0 = floor(b0)*2.0 + 1.0;
              vec4 s1 = floor(b1)*2.0 + 1.0;
              vec4 sh = -step(h, vec4(0.0));
              
              vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
              vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
              
              vec3 p0 = vec3(a0.xy, h.x);
              vec3 p1 = vec3(a0.zw, h.y);
              vec3 p2 = vec3(a1.xy, h.z);
              vec3 p3 = vec3(a1.zw, h.w);
              
              vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
              p0 *= norm.x;
              p1 *= norm.y;
              p2 *= norm.z;
              p3 *= norm.w;
              
              vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
              m = m * m;
              return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
            }
            
            void main() {
              vUv = uv;
              vPosition = position;
              vNormal = normalize(normalMatrix * normal);
              
              vec3 pos = position;
              
              // Multi-layered noise for organic morphing
              float noise1 = snoise(pos * uNoiseScale + vec3(uTime * 0.2, uMorphPhase, 0.0));
              float noise2 = snoise(pos * uNoiseScale * 2.0 - vec3(uMorphPhase, uTime * 0.3, 0.0));
              float noise3 = snoise(pos * uNoiseScale * 0.5 + vec3(0.0, uTime * 0.1, uMorphPhase));
              
              // Combine noises with audio energy
              float audioMorph = uBassEnergy * noise1 + uMidEnergy * noise2 + uHighEnergy * noise3;
              
              // Create morphing displacement
              float displacement = uDistortion * (
                noise1 * 0.5 +
                noise2 * 0.3 * (1.0 + uBassEnergy) +
                noise3 * 0.2 * (1.0 + uHighEnergy)
              );
              
              // Apply audio-reactive displacement
              displacement *= (1.0 + audioMorph * uAudioReactivity);
              
              // Displace vertices along normals
              pos += normal * displacement;
              
              vDistortion = displacement;
              
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying float vDistortion;
            
            uniform float uTime;
            uniform float uMorphPhase;
            uniform float uBassEnergy;
            uniform float uMidEnergy;
            uniform float uHighEnergy;
            uniform vec3 uColorA;
            uniform vec3 uColorB;
            uniform float uGlowIntensity;
            uniform float uContourFrequency;
            uniform float uContourSharpness;
            
            void main() {
              // Create contour lines based on distortion
              float contour = sin(vDistortion * uContourFrequency + uTime) * 0.5 + 0.5;
              contour = smoothstep(uContourSharpness - 0.1, uContourSharpness, contour);
              
              // Color based on audio energy and position
              vec3 colorMix = mix(uColorA, uColorB, 
                sin(vDistortion * 3.0 + uMorphPhase) * 0.5 + 0.5
              );
              
              // Add energy-based color shifts (reduced intensity)
              colorMix.r += uBassEnergy * 0.15;
              colorMix.g += uMidEnergy * 0.1;
              colorMix.b += uHighEnergy * 0.2;
              
              // Rim lighting for glow effect
              float rimDot = 1.0 - max(0.0, dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)));
              float rim = pow(rimDot, 2.0) * uGlowIntensity;
              
              // Combine contour lines with base color (darker base, less bright contours)
              vec3 finalColor = mix(colorMix * 0.1, colorMix * 0.8, contour);
              finalColor += rim * colorMix * 0.6;
              
              // Add inner glow based on distortion (reduced)
              float innerGlow = abs(vDistortion) * 1.5;
              finalColor += colorMix * innerGlow * 0.15;
              
              // Dynamic opacity based on contours and rim
              float alpha = max(0.4, contour * 0.9 + rim * 0.3 + innerGlow * 0.1);
              
              gl_FragColor = vec4(finalColor, alpha);
            }
          `}
        />
      </mesh>
      
      <CinematicEffects />
    </>
  )
}