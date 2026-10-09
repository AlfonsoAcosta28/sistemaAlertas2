import { mensajeConfiguracionSupabase, obtenerClienteSupabase } from '@/src/lib/supabase';
import type { Database } from '@/src/types/database';

import { ErrorConfiguracionSupabase } from './errores';

type ZonaGuardada = Database['public']['Tables']['zonas_guardadas']['Row'];

function requerirSupabase() {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  return supabase;
}

export async function listarZonasGuardadas(): Promise<ZonaGuardada[]> {
  const supabase = requerirSupabase();

  const { data, error } = await supabase
    .from('zonas_guardadas')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function crearZonaGuardada(input: {
  usuarioId: string;
  nombre: string;
  celdaH3: string;
  radioMetros: number;
}): Promise<void> {
  const supabase = requerirSupabase();

  const { error } = await supabase.from('zonas_guardadas').insert({
    usuario_id: input.usuarioId,
    nombre: input.nombre,
    celda_h3: input.celdaH3,
    radio_metros: input.radioMetros,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function borrarZonaGuardada(id: string): Promise<void> {
  const supabase = requerirSupabase();

  const { error } = await supabase.from('zonas_guardadas').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
