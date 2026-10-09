import { mensajeConfiguracionSupabase, obtenerClienteSupabase } from '@/src/lib/supabase';
import type { CampoFormulario, Database, Json, RolUsuario, Severidad, UsuarioAdmin } from '@/src/types/database';

import { ErrorConfiguracionSupabase } from './errores';

type Categoria = Database['public']['Tables']['categorias']['Row'];
type Regla = Database['public']['Tables']['categoria_reglas']['Row'];
export type Institucion = Database['public']['Tables']['instituciones']['Row'];
type MovimientoReputacion = Database['public']['Tables']['reputacion_movimientos']['Row'];

function requerirSupabase() {
  const supabase = obtenerClienteSupabase();
  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }
  return supabase;
}

// ---------- Lecturas (cualquier usuario autenticado) ----------

/** Umbral de credibilidad / ventana por categoría. */
export async function listarReglasCategorias(): Promise<Map<string, Regla>> {
  const { data, error } = await requerirSupabase().from('categoria_reglas').select('*');
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((r) => [r.categoria_id, r]));
}

export async function listarInstituciones(): Promise<Institucion[]> {
  const { data, error } = await requerirSupabase().from('instituciones').select('*').order('nombre');
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** categoria_id → ids de instituciones a las que se manda. */
export async function listarCategoriaInstituciones(): Promise<Map<string, string[]>> {
  const { data, error } = await requerirSupabase().from('categoria_instituciones').select('*');
  if (error) throw new Error(error.message);
  const mapa = new Map<string, string[]>();
  for (const fila of data ?? []) {
    mapa.set(fila.categoria_id, [...(mapa.get(fila.categoria_id) ?? []), fila.institucion_id]);
  }
  return mapa;
}

export async function listarMisMovimientosReputacion(): Promise<MovimientoReputacion[]> {
  const { data, error } = await requerirSupabase()
    .from('reputacion_movimientos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------- Administrador: categorías ----------

/** Con RLS, el administrador ve también las categorías desactivadas. */
export async function listarTodasLasCategorias(): Promise<Categoria[]> {
  const { data, error } = await requerirSupabase().from('categorias').select('*').order('nombre');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type DatosCategoria = {
  nombre: string;
  descripcion: string;
  activa: boolean;
  color: string;
  icono: string;
  severidad_default: Severidad;
  radio_inicial_metros: number;
  radio_maximo_metros: number;
  vigencia_default_minutos: number;
  umbral_confirmaciones: number;
  ventana_minutos: number;
  requiere_moderacion_obligatoria: boolean;
  requiere_foto: boolean;
  foto_requiere_rostro: boolean;
  campos_formulario: CampoFormulario[];
  instituciones: string[];
};

export async function guardarCategoria(id: string | null, datos: DatosCategoria): Promise<string> {
  const { data, error } = await requerirSupabase().rpc('admin_guardar_categoria', {
    p_id: id,
    p_datos: datos as unknown as Json,
  });
  if (error) throw new Error(error.message);
  return data;
}

// ---------- Administrador: instituciones ----------

export type DatosInstitucion = Pick<Institucion, 'nombre' | 'tipo' | 'telefono' | 'correo' | 'webhook_url' | 'activa'>;

export async function guardarInstitucion(id: string | null, datos: DatosInstitucion): Promise<void> {
  const supabase = requerirSupabase();
  const { error } = id
    ? await supabase
        .from('instituciones')
        .update({ ...datos, updated_at: new Date().toISOString() })
        .eq('id', id)
    : await supabase.from('instituciones').insert(datos);
  if (error) throw new Error(error.message);
}

// ---------- Administrador: usuarios ----------

export async function listarUsuarios(busqueda: string): Promise<UsuarioAdmin[]> {
  const { data, error } = await requerirSupabase().rpc('admin_listar_usuarios', {
    p_busqueda: busqueda.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function cambiarRolUsuario(usuarioId: string, rol: RolUsuario, institucionId: string | null) {
  const { error } = await requerirSupabase().rpc('admin_cambiar_rol', {
    p_usuario_id: usuarioId,
    p_rol: rol,
    p_institucion_id: institucionId,
  });
  if (error) throw new Error(error.message);
}

/** `dias = 0` quita la suspensión. */
export async function suspenderUsuario(usuarioId: string, dias: number) {
  const { error } = await requerirSupabase().rpc('admin_suspender_usuario', {
    p_usuario_id: usuarioId,
    p_dias: dias,
  });
  if (error) throw new Error(error.message);
}

export async function eliminarUsuario(usuarioId: string) {
  const { data, error } = await requerirSupabase().functions.invoke<{ ok?: boolean; error?: string }>(
    'admin-eliminar-usuario',
    { method: 'POST', body: { usuario_id: usuarioId } },
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

// ---------- Detalle de un reporte (panel gubernamental / administrador) ----------

type ReporteCompleto = Database['public']['Tables']['reportes']['Row'];
type Auditoria = Database['public']['Tables']['auditoria_administrativa']['Row'];

export type DetalleReporte = {
  reporte: ReporteCompleto | null;
  envios: { institucion: string; estado: string; enviado_en: string }[];
  auditoria: Auditoria[];
};

/**
 * Con RLS, el administrador ve cualquier reporte y el gubernamental solo los
 * enviados a su institución (si no, `reporte` llega en null).
 */
export async function obtenerDetalleReporte(reporteId: string): Promise<DetalleReporte> {
  const supabase = requerirSupabase();
  const [reporte, envios, instituciones, auditoria] = await Promise.all([
    supabase.from('reportes').select('*').eq('id', reporteId).maybeSingle(),
    supabase.from('reporte_envios').select('*').eq('reporte_id', reporteId),
    supabase.from('instituciones').select('id, nombre'),
    supabase
      .from('auditoria_administrativa')
      .select('*')
      .eq('reporte_id', reporteId)
      .order('created_at', { ascending: true }),
  ]);

  const error = reporte.error ?? envios.error ?? instituciones.error ?? auditoria.error;
  if (error) throw new Error(error.message);

  const nombrePorInstitucion = new Map((instituciones.data ?? []).map((i) => [i.id, i.nombre]));
  return {
    reporte: reporte.data,
    envios: (envios.data ?? []).map((e) => ({
      institucion: nombrePorInstitucion.get(e.institucion_id) ?? 'Institución',
      estado: e.estado,
      enviado_en: e.enviado_en,
    })),
    auditoria: auditoria.data ?? [],
  };
}
