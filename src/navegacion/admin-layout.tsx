import { Navigate, NavLink, Outlet, useNavigate } from 'react-router';

import { useRol } from '@/src/hooks/use-perfil';
import { useSesion } from '@/src/hooks/use-sesion';
import { Cargando } from '@/src/ui/controles';
import { IconoAtras } from '@/src/ui/iconos';

const SECCIONES = [
  { ruta: '/admin', titulo: 'Validación', soloAdmin: false },
  { ruta: '/admin/categorias', titulo: 'Categorías', soloAdmin: true },
  { ruta: '/admin/instituciones', titulo: 'Instituciones', soloAdmin: true },
  { ruta: '/admin/usuarios', titulo: 'Usuarios', soloAdmin: true },
  { ruta: '/admin/historial', titulo: 'Historial', soloAdmin: false },
] as const;

/**
 * Panel para los roles Gubernamental (validar reportes) y Administrador
 * (además: categorías, instituciones y usuarios).
 */
export function AdminLayout() {
  const { sesion } = useSesion();
  const { puedeValidar, esAdministrador, cargando } = useRol();
  const navigate = useNavigate();

  if (!sesion) {
    return <Navigate to="/login" replace />;
  }

  if (cargando) {
    return (
      <div className="centrado">
        <Cargando />
      </div>
    );
  }

  if (!puedeValidar) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="marco-admin">
      <header className="encabezado">
        <button
          type="button"
          className="encabezado__atras"
          aria-label="Volver"
          onClick={() => navigate('/', { replace: true })}>
          <IconoAtras />
        </button>
        <h1 className="encabezado__titulo">{esAdministrador ? 'Administración' : 'Panel gubernamental'}</h1>
      </header>
      <nav className="pestanas-admin" aria-label="Secciones del panel">
        {SECCIONES.filter((s) => esAdministrador || !s.soloAdmin).map((s) => (
          <NavLink
            key={s.ruta}
            to={s.ruta}
            end
            replace
            className={({ isActive }) => `pestanas-admin__item${isActive ? ' pestanas-admin__item--activo' : ''}`}>
            {s.titulo}
          </NavLink>
        ))}
      </nav>
      <main className="marco-admin__contenido">
        <Outlet />
      </main>
    </div>
  );
}

/** Envuelve las rutas que solo puede abrir el Administrador. */
export function SoloAdministrador({ children }: { children: React.ReactNode }) {
  const { esAdministrador, cargando } = useRol();
  if (cargando) return <Cargando />;
  return esAdministrador ? <>{children}</> : <Navigate to="/admin" replace />;
}
