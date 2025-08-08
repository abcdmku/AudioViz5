import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import CinematicEffects from '../environments/CinematicEffects'

export const waveKnotFatParamMeta: VisualizerMeta = {
  id: 'wave-knot-fat-param',
  name: 'Wave Knot Fat (Param)',
  description: 'Low-detail torus knot with waveform-driven ripples, parameterized for customization',
}

export const WaveKnotFatParam: VisualizerComponent = ({ analyserData, settings }) => {
  const orbitRef = useRef<any>(null)
  // Configurable parameters
  const MAX_PULSES = 16
  const BASE_KNOT_SIZE = 1.5
  const BASE_KNOT_THICKNESS = 0.35
  // Smoothing for scale
  const SMOOTHING_FACTOR = 0.1 // Lower = smoother, higher = more responsive
  const sizeScaleRef = useRef(1)
  // Calculate dynamic scale based on volume
  const rms = analyserData.rms
  const clampedRms = Math.max(0, Math.min(1, rms))
  // Rotation speed based on sound level
  const rotationSpeed = 0.5 + clampedRms * 2.5
  // You can tweak the multipliers for effect strength
  const targetSizeScale = 1 + clampedRms * 1 // overall size
  const KNOT_SEGMENTS = 1024
  const KNOT_TUBE_SEGMENTS = 256
  const RIPPLE_SIGMA = 0.03 // Controls ripple width
  const RIPPLE_STRENGTH = 0.5 // Controls ripple amplitude
  const RIPPLE_DECAY = 0.5 // Pulse amplitude half-life (seconds)
  const RIPPLE_TRAVEL_SPEED = .8 // Speed of pulses
  const RIPPLE_START_POS_SPEED = 0.07 // Speed at which the ripple start position moves (0-1 per second)
  const ONSET_RMS_FACTOR = 1.22 // RMS spike factor for fallback onset
  const ONSET_RMS_MIN = 0.04 // Minimum RMS for onset
  const PULSE_MIN_AMP = 0.02 // Minimum amplitude before pulse is removed

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
  const rippleStartPos = useRef(0)
  const prevRms = useRef(0)

  useFrame((_, delta) => {
    uniforms.current.uTime.value += delta * settings.animationSpeed
    uniforms.current.uPhase.value += delta * 0.6 * settings.animationSpeed

    // Smooth the scale using exponential moving average
    sizeScaleRef.current += (targetSizeScale - sizeScaleRef.current) * SMOOTHING_FACTOR

    // Animate ripple start position
    rippleStartPos.current = (rippleStartPos.current + RIPPLE_START_POS_SPEED * delta) % 1

    // Move pulses and decay amplitude
    for (const p of pulses.current) {
      p.pos = (p.pos + RIPPLE_TRAVEL_SPEED * Math.max(0.2, settings.animationSpeed) * delta) % 1
      p.amp *= Math.pow(0.5, delta / RIPPLE_DECAY)
    }
    // Onset detection
    const rms = analyserData.rms
    const rmsSpike = rms > prevRms.current * ONSET_RMS_FACTOR && rms > ONSET_RMS_MIN
    const onset = analyserData.beat.isOnset || rmsSpike
    if (onset) {
      pulses.current.unshift({ pos: 0, amp: 1 })
      if (pulses.current.length > MAX_PULSES) pulses.current.pop()
    }
    prevRms.current = rms
    // Remove weak pulses
    pulses.current = pulses.current.filter((p) => p.amp > PULSE_MIN_AMP)

    // Write to uniforms
    const posArr = uniforms.current.uPulsePos.value
    const ampArr = uniforms.current.uPulseAmp.value
    posArr.fill(0)
    ampArr.fill(0)
    const count = Math.min(MAX_PULSES, pulses.current.length)
    uniforms.current.uPulseCount.value = count
    for (let i = 0; i < count; i++) {
      // Offset each pulse's position by the animated start position
      posArr[i] = (pulses.current[i].pos + rippleStartPos.current) % 1
      ampArr[i] = pulses.current[i].amp
    }

    // Dynamically set OrbitControls autoRotateSpeed based on sound level
    if (orbitRef.current) {
      orbitRef.current.autoRotateSpeed = rotationSpeed
    }
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />
      <Environment preset={'city' as any} />
      <OrbitControls
        ref={orbitRef}
        enablePan
        enableZoom
        enableRotate
        enableDamping
        dampingFactor={0.1}
        autoRotate
        autoRotateSpeed={rotationSpeed}
      />
      <mesh scale={sizeScaleRef.current * BASE_KNOT_SIZE}>
        {/* Geometry is static, scaling mesh instead for performance */}
        <torusKnotGeometry args={[BASE_KNOT_SIZE, BASE_KNOT_THICKNESS, KNOT_SEGMENTS, KNOT_TUBE_SEGMENTS]} />
        {/* RIPPLE_START_POS_SPEED controls how fast the ripple start position moves (0-1 per second) */}
        <shaderMaterial
          transparent
          uniforms={uniforms.current as any}
          vertexShader={`
            varying vec3 vNormalW;
            varying vec2 vUv;
            uniform float uTime, uPhase;
            #define MAX_PULSES ${MAX_PULSES}
            uniform float uPulsePos[MAX_PULSES];
            uniform float uPulseAmp[MAX_PULSES];
            uniform int uPulseCount;
            void main(){
              vUv = uv;
              vNormalW = normalize(normalMatrix * normal);
              vec3 pos = position;
              float s = fract(vUv.x);
              float sum = 0.0;
              for (int i = 0; i < MAX_PULSES; i++) {
                if (i >= uPulseCount) break;
                float p = uPulsePos[i];
                float a = uPulseAmp[i];
                float d = abs(s - p);
                d = min(d, 1.0 - d);
                float g = exp(- (d * d) / ${RIPPLE_SIGMA * RIPPLE_SIGMA});
                sum += g * a;
              }
              float amp = sum * ${RIPPLE_STRENGTH};
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
