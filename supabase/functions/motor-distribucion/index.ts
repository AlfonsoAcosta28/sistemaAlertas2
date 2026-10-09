// Motor de distribución: calcula a quién le llega cada alerta y cuándo.
//
// Se invoca de dos formas (ver migración `..._alerta_cerca_fase2.sql`):
// 1. Con { reporte_id } justo al crear/verificar un reporte, para el primer anillo (<10s objetivo).
// 2. Sin cuerpo, desde el barrido de pg_cron cada minuto, para el crecimiento de anillos con el tiempo.
//
// El servidor solo conoce la celda H3 (resolución 8) de cada usuario, nunca su
// coordenada exacta. La app vuelve a calcular la distancia fina con su propio
// GPS antes de mostrar la alerta (ver `src/pantallas/tabs/mapa.tsx`).

import { gridDisk, latLngToCell } from "npm:h3-js@4.5.0";

import { crearClienteAdmin } from "../_shared/supabase-admin.ts";
import { enviarNotificacionesPush, type MensajePush } from "../_shared/push.ts";

const RESOLUCION_H3 = 8;
const LONGITUD_ARISTA_METROS = 461; // promedio de una celda H3 en resolución 8.

type ReporteActivo = {
  id: string;
  categoria_id: string;
  estado: "no_confirmada" | "corroborada" | "verificada";
  severidad: "baja" | "media" | "alta";
  latitud: number;
  longitud: number;
  radio_actual_metros: number;
  vigencia_minutos: number;
  created_at: string;
};

type Candidato = {
  usuario_id: string;
  push_token: string;
  ver_no_confirmados: boolean;
  horario_silencio_inicio: string | null;
  horario_silencio_fin: string | null;
  autoriza_alertas_criticas_en_silencio: boolean;
};

function dentroDeHorarioSilencio(inicio: string | null, fin: string | null): boolean {
  if (!inicio || !fin) {
    return false;
  }

  const ahora = new Date().toISOString().slice(11, 19);
  if (inicio <= fin) {
    return ahora >= inicio && ahora <= fin;
  }
  // Rango que cruza la medianoche (ej. 22:00 a 06:00).
  return ahora >= inicio || ahora <= fin;
}

function esAlertaCriticaVerificada(reporte: ReporteActivo): boolean {
  return reporte.severidad === "alta" && reporte.estado === "verificada";
}

Deno.serve(async (req) => {
  try {
    const cuerpo = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const reporteId: string | undefined = cuerpo?.reporte_id ?? undefined;

    const supabase = crearClienteAdmin();

    const { data: reportes, error: errorReportes } = await supabase.rpc(
      "obtener_reportes_activos_para_motor",
      { p_reporte_id: reporteId ?? null },
    );

    if (errorReportes) {
      throw errorReportes;
    }

    const reportesActivos = (reportes ?? []) as ReporteActivo[];

    const { data: categorias } = await supabase.from("categorias").select("id,nombre");
    const nombrePorCategoria = new Map<string, string>(
      (categorias ?? []).map((c: { id: string; nombre: string }) => [c.id, c.nombre]),
    );

    let totalNotificados = 0;

    for (const reporte of reportesActivos) {
      const celdaOrigen = latLngToCell(reporte.latitud, reporte.longitud, RESOLUCION_H3);
      const k = Math.max(1, Math.ceil(reporte.radio_actual_metros / LONGITUD_ARISTA_METROS));
      const celdasCandidatas = gridDisk(celdaOrigen, k);

      const { data: candidatosData, error: errorCandidatos } = await supabase.rpc(
        "obtener_candidatos_para_motor",
        { p_categoria_id: reporte.categoria_id, p_celdas: celdasCandidatas },
      );

      if (errorCandidatos) {
        console.error("Error obteniendo candidatos", reporte.id, errorCandidatos);
        continue;
      }

      const candidatos = (candidatosData ?? []) as Candidato[];

      const elegibles = candidatos.filter((candidato) => {
        if (reporte.estado === "no_confirmada" && !candidato.ver_no_confirmados) {
          return false;
        }

        const enSilencio = dentroDeHorarioSilencio(
          candidato.horario_silencio_inicio,
          candidato.horario_silencio_fin,
        );

        if (enSilencio) {
          const puedeSonarEnSilencio =
            esAlertaCriticaVerificada(reporte) && candidato.autoriza_alertas_criticas_en_silencio;
          if (!puedeSonarEnSilencio) {
            return false;
          }
        }

        return true;
      });

      const idsUnicos = Array.from(new Set(elegibles.map((c) => c.usuario_id)));
      if (idsUnicos.length === 0) {
        continue;
      }

      const { data: pendientesData, error: errorPendientes } = await supabase.rpc(
        "filtrar_no_notificados",
        { p_reporte_id: reporte.id, p_usuario_ids: idsUnicos },
      );

      if (errorPendientes) {
        console.error("Error filtrando notificados", reporte.id, errorPendientes);
        continue;
      }

      const pendientes = new Set((pendientesData ?? []) as string[]);
      const porEnviar = elegibles.filter((c) => pendientes.has(c.usuario_id));

      if (porEnviar.length === 0) {
        continue;
      }

      const nombreCategoria = nombrePorCategoria.get(reporte.categoria_id) ?? "Incidente";
      const esCritica = esAlertaCriticaVerificada(reporte);

      const mensajes: MensajePush[] = porEnviar.map((candidato) => ({
        to: candidato.push_token,
        title: esCritica ? `Alerta verificada: ${nombreCategoria}` : `Reporte cercano: ${nombreCategoria}`,
        body:
          reporte.estado === "no_confirmada"
            ? "Reporte ciudadano sin confirmar cerca de ti."
            : reporte.estado === "corroborada"
              ? "Varios reportes coinciden: posible incidente cerca de ti."
              : "Alerta verificada por un moderador cerca de ti.",
        sound: esCritica ? "default" : reporte.estado === "no_confirmada" ? null : "default",
        priority: "high",
        channelId: esCritica ? "alertas-criticas" : "alertas",
        data: {
          reporteId: reporte.id,
          categoriaId: reporte.categoria_id,
          estado: reporte.estado,
          severidad: reporte.severidad,
          latitudAproximada: reporte.latitud,
          longitudAproximada: reporte.longitud,
          radioAlertaActualMetros: reporte.radio_actual_metros,
        },
      }));

      await enviarNotificacionesPush(mensajes);

      await supabase.rpc("registrar_notificaciones_enviadas", {
        p_reporte_id: reporte.id,
        p_usuario_ids: porEnviar.map((c) => c.usuario_id),
      });

      totalNotificados += porEnviar.length;
    }

    return new Response(
      JSON.stringify({ reportesProcesados: reportesActivos.length, totalNotificados }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("motor-distribucion error", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
