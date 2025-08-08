import CinematicEffects from '../environments/CinematicEffects'
import { Environment } from '@react-three/drei'
import { OrbitControls } from '@react-three/drei'
import { useMemo } from 'react'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'

export const abstractBloomMeta: VisualizerMeta = {
  id: 'abstract-bloom',
  name: 'Abstract Bloom',
  description: 'Blooming torus knots reacting to spectrum',
}

export const AbstractBloom: VisualizerComponent = ({ analyserData, settings }) => {
  const group = useRef<THREE.Group>(null)
  // placeholders retained earlier are no longer needed
  const a = settings.animationSpeed
  // Shader uniforms for deformed torus knot
  const uniformsA = useRef({
    uTime: { value: 0 },
    uPhase: { value: 0 },
    uStrength: { value: 0 },
    uBass: { value: 0 },
    uColorA: { value: new THREE.Color(settings.colorA) },
    uColorB: { value: new THREE.Color(settings.colorB) },
  })

  useFrame((_, delta) => {
    if (!group.current) return
    // Rotate gently (no global scaling so ripples are evident)
    group.current.rotation.x += delta * 0.2 * a
    group.current.rotation.y += delta * 0.3 * a

    // Update uniforms
    const up = (u: any) => {
      u.uTime.value += delta * a
      u.uPhase.value += delta * 0.6 * a
      // Base drive from RMS + low band, with beat spike
      const rms = analyserData.rms
      const third = Math.floor(analyserData.frequency.length / 3)
      let low = 0
      for (let i = 0; i < third; i++) low += analyserData.frequency[i]
      const lowAvg = (low / Math.max(1, third)) / 255
      const drive = Math.min(1.5, rms * 1.2 + lowAvg * 0.8)
      const target = analyserData.beat.isOnset ? drive + 0.8 : drive
      u.uStrength.value = THREE.MathUtils.lerp(u.uStrength.value, target, 0.4)
      u.uBass.value = THREE.MathUtils.lerp(u.uBass.value, lowAvg, 0.25)
    }
    up(uniformsA.current)
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />
      <Environment preset={'city' as any} />
      <OrbitControls enablePan enableZoom enableRotate enableDamping dampingFactor={0.1} />
      <group ref={group}>
        <mesh>
          <torusKnotGeometry args={[1.5, 0.35, 512, 128]} />
          <shaderMaterial
            transparent
            uniforms={uniformsA.current as any}
            vertexShader={`
              varying vec3 vNormalW;
              varying vec2 vUv;
              uniform float uTime, uPhase, uStrength, uBass;
              void main(){
                vUv = uv;
                vNormalW = normalize(normalMatrix * normal);
                vec3 pos = position;
                // Strong, clear displacement: traveling ripple along length (uv.x), minor around tube (uv.y)
                const float TAU = 6.28318530718;
                float along = sin(uv.x * TAU * 6.0 - uPhase * 2.0);
                float around = sin(uv.y * TAU * 2.0 + uPhase * 1.0);
                float n = sin((position.x + position.y + position.z) * 0.8 + uTime * 0.7);
                float amp = (along * 0.8 + around * 0.2 + n * 0.25) * uStrength + uBass * 0.6;
                pos += normal * amp * 0.7;
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
                float t = 0.5 + 0.5 * sin(vUv.x * TAU * 1.0 - uPhase * 0.5);
                vec3 col = mix(uColorA, uColorB, t);
                float rim = pow(1.0 - max(0.0, dot(normalize(vNormalW), vec3(0.0,0.0,1.0))), 2.0);
                col += rim * 0.12;
                gl_FragColor = vec4(col, 0.98);
              }
            `}
          />
        </mesh>
      </group>
      <CinematicEffects />
    </>
  )
}


