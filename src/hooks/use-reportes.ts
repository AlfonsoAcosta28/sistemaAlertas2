import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  crearReporte,
  listarMisReportes,
  listarReportesPublicos,
  reaccionarReporte,
  type CrearReporteInput,
} from '@/src/services/reportes';
import type { TipoReaccion } from '@/src/types/database';

export function useReportesPublicos() {
  return useQuery({
    queryKey: ['reportes', 'publicos'],
    queryFn: listarReportesPublicos,
    refetchInterval: 30_000,
  });
}

export function useMisReportes() {
  return useQuery({
    queryKey: ['reportes', 'mios'],
    queryFn: listarMisReportes,
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
