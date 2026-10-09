import { mensajeConfiguracionSupabase, obtenerClienteSupabase } from '@/src/lib/supabase';
import type { Database } from '@/src/types/database';

import { ErrorConfiguracionSupabase } from './errores';

type Categoria = Database['public']['Tables']['categorias']['Row'];

export async function listarCategoriasActivas(): Promise<Categoria[]> {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .eq('activa', true)
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
