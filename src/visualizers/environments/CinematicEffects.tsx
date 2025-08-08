import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing'

export function CinematicEffects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={1.15} luminanceThreshold={0.2} luminanceSmoothing={0.05} mipmapBlur />
      <ChromaticAberration offset={[0.0006, 0.0006]} />
      <Vignette eskil={false} offset={0.15} darkness={0.8} />
    </EffectComposer>
  )
}

export default CinematicEffects


