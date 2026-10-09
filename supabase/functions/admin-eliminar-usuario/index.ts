// Permite a un ADMINISTRADOR quitar (eliminar) a otro usuario desde la app.
//
// 1) Valida el JWT de quien llama para saber quién es.
// 2) `admin_preparar_eliminacion` (solo service role) comprueba que sea
//    administrador, limpia los datos del usuario y deja registro en la auditoría.
// 3) Borra la cuenta de auth con la Admin API; `perfiles` se borra en cascada.
//
// Cuerpo: { "usuario_id": "<uuid>" }

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { crearClienteAdmin } from "../_shared/supabase-admin.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const encabezadoAuth = req.headers.get("Authorization");
    if (!encabezadoAuth?.startsWith("Bearer ")) {
      return responder({ error: "Falta el token de autorización." }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_ANON_KEY en los secretos de la función.");
    }

    const clienteDelUsuario = createClient(url, anonKey, {
      global: { headers: { Authorization: encabezadoAuth } },
      auth: { persistSession: false },
    });

    const token = encabezadoAuth.slice("Bearer ".length);
    const { data: usuarioData, error: errorUsuario } = await clienteDelUsuario.auth.getUser(token);
    if (errorUsuario || !usuarioData?.user) {
      return responder({ error: "Token inválido." }, 401);
    }

    const cuerpo = await req.json().catch(() => ({}));
    const usuarioId: string | undefined = cuerpo?.usuario_id;
    if (!usuarioId) {
      return responder({ error: "Falta usuario_id." }, 400);
    }

    const admin = crearClienteAdmin();

    const { error: errorPreparar } = await admin.rpc("admin_preparar_eliminacion", {
      p_admin_id: usuarioData.user.id,
      p_usuario_id: usuarioId,
    });
    if (errorPreparar) {
      return responder({ error: errorPreparar.message }, 403);
    }

    const { error: errorBorrado } = await admin.auth.admin.deleteUser(usuarioId);
    if (errorBorrado) {
      throw errorBorrado;
    }

    return responder({ ok: true });
  } catch (error) {
    console.error("admin-eliminar-usuario error", error);
    return responder({ error: String(error) }, 500);
  }
});
