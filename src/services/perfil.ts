import { mensajeConfiguracionSupabase, obtenerClienteSupabase } from '@/src/lib/supabase';
import type { Database } from '@/src/types/database';

import { ErrorConfiguracionSupabase } from './errores';

type Perfil = Database['public']['Tables']['perfiles']['Row'];

export async function obtenerPerfilPropio(): Promise<Perfil | null> {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  const { data, error } = await supabase.from('perfiles').select('*').maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
