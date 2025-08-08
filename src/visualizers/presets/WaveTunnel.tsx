import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import { Environment, OrbitControls } from '@react-three/drei'
import CinematicEffects from '../environments/CinematicEffects'

export const waveTunnelMeta: VisualizerMeta = {
  id: 'wave-tunnel',
  name: 'Wave Tunnel',
  description: 'Time-domain waveform tunnel',
}

export const WaveTunnel: VisualizerComponent = ({ analyserData, settings }) => {
  const mesh = useRef<THREE.Mesh>(null)
  const waveTex = useMemo(() => {
    const tex = new THREE.DataTexture(new Uint8Array(1024 * 4), 1024, 1, THREE.RGBAFormat)
    tex.needsUpdate = true
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    return tex
  }, [])

  const uniforms = useRef({
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(settings.colorA) },
    uColorB: { value: new THREE.Color(settings.colorB) },
    uWaveTex: { value: waveTex },
    uEnergy: { value: 0 },
    uRipplePhase: { value: 0 },
    uRippleStrength: { value: 0 },
    uBass: { value: 0 },
  })

  useFrame((_, delta) => {
    uniforms.current.uTime.value += delta * settings.animationSpeed
    const wave = analyserData?.waveform
    if (!wave) return
    // Update waveform texture (store in R channel)
    const data = (uniforms.current.uWaveTex.value.image.data as Uint8Array)
    const len = 1024
    for (let i = 0; i < len; i++) {
      const srcIdx = Math.floor((i / len) * wave.length)
      const v = wave[srcIdx] // 0..255
      const base = i * 4
      data[base + 0] = v
      data[base + 1] = v
      data[base + 2] = v
      data[base + 3] = 255
    }
    uniforms.current.uWaveTex.value.needsUpdate = true
    const avg = analyserData.frequency.reduce((a, b) => a + b, 0) / analyserData.frequency.length / 255
    uniforms.current.uEnergy.value = avg

    // Beat-driven ripple
    uniforms.current.uRipplePhase.value += delta * 0.6 * settings.animationSpeed
    uniforms.current.uRippleStrength.value = THREE.MathUtils.lerp(
      uniforms.current.uRippleStrength.value,
      0,
      0.6 * delta
    )
    if (analyserData.beat.isOnset) {
      uniforms.current.uRippleStrength.value = Math.min(
        2,
        uniforms.current.uRippleStrength.value + 0.8
      )
    }

    // Low frequency (bass) swell
    const third = Math.floor(analyserData.frequency.length / 3)
    let lowSum = 0
    for (let i = 0; i < third; i++) lowSum += analyserData.frequency[i]
    const lowAvg = (lowSum / Math.max(1, third)) / 255
    uniforms.current.uBass.value = THREE.MathUtils.lerp(uniforms.current.uBass.value, lowAvg, 0.15)
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />
      <Environment preset={'city' as any} />
      <OrbitControls enablePan enableZoom enableRotate enableDamping dampingFactor={0.1} />
      <mesh ref={mesh}>
      <cylinderGeometry args={[6, 6, 40, 96, 128, true]} />
      <shaderMaterial
        side={THREE.BackSide}
        transparent
        blending={THREE.AdditiveBlending}
        uniforms={uniforms.current as any}
        vertexShader={`
          varying vec2 vUv;
          uniform float uTime;
          uniform sampler2D uWaveTex;
          uniform float uRipplePhase;
          uniform float uRippleStrength;
          uniform float uBass;
          void main() {
            vUv = uv;
            vec3 pos = position;
            float w = texture2D(uWaveTex, vec2(vUv.x, 0.5)).r * 2.0 - 1.0;
            pos.xy *= 1.0 + w * 0.9;
            pos.z += sin(uTime * 1.2 + vUv.x * 28.0) * (1.2 + uBass * 0.8);
            // Ripple along Y over several beats
            float ripple = sin((vUv.y * 10.0) - (uRipplePhase * 5.0)) * uRippleStrength;
            pos.xy *= 1.0 + ripple * (0.45 + uBass * 0.3);
            pos.z += ripple * (1.0 + uBass * 0.8);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform float uEnergy;
          void main() {
            vec3 col = mix(uColorA, uColorB, vUv.x);
            float glow = smoothstep(0.0, 1.0, vUv.y) * (0.3 + uEnergy);
            gl_FragColor = vec4(col + glow, 0.9);
          }
        `}
      />
    </mesh>
    <CinematicEffects />
    </>
  )
}


