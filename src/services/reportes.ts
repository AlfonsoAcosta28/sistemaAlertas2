import { mensajeConfiguracionSupabase, obtenerClienteSupabase } from '@/src/lib/supabase';
import type { Database, TipoReaccion } from '@/src/types/database';

import { ErrorConfiguracionSupabase } from './errores';

type ReportePublico = Database['public']['Views']['reportes_publicos']['Row'];
type ReportePropio = Database['public']['Tables']['reportes']['Row'];

export type CrearReporteInput = {
  categoriaId: string;
  latitud: number;
  longitud: number;
  celdaH3: string;
  descripcion: string | null;
  fotoUrl?: string | null;
};

export async function listarReportesPublicos(): Promise<ReportePublico[]> {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  const { data, error } = await supabase
    .from('reportes_publicos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function listarMisReportes(): Promise<ReportePropio[]> {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  const { data, error } = await supabase
    .from('reportes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function crearReporte(input: CrearReporteInput): Promise<string> {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  const { data, error } = await supabase.rpc('crear_reporte', {
    p_categoria_id: input.categoriaId,
    p_latitud: input.latitud,
    p_longitud: input.longitud,
    p_celda_h3: input.celdaH3,
    p_descripcion: input.descripcion,
    p_foto_url: input.fotoUrl ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('El servidor no devolvió el identificador del reporte.');
  }

  return data;
}

export async function reaccionarReporte(reporteId: string, tipo: TipoReaccion): Promise<string> {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  const { data, error } = await supabase.rpc('reaccionar_reporte', {
    p_reporte_id: reporteId,
    p_tipo: tipo,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('El servidor no devolvió la confirmación de la reacción.');
  }

  return data;
}
