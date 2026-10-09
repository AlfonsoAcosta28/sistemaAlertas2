import { describe, expect, it } from 'vitest';

import { obtenerEstiloEstadoReporte, obtenerEtiquetaEstadoReporte, tieneClaveGoogleMapsConfigurada } from './mapa';

describe('tieneClaveGoogleMapsConfigurada', () => {
  it('devuelve false cuando la clave no existe o está vacía', () => {
    expect(tieneClaveGoogleMapsConfigurada(undefined)).toBe(false);
    expect(tieneClaveGoogleMapsConfigurada('')).toBe(false);
    expect(tieneClaveGoogleMapsConfigurada('   ')).toBe(false);
  });

  it('devuelve true cuando hay una clave no vacía', () => {
    expect(tieneClaveGoogleMapsConfigurada('AIzaSyFake')).toBe(true);
  });
});

describe('obtenerEtiquetaEstadoReporte', () => {
  it('mapea los cinco estados del documento a etiquetas en español', () => {
    expect(obtenerEtiquetaEstadoReporte('no_confirmada')).toBe('Reportada');
    expect(obtenerEtiquetaEstadoReporte('corroborada')).toBe('Pre-validada');
    expect(obtenerEtiquetaEstadoReporte('verificada')).toBe('Validada');
    expect(obtenerEtiquetaEstadoReporte('descartada')).toBe('Falsa');
    expect(obtenerEtiquetaEstadoReporte('cerrada')).toBe('Resuelta');
  });
});

describe('obtenerEstiloEstadoReporte', () => {
  it('usa rojo para verificadas de severidad alta y verde para el resto', () => {
    expect(obtenerEstiloEstadoReporte('verificada', 'alta').colorBorde).toBe('#B91C1C');
    expect(obtenerEstiloEstadoReporte('verificada', 'media').colorBorde).toBe('#047857');
    expect(obtenerEstiloEstadoReporte('verificada', 'baja').colorBorde).toBe('#047857');
  });
});
