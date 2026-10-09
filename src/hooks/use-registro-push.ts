import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { useSesion } from '@/src/hooks/use-sesion';
import { actualizarPushToken } from '@/src/services/notificaciones';
import { esNativo, plataforma } from '@/src/utils/entorno';

/**
 * Sustituye a `expo-notifications`. El token que se registra ahora es el token
 * nativo de FCM (Android) / APNs (iOS), no un ExponentPushToken; la Edge
 * Function `motor-distribucion` detecta el tipo y envía por FCM.
 *
 * IMPORTANTE (Android): `PushNotifications.register()` hace que la app se cierre
 * si no existe `android/app/google-services.json`. Por eso el registro solo
 * ocurre con `VITE_PUSH_HABILITADO=true` en `.env` (ver README).
 */
const pushHabilitado = import.meta.env.VITE_PUSH_HABILITADO === 'true';

const CANAL_CRITICAS = 'alertas-criticas';
const CANAL_GENERAL = 'alertas';

let idNotificacionLocal = 1;

export function useRegistroPush() {
  const { usuario } = useSesion();
  const navigate = useNavigate();

  useEffect(() => {
    if (!usuario || !esNativo) {
      return;
    }

    if (!pushHabilitado) {
      console.warn(
        'Notificaciones push desactivadas: agrega google-services.json y VITE_PUSH_HABILITADO=true.',
      );
      return;
    }

    let cancelado = false;
    const manejadores: Array<{ remove: () => Promise<void> }> = [];

    async function registrar() {
      let permiso = await PushNotifications.checkPermissions();

      if (permiso.receive !== 'granted') {
        permiso = await PushNotifications.requestPermissions();
      }

      if (permiso.receive !== 'granted' || cancelado) {
        return;
      }

      if (plataforma === 'android') {
        await PushNotifications.createChannel({
          id: CANAL_CRITICAS,
          name: 'Alertas críticas',
          importance: 5,
          visibility: 1,
          vibration: true,
        });
        await PushNotifications.createChannel({
          id: CANAL_GENERAL,
          name: 'Alertas cercanas',
          importance: 3,
        });
      }

      manejadores.push(
        await PushNotifications.addListener('registration', (token) => {
          if (!cancelado) {
            actualizarPushToken(token.value).catch((error: unknown) =>
              console.error('No fue posible guardar el token push', error),
            );
          }
        }),
        await PushNotifications.addListener('registrationError', (error) => {
          console.error('No fue posible registrar el token de notificaciones push', error);
        }),
        // Con la app abierta, Android no muestra el push por sí solo: lo
        // re-emitimos como notificación local, con prioridad según severidad.
        await PushNotifications.addListener('pushNotificationReceived', (notificacion) => {
          const datos = (notificacion.data ?? {}) as { severidad?: string; estado?: string };
          const esCritica = datos.severidad === 'alta' && datos.estado === 'verificada';

          if (plataforma !== 'android') {
            return; // iOS ya lo presenta vía `presentationOptions`.
          }

          void LocalNotifications.schedule({
            notifications: [
              {
                id: idNotificacionLocal++,
                title: notificacion.title ?? 'ALERTA CERCA',
                body: notificacion.body ?? '',
                channelId: esCritica ? CANAL_CRITICAS : CANAL_GENERAL,
                extra: { ...datos, reporteId: (datos as { reporteId?: string }).reporteId },
              },
            ],
          });
        }),
        // (Tocar una notificación LOCAL lo maneja `useAvisosCercanos`.)
        await PushNotifications.addListener('pushNotificationActionPerformed', (accion) => {
          const datos = (accion.notification.data ?? {}) as { reporteId?: string };
          navigate(datos.reporteId ? `/mapa?reporte=${encodeURIComponent(datos.reporteId)}` : '/mapa');
        }),
      );

      if (!cancelado) {
        await PushNotifications.register();
      }
    }

    void registrar().catch((error: unknown) =>
      console.error('Fallo al configurar notificaciones push', error),
    );

    return () => {
      cancelado = true;
      manejadores.forEach((m) => void m.remove());
    };
  }, [usuario, navigate]);
}
