import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { RedactorFoto } from '@/src/components/redactor-foto';
import {
  campoEsRequerido,
  limpiarDatos,
  normalizarCampos,
  validarDatosFormulario,
  type DatosFormulario,
} from '@/src/domain/formulario';
import { rutaIconoAlerta } from '@/src/domain/iconos-alerta';
import { useCategorias } from '@/src/hooks/use-categorias';
import { useCrearReporte } from '@/src/hooks/use-reportes';
import { useReglasCategorias } from '@/src/hooks/use-admin';
import { useSesion } from '@/src/hooks/use-sesion';
import { useUbicacion } from '@/src/hooks/use-ubicacion';
import { tomarOElegirFoto, type OrigenFoto } from '@/src/services/camara';
import { subirFotoReporte } from '@/src/services/fotos';
import type { AnalisisFoto, CampoFormulario } from '@/src/types/database';
import { Boton, Cargando } from '@/src/ui/controles';
import { alerta } from '@/src/ui/dialogos';

function CampoDinamico({
  campo,
  valor,
  datos,
  error,
  onCambio,
}: {
  campo: CampoFormulario;
  valor: string;
  datos: DatosFormulario;
  error: string | undefined;
  onCambio: (valor: string) => void;
}) {
  const obligatorio = campoEsRequerido(campo, datos);
  const id = `campo-${campo.clave}`;

  return (
    <div className="pila pila--6">
      <label htmlFor={id} className="etiqueta-campo">
        {campo.etiqueta}
        {obligatorio ? <span className="texto-error"> *</span> : <span className="texto-tenue"> (opcional)</span>}
      </label>
      {campo.tipo === 'opciones' ? (
        <div className="rejilla" id={id} role="radiogroup" aria-label={campo.etiqueta}>
          {(campo.opciones ?? []).map((opcion) => (
            <button
              type="button"
              key={opcion}
              role="radio"
              aria-checked={valor === opcion}
              onClick={() => onCambio(valor === opcion ? '' : opcion)}
              className={`chip chip--chico${valor === opcion ? ' chip--activo' : ''}`}>
              {opcion}
            </button>
          ))}
        </div>
      ) : campo.tipo === 'texto_largo' ? (
        <textarea id={id} value={valor} onChange={(e) => onCambio(e.target.value)} className="campo campo--area" />
      ) : (
        <input
          id={id}
          value={valor}
          onChange={(e) => onCambio(campo.mayusculas ? e.target.value.toUpperCase() : e.target.value)}
          className="campo"
          inputMode={campo.tipo === 'numero' ? 'numeric' : 'text'}
          autoCapitalize={campo.mayusculas ? 'characters' : 'sentences'}
        />
      )}
      {campo.ayuda ? <p className="nota">{campo.ayuda}</p> : null}
      {error ? <p className="texto-error texto-pequeno">{error}</p> : null}
    </div>
  );
}

export function CrearReporteScreen() {
  const { usuario } = useSesion();
  const navigate = useNavigate();
  const categoriasQuery = useCategorias();
  const reglasQuery = useReglasCategorias();
  const ubicacion = useUbicacion();
  const crearReporte = useCrearReporte();

  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [datos, setDatos] = useState<DatosFormulario>({});
  const [mostrarErrores, setMostrarErrores] = useState(false);
  const [aceptaDeclaracion, setAceptaDeclaracion] = useState(false);
  const [fotoPendiente, setFotoPendiente] = useState<string | null>(null);
  const [fotoLista, setFotoLista] = useState<Blob | null>(null);
  const [analisisFoto, setAnalisisFoto] = useState<AnalisisFoto | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const categoria = categoriasQuery.data?.find((c) => c.id === categoriaId) ?? null;
  const campos = useMemo(() => normalizarCampos(categoria?.campos_formulario), [categoria]);
  const errores = useMemo(() => validarDatosFormulario(campos, datos), [campos, datos]);
  const umbral = reglasQuery.data?.get(categoriaId ?? '')?.umbral_confirmaciones;
  // "Persona desaparecida": el propio reporte basta, pero con sanción legal si es falso.
  const exigeDeclaracion = Boolean(categoria?.requiere_moderacion_obligatoria);

  useEffect(() => {
    if (!fotoLista) {
      setVistaPrevia(null);
      return;
    }
    const url = URL.createObjectURL(fotoLista);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [fotoLista]);

  function elegirCategoria(id: string) {
    if (id === categoriaId) return;
    setCategoriaId(id);
    setDatos({});
    setMostrarErrores(false);
    setAceptaDeclaracion(false);
    // Cambiar de categoría puede cambiar las reglas de la foto (rostro obligatorio).
    setFotoPendiente(null);
    setFotoLista(null);
    setAnalisisFoto(null);
  }

  async function elegirFoto(origen: OrigenFoto) {
    try {
      const foto = await tomarOElegirFoto(origen);
      if (foto) {
        setFotoLista(null);
        setAnalisisFoto(null);
        setFotoPendiente(foto);
      }
    } catch (error) {
      await alerta('Permiso necesario', error instanceof Error ? error.message : String(error));
    }
  }

  function quitarFoto() {
    setFotoLista(null);
    setFotoPendiente(null);
    setAnalisisFoto(null);
  }

  async function enviar() {
    if (!categoria) {
      await alerta('Falta categoría', 'Elige qué tipo de incidente estás reportando.');
      return;
    }
    if (Object.keys(errores).length > 0) {
      setMostrarErrores(true);
      await alerta('Faltan datos', 'Revisa los campos marcados en rojo.');
      return;
    }
    if (categoria.requiere_foto && !fotoLista) {
      await alerta('Falta la foto', `Para "${categoria.nombre}" es obligatorio adjuntar una foto.`);
      return;
    }
    if (exigeDeclaracion && !aceptaDeclaracion) {
      await alerta('Confirma la declaración', 'Debes aceptar la declaración de veracidad para enviar el reporte.');
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
        categoriaId: categoria.id,
        latitud: ubicacion.ubicacion.latitud,
        longitud: ubicacion.ubicacion.longitud,
        celdaH3: ubicacion.ubicacion.celdaH3,
        descripcion: descripcion.trim() || null,
        fotoUrl,
        datos: limpiarDatos(campos, datos),
        analisisFoto: fotoUrl ? analisisFoto : null,
      });

      await alerta(
        'Reporte enviado',
        umbral && umbral > 1
          ? `Gracias. Les preguntaremos a los vecinos más cercanos si también lo ven; con ${umbral} personas se pre-valida y se manda a la institución correspondiente.`
          : 'Gracias. Tu reporte se mandó a la institución correspondiente para su validación.',
      );
      setCategoriaId(null);
      setDescripcion('');
      setDatos({});
      setMostrarErrores(false);
      setAceptaDeclaracion(false);
      quitarFoto();
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
  const fotoObligatoria = Boolean(categoria?.requiere_foto);
  const requiereRostro = Boolean(categoria?.foto_requiere_rostro);
  let paso = 3;

  return (
    <div className="pantalla pantalla--10">
      <h2 className="titulo">Reportar un incidente</h2>

      {categoriasQuery.error ? <MensajeConfiguracion error={categoriasQuery.error} /> : null}

      <p className="seccion">1. ¿Qué está pasando?</p>
      <div className="rejilla">
        {categoriasQuery.data?.map((c) => (
          <button
            type="button"
            key={c.id}
            onClick={() => elegirCategoria(c.id)}
            className={`chip chip--icono${categoriaId === c.id ? ' chip--activo' : ''}`}>
            <img src={rutaIconoAlerta(c.icono)} alt="" className="icono-categoria" />
            {c.nombre}
          </button>
        ))}
      </div>

      {categoria && umbral ? (
        <p className="nota">
          {umbral > 1
            ? `Se pre-valida cuando ${umbral} personas lo confirman (contándote a ti).`
            : 'Basta con tu reporte; una institución lo verificará.'}
        </p>
      ) : null}

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

      {campos.length > 0 ? (
        <>
          <p className="seccion">{paso++}. Datos de {categoria?.nombre.toLowerCase()}</p>
          <div className="tarjeta">
            {campos.map((campo) => (
              <CampoDinamico
                key={campo.clave}
                campo={campo}
                valor={datos[campo.clave] ?? ''}
                datos={datos}
                error={mostrarErrores ? errores[campo.clave] : undefined}
                onCambio={(valor) => setDatos((previos) => ({ ...previos, [campo.clave]: valor }))}
              />
            ))}
          </div>
        </>
      ) : null}

      <p className="seccion">
        {paso++}. {fotoObligatoria ? 'Foto (obligatoria) y descripción' : 'Opcional: descripción y foto'}
      </p>
      <textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        className="campo campo--area"
        placeholder="Describe brevemente lo que ves (opcional)"
      />

      {fotoPendiente && !fotoLista ? (
        <RedactorFoto
          key={`${fotoPendiente.length}-${requiereRostro}`}
          uriOriginal={fotoPendiente}
          requiereRostro={requiereRostro}
          onConfirmar={(foto, analisis) => {
            setFotoLista(foto);
            setAnalisisFoto(analisis);
          }}
          onCancelar={quitarFoto}
        />
      ) : fotoLista ? (
        <div className="pila pila--6">
          {vistaPrevia ? <img src={vistaPrevia} alt="Foto adjunta" className="foto-preview" /> : null}
          <Boton variante="enlace" className="alinear-inicio" onClick={quitarFoto}>
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

      {exigeDeclaracion ? (
        <label className="declaracion">
          <input
            type="checkbox"
            checked={aceptaDeclaracion}
            onChange={(e) => setAceptaDeclaracion(e.target.checked)}
          />
          <span>
            Declaro que la información es verdadera. Sé que un reporte falso de persona desaparecida puede tener
            sanciones legales.
          </span>
        </label>
      ) : null}

      <Boton className="mt-8" onClick={() => void enviar()} disabled={enviando} cargando={enviando}>
        Enviar reporte
      </Boton>

      <p className="nota">
        Tu identidad nunca se muestra a otros usuarios. La ubicación pública se difumina ~100 m hasta que el
        reporte se valide.
      </p>
    </div>
  );
}
