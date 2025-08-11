import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import { Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import CinematicEffects from '../environments/CinematicEffects'

// eslint-disable-next-line react-refresh/only-export-components
export const tunnelRippleMeta: VisualizerMeta = {
  id: 'tunnel-ripple',
  name: 'Tunnel Ripple',
  description: 'Look down a tunnel where beats create ripples that travel towards you',
}

// Ripple data structure
interface Ripple {
  position: number    // 0-1 along tunnel length
  amplitude: number   // Current amplitude
  hue: number        // HSL hue value
  timestamp: number   // Creation time
}

export const TunnelRipple: VisualizerComponent = ({ analyserData, settings }) => {
  // Configurable parameters
  const TUNNEL_LENGTH = 160          // Tunnel depth
  const TUNNEL_RADIUS = 8           // Tunnel width
  const RADIAL_SEGMENTS = 128*8       // Frequency resolution
  const LENGTH_SEGMENTS = 256       // Ripple smoothness
  const RIPPLE_SPEED = 0.5          // Speed ripples travel (0-1)
  const RIPPLE_DECAY = 0.98         // Ripple fade rate per frame
  const RIPPLE_WIDTH = 200          // Ripple gaussian width (shader param)
  const RIPPLE_AMPLITUDE = 3.0      // Max ripple displacement
  const HUE_SHIFT_SPEED = 0.1       // Hue change per beat
  const FREQUENCY_SCALE = 4.0       // Frequency effect multiplier
  const MIN_BPM = 40                // Minimum BPM to detect
  const MAX_BPM = 500               // Maximum BPM to detect
  const BEAT_THRESHOLD = 0.005       // RMS threshold for beat
  const FOG_DENSITY = 0.9           // Depth fog amount
  const GLOW_INTENSITY = 0.3        // Frequency glow strength
  const MAX_RIPPLES = 128            // Maximum concurrent ripples

  // State management
  const ripples = useRef<Ripple[]>([])
  const beatHistory = useRef<number[]>([])
  const prevRms = useRef(0)
  const currentHue = useRef(0)
  const lastBeatTime = useRef(0)

  // Create frequency texture
  const frequencyTexture = useMemo(() => {
    const tex = new THREE.DataTexture(
      new Uint8Array(RADIAL_SEGMENTS * 4),
      RADIAL_SEGMENTS,
      1,
      THREE.RGBAFormat
    )
    tex.needsUpdate = true
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    return tex
  }, [])

  // Create uniforms
  const uniforms = useRef({
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(settings.colorA) },
    uColorB: { value: new THREE.Color(settings.colorB) },
    uFrequencyTexture: { value: frequencyTexture },
    uRipplePositions: { value: new Float32Array(MAX_RIPPLES) },
    uRippleAmplitudes: { value: new Float32Array(MAX_RIPPLES) },
    uRippleHues: { value: new Float32Array(MAX_RIPPLES) },
    uRippleCount: { value: 0 },
    uRippleWidth: { value: RIPPLE_WIDTH },
    uRippleAmplitude: { value: RIPPLE_AMPLITUDE },
    uFrequencyScale: { value: FREQUENCY_SCALE },
    uFogDensity: { value: FOG_DENSITY },
    uGlowIntensity: { value: GLOW_INTENSITY },
  })

  // Update frequency texture with better frequency distribution
  const updateFrequencyTexture = () => {
    if (!analyserData) return
    
    const data = frequencyTexture.image.data as Uint8Array
    const freqArray = analyserData.frequency
    const totalBins = freqArray.length
    
    for (let i = 0; i < RADIAL_SEGMENTS; i++) {
      // Map radial segments to frequency bands with logarithmic distribution
      // This gives better representation across the frequency spectrum
      const normalizedPos = i / RADIAL_SEGMENTS
      
      // Logarithmic frequency mapping (more detail in lower frequencies)
      const logStart = Math.pow(normalizedPos, 1.5) * totalBins
      const logEnd = Math.pow((i + 1) / RADIAL_SEGMENTS, 1.5) * totalBins
      
      const startBin = Math.floor(logStart)
      const endBin = Math.min(Math.floor(logEnd), totalBins - 1)
      
      // Calculate weighted average for this frequency band
      let sum = 0
      let count = 0
      for (let j = startBin; j <= endBin; j++) {
        sum += freqArray[j]
        count++
      }
      
      const avg = count > 0 ? sum / count : 0
      
      const base = i * 4
      data[base + 0] = avg
      data[base + 1] = avg
      data[base + 2] = avg
      data[base + 3] = 255
    }
    
    frequencyTexture.needsUpdate = true
  }

  // Beat detection with BPM filtering
  const detectBeat = (currentTime: number): boolean => {
    if (!analyserData) return false
    
    // Check for onset
    const rms = analyserData.rms
    const rmsSpike = rms > prevRms.current * 1.15 && rms > BEAT_THRESHOLD
    const onset = analyserData.beat.isOnset || rmsSpike
    
    if (!onset) {
      prevRms.current = rms
      return false
    }
    
    // Calculate time since last beat
    const timeDiff = currentTime - lastBeatTime.current
    
    // Skip if too soon (debounce) - allow faster beats
    if (timeDiff < 200) {
      prevRms.current = rms
      return false
    }
    
    // Calculate BPM
    const bpm = 60000 / timeDiff
    
    // Filter by BPM range
    if (bpm >= MIN_BPM && bpm <= MAX_BPM) {
      beatHistory.current.push(currentTime)
      if (beatHistory.current.length > 10) {
        beatHistory.current.shift()
      }
      lastBeatTime.current = currentTime
      prevRms.current = rms
      return true
    }
    
    prevRms.current = rms
    return false
  }

  useFrame((_, delta) => {
    uniforms.current.uTime.value += delta * settings.animationSpeed
    
    // Update frequency texture
    updateFrequencyTexture()
    
    // Update ripple positions and decay
    for (const ripple of ripples.current) {
      ripple.position += RIPPLE_SPEED * delta * settings.animationSpeed
      ripple.amplitude *= Math.pow(RIPPLE_DECAY, delta * 60) // Normalize to 60fps
    }
    
    // Remove dead ripples
    ripples.current = ripples.current.filter(
      r => r.amplitude > 0.01 && r.position <= 1.0
    )
    
    // Detect beats and create new ripples
    const currentTime = Date.now()
    const shouldCreateRipple = detectBeat(currentTime)
    
    // Also create ripples based on energy level for more responsive visuals
    const energy = analyserData ? analyserData.frequency.reduce((a, b) => a + b, 0) / analyserData.frequency.length / 255 : 0
    const energyRipple = energy > 0.4 && (currentTime - lastBeatTime.current) > 500
    
    if (shouldCreateRipple || energyRipple) {
      // Shift hue
      currentHue.current = (currentHue.current + HUE_SHIFT_SPEED) % 1.0
      
      // Create new ripple at tunnel end (position 0)
      ripples.current.unshift({
        position: 0,
        amplitude: energyRipple ? energy * 1.5 : 1.0,
        hue: currentHue.current,
        timestamp: currentTime,
      })
      
      if (energyRipple) {
        lastBeatTime.current = currentTime
      }
      
      // Limit ripple count
      if (ripples.current.length > MAX_RIPPLES) {
        ripples.current = ripples.current.slice(0, MAX_RIPPLES)
      }
    }
    
    // Update shader uniforms
    const posArr = uniforms.current.uRipplePositions.value
    const ampArr = uniforms.current.uRippleAmplitudes.value
    const hueArr = uniforms.current.uRippleHues.value
    
    // Clear arrays
    posArr.fill(0)
    ampArr.fill(0)
    hueArr.fill(0)
    
    // Fill with current ripples
    const count = Math.min(MAX_RIPPLES, ripples.current.length)
    uniforms.current.uRippleCount.value = count
    
    for (let i = 0; i < count; i++) {
      posArr[i] = ripples.current[i].position
      ampArr[i] = ripples.current[i].amplitude
      hueArr[i] = ripples.current[i].hue
    }
  })

  return (
    <>
      <PerspectiveCamera 
        makeDefault 
        position={[0, TUNNEL_LENGTH / 2 + 5, 0]} 
        fov={75}
      />
      <ambientLight intensity={0.2} />
      <directionalLight 
        position={[TUNNEL_RADIUS * 2, TUNNEL_LENGTH / 4, TUNNEL_RADIUS]} 
        intensity={1.5} 
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={TUNNEL_LENGTH * 2}
        shadow-camera-left={-TUNNEL_RADIUS * 2}
        shadow-camera-right={TUNNEL_RADIUS * 2}
        shadow-camera-top={TUNNEL_RADIUS * 2}
        shadow-camera-bottom={-TUNNEL_RADIUS * 2}
      />
      <directionalLight 
        position={[-TUNNEL_RADIUS, -TUNNEL_LENGTH / 3, TUNNEL_RADIUS * 1.5]} 
        intensity={0.8} 
        color="#4a90e2"
      />
      <Environment preset="night" />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        enableRotate={false}
        enableDamping
        dampingFactor={0.1}
        target={[0, -TUNNEL_LENGTH / 4, 0]}
      />
      
      <mesh position={[0, 0, 0]} receiveShadow castShadow>
        <cylinderGeometry
          args={[
            TUNNEL_RADIUS,
            TUNNEL_RADIUS,
            TUNNEL_LENGTH,
            RADIAL_SEGMENTS,
            LENGTH_SEGMENTS,
            true
          ]}
        />
        <shaderMaterial
          side={THREE.BackSide}
          transparent
          blending={THREE.AdditiveBlending}
          lights={true}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          uniforms={{
            ...uniforms.current,
            ...THREE.UniformsLib.lights
          } as any}
          vertexShader={`
            varying vec2 vUv;
            varying float vFrequency;
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec3 vWorldPosition;
            uniform float uTime;
            uniform sampler2D uFrequencyTexture;
            uniform float uRipplePositions[${MAX_RIPPLES}];
            uniform float uRippleAmplitudes[${MAX_RIPPLES}];
            uniform int uRippleCount;
            uniform float uRippleWidth;
            uniform float uRippleAmplitude;
            uniform float uFrequencyScale;

            void main() {
              vUv = uv;
              
              // Get frequency for this radial segment
              float freqU = floor(uv.x * 128.0) / 128.0;
              vFrequency = texture2D(uFrequencyTexture, vec2(freqU, 0.5)).r / 255.0;
              
              vec3 pos = position;
              
              // Apply ripples
              float rippleSum = 0.0;
              for (int i = 0; i < ${MAX_RIPPLES}; i++) {
                if (i >= uRippleCount) break;
                
                float ripplePos = uRipplePositions[i];
                float rippleAmp = uRippleAmplitudes[i];
                
                // Calculate distance from ripple center
                float dist = abs(uv.y - ripplePos);
                
                // Base ripple shape
                float baseRipple = exp(-dist * dist * uRippleWidth);
                
                // Frequency-based modulation (spectrograph effect)
                // Each radial segment shows different frequency intensity
                float freqIntensity = vFrequency * uFrequencyScale;
                
                // Main wave modulated by frequency at this radial position
                float mainWave = baseRipple * rippleAmp * (0.3 + freqIntensity);
                
                // Secondary wave for frequencies above threshold
                float secondaryWave = 0.0;
                if (freqIntensity > 0.3) {
                  secondaryWave = exp(-dist * dist * (uRippleWidth * 1.5)) * rippleAmp * freqIntensity * 0.7;
                }
                
                // High-frequency detail wave for strong frequencies
                float detailWave = 0.0;
                if (freqIntensity > 0.5) {
                  detailWave = sin(dist * 80.0) * exp(-dist * dist * uRippleWidth * 0.3) * freqIntensity * 0.4;
                }
                
                float wave = mainWave + secondaryWave + detailWave;
                
                rippleSum += wave;
              }
              
              // Displace vertices radially inward (shrinking effect)
              vec3 normal = normalize(vec3(pos.x, 0.0, pos.z));
              pos -= normal * rippleSum * uRippleAmplitude;
              
              // Pass lighting information
              vNormal = normalMatrix * normal;
              vPosition = (modelViewMatrix * vec4(pos, 1.0)).xyz;
              vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
              
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vUv;
            varying float vFrequency;
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec3 vWorldPosition;
            uniform vec3 uColorA;
            uniform vec3 uColorB;
            uniform float uRippleHues[${MAX_RIPPLES}];
            uniform float uRipplePositions[${MAX_RIPPLES}];
            uniform int uRippleCount;
            uniform float uFogDensity;
            uniform float uGlowIntensity;
            
            // Three.js lighting uniforms
            #include <lights_pars_begin>

            vec3 hsl2rgb(vec3 hsl) {
              float h = hsl.x;
              float s = hsl.y;
              float l = hsl.z;
              
              float c = (1.0 - abs(2.0 * l - 1.0)) * s;
              float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
              float m = l - c / 2.0;
              
              vec3 rgb;
              if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
              else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
              else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
              else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
              else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
              else rgb = vec3(c, 0.0, x);
              
              return rgb + m;
            }

            void main() {
              // Smooth color transitions that travel with ripples
              // Y=0 is far end (where ripples start), Y=1 is near end (camera)
              float currentHue = 0.5;
              float blendWeight = 0.0;
              
              // Create smooth color transitions by blending between ripple hues
              for (int i = 0; i < ${MAX_RIPPLES}; i++) {
                if (i >= uRippleCount) break;
                
                float ripplePos = uRipplePositions[i];
                float rippleHue = uRippleHues[i];
                
                // Calculate distance from ripple front
                float distFromRipple = vUv.y - ripplePos;
                
                // Create smooth transition zone behind ripple
                float transitionWidth = 0.15; // Smooth transition over 15% of tunnel
                
                if (distFromRipple <= 0.0) {
                  // This position is ahead of the ripple - full effect
                  float weight = 1.0;
                  if (blendWeight < weight) {
                    currentHue = mix(currentHue, rippleHue, weight - blendWeight);
                    blendWeight = weight;
                  }
                } else if (distFromRipple < transitionWidth) {
                  // Smooth transition zone
                  float weight = 1.0 - (distFromRipple / transitionWidth);
                  weight = smoothstep(0.0, 1.0, weight); // Smooth falloff
                  
                  if (blendWeight < weight) {
                    currentHue = mix(currentHue, rippleHue, (weight - blendWeight) * 0.7);
                    blendWeight = weight;
                  }
                }
              }
              
              // Convert hue to color
              vec3 baseColor = hsl2rgb(vec3(currentHue, 0.8, 0.5));
              
              // Frequency-based color modulation (spectrograph visualization)
              float freqIntensity = vFrequency * 3.0;
              
              // Create frequency-based color bands
              vec3 freqColor = vec3(0.0);
              if (freqIntensity > 0.1) {
                // Low frequencies (red-orange)
                if (vUv.x < 0.33) {
                  freqColor = vec3(1.0, 0.4, 0.1) * freqIntensity;
                }
                // Mid frequencies (green-yellow) 
                else if (vUv.x < 0.66) {
                  freqColor = vec3(0.2, 1.0, 0.3) * freqIntensity;
                }
                // High frequencies (blue-cyan)
                else {
                  freqColor = vec3(0.1, 0.6, 1.0) * freqIntensity;
                }
              }
              
              // Blend base color with frequency visualization
              vec3 color = mix(baseColor, baseColor + freqColor, 0.6);
              
              // Mix with user colors
              color = mix(color, mix(uColorA, uColorB, vUv.x), 0.2);
              
              // Basic directional lighting calculation
              vec3 normal = normalize(vNormal);
              vec3 lightDirection = normalize(vec3(1.0, 0.5, 1.0)); // Main light direction
              float lightIntensity = max(dot(normal, lightDirection), 0.0);
              
              // Add shadow/lighting effect
              float shadow = 0.4 + lightIntensity * 0.6; // Base shadow + light contribution
              color *= shadow;
              
              // Secondary light from opposite side
              vec3 lightDirection2 = normalize(vec3(-0.5, -1.0, 0.8));
              float lightIntensity2 = max(dot(normal, lightDirection2), 0.0);
              color += lightIntensity2 * 0.3 * vec3(0.4, 0.6, 0.9); // Blue secondary light
              
              // Depth fog (looking down the tunnel)
              float depth = vUv.y;
              color *= (1.0 - depth * uFogDensity);
              
              gl_FragColor = vec4(color, 0.95);
            }
          `}
        />
      </mesh>
      
      <CinematicEffects />
    </>
  )
}