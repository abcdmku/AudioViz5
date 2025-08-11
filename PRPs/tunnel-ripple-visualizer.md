# PRP: Tunnel Ripple Visualizer

## Feature Overview
Create a new audio visualizer preset that simulates looking down a tunnel where beat detection creates ripples at the far end that travel towards the viewer. The tunnel's radial segments represent frequency spectrum, ripple height represents intensity, and each detected beat shifts the hue from that point onwards.

## Requirements from NEW_VIZ.md
- User looks down a tunnel perspective
- Beat detection (70-180 BPM) triggers ripples at the tunnel's end
- Ripples travel towards the user/camera
- Radial segments around tunnel represent frequency spectrum
- Ripple height represents audio intensity
- Each beat shifts the hue from that ripple point forward
- All visual parameters must be adjustable via configurable variables

## Codebase Context

### File Structure Pattern
All visualizer presets follow this structure:
- Located in `src/visualizers/presets/`
- Exported from `src/visualizers/index.ts`
- Implement `VisualizerComponent` interface
- Include metadata object with id, name, description

### Required Imports and Types
```typescript
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VisualizerComponent, VisualizerMeta } from '../../types/visualizer'
import { Environment, OrbitControls } from '@react-three/drei'
import CinematicEffects from '../environments/CinematicEffects'
```

### Audio Data Structure (from AudioAnalyserProvider)
```typescript
analyserData: {
  frequency: Uint8Array,      // 1024 frequency bins
  waveform: Uint8Array,       // 1024 waveform samples
  rms: number,                // Root mean square (volume)
  beat: {
    isOnset: boolean,         // Beat detected
    confidence: number        // 0-1 confidence level
  }
}
```

### Beat Detection Implementation
Current implementation uses:
- Simple onset detection: `avg > 140 && currentRms > 0.08`
- RMS spike detection: `rms > prevRms * 1.22 && rms > 0.04`
- Confidence calculation: `Math.min(1, Math.max(0, (avg - 100) / 155))`

### Existing Tunnel Reference (WaveTunnel.tsx)
The existing WaveTunnel uses:
- CylinderGeometry with `args={[6, 6, 40, 96, 128, true]}`
- BackSide rendering for inside view
- AdditiveBlending for glow effects
- DataTexture for waveform data
- Uniforms for time, colors, energy, ripple effects

### Parameterization Pattern (from WaveKnotFatParam.tsx)
Best practice for adjustable parameters:
```typescript
// Configurable parameters at component top
const TUNNEL_LENGTH = 50
const TUNNEL_RADIUS = 8
const RADIAL_SEGMENTS = 64  // Frequency bins
const LENGTH_SEGMENTS = 128  // Ripple resolution
```

## Implementation Blueprint

### 1. Geometry Setup
```typescript
// Tunnel as open-ended cylinder viewed from inside
<cylinderGeometry args={[
  TUNNEL_RADIUS,                    // radiusTop
  TUNNEL_RADIUS,                    // radiusBottom  
  TUNNEL_LENGTH,                    // height
  RADIAL_SEGMENTS,                  // radialSegments (frequency)
  LENGTH_SEGMENTS,                  // heightSegments (ripple detail)
  true                              // openEnded
]} />
```

### 2. Ripple System Architecture
```typescript
// Ripple data structure
interface Ripple {
  position: number    // 0-1 along tunnel length
  amplitude: number   // Current amplitude
  hue: number        // HSL hue value
  timestamp: number   // Creation time
}

// Manage ripple array (max 32 concurrent ripples)
const MAX_RIPPLES = 32
const ripples = useRef<Ripple[]>([])

// Pass to shader as uniform arrays
uniforms: {
  uRipplePositions: { value: new Float32Array(MAX_RIPPLES) },
  uRippleAmplitudes: { value: new Float32Array(MAX_RIPPLES) },
  uRippleHues: { value: new Float32Array(MAX_RIPPLES) },
  uRippleCount: { value: 0 }
}
```

### 3. Frequency Mapping
```typescript
// Map frequency bins to radial segments
// Each radial segment represents a frequency range
const getFrequencyForSegment = (segmentIndex: number) => {
  const binSize = analyserData.frequency.length / RADIAL_SEGMENTS
  const startBin = Math.floor(segmentIndex * binSize)
  const endBin = Math.floor((segmentIndex + 1) * binSize)
  
  // Average frequency amplitude for this segment
  let sum = 0
  for (let i = startBin; i < endBin; i++) {
    sum += analyserData.frequency[i]
  }
  return sum / (endBin - startBin) / 255 // Normalize to 0-1
}
```

### 4. Beat Detection with BPM Filtering
```typescript
// BPM tracking for 70-180 range
const beatHistory = useRef<number[]>([])
const MIN_BPM = 70
const MAX_BPM = 180

const detectBeat = (currentTime: number) => {
  // Use existing beat detection
  if (!analyserData.beat.isOnset) return false
  
  // Calculate time since last beat
  const lastBeat = beatHistory.current[beatHistory.current.length - 1] || 0
  const timeDiff = currentTime - lastBeat
  const bpm = 60000 / timeDiff // Convert ms to BPM
  
  // Filter by BPM range
  if (bpm >= MIN_BPM && bpm <= MAX_BPM) {
    beatHistory.current.push(currentTime)
    if (beatHistory.current.length > 10) {
      beatHistory.current.shift() // Keep last 10 beats
    }
    return true
  }
  return false
}
```

### 5. Shader Implementation
```glsl
// Vertex Shader
varying vec2 vUv;
varying float vFrequency;
uniform float uTime;
uniform sampler2D uFrequencyTexture;
uniform float uRipplePositions[32];
uniform float uRippleAmplitudes[32];
uniform int uRippleCount;

void main() {
  vUv = uv;
  
  // Get frequency for this radial segment
  float freqU = floor(uv.x * 64.0) / 64.0;
  vFrequency = texture2D(uFrequencyTexture, vec2(freqU, 0.5)).r;
  
  vec3 pos = position;
  
  // Apply ripples
  float rippleSum = 0.0;
  for (int i = 0; i < 32; i++) {
    if (i >= uRippleCount) break;
    
    float ripplePos = uRipplePositions[i];
    float rippleAmp = uRippleAmplitudes[i];
    
    // Calculate distance from ripple center
    float dist = abs(uv.y - ripplePos);
    
    // Gaussian wave shape
    float wave = exp(-dist * dist * 100.0) * rippleAmp;
    
    // Scale by frequency at this radial position
    wave *= (1.0 + vFrequency * 2.0);
    
    rippleSum += wave;
  }
  
  // Displace vertices radially
  vec3 normal = normalize(vec3(pos.x, 0.0, pos.z));
  pos += normal * rippleSum * 2.0;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}

// Fragment Shader
varying vec2 vUv;
varying float vFrequency;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uRippleHues[32];
uniform float uRipplePositions[32];
uniform int uRippleCount;

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
  // Find most recent ripple affecting this position
  float currentHue = 0.0;
  for (int i = 0; i < 32; i++) {
    if (i >= uRippleCount) break;
    if (uRipplePositions[i] <= vUv.y) {
      currentHue = uRippleHues[i];
    }
  }
  
  // Convert hue to color
  vec3 color = hsl2rgb(vec3(currentHue, 0.8, 0.5));
  
  // Add frequency-based glow
  color += vFrequency * 0.3;
  
  // Depth fog
  float depth = 1.0 - vUv.y;
  color *= depth;
  
  gl_FragColor = vec4(color, 0.95);
}
```

### 6. Configurable Parameters
```typescript
// User-adjustable parameters
const TUNNEL_LENGTH = 50          // Tunnel depth
const TUNNEL_RADIUS = 8           // Tunnel width
const RADIAL_SEGMENTS = 64        // Frequency resolution
const LENGTH_SEGMENTS = 128       // Ripple smoothness
const RIPPLE_SPEED = 0.5          // Speed ripples travel (0-1)
const RIPPLE_DECAY = 0.95         // Ripple fade rate per frame
const RIPPLE_WIDTH = 0.05         // Ripple gaussian width
const RIPPLE_AMPLITUDE = 2.0      // Max ripple displacement
const HUE_SHIFT_SPEED = 0.1       // Hue change per beat
const FREQUENCY_SCALE = 2.0       // Frequency effect multiplier
const MIN_BPM = 70                // Minimum BPM to detect
const MAX_BPM = 180               // Maximum BPM to detect
const BEAT_THRESHOLD = 0.08       // RMS threshold for beat
const CAMERA_POSITION = [0, 0, 20] // Camera z position
const FOG_DENSITY = 0.02          // Depth fog amount
const GLOW_INTENSITY = 0.3        // Frequency glow strength
```

## Implementation Tasks

### Task 1: Create Component File
Create `src/visualizers/presets/TunnelRipple.tsx` with basic structure:
- Import dependencies
- Define metadata object
- Create component with proper types
- Add to exports in `src/visualizers/index.ts`

### Task 2: Setup Geometry and Camera
- Create cylinder geometry with configurable parameters
- Position camera at tunnel entrance looking down
- Configure OrbitControls for user interaction
- Add environment lighting

### Task 3: Implement Ripple System
- Create ripple data structure and state management
- Implement beat detection with BPM filtering
- Add ripple creation on beat detection
- Update ripple positions and amplitudes each frame

### Task 4: Create Frequency Texture
- Convert frequency array to DataTexture
- Update texture each frame with current frequency data
- Map radial segments to frequency bins

### Task 5: Write Shaders
- Vertex shader with ripple displacement
- Fragment shader with hue shifting
- Add uniforms for all parameters

### Task 6: Add Parameter Controls
- Create UI controls for all configurable parameters
- Store in component state or refs
- Update uniforms when parameters change

### Task 7: Optimize Performance
- Use useMemo for static resources
- Implement ripple pooling to avoid allocation
- Optimize shader calculations

## File References

### Files to Study:
- `src/visualizers/presets/WaveTunnel.tsx` - Existing tunnel implementation
- `src/visualizers/presets/WaveKnotFatParam.tsx` - Parameter pattern
- `src/providers/AudioAnalyserProvider.tsx` - Audio data structure
- `src/types/visualizer.ts` - Required interfaces

### Files to Modify:
- `src/visualizers/index.ts` - Add new preset export

### Files to Create:
- `src/visualizers/presets/TunnelRipple.tsx` - Main implementation

## External Resources
- Three.js CylinderGeometry: https://threejs.org/docs/#api/en/geometries/CylinderGeometry
- GLSL shader reference: https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language
- Web Audio API beat detection: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- HSL to RGB conversion: https://www.rapidtables.com/convert/color/hsl-to-rgb.html

## Validation Gates

### TypeScript Compilation
```bash
npx tsc --noEmit
```

### ESLint
```bash
npx eslint src/visualizers/presets/TunnelRipple.tsx --fix
```

### Runtime Testing
1. Load an audio file
2. Verify ripples appear on beat
3. Check hue shifts are visible
4. Confirm frequency mapping works
5. Test all parameter adjustments

## Success Criteria
- [ ] Tunnel renders with proper perspective
- [ ] Ripples generate on beat detection (70-180 BPM)
- [ ] Ripples travel from far end to near
- [ ] Frequency spectrum maps to radial segments
- [ ] Hue shifts persist from ripple point
- [ ] All parameters are adjustable
- [ ] Performance maintains 60 FPS
- [ ] TypeScript compilation passes
- [ ] ESLint checks pass

## Common Pitfalls to Avoid
1. **Memory Leaks**: Clean up uniforms and textures in useEffect cleanup
2. **Shader Array Limits**: GLSL has fixed array sizes, use MAX_RIPPLES constant
3. **Coordinate System**: Three.js uses Y-up, tunnel extends along Y axis
4. **Beat Detection**: Current implementation may need tuning for BPM range
5. **Performance**: Too many ripples or segments will impact FPS

## Implementation Order
1. Create basic component with cylinder geometry
2. Add beat detection and ripple creation
3. Implement basic displacement shader
4. Add frequency mapping
5. Implement hue shifting
6. Add configurable parameters
7. Optimize and polish

## Confidence Score: 8/10

This PRP provides comprehensive context for implementing the tunnel ripple visualizer. The implementation closely follows existing patterns in the codebase while adding the specific features requested. The main complexity lies in the shader implementation and ripple management system, but all necessary patterns and examples are provided.