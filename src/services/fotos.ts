import { mensajeConfiguracionSupabase, obtenerClienteSupabase } from '@/src/lib/supabase';

import { ErrorConfiguracionSupabase } from './errores';

/**
 * Sube la foto ya redactada (cajas negras aplicadas) y recomprimida (sin EXIF)
 * a la carpeta privada del propio usuario. Devuelve la ruta en el bucket, no
 * una URL firmada: las URLs se generan al momento de mostrarse (ver
 * `obtenerUrlFirmadaFoto` en `src/services/moderacion.ts`).
 */
export async function subirFotoReporte(usuarioId: string, foto: Blob): Promise<string> {
  const supabase = obtenerClienteSupabase();

  if (!supabase) {
    throw new ErrorConfiguracionSupabase(mensajeConfiguracionSupabase());
  }

  const ruta = `${usuarioId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from('fotos-reportes').upload(ruta, foto, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ruta;
}
