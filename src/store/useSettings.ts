import { create } from 'zustand'

interface SettingsState {
  selectedId: string
  colorA: string
  colorB: string
  particleCount: number
  animationSpeed: number
  wireframe: boolean
  setSelectedId: (id: string) => void
  update: (partial: Partial<Omit<SettingsState, 'setSelectedId' | 'update'>>) => void
}

export const useSettings = create<SettingsState>((set) => ({
  selectedId: 'bars-3d',
  colorA: '#7c3aed',
  colorB: '#22d3ee',
  particleCount: 1500,
  animationSpeed: 1,
  wireframe: false,
  setSelectedId: (id) => set({ selectedId: id }),
  update: (partial) => set((state) => ({ ...state, ...partial })),
}))


