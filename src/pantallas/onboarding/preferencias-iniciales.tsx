import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useCategorias } from '@/src/hooks/use-categorias';
import {
  useActualizarCategoriaPreferencia,
  useActualizarPreferencias,
  useCategoriaPreferencias,
} from '@/src/hooks/use-preferencias';
import { useSesion } from '@/src/hooks/use-sesion';
import { useUbicacion } from '@/src/hooks/use-ubicacion';
import { marcarOnboardingCompletado } from '@/src/services/preferencias';
import { Boton, Cargando, Interruptor } from '@/src/ui/controles';

const PASO_RADIO_METROS = 1000;
const RADIO_MINIMO_METROS = 1000;
const RADIO_MAXIMO_METROS = 50000;

export function PreferenciasInicialesScreen() {
  const { usuario } = useSesion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ubicacion = useUbicacion();
  const categoriasQuery = useCategorias();
  const categoriaPreferenciasQuery = useCategoriaPreferencias();
  const actualizarCategoriaPreferencia = useActualizarCategoriaPreferencia();
  const actualizarPreferencias = useActualizarPreferencias();

  const [radioMetros, setRadioMetros] = useState(5000);
  const [guardando, setGuardando] = useState(false);

  const categoriasActivas = new Map(
    (categoriaPreferenciasQuery.data ?? []).map((c) => [c.categoria_id, c.activa]),
  );

  async function finalizar() {
    if (!usuario) {
      return;
    }

    setGuardando(true);
    try {
      await actualizarPreferencias.mutateAsync({ radio_personal_metros: radioMetros });
      await marcarOnboardingCompletado(usuario.id);
      await ubicacion.activarSeguimientoEnSegundoPlano();
      // El perfil cacheado aún dice onboarding_completado=false; se refresca
      // antes de navegar para que el layout de pestañas no nos regrese aquí.
      await queryClient.invalidateQueries({ queryKey: ['perfil', usuario.id] });
      navigate('/', { replace: true });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="pantalla pantalla--14 safe-top">
      <h1 className="titulo">Antes de empezar</h1>
      <p className="subtitulo">
        Configura qué tan lejos quieres recibir alertas y de qué categorías. Puedes cambiarlo
        después en Ajustes.
      </p>

      <section className="tarjeta">
        <p className="etiqueta">Permiso de ubicación</p>
        {ubicacion.cargando ? (
          <Cargando />
        ) : (
          <p className="valor">
            {ubicacion.permisoConcedido
              ? 'Concedido'
              : 'No concedido — algunas funciones no estarán disponibles'}
          </p>
        )}
        {ubicacion.error ? <p className="texto-error">{ubicacion.error}</p> : null}
      </section>

      <section className="tarjeta">
        <p className="etiqueta">Radio personal</p>
        <p className="valor">{(radioMetros / 1000).toFixed(0)} km</p>
        <div className="fila fila--10">
          <Boton
            variante="paso"
            onClick={() => setRadioMetros((r) => Math.max(RADIO_MINIMO_METROS, r - PASO_RADIO_METROS))}>
            −1 km
          </Boton>
          <Boton
            variante="paso"
            onClick={() => setRadioMetros((r) => Math.min(RADIO_MAXIMO_METROS, r + PASO_RADIO_METROS))}>
            +1 km
          </Boton>
        </div>
      </section>

      <section className="tarjeta">
        <p className="etiqueta">Categorías activas</p>
        {categoriasQuery.data?.map((categoria) => (
          <div key={categoria.id} className="fila-switch">
            <span>{categoria.nombre}</span>
            <Interruptor
              etiqueta={categoria.nombre}
              valor={categoriasActivas.get(categoria.id) ?? categoria.nombre !== 'Otro'}
              onCambio={(valor) =>
                actualizarCategoriaPreferencia.mutate({ categoriaId: categoria.id, activa: valor })
              }
            />
          </div>
        ))}
      </section>

      <Boton className="mt-8" onClick={finalizar} disabled={guardando} cargando={guardando}>
        Continuar
      </Boton>
    </div>
  );
}
