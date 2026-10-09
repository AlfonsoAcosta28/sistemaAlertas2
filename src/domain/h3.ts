// En el WebView de Capacitor (y en el navegador) h3-js v4 funciona sin parches,
// a diferencia de Hermes en React Native, que obligaba a usar v3 + polyfill.
// `latLngToCell` (v4) produce exactamente la misma celda que `geoToH3` (v3), y es
// la misma versión que usa la Edge Function `motor-distribucion`.
import { latLngToCell } from 'h3-js';

// Resolución 8 (~0.7 km² por celda): suficiente para agrupar candidatos sin
// guardar la coordenada exacta del usuario en el servidor.
export const RESOLUCION_H3 = 8;

export function celdaDeCoordenada(latitud: number, longitud: number): string {
  return latLngToCell(latitud, longitud, RESOLUCION_H3);
}
