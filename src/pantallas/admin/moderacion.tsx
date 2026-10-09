import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { datosParaMostrar, normalizarCampos } from '@/src/domain/formulario';
import { rutaIconoAlerta } from '@/src/domain/iconos-alerta';
import { obtenerEtiquetaEstadoReporte } from '@/src/domain/mapa';
import { colorVeracidad } from '@/src/domain/reputacion';
import { useInstituciones } from '@/src/hooks/use-admin';
import { useCategorias } from '@/src/hooks/use-categorias';
import {
  useCerrarReporte,
  useDescartarReporte,
  useReportesPendientesModeracion,
  useVerificarReporte,
} from '@/src/hooks/use-moderacion';
import { useRol } from '@/src/hooks/use-perfil';
import { obtenerUrlFirmadaFoto } from '@/src/services/moderacion';
import type { AnalisisFoto, Database } from '@/src/types/database';
import { Boton, Cargando } from '@/src/ui/controles';
import { confirmar } from '@/src/ui/dialogos';

type Reporte = Database['public']['Tables']['reportes']['Row'];
type Categoria = Database['public']['Tables']['categorias']['Row'];

export function FotoReporte({ rutaFoto }: { rutaFoto: string }) {
  const urlQuery = useQuery({
    queryKey: ['foto-firmada', rutaFoto],
    queryFn: () => obtenerUrlFirmadaFoto(rutaFoto),
  });

  if (urlQuery.isLoading) {
    return <Cargando />;
  }

  if (!urlQuery.data) {
    return null;
  }

  return <img src={urlQuery.data} alt="Foto del reporte" className="foto-moderacion" />;
}

export function ResumenAnalisis({ analisis }: { analisis: AnalisisFoto | null }) {
  if (!analisis) return null;
  if (!analisis.disponible) {
    return <p className="texto-pequeno texto-ambar">La foto no pudo analizarse en el teléfono: revísala con cuidado.</p>;
  }
  return (
    <p className="texto-pequeno texto-secundario">
      Análisis de foto: {analisis.rostros} rostro(s)
      {analisis.rostrosCubiertos ? ` (${analisis.rostrosCubiertos} tapados)` : ''} · contenido inapropiado{' '}
      {Math.round(analisis.probabilidadNsfw * 100)}% · calidad {analisis.calidad.aceptable ? 'aceptable' : 'baja'}
    </p>
  );
}

/** Botones VERDAD / MENTIRA / Cerrar (se usan en la cola y en el detalle del reporte). */
export function AccionesValidacion({ reporte }: { reporte: Reporte }) {
  const verificar = useVerificarReporte();
  const descartar = useDescartarReporte();
  const cerrar = useCerrarReporte();
  const [motivo, setMotivo] = useState('');
  const pendiente = reporte.estado === 'no_confirmada' || reporte.estado === 'corroborada';

  async function marcarMentira() {
    const ok = await confirmar(
      'Marcar como MENTIRA',
      'El reporte se descartará; el autor y quienes lo confirmaron perderán reputación. ¿Continuar?',
      'Es mentira',
    );
    if (ok) {
      descartar.mutate({ reporteId: reporte.id, motivo: motivo.trim() });
      setMotivo('');
    }
  }

  if (reporte.estado === 'descartada' || reporte.estado === 'cerrada') return null;

  return (
    <>
      {pendiente ? (
        <>
          <div className="fila fila--8">
            <Boton
              className="boton--verde"
              onClick={() => verificar.mutate({ reporteId: reporte.id })}
              disabled={verificar.isPending}>
              VERDAD
            </Boton>
            <Boton
              variante="peligro"
              onClick={() => void marcarMentira()}
              disabled={descartar.isPending || !motivo.trim()}>
              MENTIRA
            </Boton>
          </div>

          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (obligatorio para marcar como MENTIRA)"
            className="campo campo--claro campo--8"
          />
        </>
      ) : null}

      <Boton className="boton--pizarra" onClick={() => cerrar.mutate(reporte.id)} disabled={cerrar.isPending}>
        Cerrar (ya se atendió)
      </Boton>

      {verificar.error || descartar.error || cerrar.error ? (
        <MensajeConfiguracion error={verificar.error ?? descartar.error ?? cerrar.error} />
      ) : null}
    </>
  );
}

function FilaReporte({ reporte, categoria }: { reporte: Reporte; categoria: Categoria | undefined }) {
  const datos = datosParaMostrar(normalizarCampos(categoria?.campos_formulario), reporte.datos);

  return (
    <article className="tarjeta tarjeta--12">
      <div className="fila fila--entre alinear-centro">
        <span className="fila fila--8 alinear-centro">
          <img src={rutaIconoAlerta(categoria?.icono)} alt="" className="icono-categoria" />
          <span className="etiqueta">{categoria?.nombre ?? 'Categoría'}</span>
        </span>
        <span className="texto-ambar">{obtenerEtiquetaEstadoReporte(reporte.estado)}</span>
      </div>

      <p className="texto-pequeno">
        <span className="negrita" style={{ color: colorVeracidad(reporte.veracidad) }}>
          {reporte.veracidad}% de veracidad
        </span>{' '}
        <span className="texto-secundario">
          · apoyo {reporte.puntaje_apoyo} / en contra {reporte.puntaje_contra} ·{' '}
          {new Date(reporte.created_at).toLocaleString('es-MX')}
        </span>
      </p>

      <p className="texto-pequeno texto-secundario">
        Ubicación exacta: {reporte.latitud_exacta.toFixed(5)}, {reporte.longitud_exacta.toFixed(5)}
      </p>

      {datos.map(({ etiqueta, valor }) => (
        <p key={etiqueta} className="texto-pequeno">
          <span className="negrita">{etiqueta}:</span> {valor}
        </p>
      ))}

      {reporte.descripcion ? <p>{reporte.descripcion}</p> : null}
      {reporte.foto_url ? <FotoReporte rutaFoto={reporte.foto_url} /> : null}
      <ResumenAnalisis analisis={reporte.analisis_foto as AnalisisFoto | null} />

      <Link to={`/admin/reporte/${reporte.id}`} className="texto-pequeno">
        Ver detalle e historial
      </Link>

      <AccionesValidacion reporte={reporte} />
    </article>
  );
}

/**
 * Cola de validación. El usuario Gubernamental ve los reportes enviados a su
 * institución (los pre-validados); el Administrador ve todos.
 */
export function ModeracionScreen() {
  const pendientesQuery = useReportesPendientesModeracion();
  const categoriasQuery = useCategorias();
  const institucionesQuery = useInstituciones();
  const { esAdministrador, institucionId } = useRol();
  const categoriaPorId = new Map((categoriasQuery.data ?? []).map((c) => [c.id, c]));
  const institucion = institucionesQuery.data?.find((i) => i.id === institucionId);

  return (
    <div className="pantalla pantalla--12 pantalla--16">
      <h2 className="titulo titulo--22">Reportes por validar</h2>
      <p className="texto-secundario texto-13">
        {esAdministrador
          ? 'Ves todos los reportes activos.'
          : institucion
            ? `Reportes enviados a ${institucion.nombre}.`
            : 'No tienes institución asignada: ves todos los reportes activos.'}{' '}
        Al marcar VERDAD o MENTIRA se suman o restan puntos de reputación a quienes participaron.
      </p>

      {pendientesQuery.error ? <MensajeConfiguracion error={pendientesQuery.error} /> : null}

      {pendientesQuery.data?.length ? (
        pendientesQuery.data.map((reporte) => (
          <FilaReporte key={reporte.id} reporte={reporte} categoria={categoriaPorId.get(reporte.categoria_id)} />
        ))
      ) : (
        <p className="texto-tenue">No hay reportes pendientes de validar.</p>
      )}
    </div>
  );
}
