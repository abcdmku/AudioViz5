import { Effect, BlendFunction } from 'postprocessing'
import { Uniform, Vector2 } from 'three'

const fragmentShader = `
  uniform float segments;
  uniform float rotation;
  uniform vec2 offset;
  uniform float zoom;
  uniform float internalReflections;
  uniform vec2 resolution;
  
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Calculate aspect ratio for correction
    float aspectRatio = resolution.x / resolution.y;
    
    // Apply aspect ratio correction to maintain circles
    vec2 correctedUV = uv - 0.5;
    correctedUV.x *= aspectRatio;
    
    // Apply zoom and offset
    vec2 p = correctedUV * zoom - offset;
    
    // Convert to polar coordinates
    float r = length(p);
    float a = atan(p.y, p.x) + rotation;
    
    // Create kaleidoscope segments
    float tau = 2.0 * 3.14159265359;
    float segmentAngle = tau / segments;
    
    // Find which segment we're in
    a = mod(a, segmentAngle);
    
    // Simple mirroring at segment midpoint
    if (a > segmentAngle * 0.5) {
      a = segmentAngle - a;
    }
    
    // Apply internal reflections as simple folds
    float foldAngle = segmentAngle * 0.5 / max(1.0, internalReflections);
    for (float i = 0.0; i < internalReflections; i++) {
      a = abs(a);
      if (a > foldAngle) {
        a = 2.0 * foldAngle - a;
      }
    }
    
    // Use logarithmic scaling for radius to prevent outer streaking
    // This maintains detail at all distances from center
    float logR = log(1.0 + r * 2.0) * 0.5;
    
    // Convert back to Cartesian with corrected radius
    vec2 kaleidoscopeUV = vec2(
      cos(a) * logR,
      sin(a) * logR
    );
    
    // Correct for aspect ratio when sampling
    kaleidoscopeUV.x /= aspectRatio;
    
    // Add back center offset
    kaleidoscopeUV = kaleidoscopeUV + 0.5 + offset;
    
    // Ensure UV is within bounds
    kaleidoscopeUV = clamp(kaleidoscopeUV, 0.0, 1.0);
    
    // Sample the input texture
    outputColor = texture2D(inputBuffer, kaleidoscopeUV);
  }
`

interface KaleidoscopeEffectOptions {
  segments?: number
  rotation?: number
  offset?: [number, number]
  zoom?: number
  internalReflections?: number
  blendFunction?: BlendFunction
}

export class KaleidoscopeEffectImpl extends Effect {
  constructor({
    segments = 6,
    rotation = 0,
    offset = [0, 0],
    zoom = 1,
    internalReflections = 0,
    blendFunction = BlendFunction.NORMAL
  }: KaleidoscopeEffectOptions = {}) {
    super('KaleidoscopeEffect', fragmentShader, {
      blendFunction,
      uniforms: new Map<string, Uniform>([
        ['segments', new Uniform(segments)],
        ['rotation', new Uniform(rotation)],
        ['offset', new Uniform(new Vector2(...offset))],
        ['zoom', new Uniform(zoom)],
        ['internalReflections', new Uniform(internalReflections)],
        ['resolution', new Uniform(new Vector2(1, 1))]
      ])
    })
  }

  update(renderer: any, inputBuffer: any) {
    // Update resolution uniform to match current render size
    const uniforms = this.uniforms as Map<string, Uniform>
    const resolution = uniforms.get('resolution')
    if (resolution && inputBuffer) {
      resolution.value.set(inputBuffer.width, inputBuffer.height)
    }
  }
}