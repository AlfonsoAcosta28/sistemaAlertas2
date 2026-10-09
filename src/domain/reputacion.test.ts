import { describe, expect, it } from 'vitest';

import { rutaIconoAlerta } from './iconos-alerta';
import { calcularVeracidad, nivelReputacion, pesoReputacion } from './reputacion';

describe('pesoReputacion', () => {
  it('vale 1 voto con 0 puntos y respeta piso y tope', () => {
    expect(pesoReputacion(0)).toBe(1);
    expect(pesoReputacion(50)).toBe(1.5);
    expect(pesoReputacion(500)).toBe(2);
    expect(pesoReputacion(-500)).toBe(0.25);
  });

  it('asigna nivel', () => {
    expect(nivelReputacion(0)).toBe('Nueva');
    expect(nivelReputacion(80)).toBe('Muy confiable');
    expect(nivelReputacion(-30)).toBe('Baja');
  });
});

describe('calcularVeracidad (igual que en SQL)', () => {
  it('un solo reporte de umbral 5 = 20 %', () => {
    expect(calcularVeracidad(1, 0, 5)).toBe(20);
  });
  it('umbral alcanzado sin votos en contra = 100 %', () => {
    expect(calcularVeracidad(2, 0, 2)).toBe(100);
  });
  it('los votos en contra bajan la veracidad', () => {
    expect(calcularVeracidad(2, 1, 5)).toBe(27);
  });
});

describe('rutaIconoAlerta', () => {
  it('usa el ícono de la categoría o el genérico', () => {
    expect(rutaIconoAlerta('flame')).toBe('/iconos-alerta/flame.png');
    expect(rutaIconoAlerta('flame', { relativa: true })).toBe('iconos-alerta/flame.png');
    expect(rutaIconoAlerta('no-existe')).toBe('/iconos-alerta/alert.png');
    expect(rutaIconoAlerta(null)).toBe('/iconos-alerta/alert.png');
  });
});
