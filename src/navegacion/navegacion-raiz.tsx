import { App as AppNativa } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';

import { useRegistroPush } from '@/src/hooks/use-registro-push';
import { useSesion } from '@/src/hooks/use-sesion';
import { AdminLayout } from '@/src/navegacion/admin-layout';
import { AuthLayout } from '@/src/navegacion/auth-layout';
import { OnboardingLayout } from '@/src/navegacion/onboarding-layout';
import { TabsLayout } from '@/src/navegacion/tabs-layout';
import { HistorialModeracionScreen } from '@/src/pantallas/admin/historial';
import { ModeracionScreen } from '@/src/pantallas/admin/moderacion';
import { LoginScreen } from '@/src/pantallas/auth/login';
import { RegistroScreen } from '@/src/pantallas/auth/registro';
import { PreferenciasInicialesScreen } from '@/src/pantallas/onboarding/preferencias-iniciales';
import { AjustesScreen } from '@/src/pantallas/tabs/ajustes';
import { CrearReporteScreen } from '@/src/pantallas/tabs/crear-reporte';
import { InicioScreen } from '@/src/pantallas/tabs/inicio';
import { MapaScreen } from '@/src/pantallas/tabs/mapa';
import { MisReportesScreen } from '@/src/pantallas/tabs/mis-reportes';
import { registrarTareaActualizarCelda } from '@/src/tasks/ubicacion-background-task';
import { Cargando } from '@/src/ui/controles';
import { esNativo } from '@/src/utils/entorno';

const RUTAS_RAIZ = new Set(['/', '/login', '/onboarding']);

/** Botón "atrás" físico de Android: retrocede, o sale de la app en pantallas raíz. */
function useBotonAtrasAndroid() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!esNativo) return;
    const suscripcion = AppNativa.addListener('backButton', ({ canGoBack }) => {
      if (RUTAS_RAIZ.has(pathname) || !canGoBack) {
        void AppNativa.exitApp();
      } else {
        navigate(-1);
      }
    });
    return () => {
      void suscripcion.then((s) => s.remove());
    };
  }, [navigate, pathname]);
}

export function NavegacionRaiz() {
  const { cargando } = useSesion();
  useRegistroPush();
  useBotonAtrasAndroid();

  useEffect(() => {
    // Reanuda la ubicación en segundo plano si el usuario ya la había activado.
    void registrarTareaActualizarCelda();
  }, []);

  useEffect(() => {
    if (!cargando && esNativo) {
      void SplashScreen.hide();
    }
  }, [cargando]);

  if (cargando) {
    return (
      <div className="pantalla-carga">
        <Cargando claro />
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/registro" element={<RegistroScreen />} />
      </Route>

      <Route element={<OnboardingLayout />}>
        <Route path="/onboarding" element={<PreferenciasInicialesScreen />} />
      </Route>

      <Route element={<TabsLayout />}>
        <Route index element={<InicioScreen />} />
        <Route path="/mapa" element={<MapaScreen />} />
        <Route path="/crear-reporte" element={<CrearReporteScreen />} />
        <Route path="/mis-reportes" element={<MisReportesScreen />} />
        <Route path="/ajustes" element={<AjustesScreen />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<ModeracionScreen />} />
        <Route path="historial" element={<HistorialModeracionScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
