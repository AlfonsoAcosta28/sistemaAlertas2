import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { rutaIconoAlerta } from '@/src/domain/iconos-alerta';
import { obtenerEtiquetaEstadoReporte } from '@/src/domain/mapa';
import { useTodasLasCategorias } from '@/src/hooks/use-admin';
import { useHistorialModeracion } from '@/src/hooks/use-moderacion';
import { mensajeConfiguracionSupabase, obtenerClienteSupabase } from '@/src/lib/supabase';
import type { Json } from '@/src/types/database';

export const ETIQUETA_ACCION: Record<string, string> = {
  verificar: 'Validó como VERDAD',
  descartar: 'Validó como MENTIRA',
  cerrar: 'Cerró el reporte',
  enviar_instituciones: 'Se envió a instituciones',
  guardar_categoria: 'Guardó una categoría',
  cambiar_rol: 'Cambió el rol de un usuario',
  suspender: 'Suspendió a un usuario',
  quitar_suspension: 'Quitó una suspensión',
  eliminar_usuario: 'Eliminó a un usuario',
};

const ETIQUETA_ROL: Record<string, string> = {
  ciudadano: 'Usuario normal',
  gubernamental: 'Gubernamental',
  administrador: 'Administrador',
};

/** Texto legible del campo `detalle` de la auditoría (en lugar del JSON crudo). */
export function describirDetalle(accion: string, detalle: Json): string | null {
  if (!detalle || typeof detalle !== 'object' || Array.isArray(detalle)) return null;
  const d = detalle as Record<string, Json | undefined>;
  switch (accion) {
    case 'verificar':
      return d.nota ? `Nota: ${String(d.nota)}` : null;
    case 'descartar':
      return d.motivo ? `Motivo: ${String(d.motivo)}` : null;
    case 'enviar_instituciones':
      return Array.isArray(d.instituciones) ? d.instituciones.map(String).join(', ') : null;
    case 'guardar_categoria':
      return d.nombre ? `Categoría: ${String(d.nombre)}` : null;
    case 'cambiar_rol':
      return d.rol ? `Nuevo rol: ${ETIQUETA_ROL[String(d.rol)] ?? String(d.rol)}` : null;
    case 'suspender':
      return d.dias ? `${String(d.dias)} días` : null;
    default:
      return null;
  }
}

/** Categoría y estado de los reportes que aparecen en el historial (según lo que permita RLS). */
function useResumenReportes(ids: string[]) {
  return useQuery({
    queryKey: ['moderacion', 'historial', 'reportes', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const supabase = obtenerClienteSupabase();
      if (!supabase) throw new Error(mensajeConfiguracionSupabase());
      const { data, error } = await supabase.from('reportes').select('*').in('id', ids);
      if (error) throw new Error(error.message);
      return new Map((data ?? []).map((r) => [r.id, r]));
    },
  });
}

export function HistorialModeracionScreen() {
  const historialQuery = useHistorialModeracion();
  const categoriasQuery = useTodasLasCategorias();
  const navigate = useNavigate();

  const idsReportes = [
    ...new Set((historialQuery.data ?? []).map((e) => e.reporte_id).filter((id): id is string => Boolean(id))),
  ];
  const reportesQuery = useResumenReportes(idsReportes);
  const categoriaPorId = new Map((categoriasQuery.data ?? []).map((c) => [c.id, c]));

  return (
    <div className="pantalla pantalla--10 pantalla--16">
      <h2 className="titulo titulo--22">Historial de acciones</h2>
      <p className="texto-secundario texto-13">Toca una acción sobre un reporte para ver toda su información.</p>

      {historialQuery.error ? <MensajeConfiguracion error={historialQuery.error} /> : null}

      {historialQuery.data?.length ? (
        historialQuery.data.map((entrada) => {
          const reporte = entrada.reporte_id ? reportesQuery.data?.get(entrada.reporte_id) : undefined;
          const categoria = reporte ? categoriaPorId.get(reporte.categoria_id) : undefined;
          const texto = describirDetalle(entrada.accion, entrada.detalle);
          const contenido = (
            <>
              <span className="fila fila--entre alinear-centro">
                <span className="negrita">{ETIQUETA_ACCION[entrada.accion] ?? entrada.accion}</span>
                {entrada.reporte_id ? <span className="texto-azul">Ver ›</span> : null}
              </span>
              {reporte ? (
                <span className="fila fila--8 alinear-centro">
                  <img src={rutaIconoAlerta(categoria?.icono)} alt="" className="icono-categoria" />
                  <span className="texto-pequeno">
                    {categoria?.nombre ?? 'Reporte'} · {obtenerEtiquetaEstadoReporte(reporte.estado)}
                  </span>
                </span>
              ) : null}
              {texto ? <span className="texto-pequeno texto-secundario">{texto}</span> : null}
              <span className="texto-pequeno texto-tenue">
                {new Date(entrada.created_at).toLocaleString('es-MX')}
              </span>
            </>
          );

          return entrada.reporte_id ? (
            <button
              type="button"
              key={entrada.id}
              className="tarjeta tarjeta--compacta fila-historial"
              onClick={() => navigate(`/admin/reporte/${entrada.reporte_id}`)}>
              {contenido}
            </button>
          ) : (
            <article key={entrada.id} className="tarjeta tarjeta--compacta">
              {contenido}
            </article>
          );
        })
      ) : (
        <p className="texto-tenue">Todavía no hay acciones registradas.</p>
      )}
    </div>
  );
}
