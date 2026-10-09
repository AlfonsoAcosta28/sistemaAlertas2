import { mensajeConfiguracionSupabase, obtenerClienteSupabase } from '@/src/lib/supabase';

import { ErrorConfiguracionSupabase } from './errores';

export async function eliminarCuentaPropia(): Promise<void> {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'eliminar-cuenta',
    { method: 'POST' },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  await supabase.auth.signOut();
}
