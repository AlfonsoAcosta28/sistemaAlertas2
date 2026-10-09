import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { CapacitorHttp, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

import { celdaDeCoordenada } from '@/src/domain/h3';
import { obtenerClienteSupabase } from '@/src/lib/supabase';
import { esNativo, plataforma } from '@/src/utils/entorno';

/**
 * Sustituye a `expo-location` + `expo-task-manager`. El plugin
 * `@capacitor-community/background-geolocation` mantiene un servicio en primer
 * plano (Android) / modo de ubicación en segundo plano (iOS) que sigue
 * entregando ubicaciones con la app minimizada. Igual que antes, solo se envía
 * la celda H3 al servidor y solo cuando cambia.
 */
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

const CLAVE_SEGUIMIENTO_ACTIVO = 'alerta-cerca-seguimiento-fondo';

let idObservador: string | null = null;
let ultimaCeldaEnviada: string | null = null;

/**
 * Android limita las peticiones `fetch` del WebView tras ~5 min en segundo plano,
 * así que aquí se llama al RPC `actualizar_celda_perfil` con el HTTP nativo de
 * Capacitor en lugar de supabase-js.
 */
async function actualizarCeldaPorHttpNativo(celdaH3: string): Promise<void> {
  const supabase = obtenerClienteSupabase();
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabase || !url || !anonKey) {
    return;
  }

  const { data } = await supabase.auth.getSession();
  const tokenAcceso = data.session?.access_token;

  if (!tokenAcceso) {
    return;
  }

  const respuesta = await CapacitorHttp.post({
    url: `${url}/rest/v1/rpc/actualizar_celda_perfil`,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${tokenAcceso}`,
      'Content-Type': 'application/json',
    },
    data: { p_celda_h3: celdaH3 },
  });

  if (respuesta.status >= 400) {
    throw new Error(`actualizar_celda_perfil respondió ${respuesta.status}`);
  }
}

async function enviarCeldaSiCambio(latitud: number, longitud: number) {
  const celda = celdaDeCoordenada(latitud, longitud);

  if (celda === ultimaCeldaEnviada) {
    return;
  }

  try {
    await actualizarCeldaPorHttpNativo(celda);
    ultimaCeldaEnviada = celda;
  } catch (errorEnvio) {
    console.error('No se pudo actualizar la celda del perfil', errorEnvio);
  }
}

/**
 * Arranca el observador de ubicación en segundo plano. Pide permisos la
 * primera vez. Devuelve false en web o si el usuario no concede el permiso.
 */
export async function iniciarSeguimientoEnSegundoPlano(): Promise<boolean> {
  if (!esNativo) {
    return false;
  }

  if (idObservador) {
    return true;
  }

  try {
    if (plataforma === 'android') {
      // Android 13+: sin este permiso no se puede mostrar la notificación fija
      // del servicio de ubicación en segundo plano.
      const permiso = await LocalNotifications.checkPermissions();
      if (permiso.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    }

    idObservador = await BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: 'ALERTA CERCA',
        backgroundMessage: 'Actualizando tu zona aproximada para avisarte de alertas cercanas.',
        requestPermissions: true,
        stale: false,
        distanceFilter: 300,
      },
      (ubicacion, error) => {
        if (error) {
          if (error.code === 'NOT_AUTHORIZED') {
            void detenerSeguimientoEnSegundoPlano();
          }
          console.error('Ubicación en segundo plano falló', error);
          return;
        }

        if (ubicacion) {
          void enviarCeldaSiCambio(ubicacion.latitude, ubicacion.longitude);
        }
      },
    );

    await Preferences.set({ key: CLAVE_SEGUIMIENTO_ACTIVO, value: 'true' });
    return true;
  } catch (error) {
    console.error('No se pudo activar la ubicación en segundo plano', error);
    idObservador = null;
    return false;
  }
}

export async function detenerSeguimientoEnSegundoPlano(): Promise<void> {
  if (idObservador) {
    const id = idObservador;
    idObservador = null;
    await BackgroundGeolocation.removeWatcher({ id }).catch(() => undefined);
  }

  await Preferences.remove({ key: CLAVE_SEGUIMIENTO_ACTIVO });
}

export function seguimientoEnSegundoPlanoActivo(): boolean {
  return idObservador !== null;
}

/**
 * Se llama al arrancar la app: si el usuario ya había activado el seguimiento
 * en segundo plano, lo reanuda (el observador no sobrevive a que el sistema
 * cierre la app).
 */
export async function registrarTareaActualizarCelda(): Promise<boolean> {
  if (!esNativo) {
    return false;
  }

  const { value } = await Preferences.get({ key: CLAVE_SEGUIMIENTO_ACTIVO });

  if (value !== 'true') {
    return false;
  }

  return iniciarSeguimientoEnSegundoPlano();
}
