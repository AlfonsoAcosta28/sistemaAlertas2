import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';

import { MapaGoogle, type PuntoMapa } from '@/src/components/mapa-google';
import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { datosParaMostrar, normalizarCampos } from '@/src/domain/formulario';
import { normalizarIcono, rutaIconoAlerta } from '@/src/domain/iconos-alerta';
import { obtenerEstiloEstadoReporte, tieneClaveGoogleMapsConfigurada } from '@/src/domain/mapa';
import { colorVeracidad } from '@/src/domain/reputacion';
import { useAlertasCercanas } from '@/src/hooks/use-alertas-cercanas';
import { useCategorias } from '@/src/hooks/use-categorias';
import { useMisReportes, useReaccionarReporte } from '@/src/hooks/use-reportes';
import { useUbicacion } from '@/src/hooks/use-ubicacion';
import { obtenerUrlFirmadaFoto } from '@/src/services/moderacion';
import type { Database } from '@/src/types/database';
import { Boton, Cargando } from '@/src/ui/controles';
import { compartirTexto } from '@/src/ui/dialogos';
import { InsigniaEstado } from '@/src/ui/insignia-estado';
import { esNativo } from '@/src/utils/entorno';

type ReportePublico = Database['public']['Views']['reportes_publicos']['Row'];

// Una clave de Google solo admite un tipo de restricción: la de la app Android
// (VITE_GOOGLE_MAPS_API_KEY) no sirve en el navegador. En web se usa
// VITE_GOOGLE_MAPS_WEB_API_KEY si existe; si no, Leaflet + OpenStreetMap.
const claveGoogleMaps =
  (esNativo
    ? import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    : import.meta.env.VITE_GOOGLE_MAPS_WEB_API_KEY
  )?.trim() ?? '';
const usarGoogleMaps = tieneClaveGoogleMapsConfigurada(claveGoogleMaps);

// Íconos de Leaflet (uno por tipo de alerta, se crean una sola vez).
const iconosLeaflet = new Map<string, L.Icon>();
function iconoLeaflet(icono: string | null): L.Icon {
  const clave = normalizarIcono(icono);
  let existente = iconosLeaflet.get(clave);
  if (!existente) {
    existente = L.icon({ iconUrl: rutaIconoAlerta(clave), iconSize: [36, 36], iconAnchor: [18, 18] });
    iconosLeaflet.set(clave, existente);
  }
  return existente;
}

/** Re-centra el mapa cuando cambia la ubicación del usuario. */
function Recentrar({ centro }: { centro: [number, number] }) {
  const mapa = useMap();
  useEffect(() => {
    mapa.setView(centro, mapa.getZoom());
  }, [mapa, centro]);
  return null;
}

function BarraVeracidad({ veracidad }: { veracidad: number }) {
  const color = colorVeracidad(veracidad);
  return (
    <div className="veracidad" aria-label={`Veracidad ${veracidad}%`}>
      <div className="fila fila--entre">
        <span className="texto-pequeno texto-secundario">Veracidad</span>
        <span className="texto-pequeno negrita" style={{ color }}>
          {veracidad}%
        </span>
      </div>
      <div className="veracidad__pista">
        <div className="veracidad__barra" style={{ width: `${veracidad}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/** Foto pública (solo existe para persona desaparecida ya validada). */
function FotoPublica({ ruta }: { ruta: string }) {
  const urlQuery = useQuery({
    queryKey: ['foto-firmada', ruta],
    queryFn: () => obtenerUrlFirmadaFoto(ruta),
  });
  if (urlQuery.isLoading) return <Cargando />;
  return urlQuery.data ? <img src={urlQuery.data} alt="Foto del reporte" className="foto-moderacion" /> : null;
}

/**
 * Mapa de alertas con un ícono por tipo (llamita para incendio, gota para
 * inundación, etc.). Con VITE_GOOGLE_MAPS_API_KEY usa Google Maps; sin clave,
 * Leaflet + OpenStreetMap.
 */
export function MapaScreen() {
  const ubicacion = useUbicacion();
  const categoriasQuery = useCategorias();
  const reaccionar = useReaccionarReporte();
  const [seleccionado, setSeleccionado] = useState<ReportePublico | null>(null);
  const misReportesQuery = useMisReportes();
  const misReportes = useMemo(
    () => new Set((misReportesQuery.data ?? []).map((r) => r.id)),
    [misReportesQuery.data],
  );
  const [parametros, setParametros] = useSearchParams();
  const reporteSolicitado = parametros.get('reporte');

  const { alertasCercanas, radioPersonalMetros, error } = useAlertasCercanas(ubicacion.ubicacion);

  const categoriaPorId = useMemo(
    () => new Map((categoriasQuery.data ?? []).map((c) => [c.id, c])),
    [categoriasQuery.data],
  );
  const nombreCategoria = (reporte: ReportePublico) =>
    categoriaPorId.get(reporte.categoria_id)?.nombre ?? reporte.categoria_nombre ?? 'Incidente';
  const iconoCategoria = (reporte: ReportePublico) =>
    categoriaPorId.get(reporte.categoria_id)?.icono ?? reporte.categoria_icono;

  const centro = useMemo<[number, number] | null>(
    () => (ubicacion.ubicacion ? [ubicacion.ubicacion.latitud, ubicacion.ubicacion.longitud] : null),
    [ubicacion.ubicacion],
  );

  const puntosGoogle = useMemo<PuntoMapa[]>(
    () =>
      alertasCercanas.map(({ reporte }) => {
        const estilo = obtenerEstiloEstadoReporte(reporte.estado, reporte.severidad);
        const categoria = categoriaPorId.get(reporte.categoria_id);
        return {
          id: reporte.id,
          latitud: reporte.latitud_aproximada,
          longitud: reporte.longitud_aproximada,
          color: categoria?.color ?? estilo.colorBorde,
          icono: categoria?.icono ?? reporte.categoria_icono,
          titulo: categoria?.nombre ?? reporte.categoria_nombre ?? 'Incidente',
          detalle: `${estilo.etiqueta} · ${reporte.veracidad}% de veracidad`,
        };
      }),
    [alertasCercanas, categoriaPorId],
  );

  // Mantiene el detalle al día cuando se refrescan los reportes.
  useEffect(() => {
    if (!seleccionado) return;
    const actualizado = alertasCercanas.find(({ reporte }) => reporte.id === seleccionado.id)?.reporte;
    if (actualizado && actualizado !== seleccionado) setSeleccionado(actualizado);
  }, [alertasCercanas, seleccionado]);

  // Al abrir el mapa desde una notificación (?reporte=<id>) se muestra ese reporte.
  useEffect(() => {
    if (!reporteSolicitado) return;
    const encontrado = alertasCercanas.find(({ reporte }) => reporte.id === reporteSolicitado);
    if (encontrado) {
      setSeleccionado(encontrado.reporte);
      setParametros({}, { replace: true });
    }
  }, [reporteSolicitado, alertasCercanas, setParametros]);

  function seleccionarPorId(id: string) {
    const encontrado = alertasCercanas.find(({ reporte }) => reporte.id === id);
    if (encontrado) {
      reaccionar.reset();
      setSeleccionado(encontrado.reporte);
    }
  }

  async function compartir(reporte: ReportePublico) {
    await compartirTexto(
      `ALERTA CERCA: ${nombreCategoria(reporte)} cerca de ${reporte.latitud_aproximada.toFixed(3)}, ${reporte.longitud_aproximada.toFixed(3)}.`,
    );
  }

  const camposSeleccionado = normalizarCampos(
    seleccionado ? categoriaPorId.get(seleccionado.categoria_id)?.campos_formulario : null,
  );
  const datosSeleccionado = seleccionado ? datosParaMostrar(camposSeleccionado, seleccionado.datos) : [];
  // El autor no puede confirmar su propio reporte (el servidor también lo impide).
  const esMio = seleccionado ? misReportes.has(seleccionado.id) : false;
  const admiteReaccion =
    !esMio && (seleccionado?.estado === 'no_confirmada' || seleccionado?.estado === 'corroborada');

  return (
    <div className="pantalla-mapa">
      {centro && usarGoogleMaps && ubicacion.ubicacion ? (
        <MapaGoogle
          apiKey={claveGoogleMaps}
          centro={ubicacion.ubicacion}
          radioMetros={radioPersonalMetros}
          puntos={puntosGoogle}
          onSeleccionar={seleccionarPorId}
        />
      ) : centro ? (
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
              <Marker
                key={reporte.id}
                position={[reporte.latitud_aproximada, reporte.longitud_aproximada]}
                icon={iconoLeaflet(iconoCategoria(reporte))}
                eventHandlers={{ click: () => seleccionarPorId(reporte.id) }}>
                <Tooltip direction="top" offset={[0, -18]}>
                  {nombreCategoria(reporte)} · {estilo.etiqueta}
                </Tooltip>
              </Marker>
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
          <div className="fila fila--10 alinear-centro">
            <img src={rutaIconoAlerta(iconoCategoria(seleccionado))} alt="" className="icono-detalle" />
            <div>
              <p className="titulo-detalle">{nombreCategoria(seleccionado)}</p>
              <p className="texto-secundario texto-pequeno">
                {obtenerEstiloEstadoReporte(seleccionado.estado, seleccionado.severidad).etiqueta} · Gravedad{' '}
                {seleccionado.severidad} · {new Date(seleccionado.created_at).toLocaleString('es-MX')}
              </p>
            </div>
          </div>

          <BarraVeracidad veracidad={seleccionado.veracidad} />

          {seleccionado.descripcion ? <p className="texto-secundario">{seleccionado.descripcion}</p> : null}

          {datosSeleccionado.length > 0 ? (
            <dl className="lista-datos">
              {datosSeleccionado.map(({ etiqueta, valor }) => (
                <div key={etiqueta}>
                  <dt>{etiqueta}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {seleccionado.foto_url ? <FotoPublica ruta={seleccionado.foto_url} /> : null}

          {seleccionado.enviado_a.length > 0 ? (
            <p className="texto-pequeno texto-secundario">Enviado a: {seleccionado.enviado_a.join(', ')}</p>
          ) : null}

          {esMio ? (
            <p className="texto-pequeno texto-secundario aviso-autor">
              Tú hiciste este reporte. Les estamos preguntando a los vecinos cercanos si también lo ven.
            </p>
          ) : null}

          {admiteReaccion ? (
            <>
              <p className="negrita">¿Tú también lo ves?</p>
              <div className="fila fila--8">
                <Boton
                  variante="paso"
                  disabled={reaccionar.isPending}
                  onClick={() => reaccionar.mutate({ reporteId: seleccionado.id, tipo: 'confirma' })}>
                  Sí, lo veo
                </Boton>
                <Boton
                  variante="paso"
                  disabled={reaccionar.isPending}
                  onClick={() => reaccionar.mutate({ reporteId: seleccionado.id, tipo: 'desmiente' })}>
                  No es cierto
                </Boton>
              </div>
              {reaccionar.isSuccess ? (
                <p className="texto-pequeno texto-verde">
                  ¡Gracias! Tu respuesta cuenta para validar el reporte (y suma reputación si aciertas).
                </p>
              ) : null}
            </>
          ) : null}
          {reaccionar.error ? <p className="texto-error">{(reaccionar.error as Error).message}</p> : null}

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
                  onClick={() => seleccionarPorId(reporte.id)}>
                  <img src={rutaIconoAlerta(iconoCategoria(reporte))} alt="" className="icono-categoria" />
                  <span className="negrita">{nombreCategoria(reporte)}</span>
                  <InsigniaEstado estilo={obtenerEstiloEstadoReporte(reporte.estado, reporte.severidad)} />
                  <span className="texto-pequeno texto-secundario">
                    {(distancia / 1000).toFixed(1)} km · {reporte.veracidad}%
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
