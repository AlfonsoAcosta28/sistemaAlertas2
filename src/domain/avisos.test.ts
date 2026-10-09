import { describe, expect, it } from 'vitest';

import { alertasPorAvisar, claveAviso, idNotificacion, textoAviso, type AlertaParaAviso } from './avisos';

const ahora = Date.parse('2026-10-09T12:00:00Z');

function alerta(parcial: Partial<AlertaParaAviso>): AlertaParaAviso {
  return {
    id: 'r1',
    estado: 'no_confirmada',
    created_at: '2026-10-09T11:50:00Z',
    veracidad: 20,
    categoria: 'Incendio',
    distanciaMetros: 340,
    ...parcial,
  };
}

describe('alertasPorAvisar', () => {
  it('avisa de incidentes recientes de otros usuarios', () => {
    expect(alertasPorAvisar([alerta({})], new Set(), new Set(), ahora)).toHaveLength(1);
  });

  it('no avisa al autor del reporte', () => {
    expect(alertasPorAvisar([alerta({})], new Set(), new Set(['r1']), ahora)).toHaveLength(0);
  });

  it('no repite el aviso del mismo estado, pero sí avisa al pre-validarse', () => {
    const avisadas = new Set([claveAviso({ id: 'r1', estado: 'no_confirmada' })]);
    expect(alertasPorAvisar([alerta({})], avisadas, new Set(), ahora)).toHaveLength(0);
    expect(alertasPorAvisar([alerta({ estado: 'corroborada' })], avisadas, new Set(), ahora)).toHaveLength(1);
  });

  it('ignora incidentes viejos y cerrados', () => {
    expect(alertasPorAvisar([alerta({ created_at: '2026-10-09T09:00:00Z' })], new Set(), new Set(), ahora)).toHaveLength(0);
    expect(alertasPorAvisar([alerta({ estado: 'cerrada' })], new Set(), new Set(), ahora)).toHaveLength(0);
  });
});

describe('textoAviso', () => {
  it('pregunta "¿Tú también lo ves?" cuando está reportada', () => {
    expect(textoAviso(alerta({})).titulo).toBe('¿Tú también lo ves? Incendio cerca de ti');
    expect(textoAviso(alerta({})).cuerpo).toContain('340 m');
  });

  it('incluye la veracidad al pre-validarse', () => {
    expect(textoAviso(alerta({ estado: 'corroborada', veracidad: 80, distanciaMetros: 1500 })).cuerpo).toBe(
      'A 1.5 km. Pre-validado por vecinos (80% de veracidad).',
    );
  });
});

describe('idNotificacion', () => {
  it('es estable y positivo', () => {
    expect(idNotificacion('abc:no_confirmada')).toBe(idNotificacion('abc:no_confirmada'));
    expect(idNotificacion('abc:no_confirmada')).toBeGreaterThan(0);
    expect(idNotificacion('abc:corroborada')).not.toBe(idNotificacion('abc:no_confirmada'));
  });
});
