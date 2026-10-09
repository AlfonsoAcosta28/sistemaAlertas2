import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';

import { alertasPorAvisar, claveAviso, idNotificacion, textoAviso } from '@/src/domain/avisos';
import { useAlertasCercanas } from '@/src/hooks/use-alertas-cercanas';
import { useMisReportes } from '@/src/hooks/use-reportes';
import { useSesion } from '@/src/hooks/use-sesion';
import { useUbicacion } from '@/src/hooks/use-ubicacion';
import { plataforma } from '@/src/utils/entorno';

const CLAVE_AVISADAS = 'avisos-cercanos-enviados';
const MAXIMO_GUARDADAS = 300;
const CANAL = 'alertas';
const CANAL_CRITICAS = 'alertas-criticas';

async function leerAvisadas(): Promise<string[]> {
  try {
    const { value } = await Preferences.get({ key: CLAVE_AVISADAS });
    const lista: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function guardarAvisadas(lista: string[]) {
  await Preferences.set({ key: CLAVE_AVISADAS, value: JSON.stringify(lista.slice(-MAXIMO_GUARDADAS)) }).catch(
    () => undefined,
  );
}

let permisoListo: Promise<boolean> | null = null;
function prepararNotificaciones(): Promise<boolean> {
  permisoListo ??= (async () => {
    let permiso = await LocalNotifications.checkPermissions();
    if (permiso.display !== 'granted') {
      permiso = await LocalNotifications.requestPermissions();
    }
    if (permiso.display !== 'granted') return false;
    if (plataforma === 'android') {
      await LocalNotifications.createChannel({ id: CANAL, name: 'Alertas cercanas', importance: 4, vibration: true });
      await LocalNotifications.createChannel({
        id: CANAL_CRITICAS,
        name: 'Alertas críticas',
        importance: 5,
        visibility: 1,
        vibration: true,
      });
    }
    return true;
  })().catch(() => {
    permisoListo = null;
    return false;
  });
  return permisoListo;
}

/**
 * Notifica a los usuarios cuando aparece un incidente dentro de su radio (y de
 * las categorías que eligieron). Nunca avisa al autor de su propio reporte.
 * Se monta una sola vez, en el layout de las pestañas.
 */
export function useAvisosCercanos() {
  const { usuario } = useSesion();
  const navigate = useNavigate();
  const ubicacion = useUbicacion();
  const { alertasCercanas } = useAlertasCercanas(ubicacion.ubicacion);
  const misReportesQuery = useMisReportes();
  const avisadasRef = useRef<Set<string> | null>(null);
  const procesando = useRef(false);

  const misReportes = useMemo(
    () => new Set((misReportesQuery.data ?? []).map((r) => r.id)),
    [misReportesQuery.data],
  );

  // Tocar la notificación abre el mapa con ese reporte seleccionado.
  useEffect(() => {
    const suscripcion = LocalNotifications.addListener('localNotificationActionPerformed', (accion) => {
      const extra = (accion.notification.extra ?? {}) as { reporteId?: string };
      navigate(extra.reporteId ? `/mapa?reporte=${encodeURIComponent(extra.reporteId)}` : '/mapa');
    });
    return () => {
      void suscripcion.then((s) => s.remove());
    };
  }, [navigate]);

  useEffect(() => {
    // Esperar a conocer los reportes propios para no avisarle al autor.
    if (!usuario || !misReportesQuery.isSuccess || alertasCercanas.length === 0 || procesando.current) return;
    procesando.current = true;

    void (async () => {
      try {
        avisadasRef.current ??= new Set(await leerAvisadas());
        const avisadas = avisadasRef.current;

        const pendientes = alertasPorAvisar(
          alertasCercanas.map(({ reporte, distancia }) => ({
            id: reporte.id,
            estado: reporte.estado,
            created_at: reporte.created_at,
            veracidad: reporte.veracidad,
            categoria: reporte.categoria_nombre,
            distanciaMetros: distancia,
          })),
          avisadas,
          misReportes,
          Date.now(),
        );
        if (pendientes.length === 0 || !(await prepararNotificaciones())) return;

        await LocalNotifications.schedule({
          notifications: pendientes.slice(0, 5).map((alerta) => {
            const { titulo, cuerpo } = textoAviso(alerta);
            const clave = claveAviso(alerta);
            const original = alertasCercanas.find((a) => a.reporte.id === alerta.id)?.reporte;
            const critica = alerta.estado === 'verificada' && original?.severidad === 'alta';
            return {
              id: idNotificacion(clave),
              title: titulo,
              body: cuerpo,
              channelId: critica ? CANAL_CRITICAS : CANAL,
              extra: { reporteId: alerta.id },
            };
          }),
        });

        pendientes.forEach((a) => avisadas.add(claveAviso(a)));
        await guardarAvisadas([...avisadas]);
      } catch (error) {
        console.error('No se pudo mostrar el aviso de incidente cercano', error);
      } finally {
        procesando.current = false;
      }
    })();
  }, [usuario, alertasCercanas, misReportes, misReportesQuery.isSuccess]);
}
