import { mensajeConfiguracionSupabase, obtenerClienteSupabase } from '@/src/lib/supabase';
import type { Database } from '@/src/types/database';

import { ErrorConfiguracionSupabase } from './errores';

type UsuarioPreferencias = Database['public']['Tables']['usuario_preferencias']['Row'];
type CategoriaPreferencia = Database['public']['Tables']['usuario_categoria_preferencias']['Row'];

export type ActualizarPreferenciasInput = Partial<
  Pick<
    UsuarioPreferencias,
    | 'radio_personal_metros'
    | 'ver_no_confirmados'
    | 'horario_silencio_inicio'
    | 'horario_silencio_fin'
    | 'autoriza_alertas_criticas_en_silencio'
  >
>;

function requerirSupabase() {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  return supabase;
}

export async function obtenerPreferenciasPropias(): Promise<UsuarioPreferencias | null> {
  const supabase = requerirSupabase();

  const { data, error } = await supabase.from('usuario_preferencias').select('*').maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function actualizarPreferencias(
  usuarioId: string,
  cambios: ActualizarPreferenciasInput,
): Promise<void> {
  const supabase = requerirSupabase();

  const { error } = await supabase
    .from('usuario_preferencias')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('usuario_id', usuarioId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listarCategoriaPreferencias(): Promise<CategoriaPreferencia[]> {
  const supabase = requerirSupabase();

  const { data, error } = await supabase.from('usuario_categoria_preferencias').select('*');

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function actualizarCategoriaPreferencia(
  usuarioId: string,
  categoriaId: string,
  activa: boolean,
): Promise<void> {
  const supabase = requerirSupabase();

  const { error } = await supabase
    .from('usuario_categoria_preferencias')
    .upsert({ usuario_id: usuarioId, categoria_id: categoriaId, activa });

  if (error) {
    throw new Error(error.message);
  }
}

export async function marcarOnboardingCompletado(usuarioId: string): Promise<void> {
  const supabase = requerirSupabase();

  const { error } = await supabase
    .from('perfiles')
    .update({ onboarding_completado: true })
    .eq('id', usuarioId);

  if (error) {
    throw new Error(error.message);
  }
}
