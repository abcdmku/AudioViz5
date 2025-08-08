import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import CinematicEffects from '../environments/CinematicEffects'

export const waveKnotOrganicMeta: VisualizerMeta = {
  id: 'wave-knot-organic',
  name: 'Wave Knot Organic',
  description: 'Simplified torus knot with organic beat flow and frequency-responsive pulses',
}

export const WaveKnotOrganic: VisualizerComponent = ({ analyserData, settings }) => {
  // Configuration Variables - Adjust these for different behaviors
  const BASS_THRESHOLD = 0.0005        // Energy threshold for bass beats
  const TREBLE_THRESHOLD = 0.0009      // Energy threshold for treble beats
  const BASS_PULSE_WIDTH = 0.08      // Width of bass pulses (longer)
  const TREBLE_PULSE_WIDTH = 0.04    // Width of treble pulses (shorter)
  const BASS_DECAY_TIME = .5        // Bass pulse decay time (seconds)
  const TREBLE_DECAY_TIME = 0.1      // Treble pulse decay time (seconds)
  const PULSE_TRAVEL_SPEED = 1.5     // Speed of pulses flowing through knot
  const BASS_COLOR_HUE = .9        // Orange/amber hue for bass (0-1)
  const TREBLE_COLOR_HUE = 0.5       // Blue/cyan hue for treble (0-1)
  const MAX_PULSES = 128              // Maximum number of active pulses
  const KNOT_SIZE = 3              // Size of the torus knot
  const KNOT_THICKNESS = 0.5         // Thickness of the knot tube
  const DEFORMATION_STRENGTH = 0.05   // How much pulses deform the knot

  const uniforms = useRef({
    uTime: { value: 0 },
    uPulsePos: { value: new Float32Array(MAX_PULSES) },
    uPulseAmp: { value: new Float32Array(MAX_PULSES) },
    uPulseWidth: { value: new Float32Array(MAX_PULSES) },
    uPulseHue: { value: new Float32Array(MAX_PULSES) },
    uPulseCount: { value: 0 },
    uColorA: { value: new THREE.Color(settings.colorA) },
    uColorB: { value: new THREE.Color(settings.colorB) },
  })

  const pulses = useRef<{ 
    pos: number
    amp: number
    width: number
    hue: number
    decayRate: number
  }[]>([])

  const smoothedBass = useRef(0)
  const smoothedTreble = useRef(0)
  const lastBassTime = useRef(0)
  const lastTrebleTime = useRef(0)

  useFrame((_, delta) => {
    uniforms.current.uTime.value += delta * settings.animationSpeed

    // Update existing pulses
    for (const pulse of pulses.current) {
      pulse.pos = (pulse.pos + PULSE_TRAVEL_SPEED * delta * settings.animationSpeed) % 1.0
      pulse.amp *= Math.pow(0.5, delta / pulse.decayRate)
    }

    // Analyze frequency data for bass and treble
    const freq = analyserData.frequency
    const bassEnd = Math.floor(freq.length * 0.15)    // Bottom 15% = bass
    const trebleStart = Math.floor(freq.length * 0.7) // Top 30% = treble

    // Calculate bass energy
    let bassSum = 0
    for (let i = 0; i < bassEnd; i++) {
      bassSum += freq[i]
    }
    const bassEnergy = (bassSum / bassEnd) / 255

    // Calculate treble energy
    let trebleSum = 0
    for (let i = trebleStart; i < freq.length; i++) {
      trebleSum += freq[i]
    }
    const trebleEnergy = (trebleSum / (freq.length - trebleStart)) / 255

    // Smooth the energy values to reduce jitter
    const smoothingFactor = .99
    smoothedBass.current = smoothedBass.current * smoothingFactor + bassEnergy * (1 - smoothingFactor)
    smoothedTreble.current = smoothedTreble.current * smoothingFactor + trebleEnergy * (1 - smoothingFactor)

    // Spawn bass pulse if energy exceeds threshold (adaptive spike detection)
    const bassSpikeFactor = Math.max(1.1, 1.0 + (smoothedBass.current * 2.0)) // Lower spike requirement when energy is high
    const minBassCooldown = 0.05 // Minimum time between bass pulses (50ms)
    const currentTime = uniforms.current.uTime.value
    
    if (bassEnergy > BASS_THRESHOLD && 
        bassEnergy > smoothedBass.current * bassSpikeFactor &&
        currentTime - lastBassTime.current > minBassCooldown) {
      addPulse({
        pos: 0,
        amp: Math.min(1.0, bassEnergy * 1.5),
        width: BASS_PULSE_WIDTH,
        hue: BASS_COLOR_HUE,
        decayRate: BASS_DECAY_TIME
      })
      lastBassTime.current = currentTime
    }

    // Spawn treble pulse if energy exceeds threshold (adaptive spike detection)
    const trebleSpikeFactor = Math.max(1.05, 1.0 + (smoothedTreble.current * 1.5)) // Lower spike requirement when energy is high
    const minTrebleCooldown = 0.03 // Minimum time between treble pulses (30ms)
    
    if (trebleEnergy > TREBLE_THRESHOLD && 
        trebleEnergy > smoothedTreble.current * trebleSpikeFactor &&
        currentTime - lastTrebleTime.current > minTrebleCooldown) {
      addPulse({
        pos: 0,
        amp: Math.min(0.8, trebleEnergy * 2.0),
        width: TREBLE_PULSE_WIDTH,
        hue: TREBLE_COLOR_HUE,
        decayRate: TREBLE_DECAY_TIME
      })
      lastTrebleTime.current = currentTime
    }

    // Remove weak pulses only (pos wraps around now)
    pulses.current = pulses.current.filter(p => p.amp > 0.01)

    // Update uniforms
    updateUniforms()
  })

  function addPulse(pulse: { pos: number; amp: number; width: number; hue: number; decayRate: number }) {
    pulses.current.push(pulse)
    
    // Gradually remove weak pulses instead of abruptly removing by count
    if (pulses.current.length > MAX_PULSES) {
      // Sort by amplitude and remove the weakest pulse
      pulses.current.sort((a, b) => b.amp - a.amp)
      pulses.current = pulses.current.slice(0, MAX_PULSES)
    }
  }

  function updateUniforms() {
    const posArr = uniforms.current.uPulsePos.value
    const ampArr = uniforms.current.uPulseAmp.value
    const widthArr = uniforms.current.uPulseWidth.value
    const hueArr = uniforms.current.uPulseHue.value

    // Clear arrays
    posArr.fill(0)
    ampArr.fill(0)
    widthArr.fill(0.01)
    hueArr.fill(0)

    // Fill with active pulses
    const count = Math.min(MAX_PULSES, pulses.current.length)
    uniforms.current.uPulseCount.value = count

    for (let i = 0; i < count; i++) {
      const pulse = pulses.current[i]
      posArr[i] = pulse.pos
      ampArr[i] = pulse.amp
      widthArr[i] = pulse.width
      hueArr[i] = pulse.hue
    }
  }

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 4, 3]} intensity={1.0} />
      <Environment preset={'city' as any} />
      <OrbitControls enablePan enableZoom enableRotate enableDamping dampingFactor={0.1} />
      
      <mesh>
        <torusKnotGeometry args={[KNOT_SIZE, KNOT_THICKNESS, 512, 128]} />
        <shaderMaterial
          transparent
          uniforms={uniforms.current as any}
          vertexShader={`
            varying vec3 vNormal;
            varying vec2 vUv;
            uniform float uTime;
            #define MAX_PULSES ${MAX_PULSES}
            uniform float uPulsePos[MAX_PULSES];
            uniform float uPulseAmp[MAX_PULSES];
            uniform float uPulseWidth[MAX_PULSES];
            uniform int uPulseCount;
            varying float vIntensity;

            void main() {
              vUv = uv;
              vNormal = normalize(normalMatrix * normal);
              
              vec3 pos = position;
              float totalDeformation = 0.0;
              
              // Apply pulse deformations
              for (int i = 0; i < MAX_PULSES; i++) {
                if (i >= uPulseCount) break;
                
                float pulsePos = uPulsePos[i];
                float pulseAmp = uPulseAmp[i];
                float pulseWidth = uPulseWidth[i];
                
                                 // Calculate distance along the knot surface with wrapping
                 float dist = abs(uv.x - pulsePos);
                 dist = min(dist, 1.0 - dist); // Handle wrapping
                 
                 // Create gaussian pulse shape
                 float influence = exp(-(dist * dist) / (pulseWidth * pulseWidth));
                
                // Apply deformation
                float deformation = influence * pulseAmp * ${DEFORMATION_STRENGTH.toFixed(1)};
                totalDeformation += deformation;
                
                pos += normal * deformation;
              }
              
              vIntensity = totalDeformation;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            varying vec2 vUv;
            varying float vIntensity;
            uniform float uTime;
            uniform vec3 uColorA, uColorB;
            #define MAX_PULSES ${MAX_PULSES}
            uniform float uPulsePos[MAX_PULSES];
            uniform float uPulseAmp[MAX_PULSES];
            uniform float uPulseWidth[MAX_PULSES];
            uniform float uPulseHue[MAX_PULSES];
            uniform int uPulseCount;

            vec3 hsv2rgb(vec3 c) {
              vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
              vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
              return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            void main() {
                             // Base color gradient with smoother wrapping
               float colorPhase = fract(vUv.x - uTime * 0.1);
               vec3 baseColor = mix(uColorA, uColorB, 0.5 + 0.5 * sin(colorPhase * 6.28));
              
              // Calculate pulse color influence
              vec3 pulseColor = vec3(0.0);
              float totalWeight = 0.0;
              
              for (int i = 0; i < MAX_PULSES; i++) {
                if (i >= uPulseCount) break;
                
                float pulsePos = uPulsePos[i];
                float pulseAmp = uPulseAmp[i];
                float pulseWidth = uPulseWidth[i];
                float pulseHue = uPulseHue[i];
                
                                 float dist = abs(vUv.x - pulsePos);
                 dist = min(dist, 1.0 - dist); // Handle wrapping
                 float influence = exp(-(dist * dist) / (pulseWidth * pulseWidth));
                float weight = influence * pulseAmp;
                
                vec3 hsvColor = vec3(pulseHue, 0.8, 0.9);
                pulseColor += hsv2rgb(hsvColor) * weight;
                totalWeight += weight;
              }
              
              // Blend base color with pulse colors
              vec3 finalColor = baseColor;
              if (totalWeight > 0.0) {
                pulseColor /= totalWeight;
                float blendFactor = clamp(totalWeight * 2.0, 0.0, 1.0);
                finalColor = mix(baseColor, pulseColor, blendFactor);
              }
              
              // Add rim lighting
              float rim = pow(1.0 - max(0.0, dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);
              finalColor += rim * 0.1;
              
              // Add intensity-based brightness
              finalColor += vIntensity * 0.3;
              
              gl_FragColor = vec4(finalColor, 0.95);
            }
          `}
        />
      </mesh>
      
      <CinematicEffects />
    </>
  )
}
