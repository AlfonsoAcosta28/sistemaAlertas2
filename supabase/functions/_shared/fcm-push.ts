// Envío por Firebase Cloud Messaging (API HTTP v1) para los tokens nativos que
// registra la app de Capacitor (`@capacitor/push-notifications`).
//
// Requiere el secreto FIREBASE_SERVICE_ACCOUNT con el JSON completo de una
// cuenta de servicio del proyecto de Firebase:
//   npx supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)"

import type { MensajePush } from "./expo-push.ts";

type CuentaServicio = {
  project_id: string;
  client_email: string;
  private_key: string;
};

let tokenCache: { valor: string; expira: number } | null = null;

function base64Url(datos: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof datos === "string"
      ? new TextEncoder().encode(datos)
      : datos instanceof Uint8Array
        ? datos
        : new Uint8Array(datos);
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function leerCuentaServicio(): CuentaServicio | null {
  const crudo = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as CuentaServicio;
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT no es un JSON válido");
    return null;
  }
}

async function obtenerTokenAcceso(cuenta: CuentaServicio): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expira - 60 > ahora) {
    return tokenCache.valor;
  }

  const encabezado = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const carga = base64Url(
    JSON.stringify({
      iss: cuenta.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 3600,
    }),
  );

  const pem = cuenta.private_key
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const llave = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    llave,
    new TextEncoder().encode(`${encabezado}.${carga}`),
  );
  const jwt = `${encabezado}.${carga}.${base64Url(firma)}`;

  const respuesta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!respuesta.ok) {
    throw new Error(`No se pudo obtener token de Google: ${await respuesta.text()}`);
  }

  const { access_token, expires_in } = (await respuesta.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache = { valor: access_token, expira: ahora + expires_in };
  return access_token;
}

/** FCM exige que todos los valores de `data` sean strings. */
function datosComoTexto(datos: Record<string, unknown> | undefined): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(datos ?? {})) {
    if (valor !== undefined && valor !== null) {
      salida[clave] = typeof valor === "string" ? valor : JSON.stringify(valor);
    }
  }
  return salida;
}

export async function enviarNotificacionesFcm(mensajes: MensajePush[]): Promise<void> {
  if (mensajes.length === 0) return;

  const cuenta = leerCuentaServicio();
  if (!cuenta) {
    console.error(
      `Se omitieron ${mensajes.length} notificaciones FCM: falta el secreto FIREBASE_SERVICE_ACCOUNT.`,
    );
    return;
  }

  const tokenAcceso = await obtenerTokenAcceso(cuenta);
  const url = `https://fcm.googleapis.com/v1/projects/${cuenta.project_id}/messages:send`;

  await Promise.all(
    mensajes.map(async (mensaje) => {
      const respuesta = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenAcceso}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: mensaje.to,
            notification: { title: mensaje.title, body: mensaje.body },
            data: datosComoTexto(mensaje.data),
            android: {
              priority: mensaje.priority === "high" ? "HIGH" : "NORMAL",
              notification: {
                channel_id: mensaje.channelId ?? "alertas",
                ...(mensaje.sound ? { sound: "default" } : {}),
              },
            },
            apns: {
              headers: { "apns-priority": mensaje.priority === "high" ? "10" : "5" },
              payload: { aps: mensaje.sound ? { sound: "default" } : {} },
            },
          },
        }),
      });

      if (!respuesta.ok) {
        // 404 UNREGISTERED = token viejo (app desinstalada); no es fatal.
        console.error("FCM rechazó un mensaje", respuesta.status, await respuesta.text());
      }
    }),
  );
}
