import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cerrarReporte,
  descartarReporte,
  listarHistorialModeracion,
  listarReportesPendientesModeracion,
  verificarReporte,
} from '@/src/services/moderacion';
import type { Severidad } from '@/src/types/database';

export function useReportesPendientesModeracion() {
  return useQuery({
    queryKey: ['moderacion', 'pendientes'],
    queryFn: listarReportesPendientesModeracion,
    refetchInterval: 20_000,
  });
}

export function useHistorialModeracion() {
  return useQuery({
    queryKey: ['moderacion', 'historial'],
    queryFn: listarHistorialModeracion,
  });
}

function useInvalidarModeracion() {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['moderacion'] }),
      queryClient.invalidateQueries({ queryKey: ['reportes', 'publicos'] }),
    ]);
}

export function useVerificarReporte() {
  const invalidar = useInvalidarModeracion();

  return useMutation({
    mutationFn: (input: { reporteId: string; severidadOverride?: Severidad | null; nota?: string }) =>
      verificarReporte(input),
    onSuccess: () => invalidar(),
  });
}

export function useDescartarReporte() {
  const invalidar = useInvalidarModeracion();

  return useMutation({
    mutationFn: ({ reporteId, motivo }: { reporteId: string; motivo: string }) =>
      descartarReporte(reporteId, motivo),
    onSuccess: () => invalidar(),
  });
}

export function useCerrarReporte() {
  const invalidar = useInvalidarModeracion();

  return useMutation({
    mutationFn: (reporteId: string) => cerrarReporte(reporteId),
    onSuccess: () => invalidar(),
  });
}
