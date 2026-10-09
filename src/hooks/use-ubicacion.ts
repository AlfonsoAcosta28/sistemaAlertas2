import { Geolocation } from '@capacitor/geolocation';
import { useCallback, useEffect, useState } from 'react';

import { celdaDeCoordenada } from '@/src/domain/h3';
import { actualizarCeldaPerfil } from '@/src/services/ubicacion';
import { iniciarSeguimientoEnSegundoPlano } from '@/src/tasks/ubicacion-background-task';
import { esNativo } from '@/src/utils/entorno';

export type UbicacionActual = {
  latitud: number;
  longitud: number;
  celdaH3: string;
};

function mensajeDeError(excepcion: unknown): string {
  if (excepcion instanceof Error) {
    return excepcion.message;
  }
  if (typeof excepcion === 'object' && excepcion && 'message' in excepcion) {
    return String((excepcion as { message: unknown }).message);
  }
  return 'No fue posible obtener tu ubicación.';
}

export function useUbicacion() {
  const [ubicacion, setUbicacion] = useState<UbicacionActual | null>(null);
  const [permisoConcedido, setPermisoConcedido] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      if (esNativo) {
        // En web `requestPermissions` no está implementado: el navegador pide
        // permiso por sí solo al llamar a getCurrentPosition.
        let permiso = await Geolocation.checkPermissions();
        if (permiso.location !== 'granted') {
          permiso = await Geolocation.requestPermissions({ permissions: ['location'] });
        }

        if (permiso.location !== 'granted') {
          setPermisoConcedido(false);
          setError('Se necesita permiso de ubicación para reportar y ver alertas cercanas.');
          return;
        }
      }

      const posicion = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });
      setPermisoConcedido(true);

      const celdaH3 = celdaDeCoordenada(posicion.coords.latitude, posicion.coords.longitude);

      setUbicacion({
        latitud: posicion.coords.latitude,
        longitud: posicion.coords.longitude,
        celdaH3,
      });

      void actualizarCeldaPerfil(celdaH3).catch(() => undefined);
    } catch (excepcion) {
      setError(mensajeDeError(excepcion));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  // En web no hay ubicación en segundo plano; devuelve false sin tronar.
  const activarSeguimientoEnSegundoPlano = useCallback(
    (): Promise<boolean> => iniciarSeguimientoEnSegundoPlano(),
    [],
  );

  return {
    ubicacion,
    permisoConcedido,
    cargando,
    error,
    refrescar,
    activarSeguimientoEnSegundoPlano,
  };
}
