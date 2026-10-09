import { Navigate, NavLink, Outlet, useLocation } from 'react-router';

import { usePerfil } from '@/src/hooks/use-perfil';
import { useSesion } from '@/src/hooks/use-sesion';
import {
  IconoAjustes,
  IconoDocumento,
  IconoInicio,
  IconoMapa,
  IconoReportar,
} from '@/src/ui/iconos';

const PESTANAS = [
  { ruta: '/', titulo: 'Inicio', Icono: IconoInicio },
  { ruta: '/mapa', titulo: 'Mapa', Icono: IconoMapa },
  { ruta: '/crear-reporte', titulo: 'Reportar', Icono: IconoReportar },
  { ruta: '/mis-reportes', titulo: 'Mis reportes', Icono: IconoDocumento },
  { ruta: '/ajustes', titulo: 'Ajustes', Icono: IconoAjustes },
] as const;

export function TabsLayout() {
  const { sesion } = useSesion();
  const perfilQuery = usePerfil();
  const { pathname } = useLocation();

  if (!sesion) {
    return <Navigate to="/login" replace />;
  }

  if (perfilQuery.data && !perfilQuery.data.onboarding_completado) {
    return <Navigate to="/onboarding" replace />;
  }

  const titulo = PESTANAS.find((p) => p.ruta === pathname)?.titulo ?? 'ALERTA CERCA';

  return (
    <div className="marco-tabs">
      <header className="encabezado">
        <h1 className="encabezado__titulo">{titulo}</h1>
      </header>

      <main className="marco-tabs__contenido">
        <Outlet />
      </main>

      <nav className="barra-tabs" aria-label="Navegación principal">
        {PESTANAS.map(({ ruta, titulo: etiqueta, Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            end
            replace
            className={({ isActive }) => `barra-tabs__item${isActive ? ' barra-tabs__item--activo' : ''}`}>
            {({ isActive }) => (
              <>
                <Icono activo={isActive} />
                <span>{etiqueta}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
