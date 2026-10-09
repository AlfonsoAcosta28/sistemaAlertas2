import { Navigate, Outlet } from 'react-router';

import { usePerfil } from '@/src/hooks/use-perfil';
import { useSesion } from '@/src/hooks/use-sesion';

export function OnboardingLayout() {
  const { sesion } = useSesion();
  const perfilQuery = usePerfil();

  if (!sesion) {
    return <Navigate to="/login" replace />;
  }

  if (perfilQuery.data?.onboarding_completado) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
