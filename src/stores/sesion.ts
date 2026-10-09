import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

type SesionState = {
  sesion: Session | null;
  cargando: boolean;
  setSesion: (sesion: Session | null) => void;
};

export const useSesionStore = create<SesionState>((set) => ({
  sesion: null,
  cargando: true,
  setSesion: (sesion) => set({ sesion, cargando: false }),
}));
