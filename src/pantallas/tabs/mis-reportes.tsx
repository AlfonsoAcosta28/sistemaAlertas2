import { useMemo } from 'react';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { obtenerEstiloEstadoReporte } from '@/src/domain/mapa';
import { useCategorias } from '@/src/hooks/use-categorias';
import { useMisReportes } from '@/src/hooks/use-reportes';
import { InsigniaEstado } from '@/src/ui/insignia-estado';

export function MisReportesScreen() {
  const misReportesQuery = useMisReportes();
  const categoriasQuery = useCategorias();

  const nombrePorCategoria = useMemo(
    () => new Map((categoriasQuery.data ?? []).map((c) => [c.id, c.nombre])),
    [categoriasQuery.data],
  );

  return (
    <div className="pantalla pantalla--10">
      <h2 className="titulo">Mis reportes</h2>
      {misReportesQuery.error ? <MensajeConfiguracion error={misReportesQuery.error} /> : null}
      {misReportesQuery.data?.length ? (
        misReportesQuery.data.map((reporte) => (
          <article key={reporte.id} className="tarjeta tarjeta--compacta">
            <p className="negrita">{nombrePorCategoria.get(reporte.categoria_id) ?? 'Categoría'}</p>
            <InsigniaEstado estilo={obtenerEstiloEstadoReporte(reporte.estado, reporte.severidad)} />
            <p className="texto-pequeno texto-tenue">
              {new Date(reporte.created_at).toLocaleString('es-MX')}
            </p>
            {reporte.descartado_motivo ? (
              <p className="texto-pequeno texto-motivo">Motivo: {reporte.descartado_motivo}</p>
            ) : null}
          </article>
        ))
      ) : (
        <p className="texto-tenue">Aún no hay reportes para mostrar.</p>
      )}
    </div>
  );
}
