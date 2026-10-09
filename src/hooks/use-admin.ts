import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cambiarRolUsuario,
  eliminarUsuario,
  agregarPalabraProhibida,
  guardarCategoria,
  guardarInstitucion,
  listarCategoriaInstituciones,
  listarInstituciones,
  listarMisMovimientosReputacion,
  listarPalabrasProhibidas,
  listarReglasCategorias,
  listarTodasLasCategorias,
  listarUsuarios,
  obtenerDetalleReporte,
  quitarPalabraProhibida,
  suspenderUsuario,
  type DatosCategoria,
  type DatosInstitucion,
} from '@/src/services/admin';
import type { RolUsuario } from '@/src/types/database';

export function useReglasCategorias() {
  return useQuery({ queryKey: ['categorias', 'reglas'], queryFn: listarReglasCategorias });
}

export function useInstituciones() {
  return useQuery({ queryKey: ['instituciones'], queryFn: listarInstituciones });
}

export function useCategoriaInstituciones() {
  return useQuery({ queryKey: ['categorias', 'instituciones'], queryFn: listarCategoriaInstituciones });
}

export function useMisMovimientosReputacion() {
  return useQuery({ queryKey: ['reputacion', 'movimientos'], queryFn: listarMisMovimientosReputacion });
}

export function useTodasLasCategorias() {
  return useQuery({ queryKey: ['categorias', 'todas'], queryFn: listarTodasLasCategorias });
}

export function useGuardarCategoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: string | null; datos: DatosCategoria }) => guardarCategoria(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categorias'] }),
  });
}

export function useGuardarInstitucion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: string | null; datos: DatosInstitucion }) => guardarInstitucion(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instituciones'] }),
  });
}

export function useUsuariosAdmin(busqueda: string) {
  return useQuery({ queryKey: ['admin', 'usuarios', busqueda], queryFn: () => listarUsuarios(busqueda) });
}

function useInvalidarUsuarios() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['admin', 'usuarios'] });
}

export function useCambiarRol() {
  const invalidar = useInvalidarUsuarios();
  return useMutation({
    mutationFn: (v: { usuarioId: string; rol: RolUsuario; institucionId: string | null }) =>
      cambiarRolUsuario(v.usuarioId, v.rol, v.institucionId),
    onSuccess: invalidar,
  });
}

export function useSuspenderUsuario() {
  const invalidar = useInvalidarUsuarios();
  return useMutation({
    mutationFn: (v: { usuarioId: string; dias: number }) => suspenderUsuario(v.usuarioId, v.dias),
    onSuccess: invalidar,
  });
}

export function useEliminarUsuario() {
  const invalidar = useInvalidarUsuarios();
  return useMutation({ mutationFn: (usuarioId: string) => eliminarUsuario(usuarioId), onSuccess: invalidar });
}

export function useDetalleReporte(reporteId: string | undefined) {
  return useQuery({
    queryKey: ['moderacion', 'detalle', reporteId],
    queryFn: () => obtenerDetalleReporte(reporteId ?? ''),
    enabled: Boolean(reporteId),
  });
}

export function usePalabrasProhibidas() {
  return useQuery({ queryKey: ['palabras-prohibidas'], queryFn: listarPalabrasProhibidas, staleTime: 10 * 60_000 });
}

export function useAgregarPalabraProhibida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (palabra: string) => agregarPalabraProhibida(palabra),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['palabras-prohibidas'] }),
  });
}

export function useQuitarPalabraProhibida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (palabra: string) => quitarPalabraProhibida(palabra),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['palabras-prohibidas'] }),
  });
}
