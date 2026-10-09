/**
 * Íconos de alerta para el mapa (llamita = incendio, gota = inundación, etc.).
 * Los PNG viven en `public/iconos-alerta/` (generados desde los SVG del mismo
 * folder). Cada categoría guarda la clave en `categorias.icono`.
 */

export const ICONOS_ALERTA = {
  flame: 'Llamita (incendio)',
  water: 'Gota (inundación)',
  car: 'Auto (robo de vehículo)',
  'car-crash': 'Choque',
  robbery: 'Antifaz (asalto)',
  'road-block': 'Cono (zona obstruida)',
  'person-search': 'Persona (desaparecida)',
  biohazard: 'Matraz (fuga / riesgo químico)',
  alert: 'Signo de admiración (genérico)',
} as const;

export type ClaveIcono = keyof typeof ICONOS_ALERTA;

export const CLAVES_ICONOS = Object.keys(ICONOS_ALERTA) as ClaveIcono[];

export function normalizarIcono(icono: string | null | undefined): ClaveIcono {
  return icono && icono in ICONOS_ALERTA ? (icono as ClaveIcono) : 'alert';
}

/**
 * Ruta del PNG. En Android, `@capacitor/google-maps` busca `iconUrl` dentro de
 * los assets (`public/<ruta>`), así que ahí va SIN barra inicial; en el
 * navegador / WebView se usa absoluta para no depender de la ruta actual.
 */
export function rutaIconoAlerta(icono: string | null | undefined, opciones?: { relativa?: boolean }): string {
  const ruta = `iconos-alerta/${normalizarIcono(icono)}.png`;
  return opciones?.relativa ? ruta : `/${ruta}`;
}
