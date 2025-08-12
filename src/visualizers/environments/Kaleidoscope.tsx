import { forwardRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { KaleidoscopeEffectImpl } from './KaleidoscopeEffect'

export interface KaleidoscopeProps {
  segments?: number
  rotation?: number
  rotationSpeed?: number
  offset?: [number, number]
  zoom?: number
  internalReflections?: number
  animated?: boolean
}

const KaleidoscopeEffectPrimitive = forwardRef<KaleidoscopeEffectImpl, KaleidoscopeProps>((props, ref) => {
  const effect = useMemo(() => new KaleidoscopeEffectImpl(props), [
    props.segments,
    props.offset,
    props.zoom,
    props.internalReflections,
    props.rotation
  ])
  
  const rotationRef = useRef(props.rotation || 0)
  
  useFrame((_, delta) => {
    if (props.animated && props.rotationSpeed) {
      rotationRef.current += delta * props.rotationSpeed
      effect.uniforms.get('rotation')!.value = rotationRef.current
    }
  })
  
  return <primitive ref={ref} object={effect} />
})

KaleidoscopeEffectPrimitive.displayName = 'KaleidoscopeEffectPrimitive'

export function Kaleidoscope({
  segments = 6,
  rotation = 0,
  rotationSpeed = 0.1,
  offset = [0, 0],
  zoom = 1,
  internalReflections = 2,
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

export default Kaleidoscope