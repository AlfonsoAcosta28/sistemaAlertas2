import { useMemo, useState } from 'react';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { buscarGroseria, normalizarPalabraProhibida } from '@/src/domain/groserias';
import { useAgregarPalabraProhibida, usePalabrasProhibidas, useQuitarPalabraProhibida } from '@/src/hooks/use-admin';
import { Boton, Cargando } from '@/src/ui/controles';
import { confirmar } from '@/src/ui/dialogos';

/**
 * Administrador: lista de groserías que no se permiten en la descripción ni en
 * los campos de los reportes. Se guarda normalizada (sin acentos ni mayúsculas)
 * y el filtro ya detecta plurales, letras repetidas y números en lugar de letras.
 */
export function LenguajeAdminScreen() {
  const palabrasQuery = usePalabrasProhibidas();
  const agregar = useAgregarPalabraProhibida();
  const quitar = useQuitarPalabraProhibida();
  const [nueva, setNueva] = useState('');
  const [filtro, setFiltro] = useState('');
  const [prueba, setPrueba] = useState('');

  const lista = palabrasQuery.data ?? [];
  const visibles = useMemo(() => {
    const f = normalizarPalabraProhibida(filtro);
    return f ? lista.filter((p) => p.includes(f)) : lista;
  }, [lista, filtro]);
  const resultadoPrueba = prueba.trim() ? buscarGroseria(prueba, lista) : null;

  function enviar() {
    const palabra = nueva.trim();
    if (!palabra) return;
    agregar.mutate(palabra, { onSuccess: () => setNueva('') });
  }

  async function borrar(palabra: string) {
    if (await confirmar('Quitar palabra', `¿Permitir de nuevo «${palabra}» en los reportes?`, 'Quitar')) {
      quitar.mutate(palabra);
    }
  }

  return (
    <div className="pantalla pantalla--12 pantalla--16">
      <h2 className="titulo titulo--22">Lenguaje inapropiado</h2>
      <p className="texto-secundario texto-13">
        Los reportes con estas palabras no se pueden enviar. No hace falta agregar variantes con acentos,
        mayúsculas, plurales, letras repetidas («puuuto») o números («p3ndejo»): el filtro ya las detecta.
        Para frases, escríbelas con espacios (ej. «hijo de puta»).
      </p>

      <section className="tarjeta">
        <p className="etiqueta">Agregar palabra o frase</p>
        <form
          className="fila fila--8"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}>
          <input
            className="campo campo--claro"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            placeholder="Nueva palabra"
            autoCapitalize="none"
          />
          <Boton type="submit" className="boton--auto" disabled={!nueva.trim() || agregar.isPending}>
            Agregar
          </Boton>
        </form>
        {agregar.error ? <MensajeConfiguracion error={agregar.error} /> : null}
      </section>

      <section className="tarjeta">
        <p className="etiqueta">Probar un texto</p>
        <input
          className="campo campo--claro"
          value={prueba}
          onChange={(e) => setPrueba(e.target.value)}
          placeholder="Escribe un texto para ver si se bloquearía"
        />
        {prueba.trim() ? (
          resultadoPrueba ? (
            <p className="texto-error texto-pequeno">Se bloquearía (detectó «{resultadoPrueba}»).</p>
          ) : (
            <p className="texto-verde texto-pequeno">Se permitiría.</p>
          )
        ) : null}
      </section>

      <section className="tarjeta">
        <div className="fila fila--entre alinear-centro">
          <p className="etiqueta">Lista ({lista.length})</p>
        </div>
        <input
          className="campo campo--claro"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar en la lista"
        />
        {palabrasQuery.isLoading ? <Cargando /> : null}
        {palabrasQuery.error ? <MensajeConfiguracion error={palabrasQuery.error} /> : null}
        {quitar.error ? <MensajeConfiguracion error={quitar.error} /> : null}
        <div className="rejilla">
          {visibles.map((palabra) => (
            <span key={palabra} className="chip chip--chico chip--quitable">
              {palabra}
              <button type="button" aria-label={`Quitar ${palabra}`} onClick={() => void borrar(palabra)}>
                ×
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
