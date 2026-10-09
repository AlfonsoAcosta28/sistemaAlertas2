import { useEffect, useState } from 'react';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { nivelReputacion } from '@/src/domain/reputacion';
import {
  useCambiarRol,
  useEliminarUsuario,
  useInstituciones,
  useSuspenderUsuario,
  useUsuariosAdmin,
} from '@/src/hooks/use-admin';
import { useSesion } from '@/src/hooks/use-sesion';
import type { RolUsuario, UsuarioAdmin } from '@/src/types/database';
import { Boton, Cargando } from '@/src/ui/controles';
import { confirmar } from '@/src/ui/dialogos';

const ROLES: { valor: RolUsuario; etiqueta: string }[] = [
  { valor: 'ciudadano', etiqueta: 'Usuario normal' },
  { valor: 'gubernamental', etiqueta: 'Gubernamental' },
  { valor: 'administrador', etiqueta: 'Administrador' },
];

function FilaUsuario({ usuario, esYo }: { usuario: UsuarioAdmin; esYo: boolean }) {
  const institucionesQuery = useInstituciones();
  const cambiarRol = useCambiarRol();
  const suspender = useSuspenderUsuario();
  const eliminar = useEliminarUsuario();
  const [rol, setRol] = useState<RolUsuario>(usuario.rol === 'moderador' ? 'gubernamental' : usuario.rol);
  const [institucionId, setInstitucionId] = useState<string>(usuario.institucion_id ?? '');

  const suspendido = usuario.suspendido_hasta && new Date(usuario.suspendido_hasta) > new Date();
  const cambio = rol !== usuario.rol || (rol === 'gubernamental' && (institucionId || null) !== usuario.institucion_id);
  const error = cambiarRol.error ?? suspender.error ?? eliminar.error;

  async function quitarUsuario() {
    const ok = await confirmar(
      'Eliminar usuario',
      `Se borrará la cuenta de ${usuario.email ?? usuario.telefono ?? 'este usuario'} y sus datos. Sus reportes quedan anónimos. Esta acción no se puede deshacer.`,
      'Eliminar',
    );
    if (ok) eliminar.mutate(usuario.id);
  }

  return (
    <article className="tarjeta tarjeta--compacta">
      <p className="negrita">
        {usuario.email ?? usuario.telefono ?? usuario.id.slice(0, 8)} {esYo ? <span className="texto-tenue">(tú)</span> : null}
      </p>
      <p className="texto-pequeno texto-secundario">
        Reputación {usuario.reputacion} ({nivelReputacion(usuario.reputacion)}) · {usuario.reportes_confirmados_contador}{' '}
        verdaderos / {usuario.reportes_descartados_contador} falsos
        {suspendido ? ` · suspendido hasta ${new Date(usuario.suspendido_hasta ?? '').toLocaleDateString('es-MX')}` : ''}
      </p>

      {!esYo ? (
        <>
          <div className="fila fila--8">
            <select className="campo campo--claro" value={rol} onChange={(e) => setRol(e.target.value as RolUsuario)}>
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
            {rol === 'gubernamental' ? (
              <select className="campo campo--claro" value={institucionId} onChange={(e) => setInstitucionId(e.target.value)}>
                <option value="">Todas (sin institución)</option>
                {institucionesQuery.data?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          {cambio ? (
            <Boton
              variante="secundario"
              cargando={cambiarRol.isPending}
              onClick={() => cambiarRol.mutate({ usuarioId: usuario.id, rol, institucionId: institucionId || null })}>
              Guardar rol
            </Boton>
          ) : null}
          <div className="fila fila--8">
            <Boton
              variante="gris"
              disabled={suspender.isPending}
              onClick={() => suspender.mutate({ usuarioId: usuario.id, dias: suspendido ? 0 : 7 })}>
              {suspendido ? 'Quitar suspensión' : 'Suspender 7 días'}
            </Boton>
            <Boton variante="peligro" disabled={eliminar.isPending} cargando={eliminar.isPending} onClick={() => void quitarUsuario()}>
              Eliminar
            </Boton>
          </div>
        </>
      ) : null}

      {error ? <MensajeConfiguracion error={error} /> : null}
    </article>
  );
}

/** Administrador: buscar usuarios, cambiar su rol, suspenderlos o quitarlos. */
export function UsuariosAdminScreen() {
  const { usuario } = useSesion();
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const usuariosQuery = useUsuariosAdmin(busqueda);

  useEffect(() => {
    const t = window.setTimeout(() => setBusqueda(texto), 400);
    return () => window.clearTimeout(t);
  }, [texto]);

  return (
    <div className="pantalla pantalla--12 pantalla--16">
      <h2 className="titulo titulo--22">Usuarios</h2>
      <input
        className="campo campo--claro"
        placeholder="Buscar por correo o teléfono"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      {usuariosQuery.error ? <MensajeConfiguracion error={usuariosQuery.error} /> : null}
      {usuariosQuery.isLoading ? <Cargando /> : null}
      {usuariosQuery.data?.map((u) => (
        <FilaUsuario key={u.id} usuario={u} esYo={u.id === usuario?.id} />
      ))}
      {usuariosQuery.data && usuariosQuery.data.length === 0 ? (
        <p className="texto-tenue">No hay usuarios que coincidan.</p>
      ) : null}
    </div>
  );
}
