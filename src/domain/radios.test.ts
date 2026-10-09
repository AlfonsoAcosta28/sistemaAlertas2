import { describe, expect, it } from 'vitest';

import { debeRecibirAlerta } from './radios';

const base = {
  distanciaMetros: 3000,
  radioPersonalMetros: 5000,
  radioAlertaActualMetros: 10000,
  categoriaActiva: true,
  verNoConfirmados: true,
  estado: 'verificada' as const,
};

describe('debeRecibirAlerta', () => {
  it('ejemplo del documento: incendio a 10km con radio personal de 5km no llega', () => {
    expect(
      debeRecibirAlerta({
        ...base,
        distanciaMetros: 10000,
        radioPersonalMetros: 5000,
        radioAlertaActualMetros: 15000,
      }),
    ).toBe(false);
  });

  it('usa el mínimo entre radio personal y radio de la alerta', () => {
    expect(debeRecibirAlerta({ ...base, distanciaMetros: 6000, radioAlertaActualMetros: 20000 })).toBe(
      false,
    );
    expect(debeRecibirAlerta({ ...base, distanciaMetros: 4000, radioAlertaActualMetros: 3000 })).toBe(
      false,
    );
  });

  it('rechaza si la categoría no está activa', () => {
    expect(debeRecibirAlerta({ ...base, categoriaActiva: false })).toBe(false);
  });

  it('rechaza reportes descartados o cerrados', () => {
    expect(debeRecibirAlerta({ ...base, estado: 'descartada' })).toBe(false);
    expect(debeRecibirAlerta({ ...base, estado: 'cerrada' })).toBe(false);
  });

  it('respeta el filtro de ver no confirmados', () => {
    expect(debeRecibirAlerta({ ...base, estado: 'no_confirmada', verNoConfirmados: false })).toBe(
      false,
    );
    expect(debeRecibirAlerta({ ...base, estado: 'no_confirmada', verNoConfirmados: true })).toBe(
      true,
    );
  });

  it('acepta cuando la distancia está dentro de ambos radios', () => {
    expect(debeRecibirAlerta(base)).toBe(true);
  });
});
