/**
 * Umbral de calidad de foto (sin dependencias, se prueba en Node):
 * tamaño mínimo, brillo y nitidez (varianza del laplaciano en escala de grises).
 */

export type PixelesRgba = { data: ArrayLike<number>; width: number; height: number };

export type CalidadFoto = {
  ancho: number;
  alto: number;
  /** Varianza del laplaciano; más alto = más nítida. */
  nitidez: number;
  /** Brillo promedio 0–255. */
  brillo: number;
  aceptable: boolean;
  problemas: string[];
};

export const UMBRALES_CALIDAD = {
  ladoMinimo: 300,
  nitidezMinima: 60,
  brilloMinimo: 40,
  brilloMaximo: 225,
} as const;

function escalaDeGrises(pixeles: PixelesRgba): Float32Array {
  const { data, width, height } = pixeles;
  const gris = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    gris[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gris;
}

/**
 * Evalúa la calidad. `pixeles` puede ser una versión reducida de la imagen
 * (ej. 256 px de ancho) para que sea rápido; `anchoOriginal`/`altoOriginal`
 * son las dimensiones reales de la foto.
 */
export function evaluarCalidadFoto(
  pixeles: PixelesRgba,
  anchoOriginal: number,
  altoOriginal: number,
): CalidadFoto {
  const { width, height } = pixeles;
  const gris = escalaDeGrises(pixeles);

  let suma = 0;
  for (const valor of gris) suma += valor;
  const brillo = gris.length ? suma / gris.length : 0;

  let sumaLap = 0;
  let sumaLap2 = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap =
        (gris[i - width] ?? 0) + (gris[i + width] ?? 0) + (gris[i - 1] ?? 0) + (gris[i + 1] ?? 0) - 4 * (gris[i] ?? 0);
      sumaLap += lap;
      sumaLap2 += lap * lap;
      n++;
    }
  }
  const media = n ? sumaLap / n : 0;
  const nitidez = n ? sumaLap2 / n - media * media : 0;

  const problemas: string[] = [];
  if (Math.min(anchoOriginal, altoOriginal) < UMBRALES_CALIDAD.ladoMinimo) {
    problemas.push(`La foto es muy pequeña (mínimo ${UMBRALES_CALIDAD.ladoMinimo} px por lado).`);
  }
  if (nitidez < UMBRALES_CALIDAD.nitidezMinima) {
    problemas.push('La foto se ve borrosa.');
  }
  if (brillo < UMBRALES_CALIDAD.brilloMinimo) {
    problemas.push('La foto está muy oscura.');
  } else if (brillo > UMBRALES_CALIDAD.brilloMaximo) {
    problemas.push('La foto está sobreexpuesta (muy clara).');
  }

  return {
    ancho: anchoOriginal,
    alto: altoOriginal,
    nitidez: Math.round(nitidez),
    brillo: Math.round(brillo),
    aceptable: problemas.length === 0,
    problemas,
  };
}

/** Umbral de las clases de NSFWJS que se consideran contenido inapropiado. */
export const UMBRAL_NSFW = 0.6;

export function esContenidoInapropiado(predicciones: { className: string; probability: number }[]): {
  inapropiado: boolean;
  probabilidad: number;
} {
  const probabilidad = predicciones
    .filter((p) => p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy')
    .reduce((total, p) => total + (p.className === 'Sexy' ? p.probability * 0.5 : p.probability), 0);
  return { inapropiado: probabilidad >= UMBRAL_NSFW, probabilidad: Math.round(probabilidad * 100) / 100 };
}
