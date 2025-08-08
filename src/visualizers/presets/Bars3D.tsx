import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import { Environment, OrbitControls } from '@react-three/drei'
import CinematicEffects from '../environments/CinematicEffects'

export const bars3DMeta: VisualizerMeta = {
  id: 'bars-3d',
  name: '3D Frequency Bars',
  description: 'Stacked bar grid driven by spectrum',
}

export const Bars3D: VisualizerComponent = ({ analyserData, settings }) => {
  const group = useRef<THREE.Group>(null)
  const gridSize = 24
  const total = gridSize * gridSize
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colorA = new THREE.Color(settings.colorA)
  const colorB = new THREE.Color(settings.colorB)
  const colors = useMemo(() => new Float32Array(total * 3), [total])

  const meshRef = useRef<THREE.InstancedMesh>(null)

  useMemo(() => {
    for (let i = 0; i < total; i++) {
      const t = i / total
      const c = colorA.clone().lerp(colorB, t)
      colors[i * 3 + 0] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
  }, [colors, total, colorA, colorB])

  useFrame((_, delta) => {
    if (!meshRef.current || !analyserData?.frequency) return
    const freq = analyserData.frequency
    const beatBoost = analyserData.beat.isOnset ? 1.8 : 1
    let i = 0
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const fIndex = Math.min(freq.length - 1, Math.floor((i / total) * freq.length))
        const v = (freq[fIndex] / 255) * 7.5 * beatBoost
        dummy.position.set(x - gridSize / 2, v / 2, y - gridSize / 2)
        dummy.scale.set(0.7, Math.max(0.05, v), 0.7)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
        i++
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    if (group.current) group.current.rotation.y += delta * 0.18 * settings.animationSpeed
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />
      <Environment preset={'city' as any} />
      <OrbitControls enablePan enableZoom enableRotate enableDamping dampingFactor={0.1} />
      <group ref={group}>
        <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, total]}>
          <boxGeometry args={[1, 1, 1]}>
            <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
          </boxGeometry>
          <meshStandardMaterial vertexColors wireframe={settings.wireframe} />
        </instancedMesh>
      </group>
      <CinematicEffects />
    </>
  )
}


