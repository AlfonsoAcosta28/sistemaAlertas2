import { describe, expect, it } from 'vitest';

import { buscarGroseria, normalizarPalabraProhibida, palabrasDelTexto } from './groserias';

const lista = ['puto', 'pendejo', 'verga', 'perra', 'coño', 'hijo de puta', 'chinga tu madre'].map(
  normalizarPalabraProhibida,
);

describe('palabrasDelTexto', () => {
  it('quita acentos, símbolos y junta letras sueltas', () => {
    expect(palabrasDelTexto('¡Pénd3jo!')).toEqual(['pendejo']);
    expect(palabrasDelTexto('p u t o aquí')).toEqual(['p', 'u', 't', 'o', 'aqui', 'puto']);
  });
});

describe('buscarGroseria', () => {
  it('detecta groserías escritas de muchas formas', () => {
    for (const texto of [
      'eres un pendejo',
      'PENDEJOS todos',
      'pvt0'.replace('v', 'u'),
      'p.u.t.o',
      'p u t o',
      'puuuuuto',
      'pend3j0',
      'vete a la v3rg@',
      'perrrra',
      'coño',
    ]) {
      expect(buscarGroseria(texto, lista), texto).not.toBeNull();
    }
  });

  it('detecta frases', () => {
    expect(buscarGroseria('hijo de puuuta', lista)).toBe('hijo de puta');
    expect(buscarGroseria('¡Chinga tu madre!', lista)).toBe('chinga tu madre');
  });

  it('no bloquea texto normal que contiene una grosería por dentro', () => {
    for (const texto of [
      'Se descompuso la computadora del semáforo',
      'Hay un cono en la calle Disputa',
      'Venden pera y verduras',
      'Incendio en la esquina de Reforma',
      'Choque entre dos autos, uno rojo',
    ]) {
      expect(buscarGroseria(texto, lista), texto).toBeNull();
    }
  });
});
