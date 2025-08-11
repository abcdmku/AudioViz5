import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

export const particleFieldMeta: VisualizerMeta = {
  id: 'particle-field',
  name: 'Particle Field',
  description: 'Floating particles pulsing to beats',
}

export const ParticleField: VisualizerComponent = ({ analyserData, settings }) => {
  // --- Editable Parameters ---
  const points = useRef<THREE.Points>(null)
  const matRef = useRef<THREE.PointsMaterial>(null)
  const freq = analyserData.frequency
  // Number of particles
  const particleCount = 512 * 16 // Change this value to set the number of particles
  const count = particleCount
  // Sphere shape
  const baseRadius = 28
  const radiusVariance = 10
  // Particle shell limits
  const minParticleRadius = 10
  const maxParticleRadius = 50
  // Color
  const colorSaturation = 3
  const colorLightness = .5
  // Orbit camera
  const cameraOrbitRadius = 55
  const cameraOrbitYOffset = 8
  const cameraOrbitYStrength = 18
  const cameraOrbitSpeed = 0.18
  // Particle size
  const baseParticleSize = 0.2
  
  // --- Particle Generation ---
  const { positions, colors, hues } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const cols = new Float32Array(count * 3)
    const huesArr = []
    // Cyberpunk neon color palette in HSL: [hue, saturation, lightness]
    const neonColorsHSL = [
      [0.83, colorSaturation, colorLightness], // magenta
      [0.52, colorSaturation, colorLightness], // cyan
      [0.66, colorSaturation, colorLightness], // blue
      [0.41, colorSaturation, colorLightness], // electric green
      [0.95, colorSaturation, colorLightness], // pink
      [0.08, colorSaturation, colorLightness], // orange
      [0.76, colorSaturation, colorLightness], // purple
    ]
    for (let i = 0; i < count; i++) {
      // Random position on sphere
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = baseRadius + Math.sin(i * 0.7) * radiusVariance;
      pos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      // Neon color selection
      const neonIdx = i % neonColorsHSL.length;
      const [h, s, l] = neonColorsHSL[neonIdx];
      huesArr.push(h);
      const color = new THREE.Color().setHSL(h, s, l);
      cols[i * 3 + 0] = color.r;
      cols[i * 3 + 1] = color.g;
      cols[i * 3 + 2] = color.b;
    }
    return { positions: pos, colors: cols, hues: huesArr }
  }, [count, baseRadius, radiusVariance, colorSaturation, colorLightness])

  // Camera animation
  const camAngle = useRef(0)
  // Variable to control expansion direction randomness

  useFrame(({ camera }, delta) => {
    camAngle.current += delta * cameraOrbitSpeed * (settings.animationSpeed || 1)
    camera.position.set(
      Math.cos(camAngle.current) * cameraOrbitRadius,
      Math.sin(camAngle.current * 0.7) * cameraOrbitYStrength + cameraOrbitYOffset,
      Math.sin(camAngle.current) * cameraOrbitRadius
    )
    camera.lookAt(0, 0, 0)

    if (!points.current) return;
    const geometry = points.current.geometry as THREE.BufferGeometry;
    const arrPos = (geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const arrCol = (geometry.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;

    // Logarithmic mapping for perceptual uniformity
    const minHz = 20;
    const maxHz = 20000;
    const nBins = freq.length;
    for (let i = 0; i < count; i++) {
      // Map particle index to frequency bin using log scale
      const norm = i / (count - 1);
      const hz = minHz * Math.pow(maxHz / minHz, norm);
      const bin = Math.min(nBins - 1, Math.round((Math.log10(hz / minHz) / Math.log10(maxHz / minHz)) * (nBins - 1)));
      const loud = freq[bin] / 255;
      // Animate position with audio
      const baseLen = Math.sqrt(
        positions[i * 3 + 0] * positions[i * 3 + 0] +
        positions[i * 3 + 1] * positions[i * 3 + 1] +
        positions[i * 3 + 2] * positions[i * 3 + 2]
      );
      const targetRadius = THREE.MathUtils.lerp(minParticleRadius, maxParticleRadius, loud);
      const scale = targetRadius / (baseLen || 1);
      arrPos[i * 3 + 0] = positions[i * 3 + 0] * scale;
      arrPos[i * 3 + 1] = positions[i * 3 + 1] * scale;
      arrPos[i * 3 + 2] = positions[i * 3 + 2] * scale;
      // Set lightness based on loudness, matching movement, use original hue
      const mappedLightness = THREE.MathUtils.lerp(0.4, .6, loud);
      const mappedSaturation = THREE.MathUtils.lerp(1, 10, loud);
      const hue = hues[i] !== undefined ? hues[i] : 0.5;
      const finalColor = new THREE.Color().setHSL(hue, mappedSaturation, mappedLightness);
      arrCol[i * 3 + 0] = finalColor.r;
      arrCol[i * 3 + 1] = finalColor.g;
      arrCol[i * 3 + 2] = finalColor.b;
    }

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    if (colAttr) colAttr.needsUpdate = true;

    // Particle size remains constant
    if (matRef.current) {
      matRef.current.size = baseParticleSize;
    }
  })

  return (
    <>
      {/* Scene background color */}
      <color attach="background" args={["#0a0020"]} />
      {/* Lighting */}
      <ambientLight intensity={0.7} color="#222244" />
      <pointLight position={[0, 20, 20]} intensity={2.2} color="#00ffff" />
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={matRef}
          size={baseParticleSize}
          sizeAttenuation
          transparent
          opacity={0.97}
          vertexColors
        />
      </points>
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={.7}
          intensity={1.5}
        />
      </EffectComposer>
    </>
  )
}


