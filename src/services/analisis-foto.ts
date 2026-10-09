import { esContenidoInapropiado, evaluarCalidadFoto, type CalidadFoto } from '@/src/domain/calidad-foto';

/**
 * Análisis de la foto EN EL TELÉFONO, antes de subirla:
 *  - Filtro NSFW con NSFWJS (MobileNetV2, el modelo va dentro de la app).
 *  - Detección de rostros con face-api (TinyFaceDetector, modelo en
 *    `public/modelos/rostros/`).
 *  - Umbral de calidad (tamaño, brillo y nitidez).
 *
 * Los modelos se cargan la primera vez que se analiza una foto (import
 * dinámico), así no pesan en el arranque de la app.
 */

export type RostroDetectado = { x: number; y: number; ancho: number; alto: number; confianza: number };

export type ResultadoAnalisis = {
  /** false si los modelos no se pudieron cargar (la foto pasa a revisión manual). */
  disponible: boolean;
  nsfw: boolean;
  probabilidadNsfw: number;
  rostros: RostroDetectado[];
  calidad: CalidadFoto;
  error?: string;
};

const RUTA_MODELO_ROSTROS = '/modelos/rostros';
const ANCHO_MUESTRA_CALIDAD = 256;

type Modelos = {
  clasificarNsfw: (lienzo: HTMLCanvasElement) => Promise<{ className: string; probability: number }[]>;
  detectarRostros: (lienzo: HTMLCanvasElement) => Promise<RostroDetectado[]>;
};

let modelos: Promise<Modelos> | null = null;

function cargarModelos(): Promise<Modelos> {
  modelos ??= (async () => {
    const tf = await import('@tensorflow/tfjs');
    if (!(await tf.setBackend('webgl').catch(() => false))) {
      await tf.setBackend('cpu');
    }
    await tf.ready();

    const [{ load }, { MobileNetV2Model }, faceapi] = await Promise.all([
      import('nsfwjs/core'),
      import('nsfwjs/models/mobilenet_v2'),
      import('@vladmandic/face-api/dist/face-api.esm-nobundle.js'),
    ]);

    const [nsfw] = await Promise.all([
      load('MobileNetV2', { modelDefinitions: [MobileNetV2Model] }),
      faceapi.nets.tinyFaceDetector.loadFromUri(RUTA_MODELO_ROSTROS),
    ]);

    return {
      clasificarNsfw: (lienzo) => nsfw.classify(lienzo),
      detectarRostros: async (lienzo) => {
        const detecciones = await faceapi.detectAllFaces(
          lienzo,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }),
        );
        return detecciones.map((d) => ({
          x: d.box.x,
          y: d.box.y,
          ancho: d.box.width,
          alto: d.box.height,
          confianza: Math.round(d.score * 100) / 100,
        }));
      },
    } satisfies Modelos;
  })().catch((error: unknown) => {
    modelos = null; // Permite reintentar con la siguiente foto.
    throw error;
  });
  return modelos;
}

function medirCalidad(lienzo: HTMLCanvasElement, anchoOriginal: number, altoOriginal: number): CalidadFoto {
  const escala = Math.min(1, ANCHO_MUESTRA_CALIDAD / lienzo.width);
  const muestra = document.createElement('canvas');
  muestra.width = Math.max(1, Math.round(lienzo.width * escala));
  muestra.height = Math.max(1, Math.round(lienzo.height * escala));
  const ctx = muestra.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { ancho: anchoOriginal, alto: altoOriginal, nitidez: 0, brillo: 0, aceptable: true, problemas: [] };
  }
  ctx.drawImage(lienzo, 0, 0, muestra.width, muestra.height);
  return evaluarCalidadFoto(ctx.getImageData(0, 0, muestra.width, muestra.height), anchoOriginal, altoOriginal);
}

/**
 * Analiza la foto dibujada en `lienzo` (SIN cajas de redacción). Las
 * coordenadas de los rostros están en pixeles de ese lienzo.
 */
export async function analizarFoto(
  lienzo: HTMLCanvasElement,
  anchoOriginal: number,
  altoOriginal: number,
): Promise<ResultadoAnalisis> {
  const calidad = medirCalidad(lienzo, anchoOriginal, altoOriginal);

  try {
    const { clasificarNsfw, detectarRostros } = await cargarModelos();
    const [predicciones, rostros] = await Promise.all([clasificarNsfw(lienzo), detectarRostros(lienzo)]);
    const { inapropiado, probabilidad } = esContenidoInapropiado(predicciones);
    return { disponible: true, nsfw: inapropiado, probabilidadNsfw: probabilidad, rostros, calidad };
  } catch (error) {
    console.error('No se pudo analizar la foto', error);
    return {
      disponible: false,
      nsfw: false,
      probabilidadNsfw: 0,
      rostros: [],
      calidad,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
