// Despachador: la app Expo registraba `ExponentPushToken[...]`; la app Capacitor
// registra tokens nativos de FCM. Mientras convivan ambas versiones, cada token
// se envía por el servicio que le corresponde.

import { enviarNotificacionesPush as enviarPorExpo, type MensajePush } from "./expo-push.ts";
import { enviarNotificacionesFcm } from "./fcm-push.ts";

export type { MensajePush };

function esTokenExpo(token: string): boolean {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

export async function enviarNotificacionesPush(mensajes: MensajePush[]): Promise<void> {
  const expo = mensajes.filter((m) => esTokenExpo(m.to)).map(({ channelId: _c, ...resto }) => resto);
  const fcm = mensajes.filter((m) => !esTokenExpo(m.to));

  await Promise.all([
    expo.length ? enviarPorExpo(expo) : Promise.resolve(),
    enviarNotificacionesFcm(fcm),
  ]);
}
