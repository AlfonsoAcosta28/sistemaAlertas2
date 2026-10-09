import type { EstadoReporte } from '@/src/types/database';

/**
 * Avisos de incidentes cercanos generados por la propia app (notificaciones
 * locales). Complementan al push del servidor: funcionan aunque Firebase no
 * esté configurado, mientras la app esté abierta o en segundo plano reciente.
 */

export type AlertaParaAviso = {
  id: string;
  estado: EstadoReporte;
  created_at: string;
  veracidad: number;
  categoria: string;
  distanciaMetros: number;
};

/** Solo se avisa de incidentes recientes, para no inundar al abrir la app. */
export const ANTIGUEDAD_MAXIMA_AVISO_MS = 60 * 60 * 1000;

/** Se avisa una vez por reporte y por estado (reportada → pre-validada → validada). */
export function claveAviso(alerta: Pick<AlertaParaAviso, 'id' | 'estado'>): string {
  return `${alerta.id}:${alerta.estado}`;
}

export function alertasPorAvisar(
  alertas: AlertaParaAviso[],
  yaAvisadas: ReadonlySet<string>,
  misReportes: ReadonlySet<string>,
  ahora: number,
): AlertaParaAviso[] {
  return alertas.filter(
    (a) =>
      !misReportes.has(a.id) &&
      (a.estado === 'no_confirmada' || a.estado === 'corroborada' || a.estado === 'verificada') &&
      !yaAvisadas.has(claveAviso(a)) &&
      ahora - new Date(a.created_at).getTime() <= ANTIGUEDAD_MAXIMA_AVISO_MS,
  );
}

function distanciaLegible(metros: number): string {
  return metros < 1000 ? `${Math.max(10, Math.round(metros / 10) * 10)} m` : `${(metros / 1000).toFixed(1)} km`;
}

/** Mismo tono que las notificaciones del servidor (`motor-distribucion`). */
export function textoAviso(alerta: AlertaParaAviso): { titulo: string; cuerpo: string } {
  const distancia = distanciaLegible(alerta.distanciaMetros);
  if (alerta.estado === 'no_confirmada') {
    return {
      titulo: `¿Tú también lo ves? ${alerta.categoria} cerca de ti`,
      cuerpo: `Un vecino lo reportó a ${distancia}. Abre la app para confirmarlo o desmentirlo.`,
    };
  }
  if (alerta.estado === 'corroborada') {
    return {
      titulo: `¡${alerta.categoria} cerca de ti!`,
      cuerpo: `A ${distancia}. Pre-validado por vecinos (${alerta.veracidad}% de veracidad).`,
    };
  }
  return {
    titulo: `¡${alerta.categoria} cerca de ti! (validado)`,
    cuerpo: `A ${distancia}. Confirmado por una institución. Toma precauciones.`,
  };
}

/** Id numérico estable para la notificación local (Android exige int de 32 bits). */
export function idNotificacion(clave: string): number {
  let hash = 0;
  for (let i = 0; i < clave.length; i++) {
    hash = (hash * 31 + clave.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_000_000_000 || 1;
}
