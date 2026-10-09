import { mensajeConfiguracionSupabase, obtenerClienteSupabase } from '@/src/lib/supabase';

import { ErrorConfiguracionSupabase } from './errores';

export async function actualizarPushToken(token: string): Promise<void> {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  const { error } = await supabase.rpc('actualizar_push_token', { p_token: token });

  if (error) {
    throw new Error(error.message);
  }
}
