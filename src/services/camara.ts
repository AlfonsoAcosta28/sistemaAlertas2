import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import { esNativo } from '@/src/utils/entorno';

export type OrigenFoto = 'camara' | 'galeria';

function elegirArchivoEnNavegador(origen: OrigenFoto): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (origen === 'camara') {
      input.setAttribute('capture', 'environment');
    }
    input.onchange = () => {
      const archivo = input.files?.[0];
      if (!archivo) {
        resolve(null);
        return;
      }
      const lector = new FileReader();
      lector.onload = () => resolve(typeof lector.result === 'string' ? lector.result : null);
      lector.onerror = () => resolve(null);
      lector.readAsDataURL(archivo);
    };
    input.click();
  });
}

/**
 * Sustituye a `expo-image-picker`. Devuelve la foto como data URL, o null si el
 * usuario canceló. Lanza error si se negó el permiso.
 */
export async function tomarOElegirFoto(origen: OrigenFoto): Promise<string | null> {
  if (!esNativo) {
    return elegirArchivoEnNavegador(origen);
  }

  try {
    const foto = await Camera.getPhoto({
      quality: 90,
      resultType: CameraResultType.DataUrl,
      source: origen === 'camara' ? CameraSource.Camera : CameraSource.Photos,
      correctOrientation: true,
      allowEditing: false,
    });
    return foto.dataUrl ?? null;
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    if (/cancel/i.test(mensaje)) {
      return null;
    }
    if (/denied|permission/i.test(mensaje)) {
      throw new Error('Necesitamos ese permiso para adjuntar una foto.');
    }
    throw error instanceof Error ? error : new Error(mensaje);
  }
}
