import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import CinematicEffects from '../environments/CinematicEffects'

export const waveKnotMeta: VisualizerMeta = {
  id: 'wave-knot',
  name: 'Wave Knot',
  description: 'High-detail torus knot with waveform-driven ripples',
}

export const WaveKnot: VisualizerComponent = ({ analyserData, settings }) => {
  const MAX_PULSES = 32
  const uniforms = useRef({
    uTime: { value: 0 },
    uPhase: { value: 0 },
    uPulsePos: { value: new Float32Array(MAX_PULSES) },
    uPulseAmp: { value: new Float32Array(MAX_PULSES) },
    uPulseWidth: { value: new Float32Array(MAX_PULSES) },
    uPulseColR: { value: new Float32Array(MAX_PULSES) },
    uPulseColG: { value: new Float32Array(MAX_PULSES) },
    uPulseColB: { value: new Float32Array(MAX_PULSES) },
    uPulseCount: { value: 0 },
    uColorA: { value: new THREE.Color(settings.colorA) },
    uColorB: { value: new THREE.Color(settings.colorB) },
  })
  const pulses = useRef<{ pos: number; amp: number; width: number; color: THREE.Color }[]>([])
  const prevRms = useRef(0)
  const NUM_BANDS = 32
  const prevBands = useRef<Float32Array>(new Float32Array(NUM_BANDS))

  useFrame((_, delta) => {
    uniforms.current.uTime.value += delta * settings.animationSpeed
    uniforms.current.uPhase.value += delta * 0.6 * settings.animationSpeed

    // Move existing pulses along uv.x and decay amplitude (~4s half-life)
    const travelSpeed = 0.35 * Math.max(0.2, settings.animationSpeed)
    for (const p of pulses.current) {
      p.pos += travelSpeed * delta
      // ~1.2s half-life (slower decay)
      p.amp *= Math.pow(0.5, delta / 1.2)
    }
    // Spawn pulses from frequency band spikes: higher bands => sharper and cooler
    const freq = analyserData.frequency
    const bandSize = Math.max(1, Math.floor(freq.length / NUM_BANDS))
    for (let b = 0; b < NUM_BANDS; b++) {
      const start = b * bandSize
      const end = Math.min(freq.length, start + bandSize)
      let sum = 0
      for (let i = start; i < end; i++) sum += freq[i]
      const energy = (sum / (end - start)) / 255 // 0..1
      const prev = prevBands.current[b]

        const bandNorm = b / (NUM_BANDS - 1) // 0 low -> 1 high
        // Width: low freq wider, high freq sharper
        const width = 0.018 - bandNorm * 0.012 // 0.018 .. 0.006 (sharper)
        // Color: warm (low) to cold (high) via HSL hue 30deg -> 200deg
        const hue = (30 + bandNorm * (200 - 30)) / 360
        const col = new THREE.Color().setHSL(hue, 0.85, 0.55)
        const bandGain = 0.3 + bandNorm * 0.4 // low bands downscaled, highs upscaled
        addPulse({ pos: 0, amp: Math.min(0.4, energy * bandGain * 0.8), width, color: col })

      prevBands.current[b] = energy
    }

    // Additional ripples from high frequency content (captures percussive elements)
    const highFreqStart = Math.floor(freq.length * 0.7) // Top 30% of frequencies
    let highFreqSum = 0
    for (let i = highFreqStart; i < freq.length; i++) {
      highFreqSum += freq[i]
    }
    const highFreqAvg = highFreqSum / (freq.length - highFreqStart) / 255
    if (highFreqAvg > 0.15) { // high freq ripples
      const col = new THREE.Color().setHSL(0.65, 0.8, 0.6) // fixed cool color
      addPulse({ 
        pos: 0, // start at 0 for flow
        amp: Math.min(0.25, highFreqAvg * 1.2), 
        width: 0.008, // smaller, sharper ripples
        color: col 
      })
    }
    
    // Remove very weak pulses and pulses that have traveled beyond the knot
    pulses.current = pulses.current.filter((p) => p.amp > 0.008 && p.pos <= 1.0)

    // Helper to add a pulse (no cap)
    function addPulse(pulse: { pos: number; amp: number; width: number; color: THREE.Color }) {
      pulses.current.push(pulse)
    }

    // Write to uniforms
    const posArr = uniforms.current.uPulsePos.value
    const ampArr = uniforms.current.uPulseAmp.value
    const widArr = uniforms.current.uPulseWidth.value
    const rArr = uniforms.current.uPulseColR.value
    const gArr = uniforms.current.uPulseColG.value
    const bArr = uniforms.current.uPulseColB.value
    posArr.fill(0)
    ampArr.fill(0)
    widArr.fill(0.005)
    rArr.fill(0)
    gArr.fill(0)
    bArr.fill(0)
    // When writing to uniforms, only use the most recent MAX_PULSES pulses
    const visible = pulses.current.slice(0, MAX_PULSES)
    const count = visible.length
    uniforms.current.uPulseCount.value = count
    for (let i = 0; i < count; i++) {
      const p = visible[i]
      posArr[i] = p.pos
      ampArr[i] = p.amp
      widArr[i] = p.width
      rArr[i] = p.color.r
      gArr[i] = p.color.g
      bArr[i] = p.color.b
    }
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />
      <Environment preset={'city' as any} />
      <OrbitControls enablePan enableZoom enableRotate enableDamping dampingFactor={0.1} />
      <mesh>
        {/* High segment counts for detailed deformations */}
        <torusKnotGeometry args={[1.5, 0.35, 1024, 256]} />
        <shaderMaterial
          transparent
          uniforms={uniforms.current as any}
          vertexShader={`
            varying vec3 vNormalW;
            varying vec2 vUv;
            uniform float uTime, uPhase;
            #define MAX_PULSES 32
            uniform float uPulsePos[MAX_PULSES];
            uniform float uPulseAmp[MAX_PULSES];
            uniform float uPulseWidth[MAX_PULSES];
            uniform float uPulseColR[MAX_PULSES];
            uniform float uPulseColG[MAX_PULSES];
            uniform float uPulseColB[MAX_PULSES];
            uniform int uPulseCount;
            varying float vIntensity;
            varying vec3 vTint;
            void main(){
              vUv = uv;
              vNormalW = normalize(normalMatrix * normal);
              vec3 pos = position;
              // Pulses flow along uv.x from 0 to 1 without wrapping
              float s = vUv.x; // Use raw UV coordinate, not fract()
              float sum = 0.0;
              vec3 tint = vec3(0.0);
              float wsum = 0.0;
              for (int i = 0; i < MAX_PULSES; i++) {
                if (i >= uPulseCount) break;
                float p = uPulsePos[i];
                float a = uPulseAmp[i];
                // Simple distance without wrap-around
                float d = abs(s - p);
                float w = max(0.002, uPulseWidth[i]);
                float g = exp(- (d * d) / (w * w));
                // Clamp per-pulse contribution to allow variation but prevent extreme values
                float weight = min(g * a, 0.4);
                sum += weight;
                tint += vec3(uPulseColR[i], uPulseColG[i], uPulseColB[i]) * weight;
                wsum += weight;
              }
              float amp = min(sum, 0.6) * 1.0;
              pos += normal * amp;
              vIntensity = sum;
              vTint = (wsum > 0.0) ? (tint / wsum) : vec3(0.0);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormalW;
            varying vec2 vUv;
            uniform vec3 uColorA, uColorB;
            uniform float uPhase;
            varying float vIntensity;
            varying vec3 vTint;
            void main(){
              const float TAU = 6.28318530718;
              vec3 base = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vUv.x * TAU - uPhase * 0.3));
              // Blend towards per-pulse tint based on intensity
              float k = clamp(vIntensity * 2.0, 0.0, 1.0);
              vec3 col = mix(base, vTint, k);
              float rim = pow(1.0 - max(0.0, dot(normalize(vNormalW), vec3(0.0,0.0,1.0))), 2.0);
              col += rim * 0.12;
              gl_FragColor = vec4(col, 0.98);
            }
          `}
        />
      </mesh>
      <CinematicEffects />
    </>
  )
}


