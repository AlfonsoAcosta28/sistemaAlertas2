import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  crearReporte,
  listarEnviosDeMisReportes,
  listarMisReportes,
  listarReportesPublicos,
  reaccionarReporte,
  type CrearReporteInput,
} from '@/src/services/reportes';
import { useSesion } from '@/src/hooks/use-sesion';
import type { TipoReaccion } from '@/src/types/database';

export function useReportesPublicos() {
  return useQuery({
    queryKey: ['reportes', 'publicos'],
    queryFn: listarReportesPublicos,
    refetchInterval: 30_000,
  });
}

export function useMisReportes() {
  // El id del usuario va en la llave para no mezclar datos al cambiar de cuenta.
  const { usuario } = useSesion();
  return useQuery({
    queryKey: ['reportes', 'mios', usuario?.id],
    enabled: Boolean(usuario),
    queryFn: listarMisReportes,
  });
}

export function useEnviosDeMisReportes() {
  const { usuario } = useSesion();
  return useQuery({
    queryKey: ['reportes', 'mios', usuario?.id, 'envios'],
    enabled: Boolean(usuario),
    queryFn: listarEnviosDeMisReportes,
  });
}

export function useCrearReporte() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CrearReporteInput) => crearReporte(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reportes', 'publicos'] }),
        queryClient.invalidateQueries({ queryKey: ['reportes', 'mios'] }),
      ]);
    },
  });
}

export function useReaccionarReporte() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reporteId, tipo }: { reporteId: string; tipo: TipoReaccion }) =>
      reaccionarReporte(reporteId, tipo),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reportes', 'publicos'] });
    },
  });
}
