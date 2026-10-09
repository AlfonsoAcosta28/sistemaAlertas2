import { describe, expect, it } from 'vitest';

import { validarReglasReaccion } from './reacciones';

describe('validarReglasReaccion', () => {
  it('rechaza reaccionar al propio reporte', () => {
    expect(() =>
      validarReglasReaccion({ creadorId: 'usuario-1', usuarioActualId: 'usuario-1' }),
    ).toThrow('No puedes reaccionar a tu propio reporte.');
  });

  it('permite reaccionar al reporte de otro usuario', () => {
    expect(validarReglasReaccion({ creadorId: 'usuario-1', usuarioActualId: 'usuario-2' })).toBe(
      true,
    );
  });

  it('permite reaccionar cuando el reporte ya no tiene creador (cuenta borrada)', () => {
    expect(validarReglasReaccion({ creadorId: null, usuarioActualId: 'usuario-2' })).toBe(true);
  });
});
