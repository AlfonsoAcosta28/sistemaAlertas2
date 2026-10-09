import { mensajeConfiguracionSupabase, obtenerClienteSupabase } from '@/src/lib/supabase';

import { ErrorConfiguracionSupabase } from './errores';

export async function actualizarCeldaPerfil(celdaH3: string): Promise<void> {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  const { error } = await supabase.rpc('actualizar_celda_perfil', { p_celda_h3: celdaH3 });

  if (error) {
    throw new Error(error.message);
  }
}
