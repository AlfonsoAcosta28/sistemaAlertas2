import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSesion } from '@/src/hooks/use-sesion';
import {
  actualizarCategoriaPreferencia,
  actualizarPreferencias,
  listarCategoriaPreferencias,
  obtenerPreferenciasPropias,
  type ActualizarPreferenciasInput,
} from '@/src/services/preferencias';

export function usePreferencias() {
  const { usuario } = useSesion();

  return useQuery({
    queryKey: ['preferencias', usuario?.id],
    queryFn: obtenerPreferenciasPropias,
    enabled: Boolean(usuario),
  });
}

export function useCategoriaPreferencias() {
  const { usuario } = useSesion();

  return useQuery({
    queryKey: ['categoria-preferencias', usuario?.id],
    queryFn: listarCategoriaPreferencias,
    enabled: Boolean(usuario),
  });
}

export function useActualizarPreferencias() {
  const { usuario } = useSesion();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cambios: ActualizarPreferenciasInput) => {
      if (!usuario) {
        throw new Error('Debes iniciar sesión.');
      }
      return actualizarPreferencias(usuario.id, cambios);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['preferencias', usuario?.id] });
    },
  });
}

export function useActualizarCategoriaPreferencia() {
  const { usuario } = useSesion();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoriaId, activa }: { categoriaId: string; activa: boolean }) => {
      if (!usuario) {
        throw new Error('Debes iniciar sesión.');
      }
      return actualizarCategoriaPreferencia(usuario.id, categoriaId, activa);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categoria-preferencias', usuario?.id] });
    },
  });
}
