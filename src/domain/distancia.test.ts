import { describe, expect, it } from 'vitest';

import { distanciaMetros } from './distancia';

describe('distanciaMetros', () => {
  it('devuelve 0 para el mismo punto', () => {
    expect(distanciaMetros(19.4333, -102.05, 19.4333, -102.05)).toBe(0);
  });

  it('aproxima ~111 km por cada grado de latitud', () => {
    const distancia = distanciaMetros(19.0, -102.0, 20.0, -102.0);
    expect(distancia).toBeGreaterThan(110000);
    expect(distancia).toBeLessThan(112000);
  });
});
