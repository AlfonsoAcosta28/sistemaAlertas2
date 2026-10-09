/**
 * Filtro de groserías para la descripción y los campos de texto del reporte.
 *
 * El MISMO algoritmo está en SQL (`public.buscar_groseria`, migración
 * `..._alerta_cerca_groserias.sql`): el teléfono avisa al momento y el
 * servidor bloquea aunque alguien modifique la app. Si cambias uno, cambia el otro.
 *
 * Pasos:
 *  1. Minúsculas y sin acentos (la ñ se conserva: "coño" ≠ "cono").
 *  2. Números/símbolos que imitan letras: 0→o 1→i 3→e 4→a 5→s 7→t @→a $→s.
 *  3. Se separa en palabras y a cada una se le quitan los signos internos
 *     ("p.u.t.o" → "puto"). Letras sueltas seguidas se juntan ("p u t o" → "puto").
 *  4. Cada palabra se compara COMPLETA (no como pedazo: "computadora" no cuenta),
 *     también con letras repetidas reducidas ("puuuto") y sin la "s" final del plural.
 *  5. Las frases de la lista (con espacio, ej. "hijo de puta") se buscan en el texto normalizado.
 */

const ACENTOS: Record<string, string> = {
  á: 'a', à: 'a', ä: 'a', â: 'a',
  é: 'e', è: 'e', ë: 'e', ê: 'e',
  í: 'i', ì: 'i', ï: 'i', î: 'i',
  ó: 'o', ò: 'o', ö: 'o', ô: 'o',
  ú: 'u', ù: 'u', ü: 'u', û: 'u',
};

const SUSTITUTOS: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's',
};

/** Normaliza una palabra o frase de la lista (lo que se guarda en la base). */
export function normalizarPalabraProhibida(palabra: string): string {
  return palabrasDelTexto(palabra).join(' ');
}

/** Pasos 1–3: texto → lista de palabras normalizadas. */
export function palabrasDelTexto(texto: string): string[] {
  const limpio = [...texto.toLowerCase()].map((c) => ACENTOS[c] ?? SUSTITUTOS[c] ?? c).join('');

  const palabras: string[] = [];
  let letrasSueltas = '';
  const cerrarSueltas = () => {
    if (letrasSueltas.length >= 2) palabras.push(letrasSueltas);
    letrasSueltas = '';
  };

  for (const crudo of limpio.split(/\s+/)) {
    const palabra = crudo.replace(/[^a-zñ]/g, '');
    if (!palabra) continue;
    palabras.push(palabra);
    if (palabra.length === 1) {
      letrasSueltas += palabra;
    } else {
      cerrarSueltas();
    }
  }
  cerrarSueltas();
  return palabras;
}

/** Paso 4: formas con las que se compara cada palabra. */
export function variantesDePalabra(palabra: string): string[] {
  const variantes = new Set([
    palabra,
    palabra.replace(/(.)\1{2,}/g, '$1'), // "puuuto" → "puto"
    palabra.replace(/(.)\1{2,}/g, '$1$1'), // "perrrra" → "perra"
  ]);
  for (const v of [...variantes]) {
    if (v.length > 3 && v.endsWith('s')) variantes.add(v.slice(0, -1)); // plural
  }
  return [...variantes];
}

/** Devuelve la palabra prohibida encontrada (normalizada) o null. */
export function buscarGroseria(texto: string, lista: readonly string[]): string | null {
  if (!texto.trim() || lista.length === 0) return null;

  const palabras = palabrasDelTexto(texto);
  const sueltas = new Set(lista.filter((p) => !p.includes(' ')));
  const frases = lista.filter((p) => p.includes(' '));

  for (const palabra of palabras) {
    for (const variante of variantesDePalabra(palabra)) {
      if (sueltas.has(variante)) return variante;
    }
  }

  const unido = ` ${palabras.map((p) => p.replace(/(.)\1{2,}/g, '$1')).join(' ')} `;
  return frases.find((frase) => unido.includes(` ${frase} `)) ?? null;
}

export const MENSAJE_GROSERIA = 'Usa un lenguaje respetuoso: el texto tiene palabras ofensivas.';
