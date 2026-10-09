import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSesion } from '@/src/hooks/use-sesion';
import { borrarZonaGuardada, crearZonaGuardada, listarZonasGuardadas } from '@/src/services/zonas';

export function useZonasGuardadas() {
  const { usuario } = useSesion();

  return useQuery({
    queryKey: ['zonas', usuario?.id],
    queryFn: listarZonasGuardadas,
    enabled: Boolean(usuario),
  });
}

export function useCrearZonaGuardada() {
  const { usuario } = useSesion();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { nombre: string; celdaH3: string; radioMetros: number }) => {
      if (!usuario) {
        throw new Error('Debes iniciar sesión.');
      }
      return crearZonaGuardada({ usuarioId: usuario.id, ...input });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['zonas', usuario?.id] });
    },
  });
}

export function useBorrarZonaGuardada() {
  const { usuario } = useSesion();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => borrarZonaGuardada(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['zonas', usuario?.id] });
    },
  });
}
