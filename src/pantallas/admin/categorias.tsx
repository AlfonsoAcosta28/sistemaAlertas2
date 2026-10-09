import { useState } from 'react';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { claveDesdeEtiqueta, normalizarCampos } from '@/src/domain/formulario';
import { CLAVES_ICONOS, ICONOS_ALERTA, rutaIconoAlerta } from '@/src/domain/iconos-alerta';
import {
  useCategoriaInstituciones,
  useGuardarCategoria,
  useInstituciones,
  useReglasCategorias,
  useTodasLasCategorias,
} from '@/src/hooks/use-admin';
import type { DatosCategoria } from '@/src/services/admin';
import type { CampoFormulario, Database, Severidad, TipoCampo } from '@/src/types/database';
import { Boton, Cargando, Interruptor } from '@/src/ui/controles';
import { alerta } from '@/src/ui/dialogos';

type Categoria = Database['public']['Tables']['categorias']['Row'];

const TIPOS_CAMPO: { valor: TipoCampo; etiqueta: string }[] = [
  { valor: 'texto', etiqueta: 'Texto corto' },
  { valor: 'texto_largo', etiqueta: 'Texto largo' },
  { valor: 'numero', etiqueta: 'Número' },
  { valor: 'opciones', etiqueta: 'Opciones' },
];

const SEVERIDADES: Severidad[] = ['baja', 'media', 'alta'];

function categoriaVacia(): DatosCategoria {
  return {
    nombre: '',
    descripcion: '',
    activa: true,
    color: '#64748B',
    icono: 'alert',
    severidad_default: 'media',
    radio_inicial_metros: 500,
    radio_maximo_metros: 500,
    vigencia_default_minutos: 180,
    umbral_confirmaciones: 2,
    ventana_minutos: 30,
    requiere_moderacion_obligatoria: false,
    requiere_foto: false,
    foto_requiere_rostro: false,
    campos_formulario: [],
    instituciones: [],
  };
}

function CampoNumero({
  etiqueta,
  valor,
  onCambio,
  ayuda,
}: {
  etiqueta: string;
  valor: number;
  onCambio: (v: number) => void;
  ayuda?: string;
}) {
  return (
    <label className="pila pila--6">
      <span className="etiqueta-campo">{etiqueta}</span>
      <input
        type="number"
        inputMode="numeric"
        className="campo campo--claro"
        value={Number.isFinite(valor) ? valor : ''}
        onChange={(e) => onCambio(Number.parseInt(e.target.value, 10))}
      />
      {ayuda ? <span className="nota">{ayuda}</span> : null}
    </label>
  );
}

function FilaInterruptor({ etiqueta, valor, onCambio }: { etiqueta: string; valor: boolean; onCambio: (v: boolean) => void }) {
  return (
    <div className="fila-switch">
      <span>{etiqueta}</span>
      <Interruptor valor={valor} onCambio={onCambio} etiqueta={etiqueta} />
    </div>
  );
}

/** Editor de un campo del formulario de reporte. */
function EditorCampo({
  campo,
  otros,
  onCambio,
  onQuitar,
}: {
  campo: CampoFormulario;
  otros: CampoFormulario[];
  onCambio: (c: CampoFormulario) => void;
  onQuitar: () => void;
}) {
  return (
    <div className="tarjeta tarjeta--compacta editor-campo">
      <input
        className="campo campo--claro"
        placeholder="Etiqueta (ej. Placas)"
        value={campo.etiqueta}
        onChange={(e) =>
          onCambio({ ...campo, etiqueta: e.target.value, clave: campo.clave || claveDesdeEtiqueta(e.target.value) })
        }
      />
      <div className="fila fila--8">
        <select
          className="campo campo--claro"
          value={campo.tipo}
          onChange={(e) => onCambio({ ...campo, tipo: e.target.value as TipoCampo })}>
          {TIPOS_CAMPO.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>
        <select
          className="campo campo--claro"
          value={campo.requerido ? '__siempre' : (campo.requerido_si_vacio ?? '')}
          onChange={(e) => {
            const { requerido: _r, requerido_si_vacio: _s, ...resto } = campo;
            const v = e.target.value;
            onCambio(v === '__siempre' ? { ...resto, requerido: true } : v ? { ...resto, requerido_si_vacio: v } : resto);
          }}>
          <option value="">Opcional</option>
          <option value="__siempre">Obligatorio</option>
          {otros
            .filter((o) => o.clave && o.clave !== campo.clave)
            .map((o) => (
              <option key={o.clave} value={o.clave}>
                Si «{o.etiqueta}» está vacío
              </option>
            ))}
        </select>
      </div>
      {campo.tipo === 'opciones' ? (
        <input
          className="campo campo--claro"
          placeholder="Opciones separadas por coma (ej. Automóvil, Moto)"
          value={(campo.opciones ?? []).join(', ')}
          onChange={(e) =>
            onCambio({
              ...campo,
              opciones: e.target.value.split(',').map((o) => o.trimStart()),
            })
          }
        />
      ) : null}
      <input
        className="campo campo--claro"
        placeholder="Texto de ayuda (opcional)"
        value={campo.ayuda ?? ''}
        onChange={(e) => {
          const { ayuda: _a, ...resto } = campo;
          onCambio(e.target.value ? { ...resto, ayuda: e.target.value } : resto);
        }}
      />
      <div className="fila fila--entre alinear-centro">
        <label className="fila fila--8 alinear-centro texto-13">
          <input
            type="checkbox"
            checked={Boolean(campo.mayusculas)}
            onChange={(e) => {
              const { mayusculas: _m, ...resto } = campo;
              onCambio(e.target.checked ? { ...resto, mayusculas: true } : resto);
            }}
          />
          Guardar en MAYÚSCULAS
        </label>
        <button type="button" className="boton-texto-peligro" onClick={onQuitar}>
          Quitar campo
        </button>
      </div>
      <span className="nota">Clave interna: {campo.clave || '—'}</span>
    </div>
  );
}

function EditorCategoria({
  id,
  inicial,
  onCerrar,
}: {
  id: string | null;
  inicial: DatosCategoria;
  onCerrar: () => void;
}) {
  const [datos, setDatos] = useState<DatosCategoria>(inicial);
  const institucionesQuery = useInstituciones();
  const guardar = useGuardarCategoria();

  function cambiar<K extends keyof DatosCategoria>(clave: K, valor: DatosCategoria[K]) {
    setDatos((previos) => ({ ...previos, [clave]: valor }));
  }

  function cambiarCampo(indice: number, campo: CampoFormulario) {
    cambiar(
      'campos_formulario',
      datos.campos_formulario.map((c, i) => (i === indice ? campo : c)),
    );
  }

  async function enviar() {
    const campos = datos.campos_formulario.map((c) => ({
      ...c,
      clave: c.clave || claveDesdeEtiqueta(c.etiqueta),
      ...(c.opciones ? { opciones: c.opciones.map((o) => o.trim()).filter(Boolean) } : {}),
    }));
    const claves = campos.map((c) => c.clave);
    if (campos.some((c) => !c.clave || !c.etiqueta.trim()) || new Set(claves).size !== claves.length) {
      await alerta('Revisa los campos', 'Cada campo necesita una etiqueta distinta.');
      return;
    }
    await guardar.mutateAsync({ id, datos: { ...datos, campos_formulario: campos } });
    onCerrar();
  }

  return (
    <section className="tarjeta editor-categoria">
      <p className="etiqueta">{id ? `Editar: ${inicial.nombre}` : 'Nueva categoría'}</p>

      <label className="pila pila--6">
        <span className="etiqueta-campo">Nombre</span>
        <input className="campo campo--claro" value={datos.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
      </label>
      <label className="pila pila--6">
        <span className="etiqueta-campo">Descripción</span>
        <input
          className="campo campo--claro"
          value={datos.descripcion}
          onChange={(e) => cambiar('descripcion', e.target.value)}
        />
      </label>

      <FilaInterruptor etiqueta="Activa (visible para reportar)" valor={datos.activa} onCambio={(v) => cambiar('activa', v)} />

      <span className="etiqueta-campo">Ícono en el mapa</span>
      <div className="rejilla">
        {CLAVES_ICONOS.map((clave) => (
          <button
            type="button"
            key={clave}
            title={ICONOS_ALERTA[clave]}
            aria-label={ICONOS_ALERTA[clave]}
            aria-pressed={datos.icono === clave}
            className={`selector-icono${datos.icono === clave ? ' selector-icono--activo' : ''}`}
            onClick={() => cambiar('icono', clave)}>
            <img src={rutaIconoAlerta(clave)} alt="" />
          </button>
        ))}
      </div>

      <label className="fila fila--8 alinear-centro">
        <span className="etiqueta-campo">Color</span>
        <input type="color" value={datos.color} onChange={(e) => cambiar('color', e.target.value)} />
      </label>
      <div className="rejilla">
        {SEVERIDADES.map((s) => (
          <button
            type="button"
            key={s}
            className={`chip chip--chico${datos.severidad_default === s ? ' chip--activo' : ''}`}
            onClick={() => cambiar('severidad_default', s)}>
            Gravedad {s}
          </button>
        ))}
      </div>

      <div className="rejilla-2">
        <CampoNumero
          etiqueta="Radio (m)"
          valor={datos.radio_inicial_metros}
          onCambio={(v) => cambiar('radio_inicial_metros', v)}
          ayuda="La pregunta «¿lo ves?» llega a la mitad."
        />
        <CampoNumero
          etiqueta="Radio máximo (m)"
          valor={datos.radio_maximo_metros}
          onCambio={(v) => cambiar('radio_maximo_metros', v)}
          ayuda="Igual al radio si no debe crecer."
        />
        <CampoNumero
          etiqueta="Credibilidad (personas)"
          valor={datos.umbral_confirmaciones}
          onCambio={(v) => cambiar('umbral_confirmaciones', v)}
          ayuda="Contando el reporte original."
        />
        <CampoNumero
          etiqueta="Ventana (min)"
          valor={datos.ventana_minutos}
          onCambio={(v) => cambiar('ventana_minutos', v)}
          ayuda="Para juntar reportes iguales."
        />
        <CampoNumero
          etiqueta="Vigencia (min)"
          valor={datos.vigencia_default_minutos}
          onCambio={(v) => cambiar('vigencia_default_minutos', v)}
        />
      </div>

      <FilaInterruptor
        etiqueta="Datos sensibles: solo se muestran completos al validarse"
        valor={datos.requiere_moderacion_obligatoria}
        onCambio={(v) => cambiar('requiere_moderacion_obligatoria', v)}
      />
      <FilaInterruptor etiqueta="Foto obligatoria" valor={datos.requiere_foto} onCambio={(v) => cambiar('requiere_foto', v)} />
      <FilaInterruptor
        etiqueta="La foto debe mostrar un rostro"
        valor={datos.foto_requiere_rostro}
        onCambio={(v) => cambiar('foto_requiere_rostro', v)}
      />

      <span className="etiqueta-campo">Se envía a</span>
      <div className="rejilla">
        {institucionesQuery.data?.map((inst) => {
          const activa = datos.instituciones.includes(inst.id);
          return (
            <button
              type="button"
              key={inst.id}
              className={`chip chip--chico${activa ? ' chip--activo' : ''}`}
              onClick={() =>
                cambiar(
                  'instituciones',
                  activa ? datos.instituciones.filter((i) => i !== inst.id) : [...datos.instituciones, inst.id],
                )
              }>
              {inst.nombre}
            </button>
          );
        })}
      </div>

      <span className="etiqueta-campo">Campos del formulario de reporte</span>
      {datos.campos_formulario.map((campo, i) => (
        <EditorCampo
          key={i}
          campo={campo}
          otros={datos.campos_formulario}
          onCambio={(c) => cambiarCampo(i, c)}
          onQuitar={() =>
            cambiar(
              'campos_formulario',
              datos.campos_formulario.filter((_, j) => j !== i),
            )
          }
        />
      ))}
      <Boton
        variante="contorno"
        onClick={() =>
          cambiar('campos_formulario', [...datos.campos_formulario, { clave: '', etiqueta: '', tipo: 'texto' }])
        }>
        + Agregar campo
      </Boton>

      {guardar.error ? <MensajeConfiguracion error={guardar.error} /> : null}

      <div className="fila fila--8">
        <Boton variante="gris" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton onClick={() => void enviar()} cargando={guardar.isPending} disabled={guardar.isPending || !datos.nombre.trim()}>
          Guardar
        </Boton>
      </div>
    </section>
  );
}

/** Administrador: alta y edición de categorías con todas sus variables. */
export function CategoriasAdminScreen() {
  const categoriasQuery = useTodasLasCategorias();
  const reglasQuery = useReglasCategorias();
  const instCategoriaQuery = useCategoriaInstituciones();
  const [editando, setEditando] = useState<{ id: string | null; datos: DatosCategoria } | null>(null);

  function abrir(categoria: Categoria) {
    const regla = reglasQuery.data?.get(categoria.id);
    setEditando({
      id: categoria.id,
      datos: {
        nombre: categoria.nombre,
        descripcion: categoria.descripcion ?? '',
        activa: categoria.activa,
        color: categoria.color ?? '#64748B',
        icono: categoria.icono ?? 'alert',
        severidad_default: categoria.severidad_default,
        radio_inicial_metros: categoria.radio_inicial_metros,
        radio_maximo_metros: categoria.radio_maximo_metros,
        vigencia_default_minutos: categoria.vigencia_default_minutos,
        umbral_confirmaciones: regla?.umbral_confirmaciones ?? 2,
        ventana_minutos: regla?.ventana_minutos ?? 30,
        requiere_moderacion_obligatoria: categoria.requiere_moderacion_obligatoria,
        requiere_foto: categoria.requiere_foto,
        foto_requiere_rostro: categoria.foto_requiere_rostro,
        campos_formulario: normalizarCampos(categoria.campos_formulario),
        instituciones: instCategoriaQuery.data?.get(categoria.id) ?? [],
      },
    });
  }

  if (editando) {
    return (
      <div className="pantalla pantalla--12 pantalla--16">
        <EditorCategoria
          key={editando.id ?? 'nueva'}
          id={editando.id}
          inicial={editando.datos}
          onCerrar={() => setEditando(null)}
        />
      </div>
    );
  }

  return (
    <div className="pantalla pantalla--12 pantalla--16">
      <div className="fila fila--entre alinear-centro">
        <h2 className="titulo titulo--22">Categorías</h2>
        <Boton variante="secundario" className="boton--auto" onClick={() => setEditando({ id: null, datos: categoriaVacia() })}>
          + Nueva
        </Boton>
      </div>

      {categoriasQuery.error ? <MensajeConfiguracion error={categoriasQuery.error} /> : null}
      {categoriasQuery.isLoading ? <Cargando /> : null}

      {categoriasQuery.data?.map((c) => {
        const regla = reglasQuery.data?.get(c.id);
        return (
          <button type="button" key={c.id} className="tarjeta tarjeta--compacta fila-admin" onClick={() => abrir(c)}>
            <img src={rutaIconoAlerta(c.icono)} alt="" className="icono-categoria" />
            <span className="pila">
              <span className="negrita">
                {c.nombre} {c.activa ? null : <span className="texto-tenue">(desactivada)</span>}
              </span>
              <span className="texto-pequeno texto-secundario">
                Radio {c.radio_inicial_metros} m
                {c.radio_maximo_metros !== c.radio_inicial_metros ? `–${c.radio_maximo_metros} m` : ''} · credibilidad{' '}
                {regla?.umbral_confirmaciones ?? '?'} · {normalizarCampos(c.campos_formulario).length} campo(s)
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
