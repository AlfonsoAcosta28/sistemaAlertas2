import type { EstadoReporte, Severidad } from '@/src/types/database';

export function tieneClaveGoogleMapsConfigurada(claveGoogleMaps: string | undefined): boolean {
  return Boolean(claveGoogleMaps?.trim());
}

export function obtenerEtiquetaEstadoReporte(estado: EstadoReporte): string {
  switch (estado) {
    case 'no_confirmada':
      return 'Reporte ciudadano sin confirmar';
    case 'corroborada':
      return 'Varios reportes';
    case 'verificada':
      return 'Verificada';
    case 'descartada':
      return 'Descartada';
    case 'cerrada':
      return 'Resuelta';
  }
}

export type EstiloEstado = {
  etiqueta: string;
  colorTexto: string;
  colorBorde: string;
  colorFondo: string;
};

export function obtenerEstiloEstadoReporte(estado: EstadoReporte, severidad: Severidad): EstiloEstado {
  const etiqueta = obtenerEtiquetaEstadoReporte(estado);

  switch (estado) {
    case 'no_confirmada':
      return { etiqueta, colorTexto: '#92400E', colorBorde: '#D97706', colorFondo: '#FFFBEB' };
    case 'corroborada':
      return { etiqueta, colorTexto: '#9A3412', colorBorde: '#EA580C', colorFondo: '#FFF7ED' };
    case 'verificada':
      return severidad === 'alta'
        ? { etiqueta, colorTexto: '#991B1B', colorBorde: '#B91C1C', colorFondo: '#FEF2F2' }
        : { etiqueta, colorTexto: '#065F46', colorBorde: '#047857', colorFondo: '#ECFDF5' };
    case 'descartada':
      return { etiqueta, colorTexto: '#991B1B', colorBorde: '#B91C1C', colorFondo: '#FEF2F2' };
    case 'cerrada':
      return { etiqueta, colorTexto: '#334155', colorBorde: '#64748B', colorFondo: '#F1F5F9' };
  }
}
