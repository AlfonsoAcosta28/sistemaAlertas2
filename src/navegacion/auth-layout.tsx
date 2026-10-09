import { Navigate, Outlet } from 'react-router';

import { useSesion } from '@/src/hooks/use-sesion';

export function AuthLayout() {
  const { sesion } = useSesion();

  if (sesion) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
