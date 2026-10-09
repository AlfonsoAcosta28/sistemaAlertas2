import { useQuery } from '@tanstack/react-query';

import { useSesion } from '@/src/hooks/use-sesion';
import { obtenerPerfilPropio } from '@/src/services/perfil';

export function usePerfil() {
  const { usuario } = useSesion();

  return useQuery({
    queryKey: ['perfil', usuario?.id],
    queryFn: obtenerPerfilPropio,
    enabled: Boolean(usuario),
  });
}

/**
 * Roles del documento:
 *  - ciudadano (usuario normal): reporta, tiene reputación y recibe alertas.
 *  - gubernamental: valida reportes como VERDAD / MENTIRA (los de su institución).
 *  - administrador: además gestiona categorías, instituciones y usuarios.
 */
export function useRol() {
  const perfilQuery = usePerfil();
  const rol = perfilQuery.data?.rol;
  const esAdministrador = rol === 'administrador';
  const esGubernamental = rol === 'gubernamental' || rol === 'moderador';

  return {
    rol,
    esAdministrador,
    esGubernamental,
    puedeValidar: esAdministrador || esGubernamental,
    institucionId: perfilQuery.data?.institucion_id ?? null,
    cargando: perfilQuery.isLoading,
  };
}

/** Compatibilidad con pantallas existentes. */
export function useEsModerador() {
  const { puedeValidar, cargando } = useRol();
  return { esModerador: puedeValidar, cargando };
}
