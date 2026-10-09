import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';

import type { Database } from '@/src/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function supabaseConfigurado() {
  return Boolean(supabaseUrl) && Boolean(supabaseAnonKey);
}

export function mensajeConfiguracionSupabase() {
  return 'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env para habilitar datos en línea.';
}

/**
 * En nativo la sesión se guarda con `@capacitor/preferences` (SharedPreferences /
 * UserDefaults), que el sistema no borra como puede pasar con el localStorage del
 * WebView. En navegador se deja el localStorage por defecto de supabase-js.
 */
const almacenamientoNativo: SupportedStorage = {
  getItem: async (clave) => (await Preferences.get({ key: clave })).value,
  setItem: async (clave, valor) => {
    await Preferences.set({ key: clave, value: valor });
  },
  removeItem: async (clave) => {
    await Preferences.remove({ key: clave });
  },
};

let cliente: SupabaseClient<Database> | null = null;

export function obtenerClienteSupabase() {
  if (!supabaseConfigurado()) {
    return null;
  }

  if (cliente) {
    return cliente;
  }

  cliente = createClient<Database>(supabaseUrl ?? '', supabaseAnonKey ?? '', {
    auth: {
      ...(Capacitor.isNativePlatform() ? { storage: almacenamientoNativo } : {}),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return cliente;
}
