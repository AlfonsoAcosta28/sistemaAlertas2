import { useQuery } from '@tanstack/react-query';

import { useSesion } from '@/src/hooks/use-sesion';
import { obtenerPerfilPropio } from '@/src/services/perfil';

export function usePerfil() {
  const { usuario } = useSesion();

  return useQuery({
    queryKey: ['perfil', usuario?.id],
    queryFn: obtenerPerfilPropio,
    enabled: Boolean(usuario),
  });
}

export function useEsModerador() {
  const perfilQuery = usePerfil();
  const rol = perfilQuery.data?.rol;

  return {
    esModerador: rol === 'moderador' || rol === 'autoridad',
    cargando: perfilQuery.isLoading,
  };
}
