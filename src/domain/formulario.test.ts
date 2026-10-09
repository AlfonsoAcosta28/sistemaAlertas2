import { describe, expect, it } from 'vitest';

import {
  claveDesdeEtiqueta,
  datosParaMostrar,
  limpiarDatos,
  normalizarCampos,
  validarDatosFormulario,
} from './formulario';

// Mismos campos que la migración para "Robo de vehículo".
const camposRobo = normalizarCampos([
  { clave: 'placas', etiqueta: 'Placas', tipo: 'texto', requerido: false, mayusculas: true },
  {
    clave: 'tipo_vehiculo',
    etiqueta: 'Tipo de vehículo',
    tipo: 'opciones',
    requerido_si_vacio: 'placas',
    opciones: ['Automóvil', 'Camioneta', 'Motocicleta'],
  },
  { clave: 'marca', etiqueta: 'Marca y modelo', tipo: 'texto', requerido_si_vacio: 'placas' },
  { clave: 'color', etiqueta: 'Color', tipo: 'texto', requerido_si_vacio: 'placas' },
]);

const camposPersona = normalizarCampos([
  { clave: 'nombre', etiqueta: 'Nombre completo', tipo: 'texto', requerido: true },
  { clave: 'edad', etiqueta: 'Edad', tipo: 'numero', requerido: true },
]);

describe('normalizarCampos', () => {
  it('ignora entradas mal formadas', () => {
    expect(normalizarCampos(null)).toEqual([]);
    expect(normalizarCampos([{ clave: 'x' }, { clave: 'y', etiqueta: 'Y', tipo: 'raro' }, 3])).toEqual([]);
    expect(camposRobo).toHaveLength(4);
  });
});

describe('validarDatosFormulario', () => {
  it('robo con placas: la descripción es opcional', () => {
    expect(validarDatosFormulario(camposRobo, { placas: 'abc-123' })).toEqual({});
  });

  it('robo sin placas: exige tipo, marca y color', () => {
    const errores = validarDatosFormulario(camposRobo, {});
    expect(Object.keys(errores).sort()).toEqual(['color', 'marca', 'tipo_vehiculo']);
    expect(errores.marca).toContain('Placas');
  });

  it('valida opciones y números', () => {
    expect(validarDatosFormulario(camposRobo, { tipo_vehiculo: 'Tanque', marca: 'x', color: 'y' })).toHaveProperty(
      'tipo_vehiculo',
    );
    expect(validarDatosFormulario(camposPersona, { nombre: 'Ana', edad: 'doce' })).toHaveProperty('edad');
    expect(validarDatosFormulario(camposPersona, { nombre: 'Ana', edad: '12' })).toEqual({});
    expect(validarDatosFormulario(camposPersona, { nombre: '  ', edad: '12' })).toHaveProperty('nombre');
  });
});

describe('limpiarDatos y datosParaMostrar', () => {
  it('quita claves desconocidas y aplica mayúsculas', () => {
    expect(limpiarDatos(camposRobo, { placas: ' abc-123 ', otra: 'x', marca: '' })).toEqual({ placas: 'ABC-123' });
  });

  it('usa la etiqueta del campo al mostrar', () => {
    expect(datosParaMostrar(camposRobo, { placas: 'ABC-123' })).toEqual([{ etiqueta: 'Placas', valor: 'ABC-123' }]);
    expect(datosParaMostrar(camposRobo, null)).toEqual([]);
  });
});

describe('claveDesdeEtiqueta', () => {
  it('genera claves sin acentos ni espacios', () => {
    expect(claveDesdeEtiqueta('¿Dónde se le vio por última vez?')).toBe('donde_se_le_vio_por_ultima_vez');
  });
});
