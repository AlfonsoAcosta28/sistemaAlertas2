import { mensajeConfiguracionSupabase, obtenerClienteSupabase } from '@/src/lib/supabase';

import { ErrorConfiguracionSupabase } from './errores';

function requerirSupabase() {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  return supabase;
}

export async function registrarUsuario(input: {
  email: string;
  password: string;
  telefono?: string | null;
}) {
  const supabase = requerirSupabase();

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (input.telefono && data.user) {
    await supabase.from('perfiles').update({ telefono: input.telefono }).eq('id', data.user.id);
  }

  return data;
}

export async function iniciarSesion(input: { email: string; password: string }) {
  const supabase = requerirSupabase();

  const { data, error } = await supabase.auth.signInWithPassword(input);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function cerrarSesion(): Promise<void> {
  const supabase = requerirSupabase();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}
