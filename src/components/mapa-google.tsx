import { GoogleMap } from '@capacitor/google-maps';
import { useEffect, useRef, useState } from 'react';

import { rutaIconoAlerta } from '@/src/domain/iconos-alerta';
import { esNativo } from '@/src/utils/entorno';

export type PuntoMapa = {
  id: string;
  latitud: number;
  longitud: number;
  color: string;
  /** Clave del ícono de la categoría (ver `src/domain/iconos-alerta.ts`). */
  icono: string | null;
  titulo: string;
  detalle: string;
};

type PropsMapaGoogle = {
  apiKey: string;
  centro: { latitud: number; longitud: number };
  radioMetros: number;
  puntos: PuntoMapa[];
  onSeleccionar: (id: string) => void;
};

// Cada instancia usa un id distinto para que un mapa destruido nunca se
// confunda con el nuevo dentro del plugin.
let contadorMapas = 0;

function hexARgba(hex: string) {
  const limpio = hex.replace('#', '');
  return {
    r: parseInt(limpio.slice(0, 2), 16),
    g: parseInt(limpio.slice(2, 4), 16),
    b: parseInt(limpio.slice(4, 6), 16),
    a: 1,
  };
}

/**
 * Mapa con el SDK de Google Maps (`@capacitor/google-maps`): nativo en
 * Android/iOS y Maps JavaScript API en web. Sustituye a `react-native-maps`
 * con la misma clave de API.
 *
 * En Android el mapa nativo se dibuja DEBAJO del WebView, por eso mientras está
 * montado se agrega la clase `con-mapa-nativo` al <html>, que vuelve
 * transparentes los fondos de la página (ver global.css).
 */
export function MapaGoogle({ apiKey, centro, radioMetros, puntos, onSeleccionar }: PropsMapaGoogle) {
  const elementoRef = useRef<HTMLElement>(null);
  const [mapa, setMapa] = useState<GoogleMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idsMarcadores = useRef<string[]>([]);
  const idsCirculos = useRef<string[]>([]);
  const idPorMarcador = useRef(new Map<string, string>());
  const onSeleccionarRef = useRef(onSeleccionar);
  onSeleccionarRef.current = onSeleccionar;

  // Crear / destruir el mapa.
  useEffect(() => {
    const elemento = elementoRef.current;
    if (!elemento) return;

    let vigente = true;
    let instancia: GoogleMap | null = null;
    document.documentElement.classList.add('con-mapa-nativo');

    // Se difiere la creación un tick: en desarrollo, React StrictMode monta,
    // desmonta y vuelve a montar el componente al instante. Sin esto se crean dos
    // mapas sobre el mismo elemento y el `destroy` del primero borra el segundo
    // ("Cannot read properties of undefined (reading 'map')").
    const temporizador = window.setTimeout(() => {
      if (!vigente) return;
      void crear();
    }, 0);

    const crear = () => GoogleMap.create({
      id: `mapa-alertas-${++contadorMapas}`,
      element: elemento,
      apiKey,
      forceCreate: true,
      config: {
        center: { lat: centro.latitud, lng: centro.longitud },
        zoom: 13,
      },
    })
      .then(async (creado) => {
        instancia = creado;
        if (!vigente) {
          await creado.destroy();
          return;
        }
        if (esNativo) {
          await creado.enableCurrentLocation(true).catch(() => undefined);
        }
        await creado.setOnMarkerClickListener(({ markerId }) => {
          const id = idPorMarcador.current.get(markerId);
          if (id) onSeleccionarRef.current(id);
        });
        setMapa(creado);
      })
      .catch((e: unknown) => {
        console.error('No se pudo crear el mapa de Google', e);
        if (vigente) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      vigente = false;
      window.clearTimeout(temporizador);
      document.documentElement.classList.remove('con-mapa-nativo');
      setMapa(null);
      void instancia?.destroy();
    };
    // El mapa se crea una sola vez; los cambios de centro se aplican abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Recentrar cuando cambia la ubicación.
  useEffect(() => {
    if (!mapa) return;
    void mapa
      .setCamera({ coordinate: { lat: centro.latitud, lng: centro.longitud }, animate: true })
      .catch(() => undefined);
  }, [mapa, centro.latitud, centro.longitud]);

  // Círculo del radio personal (+ punto propio en web, donde no hay "mi ubicación").
  useEffect(() => {
    if (!mapa) return;
    let vigente = true;
    void (async () => {
      if (idsCirculos.current.length) {
        await mapa.removeCircles(idsCirculos.current).catch(() => undefined);
        idsCirculos.current = [];
      }
      const ids = await mapa.addCircles([
        {
          center: { lat: centro.latitud, lng: centro.longitud },
          radius: radioMetros,
          strokeColor: '#1D4ED8',
          strokeWeight: 1,
          fillColor: '#1D4ED8',
          fillOpacity: 0.08,
        },
        ...(esNativo
          ? []
          : [
              {
                center: { lat: centro.latitud, lng: centro.longitud },
                radius: 40,
                strokeColor: '#FFFFFF',
                strokeWeight: 2,
                fillColor: '#1D4ED8',
                fillOpacity: 1,
              },
            ]),
      ]);
      if (vigente) idsCirculos.current = ids;
      else await mapa.removeCircles(ids).catch(() => undefined);
    })().catch((e: unknown) => {
      // Si el mapa se destruyó mientras tanto (cambio de pestaña), se ignora.
      if (vigente) console.error('Error actualizando el mapa', e);
    });
    return () => {
      vigente = false;
    };
  }, [mapa, centro.latitud, centro.longitud, radioMetros]);

  // Marcadores de alertas.
  useEffect(() => {
    if (!mapa) return;
    let vigente = true;
    void (async () => {
      if (idsMarcadores.current.length) {
        await mapa.removeMarkers(idsMarcadores.current).catch(() => undefined);
        idsMarcadores.current = [];
        idPorMarcador.current.clear();
      }
      if (puntos.length === 0) return;
      const ids = await mapa.addMarkers(
        puntos.map((p) => ({
          coordinate: { lat: p.latitud, lng: p.longitud },
          title: p.titulo,
          snippet: p.detalle,
          // Ícono por tipo de alerta (llamita, gota, auto...). En Android el
          // plugin lo lee de los assets (`public/iconos-alerta/*.png`).
          iconUrl: rutaIconoAlerta(p.icono, { relativa: esNativo }),
          iconSize: { width: 40, height: 40 },
          iconAnchor: { x: 20, y: 20 },
          // Respaldo si el ícono no se pudiera cargar.
          tintColor: hexARgba(p.color),
        })),
      );
      if (!vigente) {
        await mapa.removeMarkers(ids).catch(() => undefined);
        return;
      }
      idsMarcadores.current = ids;
      ids.forEach((idMarcador, i) => {
        const punto = puntos[i];
        if (punto) idPorMarcador.current.set(idMarcador, punto.id);
      });
    })().catch((e: unknown) => {
      // Si el mapa se destruyó mientras tanto (cambio de pestaña), se ignora.
      if (vigente) console.error('Error actualizando el mapa', e);
    });
    return () => {
      vigente = false;
    };
  }, [mapa, puntos]);

  return (
    <div className="mapa mapa-google">
      <capacitor-google-map ref={elementoRef} className="mapa-google__elemento" />
      {error ? (
        <div className="mapa-google__error">
          <p className="negrita">No se pudo cargar Google Maps</p>
          <p className="texto-pequeno">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
