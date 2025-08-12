# PRP: Kaleidoscope Effect Implementation

## Overview
Implement a reusable Kaleidoscope post-processing effect for the AudioViz5 project that can be dropped into any preset using `<Kaleidoscope />` JSX syntax, similar to the existing `CinematicEffects` component.

## Context & Requirements

### User Requirements
- Create a Kaleidoscope environment effect similar to CinematicEffects
- Must be portable and reusable across presets
- Simple JSX usage: `<Kaleidoscope />`
- Configurable parameters via props:
  - Number of mirrors/segments
  - Internal reflections
  - Rotation speed
  - Other kaleidoscope parameters
- Pixel-perfect mirroring of scene slices

### Technical Context

#### Project Stack
- **React**: 19.1.1
- **Three.js**: 0.179.1
- **@react-three/fiber**: 9.3.0
- **@react-three/postprocessing**: 3.0.4
- **postprocessing**: 6.37.7
- **TypeScript**: 5.8.3

#### Existing Patterns

##### CinematicEffects Implementation (Reference)
Location: `src/visualizers/environments/CinematicEffects.tsx`
```typescript
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'

export function CinematicEffects({ bloomIntensity = 1.15 }: { bloomIntensity?: number }) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={bloomIntensity} luminanceThreshold={0.2} luminanceSmoothing={0.05} mipmapBlur />
      <Vignette eskil={false} offset={0.15} darkness={0.8} />
    </EffectComposer>
  )
}
```

##### Custom Shader Pattern (Reference)
The project uses inline GLSL shaders with ShaderMaterial (see `SharpSphere.tsx`).

## Implementation Blueprint

### 1. Kaleidoscope Effect Class

Create a custom Effect class extending `postprocessing.Effect`:

```typescript
// src/visualizers/environments/KaleidoscopeEffect.ts
import { Effect, BlendFunction } from 'postprocessing'
import { Uniform } from 'three'

const fragmentShader = `
  uniform float segments;      // Number of kaleidoscope segments
  uniform float rotation;      // Rotation angle
  uniform vec2 offset;         // Center offset
  uniform float zoom;          // Zoom level
  uniform float internalReflections; // Number of internal reflections
  
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Center and offset coordinates
    vec2 p = (uv - 0.5 - offset) * zoom;
    
    // Convert to polar coordinates
    float r = length(p);
    float a = atan(p.y, p.x) + rotation;
    
    // Create kaleidoscope segments
    float tau = 2.0 * 3.14159265359;
    float segmentAngle = tau / segments;
    
    // Apply modulo for segment repetition
    a = mod(a, segmentAngle);
    
    // Mirror effect for perfect reflection
    if (a > segmentAngle * 0.5) {
      a = segmentAngle - a;
    }
    
    // Apply internal reflections
    for (float i = 0.0; i < internalReflections; i++) {
      if (mod(i, 2.0) == 0.0) {
        a = abs(a);
      } else {
        a = segmentAngle - abs(a);
      }
    }
    
    // Convert back to Cartesian coordinates
    vec2 kaleidoscopeUV = vec2(cos(a), sin(a)) * r + 0.5 + offset;
    
    // Ensure UV is within bounds
    kaleidoscopeUV = clamp(kaleidoscopeUV, 0.0, 1.0);
    
    // Sample the input texture
    outputColor = texture2D(inputBuffer, kaleidoscopeUV);
  }
`

export class KaleidoscopeEffectImpl extends Effect {
  constructor({
    segments = 6,
    rotation = 0,
    offset = [0, 0],
    zoom = 1,
    internalReflections = 0,
    blendFunction = BlendFunction.NORMAL
  } = {}) {
    super('KaleidoscopeEffect', fragmentShader, {
      blendFunction,
      uniforms: new Map([
        ['segments', new Uniform(segments)],
        ['rotation', new Uniform(rotation)],
        ['offset', new Uniform(new Vector2(...offset))],
        ['zoom', new Uniform(zoom)],
        ['internalReflections', new Uniform(internalReflections)]
      ])
    })
  }

  update(renderer, inputBuffer, deltaTime) {
    // Uniforms can be updated here if needed for animation
  }
}
```

### 2. React Component Wrapper

Create the React component:

```typescript
// src/visualizers/environments/Kaleidoscope.tsx
import { forwardRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { KaleidoscopeEffectImpl } from './KaleidoscopeEffect'

interface KaleidoscopeProps {
  segments?: number
  rotation?: number
  rotationSpeed?: number
  offset?: [number, number]
  zoom?: number
  internalReflections?: number
  animated?: boolean
}

// Primitive component for the effect
const KaleidoscopeEffectPrimitive = forwardRef<any, KaleidoscopeProps>((props, ref) => {
  const effect = useMemo(() => new KaleidoscopeEffectImpl(props), [
    props.segments,
    props.offset,
    props.zoom,
    props.internalReflections
  ])
  
  const rotationRef = useRef(props.rotation || 0)
  
  useFrame((state, delta) => {
    if (props.animated && props.rotationSpeed) {
      rotationRef.current += delta * props.rotationSpeed
      effect.uniforms.get('rotation').value = rotationRef.current
    }
  })
  
  return <primitive ref={ref} object={effect} />
})

// Main component
export function Kaleidoscope({
  segments = 6,
  rotation = 0,
  rotationSpeed = 0.1,
  offset = [0, 0],
  zoom = 1,
  internalReflections = 0,
  animated = true
}: KaleidoscopeProps) {
  return (
    <EffectComposer multisampling={4}>
      <KaleidoscopeEffectPrimitive
        segments={segments}
        rotation={rotation}
        rotationSpeed={rotationSpeed}
        offset={offset}
        zoom={zoom}
        internalReflections={internalReflections}
        animated={animated}
      />
    </EffectComposer>
  )
}

// Export as default for consistency with CinematicEffects
export default Kaleidoscope
```

### 3. Integration & Usage

Update exports:
```typescript
// src/visualizers/environments/index.ts
export { default as CinematicEffects } from './CinematicEffects'
export { default as Kaleidoscope } from './Kaleidoscope'
```

Usage in presets:
```typescript
// In any preset file
import Kaleidoscope from '../environments/Kaleidoscope'

export const MyPreset: VisualizerComponent = ({ analyserData, settings }) => {
  return (
    <>
      {/* Scene content */}
      <mesh>...</mesh>
      
      {/* Add Kaleidoscope effect */}
      <Kaleidoscope 
        segments={8}
        rotationSpeed={0.2}
        internalReflections={1}
      />
    </>
  )
}
```

## Implementation Tasks

1. **Create KaleidoscopeEffect.ts**
   - Implement the Effect class with GLSL shader
   - Handle all uniform parameters
   - Ensure proper coordinate transformations

2. **Create Kaleidoscope.tsx**
   - Implement React component wrapper
   - Add animation support via useFrame
   - Ensure proper prop handling and defaults

3. **Test Integration**
   - Add to existing presets for testing
   - Verify pixel-perfect mirroring
   - Test all parameters

4. **Add TypeScript Types**
   - Export KaleidoscopeProps interface
   - Ensure type safety

5. **Performance Optimization**
   - Test with multisampling settings
   - Optimize shader calculations
   - Profile with Chrome DevTools

## Validation Gates

```bash
# TypeScript compilation
npx tsc --noEmit

# Linting
npx eslint . --fix

# Development testing
npm run dev
# Test in browser with different presets
```

## Key Implementation Details

### Mathematical Approach
1. **Polar Coordinate Conversion**: Convert UV coordinates to polar (r, θ) for rotation
2. **Segment Division**: Divide 2π by number of segments
3. **Modulo Operation**: Use mod() to repeat segments
4. **Mirroring**: Flip coordinates for perfect reflection
5. **Internal Reflections**: Apply multiple reflection passes

### Performance Considerations
- Use single-pass shader for efficiency
- Minimize texture sampling
- Cache uniform values when static
- Use multisampling=4 for quality/performance balance

### Error Handling
- Clamp UV coordinates to prevent edge artifacts
- Validate segment count (min: 2, max: reasonable limit)
- Handle division by zero in polar conversion
- Graceful fallback for invalid parameters

## External Resources

- **Postprocessing Documentation**: https://github.com/pmndrs/postprocessing/wiki/Custom-Passes
- **React-Postprocessing**: https://react-postprocessing.docs.pmnd.rs/effects/custom-effects
- **GLSL Reference**: https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language
- **Three.js Uniforms**: https://threejs.org/docs/#api/en/core/Uniform

## Common Pitfalls to Avoid

1. **UV Coordinate Edge Cases**: Always clamp final UV coordinates
2. **Rotation Units**: Use radians, not degrees
3. **Effect Order**: Kaleidoscope should typically come before bloom/glow effects
4. **Memory Leaks**: Properly dispose of effects when unmounting
5. **Shader Compilation**: Test on different GPUs/browsers

## Success Criteria

- [ ] Component can be dropped into any preset with `<Kaleidoscope />`
- [ ] All parameters are configurable via props
- [ ] Pixel-perfect mirroring with no artifacts
- [ ] Smooth animation when enabled
- [ ] TypeScript fully typed
- [ ] Performance impact < 5ms per frame
- [ ] Works with existing CinematicEffects

## Confidence Score: 8/10

High confidence due to:
- Clear existing patterns in codebase
- Well-documented postprocessing library
- Simple mathematical transformations
- Similar components already working

Moderate complexity in:
- GLSL shader debugging
- Ensuring pixel-perfect mirroring
- Performance optimization