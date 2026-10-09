import { createClient } from "npm:@supabase/supabase-js@2.57.4";

export function crearClienteAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan los secretos SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en la Edge Function.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
