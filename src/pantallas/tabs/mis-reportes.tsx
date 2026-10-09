import { useMemo } from 'react';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { datosParaMostrar, normalizarCampos } from '@/src/domain/formulario';
import { rutaIconoAlerta } from '@/src/domain/iconos-alerta';
import { obtenerEstiloEstadoReporte } from '@/src/domain/mapa';
import { colorVeracidad } from '@/src/domain/reputacion';
import { useCategorias } from '@/src/hooks/use-categorias';
import { useEnviosDeMisReportes, useMisReportes } from '@/src/hooks/use-reportes';
import { InsigniaEstado } from '@/src/ui/insignia-estado';

export function MisReportesScreen() {
  const misReportesQuery = useMisReportes();
  const enviosQuery = useEnviosDeMisReportes();
  const categoriasQuery = useCategorias();

  const categoriaPorId = useMemo(
    () => new Map((categoriasQuery.data ?? []).map((c) => [c.id, c])),
    [categoriasQuery.data],
  );

  return (
    <div className="pantalla pantalla--10">
      <h2 className="titulo">Mis reportes</h2>
      {misReportesQuery.error ? <MensajeConfiguracion error={misReportesQuery.error} /> : null}
      {misReportesQuery.data?.length ? (
        misReportesQuery.data.map((reporte) => {
          const categoria = categoriaPorId.get(reporte.categoria_id);
          const datos = datosParaMostrar(normalizarCampos(categoria?.campos_formulario), reporte.datos);
          const enviadoA = enviosQuery.data?.get(reporte.id) ?? [];
          return (
            <article key={reporte.id} className="tarjeta tarjeta--compacta">
              <div className="fila fila--8 alinear-centro">
                <img src={rutaIconoAlerta(categoria?.icono)} alt="" className="icono-categoria" />
                <p className="negrita">{categoria?.nombre ?? 'Categoría'}</p>
              </div>
              <div className="fila fila--8 alinear-centro">
                <InsigniaEstado estilo={obtenerEstiloEstadoReporte(reporte.estado, reporte.severidad)} />
                <span className="texto-pequeno negrita" style={{ color: colorVeracidad(reporte.veracidad) }}>
                  {reporte.veracidad}% de veracidad
                </span>
              </div>
              <p className="texto-pequeno texto-tenue">
                {new Date(reporte.created_at).toLocaleString('es-MX')}
              </p>
              {datos.map(({ etiqueta, valor }) => (
                <p key={etiqueta} className="texto-pequeno texto-secundario">
                  {etiqueta}: {valor}
                </p>
              ))}
              {enviadoA.length > 0 ? (
                <p className="texto-pequeno texto-secundario">Enviado a: {enviadoA.join(', ')}</p>
              ) : null}
              {reporte.descartado_motivo ? (
                <p className="texto-pequeno texto-motivo">Motivo: {reporte.descartado_motivo}</p>
              ) : null}
            </article>
          );
        })
      ) : (
        <p className="texto-tenue">Aún no hay reportes para mostrar.</p>
      )}
    </div>
  );
}
