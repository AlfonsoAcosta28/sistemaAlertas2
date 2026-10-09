export type MensajePush = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "high";
  channelId?: string;
};

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const TAMANO_LOTE = 100;

export async function enviarNotificacionesPush(mensajes: MensajePush[]): Promise<void> {
  for (let i = 0; i < mensajes.length; i += TAMANO_LOTE) {
    const lote = mensajes.slice(i, i + TAMANO_LOTE);

    await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(lote),
    });
  }
}
