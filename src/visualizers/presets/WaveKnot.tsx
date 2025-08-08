import { useMemo, useRef } from 'react'
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
  const uniforms = useRef({
    uTime: { value: 0 },
    uPhase: { value: 0 },
    uStrength: { value: 0 },
    uBass: { value: 0 },
    uWaveTex: { value: null as unknown as THREE.DataTexture },
    uColorA: { value: new THREE.Color(settings.colorA) },
    uColorB: { value: new THREE.Color(settings.colorB) },
  })

  const waveTex = useMemo(() => {
    const tex = new THREE.DataTexture(new Uint8Array(2048 * 4), 2048, 1, THREE.RGBAFormat)
    tex.needsUpdate = true
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    uniforms.current.uWaveTex.value = tex
    return tex
  }, [])

  useFrame((_, delta) => {
    uniforms.current.uTime.value += delta * settings.animationSpeed
    uniforms.current.uPhase.value += delta * 0.5 * settings.animationSpeed
    if (!analyserData?.waveform) return

    // Update waveform texture from time-domain data
    const wave = analyserData.waveform
    const data = waveTex.image.data as Uint8Array
    const len = 2048
    for (let i = 0; i < len; i++) {
      const srcIdx = Math.floor((i / len) * wave.length)
      const v = wave[srcIdx] // 0..255
      const base = i * 4
      data[base + 0] = v
      data[base + 1] = v
      data[base + 2] = v
      data[base + 3] = 255
    }
    waveTex.needsUpdate = true

    // Drive strength and bass swell
    const rms = analyserData.rms
    const third = Math.floor(analyserData.frequency.length / 3)
    let low = 0
    for (let i = 0; i < third; i++) low += analyserData.frequency[i]
    const lowAvg = (low / Math.max(1, third)) / 255
    const drive = Math.min(1.5, rms * 1.2 + lowAvg * 0.8)
    const target = analyserData.beat.isOnset ? drive + 0.8 : drive
    uniforms.current.uStrength.value = THREE.MathUtils.lerp(
      uniforms.current.uStrength.value,
      target,
      0.35
    )
    uniforms.current.uBass.value = THREE.MathUtils.lerp(
      uniforms.current.uBass.value,
      lowAvg,
      0.2
    )
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
            uniform float uTime, uPhase, uStrength, uBass;
            uniform sampler2D uWaveTex;
            void main(){
              vUv = uv;
              vNormalW = normalize(normalMatrix * normal);
              vec3 pos = position;
              // Sample waveform along length; scroll phase so wave travels
              float w = texture2D(uWaveTex, vec2(fract(uv.x - uPhase * 0.15), 0.5)).r * 2.0 - 1.0;
              // Secondary tube ripple for extra detail
              const float TAU = 6.28318530718;
              float tube = sin(uv.y * TAU * 4.0 + uPhase * 2.0);
              float amp = (w * 0.9 + tube * 0.25) * (0.7 + uBass * 0.6) * (0.6 + uStrength);
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
              // Seamless color band traveling along length
              float t = 0.5 + 0.5 * sin(vUv.x * TAU * 1.0 - uPhase * 0.5);
              vec3 col = mix(uColorA, uColorB, t);
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


