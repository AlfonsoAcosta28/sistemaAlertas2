import { describe, expect, it } from 'vitest';

import { esContenidoInapropiado, evaluarCalidadFoto } from './calidad-foto';

function imagen(ancho: number, alto: number, color: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(ancho * alto * 4);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const v = color(x, y);
      const i = (y * ancho + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: ancho, height: alto };
}

describe('evaluarCalidadFoto', () => {
  it('acepta una foto con detalle y buena luz', () => {
    const tablero = imagen(64, 64, (x, y) => ((x >> 2) + (y >> 2)) % 2 ? 200 : 60);
    const calidad = evaluarCalidadFoto(tablero, 1280, 960);
    expect(calidad.aceptable).toBe(true);
  });

  it('rechaza una foto lisa (borrosa), oscura y pequeña', () => {
    const lisa = imagen(64, 64, () => 10);
    const calidad = evaluarCalidadFoto(lisa, 200, 150);
    expect(calidad.aceptable).toBe(false);
    expect(calidad.problemas).toHaveLength(3);
  });
});

describe('esContenidoInapropiado', () => {
  it('marca contenido explícito y deja pasar lo neutral', () => {
    expect(esContenidoInapropiado([{ className: 'Porn', probability: 0.9 }]).inapropiado).toBe(true);
    expect(
      esContenidoInapropiado([
        { className: 'Neutral', probability: 0.8 },
        { className: 'Sexy', probability: 0.2 },
      ]).inapropiado,
    ).toBe(false);
  });
});
