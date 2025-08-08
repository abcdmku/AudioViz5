import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import CinematicEffects from '../environments/CinematicEffects'

export const waveKnotFatMeta: VisualizerMeta = {
  id: 'wave-knot-fat',
  name: 'Wave Knot Fat',
  description: 'Low-detail torus knot with waveform-driven ripples',
}

export const WaveKnotFat: VisualizerComponent = ({ analyserData, settings }) => {
  const MAX_PULSES = 12
  const uniforms = useRef({
    uTime: { value: 0 },
    uPhase: { value: 0 },
    uPulsePos: { value: new Float32Array(MAX_PULSES) },
    uPulseAmp: { value: new Float32Array(MAX_PULSES) },
    uPulseCount: { value: 0 },
    uColorA: { value: new THREE.Color(settings.colorA) },
    uColorB: { value: new THREE.Color(settings.colorB) },
  })
  const pulses = useRef<{ pos: number; amp: number }[]>([])
  const prevRms = useRef(0)

  useFrame((_, delta) => {
    uniforms.current.uTime.value += delta * settings.animationSpeed
    uniforms.current.uPhase.value += delta * 0.6 * settings.animationSpeed

    // Move existing pulses along uv.x and decay amplitude (~4s half-life)
    const travelSpeed = 0.35 * Math.max(0.2, settings.animationSpeed)
    for (const p of pulses.current) {
      p.pos = (p.pos + travelSpeed * delta) % 1
      // ~1s half-life
      p.amp *= Math.pow(0.5, delta / 0.5)
    }
    // Spawn a new pulse at the start on onset or RMS spike fallback
    const rms = analyserData.rms
    const rmsSpike = rms > prevRms.current * 1.22 && rms > 0.04
    const onset = analyserData.beat.isOnset || rmsSpike
    if (onset) {
      pulses.current.unshift({ pos: 0, amp: 1 })
      if (pulses.current.length > MAX_PULSES) pulses.current.pop()
    }
    prevRms.current = rms
    // Remove very weak pulses
    pulses.current = pulses.current.filter((p) => p.amp > 0.02)

    // Write to uniforms
    const posArr = uniforms.current.uPulsePos.value
    const ampArr = uniforms.current.uPulseAmp.value
    posArr.fill(0)
    ampArr.fill(0)
    const count = Math.min(MAX_PULSES, pulses.current.length)
    uniforms.current.uPulseCount.value = count
    for (let i = 0; i < count; i++) {
      posArr[i] = pulses.current[i].pos
      ampArr[i] = pulses.current[i].amp
    }
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />
      <Environment preset={'city' as any} />
      <OrbitControls enablePan enableZoom enableRotate enableDamping dampingFactor={0.1} autoRotate autoRotateSpeed={5} />
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
            #define MAX_PULSES 12
            uniform float uPulsePos[MAX_PULSES];
            uniform float uPulseAmp[MAX_PULSES];
            uniform int uPulseCount;
            void main(){
              vUv = uv;
              vNormalW = normalize(normalMatrix * normal);
              vec3 pos = position;
              // Beat-only traveling ripples along uv.x
              float s = fract(vUv.x);
              float sum = 0.0;
              for (int i = 0; i < MAX_PULSES; i++) {
                if (i >= uPulseCount) break;
                float p = uPulsePos[i];
                float a = uPulseAmp[i];
                float d = abs(s - p);
                d = min(d, 1.0 - d);
                float g = exp(- (d * d) / 0.0025); // sigma ~0.05
                sum += g * a;
              }
              float amp = sum * 1.2;
              pos += normal * amp;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormalW;
            varying vec2 vUv;
            uniform vec3 uColorA, uColorB;
            uniform float uPhase;
            void main(){
              const float TAU = 6.28318530718;
              vec3 col = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vUv.x * TAU - uPhase * 0.3));
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


