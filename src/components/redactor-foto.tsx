import { useEffect, useRef, useState } from 'react';

import { Boton } from '@/src/ui/controles';

type Caja = { x: number; y: number };

// Tamaño de la caja en pixeles de pantalla (como en la versión Expo).
const ANCHO_CAJA = 60;
const ALTO_CAJA = 40;
const ANCHO_MAXIMO = 1280;
const CALIDAD_JPEG = 0.7;

type RedactorFotoProps = {
  uriOriginal: string;
  onConfirmar: (foto: Blob) => void;
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

/**
 * Sustituto de "blur automático de rostros/placas" (fuera de alcance sin un
 * modelo de detección): el usuario tapa manualmente zonas sensibles con cajas
 * negras antes de enviar. Todo se dibuja en un `<canvas>`, que al exportarse a
 * JPEG (máx. 1280 px, calidad 0.7) aplana las cajas sobre la imagen y descarta
 * los metadatos EXIF. A diferencia de la versión Expo, funciona en cualquier
 * build (ya no depende de react-native-view-shot).
 */
export function RedactorFoto({ uriOriginal, onConfirmar, onCancelar }: RedactorFotoProps) {
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const [imagen, setImagen] = useState<HTMLImageElement | null>(null);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    cargarImagen(uriOriginal)
      .then((img) => vigente && setImagen(img))
      .catch((e: unknown) => vigente && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      vigente = false;
    };
  }, [uriOriginal]);

  // Redibuja imagen + cajas cada vez que cambian. Las cajas se guardan en
  // coordenadas del lienzo (resolución final), no de pantalla.
  useEffect(() => {
    const lienzo = lienzoRef.current;
    if (!lienzo || !imagen) return;

    const escala = Math.min(1, ANCHO_MAXIMO / imagen.naturalWidth);
    lienzo.width = Math.round(imagen.naturalWidth * escala);
    lienzo.height = Math.round(imagen.naturalHeight * escala);

    const ctx = lienzo.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

    const factor = lienzo.width / (lienzo.clientWidth || lienzo.width);
    const ancho = ANCHO_CAJA * factor;
    const alto = ALTO_CAJA * factor;
    ctx.fillStyle = '#000000';
    for (const caja of cajas) {
      ctx.fillRect(caja.x - ancho / 2, caja.y - alto / 2, ancho, alto);
    }
  }, [imagen, cajas]);

  function alTocar(evento: React.PointerEvent<HTMLCanvasElement>) {
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    const rect = lienzo.getBoundingClientRect();
    const x = ((evento.clientX - rect.left) / rect.width) * lienzo.width;
    const y = ((evento.clientY - rect.top) / rect.height) * lienzo.height;
    setCajas((previas) => [...previas, { x, y }]);
  }

  async function confirmar() {
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    setProcesando(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        lienzo.toBlob(resolve, 'image/jpeg', CALIDAD_JPEG),
      );
      if (!blob) {
        throw new Error('No se pudo procesar la foto.');
      }
      onConfirmar(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="pila pila--8">
      <p className="texto-ayuda">
        Toca sobre rostros o placas para cubrirlos con una caja negra antes de enviar (opcional).
      </p>

      <div className="redactor__marco">
        {imagen ? (
          <canvas ref={lienzoRef} className="redactor__lienzo" onPointerDown={alTocar} />
        ) : (
          <span className="texto-claro">Cargando foto…</span>
        )}
      </div>

      {error ? <p className="texto-error">{error}</p> : null}

      <div className="fila fila--8">
        <Boton
          variante="gris"
          onClick={() => setCajas((previas) => previas.slice(0, -1))}
          disabled={cajas.length === 0}>
          Quitar última caja
        </Boton>
        <Boton variante="gris" onClick={onCancelar}>
          Quitar foto
        </Boton>
      </div>

      <Boton onClick={confirmar} disabled={procesando || !imagen}>
        {procesando ? 'Procesando…' : 'Usar esta foto'}
      </Boton>
    </div>
  );
}
