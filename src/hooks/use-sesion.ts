import { useEffect } from 'react';

import { obtenerClienteSupabase } from '@/src/lib/supabase';
import { useSesionStore } from '@/src/stores/sesion';

/**
 * Debe montarse una sola vez (en el layout raíz) para sincronizar el store
 * de sesión con los cambios de autenticación de Supabase.
 */
export function useInicializarSesion() {
  const setSesion = useSesionStore((estado) => estado.setSesion);

  useEffect(() => {
    const supabase = obtenerClienteSupabase();

    if (!supabase) {
      setSesion(null);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
    });

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      setSesion(sesion);
    });

    return () => {
      suscripcion.subscription.unsubscribe();
    };
  }, [setSesion]);
}

export function useSesion() {
  const sesion = useSesionStore((estado) => estado.sesion);
  const cargando = useSesionStore((estado) => estado.cargando);

  return { sesion, usuario: sesion?.user ?? null, cargando };
}
