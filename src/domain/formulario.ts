import type { CampoFormulario, Json, TipoCampo } from '@/src/types/database';

/**
 * Campos extra del formulario de reporte, definidos por categoría en
 * `categorias.campos_formulario` (los edita el administrador). El servidor
 * (`crear_reporte`) repite estas mismas validaciones.
 */

const TIPOS_VALIDOS: readonly TipoCampo[] = ['texto', 'texto_largo', 'numero', 'opciones'];
const PATRON_NUMERO = /^\d{1,3}(\.\d+)?$/;
const LARGO_MAXIMO = 500;

export type DatosFormulario = Record<string, string>;

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function textoONulo(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}

/** Convierte el JSON guardado en BD en campos tipados, ignorando entradas mal formadas. */
export function normalizarCampos(valor: Json | unknown): CampoFormulario[] {
  if (!Array.isArray(valor)) return [];

  const campos: CampoFormulario[] = [];
  for (const entrada of valor) {
    if (!esObjeto(entrada)) continue;
    const clave = textoONulo(entrada.clave);
    const etiqueta = textoONulo(entrada.etiqueta);
    const tipo = entrada.tipo as TipoCampo;
    if (!clave || !etiqueta || !TIPOS_VALIDOS.includes(tipo)) continue;

    const campo: CampoFormulario = { clave, etiqueta, tipo };
    if (entrada.requerido === true) campo.requerido = true;
    const requeridoSiVacio = textoONulo(entrada.requerido_si_vacio);
    if (requeridoSiVacio) campo.requerido_si_vacio = requeridoSiVacio;
    const ayuda = textoONulo(entrada.ayuda);
    if (ayuda) campo.ayuda = ayuda;
    if (entrada.mayusculas === true) campo.mayusculas = true;
    if (Array.isArray(entrada.opciones)) {
      campo.opciones = entrada.opciones.filter((o): o is string => typeof o === 'string' && o.trim() !== '');
    }
    campos.push(campo);
  }
  return campos;
}

export function campoEsRequerido(campo: CampoFormulario, datos: DatosFormulario): boolean {
  if (campo.requerido) return true;
  if (campo.requerido_si_vacio) {
    return !(datos[campo.requerido_si_vacio] ?? '').trim();
  }
  return false;
}

/** Devuelve un mapa clave → mensaje de error (vacío si todo está bien). */
export function validarDatosFormulario(
  campos: CampoFormulario[],
  datos: DatosFormulario,
): Record<string, string> {
  const errores: Record<string, string> = {};

  for (const campo of campos) {
    const valor = (datos[campo.clave] ?? '').trim();

    if (!valor) {
      if (campoEsRequerido(campo, datos)) {
        errores[campo.clave] = campo.requerido_si_vacio
          ? `Obligatorio si no llenas "${campos.find((c) => c.clave === campo.requerido_si_vacio)?.etiqueta ?? campo.requerido_si_vacio}".`
          : 'Este campo es obligatorio.';
      }
      continue;
    }

    if (campo.tipo === 'numero' && !PATRON_NUMERO.test(valor)) {
      errores[campo.clave] = 'Escribe solo números.';
    } else if (campo.tipo === 'opciones' && campo.opciones?.length && !campo.opciones.includes(valor)) {
      errores[campo.clave] = 'Elige una de las opciones.';
    } else if (valor.length > LARGO_MAXIMO) {
      errores[campo.clave] = `Máximo ${LARGO_MAXIMO} caracteres.`;
    }
  }

  return errores;
}

/** Deja solo las claves conocidas, sin espacios sobrantes ni valores vacíos. */
export function limpiarDatos(campos: CampoFormulario[], datos: DatosFormulario): DatosFormulario {
  const limpio: DatosFormulario = {};
  for (const campo of campos) {
    let valor = (datos[campo.clave] ?? '').trim();
    if (!valor) continue;
    if (campo.mayusculas) valor = valor.toUpperCase();
    limpio[campo.clave] = valor.slice(0, LARGO_MAXIMO);
  }
  return limpio;
}

/** Pares etiqueta/valor para mostrar los datos de un reporte ya guardado. */
export function datosParaMostrar(
  campos: CampoFormulario[],
  datos: Json | null | undefined,
): { etiqueta: string; valor: string }[] {
  if (!esObjeto(datos)) return [];
  const conocidas = new Map(campos.map((c) => [c.clave, c.etiqueta]));
  return Object.entries(datos)
    .filter(([, valor]) => typeof valor === 'string' || typeof valor === 'number')
    .map(([clave, valor]) => ({ etiqueta: conocidas.get(clave) ?? clave, valor: String(valor) }));
}

/** Clave estable a partir de la etiqueta que escribe el administrador. */
export function claveDesdeEtiqueta(etiqueta: string): string {
  return etiqueta
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
