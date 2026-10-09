// Borra la cuenta y los datos del usuario que llama a esta función (derechos ARCO).
//
// El borrado de auth.users requiere la Admin API (service role), que no está
// disponible desde el cliente. Por eso: 1) se valida el JWT del usuario para
// saber a quién borrar, 2) se limpian sus datos vía la función SQL
// `eliminar_cuenta_propia` (RLS/lógica ya centralizada ahí) y 3) se borra la
// cuenta de auth con la Admin API; `perfiles` se borra en cascada.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { crearClienteAdmin } from "../_shared/supabase-admin.ts";

Deno.serve(async (req) => {
  try {
    const encabezadoAuth = req.headers.get("Authorization");
    if (!encabezadoAuth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Falta el token de autorización." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = encabezadoAuth.slice("Bearer ".length);
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!url || !anonKey) {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_ANON_KEY en los secretos de la función.");
    }

    const clienteDelUsuario = createClient(url, anonKey, {
      global: { headers: { Authorization: encabezadoAuth } },
      auth: { persistSession: false },
    });

    const { data: usuarioData, error: errorUsuario } = await clienteDelUsuario.auth.getUser(token);
    if (errorUsuario || !usuarioData?.user) {
      return new Response(JSON.stringify({ error: "Token inválido." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const usuarioId = usuarioData.user.id;

    const { error: errorLimpieza } = await clienteDelUsuario.rpc("eliminar_cuenta_propia");
    if (errorLimpieza) {
      throw errorLimpieza;
    }

    const admin = crearClienteAdmin();
    const { error: errorBorrado } = await admin.auth.admin.deleteUser(usuarioId);
    if (errorBorrado) {
      throw errorBorrado;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("eliminar-cuenta error", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
