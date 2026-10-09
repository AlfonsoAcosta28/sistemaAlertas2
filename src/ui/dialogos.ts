import { Dialog } from '@capacitor/dialog';
import { Share } from '@capacitor/share';

/** Equivalente a `Alert.alert(titulo, mensaje)` de React Native. */
export async function alerta(titulo: string, mensaje: string): Promise<void> {
  await Dialog.alert({ title: titulo, message: mensaje, buttonTitle: 'Aceptar' });
}

/** Equivalente a un `Alert.alert` con botones Cancelar / Confirmar. */
export async function confirmar(
  titulo: string,
  mensaje: string,
  textoConfirmar = 'Aceptar',
): Promise<boolean> {
  const { value } = await Dialog.confirm({
    title: titulo,
    message: mensaje,
    okButtonTitle: textoConfirmar,
    cancelButtonTitle: 'Cancelar',
  });
  return value;
}

/** Equivalente a `Share.share` de React Native, con respaldo al portapapeles en web. */
export async function compartirTexto(texto: string): Promise<void> {
  const { value: puede } = await Share.canShare().catch(() => ({ value: false }));

  if (puede) {
    await Share.share({ text: texto, dialogTitle: 'Compartir alerta' }).catch(() => undefined);
    return;
  }

  await navigator.clipboard?.writeText(texto).catch(() => undefined);
  await alerta('Copiado', 'El texto de la alerta se copió al portapapeles.');
}
