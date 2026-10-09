import { useEffect, useRef, useState } from 'react';

import { analizarFoto, type ResultadoAnalisis } from '@/src/services/analisis-foto';
import type { AnalisisFoto } from '@/src/types/database';
import { Boton, Cargando } from '@/src/ui/controles';

/** Caja negra en coordenadas del lienzo (resolución final). */
type Caja = { x: number; y: number; ancho: number; alto: number; automatica: boolean };

// Tamaño de la caja manual en pixeles de pantalla.
const ANCHO_CAJA = 60;
const ALTO_CAJA = 40;
const ANCHO_MAXIMO = 1280;
const CALIDAD_JPEG = 0.7;
// Margen extra alrededor de cada rostro detectado al taparlo.
const MARGEN_ROSTRO = 0.25;

type RedactorFotoProps = {
  uriOriginal: string;
  /**
   * true para "Persona desaparecida": la foto DEBE mostrar un rostro con buena
   * calidad, y por eso no se tapan los rostros.
   */
  requiereRostro?: boolean;
  onConfirmar: (foto: Blob, analisis: AnalisisFoto) => void;
  onCancelar: () => void;
};

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => reject(new Error('No se pudo abrir la foto.'));
    imagen.src = src;
  });
}

function dimensionesLienzo(imagen: HTMLImageElement) {
  const escala = Math.min(1, ANCHO_MAXIMO / imagen.naturalWidth);
  return { ancho: Math.round(imagen.naturalWidth * escala), alto: Math.round(imagen.naturalHeight * escala) };
}

/**
 * Revisa y prepara la foto antes de subirla:
 *  1. Analiza en el teléfono: contenido inapropiado (NSFW), rostros y calidad.
 *  2. Si hay contenido inapropiado, la foto no se puede usar.
 *  3. Reportes normales: tapa automáticamente los rostros detectados (el
 *     usuario puede agregar o quitar cajas a mano, por ejemplo sobre placas).
 *  4. Persona desaparecida: exige al menos un rostro y calidad mínima.
 * El `<canvas>` exportado a JPEG (máx. 1280 px, calidad 0.7) aplana las cajas
 * y descarta los metadatos EXIF.
 */
export function RedactorFoto({ uriOriginal, requiereRostro = false, onConfirmar, onCancelar }: RedactorFotoProps) {
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const [imagen, setImagen] = useState<HTMLImageElement | null>(null);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [analisis, setAnalisis] = useState<ResultadoAnalisis | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setAnalisis(null);
    setCajas([]);
    cargarImagen(uriOriginal)
      .then((img) => vigente && setImagen(img))
      .catch((e: unknown) => vigente && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      vigente = false;
    };
  }, [uriOriginal]);

  // Análisis sobre una copia limpia de la foto (sin cajas).
  useEffect(() => {
    if (!imagen) return;
    let vigente = true;
    const { ancho, alto } = dimensionesLienzo(imagen);
    const copia = document.createElement('canvas');
    copia.width = ancho;
    copia.height = alto;
    copia.getContext('2d')?.drawImage(imagen, 0, 0, ancho, alto);

    void analizarFoto(copia, imagen.naturalWidth, imagen.naturalHeight).then((resultado) => {
      if (!vigente) return;
      setAnalisis(resultado);
      if (!requiereRostro && !resultado.nsfw) {
        setCajas(
          resultado.rostros.map((r) => ({
            x: r.x + r.ancho / 2,
            y: r.y + r.alto / 2,
            ancho: r.ancho * (1 + MARGEN_ROSTRO * 2),
            alto: r.alto * (1 + MARGEN_ROSTRO * 2),
            automatica: true,
          })),
        );
      }
    });
    return () => {
      vigente = false;
    };
  }, [imagen, requiereRostro]);

  // Redibuja imagen + cajas cada vez que cambian.
  useEffect(() => {
    const lienzo = lienzoRef.current;
    if (!lienzo || !imagen) return;

    const { ancho, alto } = dimensionesLienzo(imagen);
    lienzo.width = ancho;
    lienzo.height = alto;

    const ctx = lienzo.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(imagen, 0, 0, ancho, alto);
    ctx.fillStyle = '#000000';
    for (const caja of cajas) {
      ctx.fillRect(caja.x - caja.ancho / 2, caja.y - caja.alto / 2, caja.ancho, caja.alto);
    }
  }, [imagen, cajas]);

  function alTocar(evento: React.PointerEvent<HTMLCanvasElement>) {
    if (requiereRostro) return;
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    const rect = lienzo.getBoundingClientRect();
    const factor = lienzo.width / (rect.width || lienzo.width);
    const x = ((evento.clientX - rect.left) / rect.width) * lienzo.width;
    const y = ((evento.clientY - rect.top) / rect.height) * lienzo.height;
    setCajas((previas) => [...previas, { x, y, ancho: ANCHO_CAJA * factor, alto: ALTO_CAJA * factor, automatica: false }]);
  }

  // Motivos que impiden usar la foto.
  const bloqueos: string[] = [];
  if (analisis?.nsfw) {
    bloqueos.push('La foto parece tener contenido inapropiado y no se puede usar.');
  }
  if (requiereRostro && analisis?.disponible) {
    if (analisis.rostros.length === 0) {
      bloqueos.push('No se detectó ningún rostro. Usa una foto donde se vea claramente la cara de la persona.');
    }
    bloqueos.push(...analisis.calidad.problemas);
  }

  async function confirmar() {
    const lienzo = lienzoRef.current;
    if (!lienzo || !analisis) return;
    setProcesando(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        lienzo.toBlob(resolve, 'image/jpeg', CALIDAD_JPEG),
      );
      if (!blob) {
        throw new Error('No se pudo procesar la foto.');
      }
      onConfirmar(blob, {
        disponible: analisis.disponible,
        nsfw: analisis.nsfw,
        probabilidadNsfw: analisis.probabilidadNsfw,
        rostros: analisis.rostros.length,
        calidad: {
          ancho: analisis.calidad.ancho,
          alto: analisis.calidad.alto,
          nitidez: analisis.calidad.nitidez,
          brillo: analisis.calidad.brillo,
          aceptable: analisis.calidad.aceptable,
        },
        rostrosCubiertos: cajas.filter((c) => c.automatica).length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcesando(false);
    }
  }

  const rostrosTapados = cajas.filter((c) => c.automatica).length;

  return (
    <div className="pila pila--8">
      <p className="texto-ayuda">
        {requiereRostro
          ? 'La foto debe mostrar claramente el rostro de la persona.'
          : 'Tapamos automáticamente los rostros. Toca sobre placas u otros datos sensibles para cubrirlos también.'}
      </p>

      <div className="redactor__marco">
        {imagen ? (
          <canvas ref={lienzoRef} className="redactor__lienzo" onPointerDown={alTocar} />
        ) : (
          <span className="texto-claro">Cargando foto…</span>
        )}
      </div>

      {!analisis && imagen ? (
        <div className="fila fila--8 analisis-foto">
          <Cargando />
          <span className="texto-secundario">Revisando la foto (contenido, rostros y calidad)…</span>
        </div>
      ) : null}

      {analisis && analisis.disponible && bloqueos.length === 0 ? (
        <p className="analisis-foto analisis-foto--ok">
          ✓ Foto revisada
          {requiereRostro
            ? ` · ${analisis.rostros.length} rostro(s) detectado(s)`
            : rostrosTapados > 0
              ? ` · ${rostrosTapados} rostro(s) tapado(s) automáticamente`
              : ''}
        </p>
      ) : null}

      {analisis && !analisis.disponible ? (
        <p className="analisis-foto analisis-foto--aviso">
          No pudimos revisar la foto automáticamente en este teléfono. Una institución la revisará antes de
          publicarla.
        </p>
      ) : null}

      {bloqueos.map((motivo) => (
        <p key={motivo} className="texto-error">
          {motivo}
        </p>
      ))}

      {error ? <p className="texto-error">{error}</p> : null}

      <div className="fila fila--8">
        {!requiereRostro ? (
          <Boton
            variante="gris"
            onClick={() => setCajas((previas) => previas.slice(0, -1))}
            disabled={cajas.length === 0}>
            Quitar última caja
          </Boton>
        ) : null}
        <Boton variante="gris" onClick={onCancelar}>
          {bloqueos.length ? 'Elegir otra foto' : 'Quitar foto'}
        </Boton>
      </div>

      <Boton onClick={() => void confirmar()} disabled={procesando || !imagen || !analisis || bloqueos.length > 0}>
        {procesando ? 'Procesando…' : 'Usar esta foto'}
      </Boton>
    </div>
  );
}
