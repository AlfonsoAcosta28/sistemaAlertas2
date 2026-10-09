import { useState } from 'react';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { useGuardarInstitucion, useInstituciones } from '@/src/hooks/use-admin';
import type { DatosInstitucion, Institucion } from '@/src/services/admin';
import { Boton, Interruptor } from '@/src/ui/controles';

const TIPOS = [
  'bomberos',
  'policia',
  'proteccion_civil',
  'busqueda',
  'fiscalia',
  'transito',
  'emergencias',
  'otra',
];

function vacia(): DatosInstitucion {
  return { nombre: '', tipo: 'otra', telefono: null, correo: null, webhook_url: null, activa: true };
}

function EditorInstitucion({ id, inicial, onCerrar }: { id: string | null; inicial: DatosInstitucion; onCerrar: () => void }) {
  const [datos, setDatos] = useState(inicial);
  const guardar = useGuardarInstitucion();
  const texto = (clave: 'telefono' | 'correo' | 'webhook_url', valor: string) =>
    setDatos((d) => ({ ...d, [clave]: valor.trim() ? valor : null }));

  return (
    <section className="tarjeta">
      <p className="etiqueta">{id ? `Editar: ${inicial.nombre}` : 'Nueva institución'}</p>
      <input
        className="campo campo--claro"
        placeholder="Nombre"
        value={datos.nombre}
        onChange={(e) => setDatos((d) => ({ ...d, nombre: e.target.value }))}
      />
      <select className="campo campo--claro" value={datos.tipo} onChange={(e) => setDatos((d) => ({ ...d, tipo: e.target.value }))}>
        {TIPOS.map((t) => (
          <option key={t} value={t}>
            {t.replace('_', ' ')}
          </option>
        ))}
      </select>
      <input
        className="campo campo--claro"
        placeholder="Teléfono"
        inputMode="tel"
        value={datos.telefono ?? ''}
        onChange={(e) => texto('telefono', e.target.value)}
      />
      <input
        className="campo campo--claro"
        placeholder="Correo"
        inputMode="email"
        value={datos.correo ?? ''}
        onChange={(e) => texto('correo', e.target.value)}
      />
      <input
        className="campo campo--claro"
        placeholder="Webhook (https://…) — opcional"
        inputMode="url"
        value={datos.webhook_url ?? ''}
        onChange={(e) => texto('webhook_url', e.target.value)}
      />
      <p className="nota">
        Si pones un webhook, cada reporte pre-validado se envía ahí en formato JSON (además de aparecer en el panel
        de sus usuarios gubernamentales).
      </p>
      <div className="fila-switch">
        <span>Activa</span>
        <Interruptor valor={datos.activa} onCambio={(v) => setDatos((d) => ({ ...d, activa: v }))} etiqueta="Activa" />
      </div>
      {guardar.error ? <MensajeConfiguracion error={guardar.error} /> : null}
      <div className="fila fila--8">
        <Boton variante="gris" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton
          cargando={guardar.isPending}
          disabled={guardar.isPending || !datos.nombre.trim()}
          onClick={() => guardar.mutate({ id, datos: { ...datos, nombre: datos.nombre.trim() } }, { onSuccess: onCerrar })}>
          Guardar
        </Boton>
      </div>
    </section>
  );
}

/** Administrador: instituciones a las que se mandan los reportes. */
export function InstitucionesAdminScreen() {
  const institucionesQuery = useInstituciones();
  const [editando, setEditando] = useState<{ id: string | null; datos: DatosInstitucion } | null>(null);

  function abrir(i: Institucion) {
    setEditando({
      id: i.id,
      datos: { nombre: i.nombre, tipo: i.tipo, telefono: i.telefono, correo: i.correo, webhook_url: i.webhook_url, activa: i.activa },
    });
  }

  return (
    <div className="pantalla pantalla--12 pantalla--16">
      <div className="fila fila--entre alinear-centro">
        <h2 className="titulo titulo--22">Instituciones</h2>
        {!editando ? (
          <Boton variante="secundario" className="boton--auto" onClick={() => setEditando({ id: null, datos: vacia() })}>
            + Nueva
          </Boton>
        ) : null}
      </div>

      {editando ? (
        <EditorInstitucion
          key={editando.id ?? 'nueva'}
          id={editando.id}
          inicial={editando.datos}
          onCerrar={() => setEditando(null)}
        />
      ) : null}

      {institucionesQuery.error ? <MensajeConfiguracion error={institucionesQuery.error} /> : null}

      {!editando
        ? institucionesQuery.data?.map((i) => (
            <button type="button" key={i.id} className="tarjeta tarjeta--compacta fila-admin" onClick={() => abrir(i)}>
              <span className="pila">
                <span className="negrita">
                  {i.nombre} {i.activa ? null : <span className="texto-tenue">(inactiva)</span>}
                </span>
                <span className="texto-pequeno texto-secundario">
                  {i.tipo.replace('_', ' ')}
                  {i.telefono ? ` · ${i.telefono}` : ''}
                  {i.webhook_url ? ' · webhook configurado' : ''}
                </span>
              </span>
            </button>
          ))
        : null}
    </div>
  );
}
