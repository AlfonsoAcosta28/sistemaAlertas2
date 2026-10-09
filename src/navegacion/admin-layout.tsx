import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';

import { useEsModerador } from '@/src/hooks/use-perfil';
import { useSesion } from '@/src/hooks/use-sesion';
import { Cargando } from '@/src/ui/controles';
import { IconoAtras } from '@/src/ui/iconos';

export function AdminLayout() {
  const { sesion } = useSesion();
  const { esModerador, cargando } = useEsModerador();
  const navigate = useNavigate();
  const { pathname } = useLocation();

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

  if (!esModerador) {
    return <Navigate to="/" replace />;
  }

  const enHistorial = pathname.endsWith('/historial');

  return (
    <div className="marco-admin">
      <header className="encabezado">
        <button
          type="button"
          className="encabezado__atras"
          aria-label="Volver"
          onClick={() => (enHistorial ? navigate('/admin') : navigate('/', { replace: true }))}>
          <IconoAtras />
        </button>
        <h1 className="encabezado__titulo">{enHistorial ? 'Historial' : 'Moderación'}</h1>
      </header>
      <main className="marco-admin__contenido">
        <Outlet />
      </main>
    </div>
  );
}
