import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { RedactorFoto } from '@/src/components/redactor-foto';
import { useCategorias } from '@/src/hooks/use-categorias';
import { useCrearReporte } from '@/src/hooks/use-reportes';
import { useSesion } from '@/src/hooks/use-sesion';
import { useUbicacion } from '@/src/hooks/use-ubicacion';
import { tomarOElegirFoto, type OrigenFoto } from '@/src/services/camara';
import { subirFotoReporte } from '@/src/services/fotos';
import { Boton, Cargando } from '@/src/ui/controles';
import { alerta } from '@/src/ui/dialogos';

export function CrearReporteScreen() {
  const { usuario } = useSesion();
  const navigate = useNavigate();
  const categoriasQuery = useCategorias();
  const ubicacion = useUbicacion();
  const crearReporte = useCrearReporte();

  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [fotoPendiente, setFotoPendiente] = useState<string | null>(null);
  const [fotoLista, setFotoLista] = useState<Blob | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  useEffect(() => {
    if (!fotoLista) {
      setVistaPrevia(null);
      return;
    }
    const url = URL.createObjectURL(fotoLista);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [fotoLista]);

  async function elegirFoto(origen: OrigenFoto) {
    try {
      const foto = await tomarOElegirFoto(origen);
      if (foto) {
        setFotoLista(null);
        setFotoPendiente(foto);
      }
    } catch (error) {
      await alerta('Permiso necesario', error instanceof Error ? error.message : String(error));
    }
  }

  async function enviar() {
    if (!categoriaId) {
      await alerta('Falta categoría', 'Elige qué tipo de incidente estás reportando.');
      return;
    }

    if (!ubicacion.ubicacion) {
      await alerta('Falta ubicación', 'Necesitamos tu ubicación para publicar el reporte.');
      return;
    }

    if (!usuario) {
      await alerta('Sesión requerida', 'Inicia sesión para reportar.');
      return;
    }

    try {
      let fotoUrl: string | null = null;

      if (fotoLista) {
        setSubiendoFoto(true);
        fotoUrl = await subirFotoReporte(usuario.id, fotoLista);
      }

      await crearReporte.mutateAsync({
        categoriaId,
        latitud: ubicacion.ubicacion.latitud,
        longitud: ubicacion.ubicacion.longitud,
        celdaH3: ubicacion.ubicacion.celdaH3,
        descripcion: descripcion.trim() || null,
        fotoUrl,
      });

      await alerta('Reporte enviado', 'Gracias, tu reporte ya está en revisión de la comunidad.');
      setCategoriaId(null);
      setDescripcion('');
      setFotoPendiente(null);
      setFotoLista(null);
      navigate('/mapa', { replace: true });
    } catch (error) {
      await alerta(
        'No fue posible enviar',
        error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
      );
    } finally {
      setSubiendoFoto(false);
    }
  }

  const enviando = crearReporte.isPending || subiendoFoto;

  return (
    <div className="pantalla pantalla--10">
      <h2 className="titulo">Reportar un incidente</h2>

      {categoriasQuery.error ? <MensajeConfiguracion error={categoriasQuery.error} /> : null}

      <p className="seccion">1. ¿Qué está pasando?</p>
      <div className="rejilla">
        {categoriasQuery.data?.map((categoria) => (
          <button
            type="button"
            key={categoria.id}
            onClick={() => setCategoriaId(categoria.id)}
            className={`chip${categoriaId === categoria.id ? ' chip--activo' : ''}`}>
            {categoria.nombre}
          </button>
        ))}
      </div>

      <p className="seccion">2. Ubicación</p>
      <div className="tarjeta tarjeta--compacta">
        {ubicacion.cargando ? (
          <Cargando />
        ) : ubicacion.ubicacion ? (
          <p className="negrita">
            {ubicacion.ubicacion.latitud.toFixed(5)}, {ubicacion.ubicacion.longitud.toFixed(5)}
          </p>
        ) : (
          <p className="negrita">Sin ubicación todavía.</p>
        )}
        {ubicacion.error ? <p className="texto-error">{ubicacion.error}</p> : null}
        <Boton variante="enlace" className="alinear-inicio" onClick={() => void ubicacion.refrescar()}>
          Actualizar mi ubicación
        </Boton>
      </div>

      <p className="seccion">3. Opcional: descripción y foto</p>
      <textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        className="campo campo--area"
        placeholder="Describe brevemente lo que ves (opcional)"
      />

      {fotoPendiente && !fotoLista ? (
        <RedactorFoto
          uriOriginal={fotoPendiente}
          onConfirmar={(foto) => setFotoLista(foto)}
          onCancelar={() => setFotoPendiente(null)}
        />
      ) : fotoLista ? (
        <div className="pila pila--6">
          {vistaPrevia ? <img src={vistaPrevia} alt="Foto adjunta" className="foto-preview" /> : null}
          <Boton
            variante="enlace"
            className="alinear-inicio"
            onClick={() => {
              setFotoLista(null);
              setFotoPendiente(null);
            }}>
            Quitar foto
          </Boton>
        </div>
      ) : (
        <div className="fila fila--8">
          <Boton variante="contorno" onClick={() => void elegirFoto('camara')}>
            Tomar foto
          </Boton>
          <Boton variante="contorno" onClick={() => void elegirFoto('galeria')}>
            Elegir de galería
          </Boton>
        </div>
      )}

      <Boton className="mt-8" onClick={() => void enviar()} disabled={enviando} cargando={enviando}>
        Enviar reporte
      </Boton>

      <p className="nota">
        Tu identidad nunca se muestra a otros usuarios. La ubicación pública se difumina ~100 m
        hasta que el reporte se verifique.
      </p>
    </div>
  );
}
