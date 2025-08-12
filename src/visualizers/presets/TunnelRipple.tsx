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
  // Configurable parameters for waveform tunnel
  const TUNNEL_LENGTH = 100         // Tunnel depth
  const TUNNEL_RADIUS = 6           // Base tunnel radius
  const RADIAL_SEGMENTS = 128       // Circumference resolution for waveform
  const LENGTH_SEGMENTS = 512       // Length segments for smooth waveform travel
  const WAVEFORM_AMPLITUDE = 2.0    // How much waveform affects tunnel shape
  const TUNNEL_SPEED = 0.5          // Speed of traveling through tunnel
  const WAVEFORM_SCALE = 1.0        // Scale factor for waveform data
  const COLOR_INTENSITY = 1.5       // Waveform color intensity
  const GLOW_STRENGTH = 0.8         // Glow effect strength

  // State management for waveform tunnel
  const tunnelOffset = useRef(0)

  // Create waveform texture for tunnel walls
  const waveformTexture = useMemo(() => {
    const tex = new THREE.DataTexture(
      new Uint8Array(1024 * 4), // Use full waveform resolution
      1024,
      1,
      THREE.RGBAFormat
    )
    tex.needsUpdate = true
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.wrapS = THREE.RepeatWrapping
    return tex
  }, [])

  // Create uniforms for waveform tunnel
  const uniforms = useRef({
    uTime: { value: 0 },
    uTunnelOffset: { value: 0 },
    uColorA: { value: new THREE.Color(settings.colorA) },
    uColorB: { value: new THREE.Color(settings.colorB) },
    uWaveformTexture: { value: waveformTexture },
    uWaveformAmplitude: { value: WAVEFORM_AMPLITUDE },
    uWaveformScale: { value: WAVEFORM_SCALE },
    uColorIntensity: { value: COLOR_INTENSITY },
    uGlowStrength: { value: GLOW_STRENGTH },
    uTunnelRadius: { value: TUNNEL_RADIUS },
  })

  // Update waveform texture for tunnel walls
  const updateWaveformTexture = () => {
    if (!analyserData) return
    
    const data = waveformTexture.image.data as Uint8Array
    const waveformArray = analyserData.waveform
    
    // Copy waveform data directly to texture
    for (let i = 0; i < 1024; i++) {
      const waveValue = i < waveformArray.length ? waveformArray[i] : 128
      const base = i * 4
      data[base + 0] = waveValue
      data[base + 1] = waveValue 
      data[base + 2] = waveValue
      data[base + 3] = 255
    }
    
    waveformTexture.needsUpdate = true
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
    
    // Update waveform texture
    updateWaveformTexture()
    
    // Animate tunnel movement (traveling through the waveform)
    tunnelOffset.current += TUNNEL_SPEED * delta * settings.animationSpeed
    uniforms.current.uTunnelOffset.value = tunnelOffset.current
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
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          uniforms={uniforms.current as any}
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
            uniform float uMountainHeight;
            uniform float uMountainThreshold;

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
              
              // Create mountain-like terrain based on frequency data
              vec3 normal = normalize(vec3(pos.x, 0.0, pos.z));
              
              // Base frequency displacement (mountain terrain)
              float audioIntensity = vFrequency;
              
              // Always show some mountains for debugging, scale with audio
              float baseDisplacement = uMountainHeight * 0.2; // Base 20% height always
              float audioDisplacement = 0.0;
              
              if (audioIntensity > uMountainThreshold) {
                // Scale mountain height based on audio intensity above threshold
                float scaledIntensity = (audioIntensity - uMountainThreshold) / (1.0 - uMountainThreshold);
                scaledIntensity = smoothstep(0.0, 1.0, scaledIntensity);
                audioDisplacement = scaledIntensity * uMountainHeight * 0.8; // Additional 80% from audio
              }
              
              float mountainDisplacement = baseDisplacement + audioDisplacement;
              
              // Add multiple layers of noise for complex mountain terrain
              // Large terrain features
              float noise1 = sin(vUv.x * 20.0 + vUv.y * 15.0 + uTime * 0.1) * 0.3;
              float noise2 = cos(vUv.x * 35.0 + vUv.y * 25.0 - uTime * 0.15) * 0.2;
              
              // Medium terrain features  
              float noise3 = sin(vUv.x * 60.0 + vUv.y * 40.0 + uTime * 0.2) * 0.15;
              float noise4 = cos(vUv.x * 80.0 - vUv.y * 50.0 + uTime * 0.05) * 0.1;
              
              // Fine detail
              float noise5 = sin(vUv.x * 120.0 + vUv.y * 100.0 - uTime * 0.3) * 0.05;
              
              // Add some fractal-like variation
              float fractal = sin(vUv.x * 40.0) * cos(vUv.y * 30.0) * sin(uTime * 0.1) * 0.1;
              
              // Combine all noise layers
              float totalNoise = noise1 + noise2 + noise3 + noise4 + noise5 + fractal;
              
              // Always apply some noise, scale more with audio
              float baseNoiseScale = 0.3; // Base noise always present
              float audioNoiseScale = 0.0;
              
              if (audioIntensity > uMountainThreshold) {
                float noiseScale = (audioIntensity - uMountainThreshold) / (1.0 - uMountainThreshold);
                noiseScale = smoothstep(0.0, 1.0, noiseScale);
                audioNoiseScale = noiseScale * (0.7 + audioIntensity * 1.2);
              }
              
              mountainDisplacement += totalNoise * (baseNoiseScale + audioNoiseScale);
              
              // Apply mountain displacement inward (creating valleys and peaks)
              pos -= normal * mountainDisplacement;
              
              // Add ripple effects on top of mountain terrain
              pos -= normal * rippleSum * uRippleAmplitude * 0.5;
              
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
              
              // Enhanced lighting for mountain terrain
              vec3 normal = normalize(vNormal);
              vec3 lightDirection = normalize(vec3(1.0, 0.5, 1.0)); // Main light direction
              float lightIntensity = max(dot(normal, lightDirection), 0.0);
              
              // Create more dramatic shadows for mountain peaks and valleys
              float shadow = 0.3 + lightIntensity * 0.7; // Stronger contrast
              
              // Add mountain altitude-based shading (peaks are brighter)
              float altitude = vFrequency; // Use frequency as altitude
              shadow += altitude * 0.2; // Peaks get more light
              
              color *= shadow;
              
              // Secondary light from opposite side with altitude effect
              vec3 lightDirection2 = normalize(vec3(-0.5, -1.0, 0.8));
              float lightIntensity2 = max(dot(normal, lightDirection2), 0.0);
              
              // Mountain peaks catch more secondary light
              vec3 secondaryColor = vec3(0.4, 0.6, 0.9) * (1.0 + altitude * 0.5);
              color += lightIntensity2 * 0.3 * secondaryColor;
              
              // Add subtle rim lighting for mountain edges
              float rim = 1.0 - abs(dot(normal, vec3(0.0, 1.0, 0.0)));
              rim = pow(rim, 2.0);
              color += rim * altitude * 0.2 * vec3(1.0, 0.8, 0.6);
              
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