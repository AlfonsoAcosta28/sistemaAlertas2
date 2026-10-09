import { useMemo } from 'react';

import { distanciaMetros } from '@/src/domain/distancia';
import { debeRecibirAlerta } from '@/src/domain/radios';
import { useCategoriaPreferencias, usePreferencias } from '@/src/hooks/use-preferencias';
import { useReportesPublicos } from '@/src/hooks/use-reportes';
import type { UbicacionActual } from '@/src/hooks/use-ubicacion';

/** Reportes públicos filtrados por la regla del documento y ordenados por distancia. */
export function useAlertasCercanas(ubicacion: UbicacionActual | null) {
  const reportesQuery = useReportesPublicos();
  const preferenciasQuery = usePreferencias();
  const categoriaPreferenciasQuery = useCategoriaPreferencias();

  const categoriaActivaPorId = useMemo(
    () => new Map((categoriaPreferenciasQuery.data ?? []).map((c) => [c.categoria_id, c.activa])),
    [categoriaPreferenciasQuery.data],
  );

  const radioPersonalMetros = preferenciasQuery.data?.radio_personal_metros ?? 5000;
  const verNoConfirmados = preferenciasQuery.data?.ver_no_confirmados ?? true;

  const alertasCercanas = useMemo(() => {
    if (!ubicacion) {
      return [];
    }

    return (reportesQuery.data ?? [])
      .map((reporte) => ({
        reporte,
        distancia: distanciaMetros(
          ubicacion.latitud,
          ubicacion.longitud,
          reporte.latitud_aproximada,
          reporte.longitud_aproximada,
        ),
      }))
      .filter(({ reporte, distancia }) =>
        debeRecibirAlerta({
          distanciaMetros: distancia,
          radioPersonalMetros,
          radioAlertaActualMetros: reporte.radio_actual_metros,
          categoriaActiva: categoriaActivaPorId.get(reporte.categoria_id) ?? true,
          verNoConfirmados,
          estado: reporte.estado,
        }),
      )
      .sort((a, b) => a.distancia - b.distancia);
  }, [reportesQuery.data, ubicacion, radioPersonalMetros, verNoConfirmados, categoriaActivaPorId]);

  return { alertasCercanas, radioPersonalMetros, error: reportesQuery.error };
}
