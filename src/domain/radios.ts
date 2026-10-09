import type { EstadoReporte } from '@/src/types/database';

export type ParametrosFiltroAlerta = {
  distanciaMetros: number;
  radioPersonalMetros: number;
  radioAlertaActualMetros: number;
  categoriaActiva: boolean;
  verNoConfirmados: boolean;
  estado: EstadoReporte;
};

/**
 * Regla central del documento: d(usuario, incidente) <= min(radio_usuario, radio_alerta(t)),
 * y la categoría debe estar activa en las preferencias del usuario.
 */
export function debeRecibirAlerta(parametros: ParametrosFiltroAlerta): boolean {
  if (!parametros.categoriaActiva) {
    return false;
  }

  if (parametros.estado === 'descartada' || parametros.estado === 'cerrada') {
    return false;
  }

  if (parametros.estado === 'no_confirmada' && !parametros.verNoConfirmados) {
    return false;
  }

  const radioEfectivo = Math.min(parametros.radioPersonalMetros, parametros.radioAlertaActualMetros);
  return parametros.distanciaMetros <= radioEfectivo;
}
