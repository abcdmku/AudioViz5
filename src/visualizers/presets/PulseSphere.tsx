import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'

export const pulseSphereMeta: VisualizerMeta = {
  id: 'pulse-sphere',
  name: 'Pulse Sphere',
  description: 'Audio-reactive glowing sphere',
}

export const PulseSphere: VisualizerComponent = ({ analyserData, settings }) => {
  const mesh = useRef<THREE.Mesh>(null)
  const uniforms = useRef({
    uTime: { value: 0 },
    uAmp: { value: 0 },
    uColorA: { value: new THREE.Color(settings.colorA) },
    uColorB: { value: new THREE.Color(settings.colorB) },
    uFreqLow: { value: 0 },
    uFreqMid: { value: 0 },
    uFreqHigh: { value: 0 },
  })

  useFrame((_, delta) => {
    uniforms.current.uTime.value += delta * settings.animationSpeed
    const freq = analyserData.frequency
    const third = Math.floor(freq.length / 3)
    const low = freq.slice(0, third)
    const mid = freq.slice(third, third * 2)
    const high = freq.slice(third * 2)
    const avg = (arr: Uint8Array) => arr.reduce((a, b) => a + b, 0) / arr.length / 255
    const lowAvg = avg(low)
    const midAvg = avg(mid)
    const highAvg = avg(high)
    uniforms.current.uFreqLow.value = lowAvg
    uniforms.current.uFreqMid.value = midAvg
    uniforms.current.uFreqHigh.value = highAvg
    const amp = (lowAvg * 0.6 + midAvg * 0.3 + highAvg * 0.1)
    uniforms.current.uAmp.value = 0.2 + amp * 1.2 + (analyserData.beat.isOnset ? 0.35 : 0)
    if (mesh.current) mesh.current.rotation.y += delta * 0.2
  })

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[2.5, 64]} />
      <shaderMaterial
        transparent
        uniforms={uniforms.current as any}
        vertexShader={`
          varying vec3 vNormalW;
          uniform float uTime;
          uniform float uAmp;
          uniform float uFreqLow;
          uniform float uFreqMid;
          uniform float uFreqHigh;
          // 4D Simplex noise (impostor - light weight)
          float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453123);} 
          float noise(vec3 p){
            vec3 i=floor(p); vec3 f=fract(p); 
            float n=dot(i,vec3(1.0,57.0,113.0));
            float res=mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
            return res;
          }
          void main() {
            vec3 pos = position;
            float n = noise(normal * 4.0 + vec3(uTime*0.5));
            float warp = uFreqLow*0.6 + uFreqMid*0.3 + uFreqHigh*0.1;
            pos += normal * (uAmp + n*0.5*warp);
            vNormalW = normalMatrix * normal;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vNormalW;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          void main() {
            float rim = pow(1.0 - max(0.0, dot(normalize(vNormalW), vec3(0.0,0.0,1.0))), 2.0);
            vec3 col = mix(uColorA, uColorB, rim);
            gl_FragColor = vec4(col, 0.98);
          }
        `}
      />
    </mesh>
  )
}


