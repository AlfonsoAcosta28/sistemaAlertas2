import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';
import { useEffect, useState } from 'react';

import { esNativo } from '@/src/utils/entorno';

type EstadoPermiso = 'pendiente' | 'concedido' | 'denegado' | 'no disponible en web';

function traducir(estado: string): EstadoPermiso {
  if (estado === 'granted') return 'concedido';
  if (estado === 'denied') return 'denegado';
  return 'pendiente';
}

export function usePermisosDispositivo() {
  const [estadoUbicacion, setEstadoUbicacion] = useState<EstadoPermiso>('pendiente');
  const [estadoNotificaciones, setEstadoNotificaciones] = useState<EstadoPermiso>('pendiente');

  useEffect(() => {
    async function cargarPermisos() {
      if (!esNativo) {
        try {
          const estado = await navigator.permissions.query({ name: 'geolocation' });
          setEstadoUbicacion(traducir(estado.state));
        } catch {
          setEstadoUbicacion('pendiente');
        }
        setEstadoNotificaciones('no disponible en web');
        return;
      }

      const ubicacion = await Geolocation.checkPermissions().catch(() => null);
      setEstadoUbicacion(ubicacion ? traducir(ubicacion.location) : 'pendiente');

      const notificaciones = await PushNotifications.checkPermissions().catch(() => null);
      setEstadoNotificaciones(notificaciones ? traducir(notificaciones.receive) : 'pendiente');
    }

    void cargarPermisos();
  }, []);

  return {
    estadoUbicacion,
    estadoNotificaciones,
  };
}
