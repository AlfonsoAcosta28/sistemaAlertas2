import { useEffect, useMemo, useState } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { obtenerEstiloEstadoReporte } from '@/src/domain/mapa';
import { useAlertasCercanas } from '@/src/hooks/use-alertas-cercanas';
import { useCategorias } from '@/src/hooks/use-categorias';
import { useReaccionarReporte } from '@/src/hooks/use-reportes';
import { useUbicacion } from '@/src/hooks/use-ubicacion';
import type { Database } from '@/src/types/database';
import { Boton, Cargando } from '@/src/ui/controles';
import { compartirTexto } from '@/src/ui/dialogos';
import { InsigniaEstado } from '@/src/ui/insignia-estado';

type ReportePublico = Database['public']['Views']['reportes_publicos']['Row'];

/** Re-centra el mapa cuando cambia la ubicación del usuario. */
function Recentrar({ centro }: { centro: [number, number] }) {
  const mapa = useMap();
  useEffect(() => {
    mapa.setView(centro, mapa.getZoom());
  }, [mapa, centro]);
  return null;
}

/**
 * Sustituye a react-native-maps (Google Maps) por Leaflet + OpenStreetMap:
 * funciona igual en Android, iOS y web y no requiere clave de API.
 */
export function MapaScreen() {
  const ubicacion = useUbicacion();
  const categoriasQuery = useCategorias();
  const reaccionar = useReaccionarReporte();
  const [seleccionado, setSeleccionado] = useState<ReportePublico | null>(null);

  const { alertasCercanas, radioPersonalMetros, error } = useAlertasCercanas(ubicacion.ubicacion);

  const nombrePorCategoria = useMemo(
    () => new Map((categoriasQuery.data ?? []).map((c) => [c.id, c.nombre])),
    [categoriasQuery.data],
  );

  const centro = useMemo<[number, number] | null>(
    () => (ubicacion.ubicacion ? [ubicacion.ubicacion.latitud, ubicacion.ubicacion.longitud] : null),
    [ubicacion.ubicacion],
  );

  async function compartir(reporte: ReportePublico) {
    const nombreCategoria = nombrePorCategoria.get(reporte.categoria_id) ?? 'Incidente';
    await compartirTexto(
      `ALERTA CERCA: ${nombreCategoria} cerca de ${reporte.latitud_aproximada.toFixed(3)}, ${reporte.longitud_aproximada.toFixed(3)}.`,
    );
  }

  return (
    <div className="pantalla-mapa">
      {centro ? (
        <MapContainer center={centro} zoom={13} className="mapa" attributionControl>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recentrar centro={centro} />
          <Circle
            center={centro}
            radius={radioPersonalMetros}
            pathOptions={{ color: '#1D4ED8', weight: 1, fillColor: '#1D4ED8', fillOpacity: 0.08 }}
          />
          <CircleMarker
            center={centro}
            radius={7}
            pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: '#1D4ED8', fillOpacity: 1 }}
          />
          {alertasCercanas.map(({ reporte }) => {
            const estilo = obtenerEstiloEstadoReporte(reporte.estado, reporte.severidad);
            return (
              <CircleMarker
                key={reporte.id}
                center={[reporte.latitud_aproximada, reporte.longitud_aproximada]}
                radius={11}
                pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: estilo.colorBorde, fillOpacity: 0.95 }}
                eventHandlers={{ click: () => setSeleccionado(reporte) }}>
                <Tooltip direction="top" offset={[0, -10]}>
                  {nombrePorCategoria.get(reporte.categoria_id) ?? 'Incidente'} · {estilo.etiqueta}
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      ) : (
        <div className="mapa-respaldo">
          {ubicacion.cargando ? <Cargando /> : null}
          <p className="negrita">
            {ubicacion.error ? 'No pudimos obtener tu ubicación' : 'Obteniendo tu ubicación…'}
          </p>
          {ubicacion.error ? (
            <>
              <p>{ubicacion.error}</p>
              <Boton variante="enlace" onClick={() => void ubicacion.refrescar()}>
                Reintentar
              </Boton>
            </>
          ) : null}
        </div>
      )}

      {error ? <MensajeConfiguracion error={error} /> : null}

      {seleccionado ? (
        <section className="tarjeta panel-detalle">
          <p className="titulo-detalle">
            {nombrePorCategoria.get(seleccionado.categoria_id) ?? 'Incidente'}
          </p>
          <p className="texto-secundario">
            {obtenerEstiloEstadoReporte(seleccionado.estado, seleccionado.severidad).etiqueta} ·{' '}
            {new Date(seleccionado.created_at).toLocaleString('es-MX')}
          </p>
          {seleccionado.descripcion ? (
            <p className="texto-secundario">{seleccionado.descripcion}</p>
          ) : null}
          <div className="fila fila--8">
            <Boton
              variante="paso"
              onClick={() => reaccionar.mutate({ reporteId: seleccionado.id, tipo: 'confirma' })}>
              Yo también lo veo
            </Boton>
            <Boton
              variante="paso"
              onClick={() => reaccionar.mutate({ reporteId: seleccionado.id, tipo: 'desmiente' })}>
              Esto no es cierto
            </Boton>
          </div>
          {reaccionar.error ? (
            <p className="texto-error">{(reaccionar.error as Error).message}</p>
          ) : null}
          <Boton variante="enlace" className="texto-secundario" onClick={() => void compartir(seleccionado)}>
            Compartir
          </Boton>
          <Boton variante="enlace" className="texto-tenue" onClick={() => setSeleccionado(null)}>
            Cerrar
          </Boton>
        </section>
      ) : (
        <section className="tarjeta panel-reportes">
          <p className="etiqueta">Alertas dentro de tu radio ({alertasCercanas.length})</p>
          <div className="panel-reportes__lista">
            {alertasCercanas.length > 0 ? (
              alertasCercanas.map(({ reporte, distancia }) => (
                <button
                  type="button"
                  key={reporte.id}
                  className="fila-reporte"
                  onClick={() => setSeleccionado(reporte)}>
                  <span className="negrita">
                    {nombrePorCategoria.get(reporte.categoria_id) ?? 'Incidente'}
                  </span>
                  <InsigniaEstado estilo={obtenerEstiloEstadoReporte(reporte.estado, reporte.severidad)} />
                  <span className="texto-pequeno texto-secundario">
                    {(distancia / 1000).toFixed(1)} km de ti
                  </span>
                </button>
              ))
            ) : (
              <p className="texto-tenue">No hay alertas dentro de tu radio por ahora.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
