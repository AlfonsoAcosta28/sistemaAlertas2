import { mensajeConfiguracionSupabase, obtenerClienteSupabase } from '@/src/lib/supabase';
import type { Database, Severidad } from '@/src/types/database';

import { ErrorConfiguracionSupabase } from './errores';

type Reporte = Database['public']['Tables']['reportes']['Row'];
type Auditoria = Database['public']['Tables']['auditoria_administrativa']['Row'];

function requerirSupabase() {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  return supabase;
}

export async function listarReportesPendientesModeracion(): Promise<Reporte[]> {
  const supabase = requerirSupabase();

  const { data, error } = await supabase
    .from('reportes')
    .select('*')
    .in('estado', ['no_confirmada', 'corroborada'])
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function listarHistorialModeracion(): Promise<Auditoria[]> {
  const supabase = requerirSupabase();

  const { data, error } = await supabase
    .from('auditoria_administrativa')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function verificarReporte(input: {
  reporteId: string;
  severidadOverride?: Severidad | null;
  nota?: string | null;
}): Promise<void> {
  const supabase = requerirSupabase();

  const { error } = await supabase.rpc('moderar_verificar_reporte', {
    p_reporte_id: input.reporteId,
    p_severidad_override: input.severidadOverride ?? null,
    p_nota: input.nota ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function descartarReporte(reporteId: string, motivo: string): Promise<void> {
  const supabase = requerirSupabase();

  const { error } = await supabase.rpc('moderar_descartar_reporte', {
    p_reporte_id: reporteId,
    p_motivo: motivo,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function cerrarReporte(reporteId: string): Promise<void> {
  const supabase = requerirSupabase();

  const { error } = await supabase.rpc('moderar_cerrar_reporte', {
    p_reporte_id: reporteId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function obtenerUrlFirmadaFoto(rutaFoto: string): Promise<string | null> {
  const supabase = requerirSupabase();

  const { data, error } = await supabase.storage
    .from('fotos-reportes')
    .createSignedUrl(rutaFoto, 60 * 10);

  if (error) {
    throw new Error(error.message);
  }

  return data?.signedUrl ?? null;
}
