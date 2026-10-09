import { describe, expect, it } from 'vitest';

import { celdaDeCoordenada } from './h3';

describe('celdaDeCoordenada', () => {
  it('devuelve una celda H3 de resolución 8 válida', () => {
    const celda = celdaDeCoordenada(19.4326, -99.1332);
    expect(celda).toMatch(/^88[0-9a-f]{13}$/);
  });
});
