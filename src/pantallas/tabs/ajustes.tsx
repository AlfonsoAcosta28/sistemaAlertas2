import { useState } from 'react';
import { useNavigate } from 'react-router';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { useCategorias } from '@/src/hooks/use-categorias';
import { usePermisosDispositivo } from '@/src/hooks/use-permisos-dispositivo';
import { useEsModerador } from '@/src/hooks/use-perfil';
import {
  useActualizarCategoriaPreferencia,
  useActualizarPreferencias,
  useCategoriaPreferencias,
  usePreferencias,
} from '@/src/hooks/use-preferencias';
import { useSesion } from '@/src/hooks/use-sesion';
import { useUbicacion } from '@/src/hooks/use-ubicacion';
import { useBorrarZonaGuardada, useCrearZonaGuardada, useZonasGuardadas } from '@/src/hooks/use-zonas';
import { cerrarSesion } from '@/src/services/auth';
import { eliminarCuentaPropia } from '@/src/services/cuenta';
import { detenerSeguimientoEnSegundoPlano } from '@/src/tasks/ubicacion-background-task';
import { Boton, Interruptor } from '@/src/ui/controles';
import { alerta, confirmar } from '@/src/ui/dialogos';
import { esNativo } from '@/src/utils/entorno';

const PASO_RADIO_METROS = 1000;
const RADIO_MINIMO_METROS = 1000;
const RADIO_MAXIMO_METROS = 50000;

export function AjustesScreen() {
  const { usuario } = useSesion();
  const navigate = useNavigate();
  const permisos = usePermisosDispositivo();
  const ubicacion = useUbicacion();
  const { esModerador } = useEsModerador();

  const preferenciasQuery = usePreferencias();
  const actualizarPreferencias = useActualizarPreferencias();
  const categoriasQuery = useCategorias();
  const categoriaPreferenciasQuery = useCategoriaPreferencias();
  const actualizarCategoriaPreferencia = useActualizarCategoriaPreferencia();

  const zonasQuery = useZonasGuardadas();
  const crearZona = useCrearZonaGuardada();
  const borrarZona = useBorrarZonaGuardada();
  const [nombreZona, setNombreZona] = useState('');

  const [eliminando, setEliminando] = useState(false);

  const radioMetros = preferenciasQuery.data?.radio_personal_metros ?? 5000;
  const categoriaActivaPorId = new Map(
    (categoriaPreferenciasQuery.data ?? []).map((c) => [c.categoria_id, c.activa]),
  );
  const horarioSilencioActivo = Boolean(
    preferenciasQuery.data?.horario_silencio_inicio && preferenciasQuery.data?.horario_silencio_fin,
  );

  function cambiarRadio(delta: number) {
    const nuevo = Math.min(RADIO_MAXIMO_METROS, Math.max(RADIO_MINIMO_METROS, radioMetros + delta));
    actualizarPreferencias.mutate({ radio_personal_metros: nuevo });
  }

  function alternarHorarioSilencio(activar: boolean) {
    actualizarPreferencias.mutate(
      activar
        ? { horario_silencio_inicio: '22:00:00', horario_silencio_fin: '07:00:00' }
        : { horario_silencio_inicio: null, horario_silencio_fin: null },
    );
  }

  async function agregarZona() {
    if (!nombreZona.trim() || !ubicacion.ubicacion) {
      await alerta('Falta información', 'Dale un nombre y asegúrate de tener tu ubicación actual.');
      return;
    }

    await crearZona.mutateAsync({
      nombre: nombreZona.trim(),
      celdaH3: ubicacion.ubicacion.celdaH3,
      radioMetros: 1000,
    });
    setNombreZona('');
  }

  async function activarSegundoPlano() {
    const activo = await ubicacion.activarSeguimientoEnSegundoPlano();
    await alerta(
      'Ubicación en segundo plano',
      activo
        ? 'Activada. Verás una notificación fija mientras la app actualiza tu zona aproximada.'
        : esNativo
          ? 'No se pudo activar. Revisa que hayas permitido la ubicación "Todo el tiempo".'
          : 'Solo está disponible en la app de Android/iOS.',
    );
  }

  async function confirmarBorrarCuenta() {
    const aceptado = await confirmar(
      'Borrar mi cuenta y datos',
      'Esta acción es permanente: se borrarán tus preferencias, zonas guardadas y tu cuenta. ¿Continuar?',
      'Borrar todo',
    );
    if (!aceptado) return;

    setEliminando(true);
    try {
      await eliminarCuentaPropia();
      await detenerSeguimientoEnSegundoPlano();
      navigate('/login', { replace: true });
    } catch (error) {
      await alerta(
        'No fue posible borrar la cuenta',
        error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
      );
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="pantalla pantalla--14">
      <h2 className="titulo">Ajustes</h2>

      {preferenciasQuery.error ? <MensajeConfiguracion error={preferenciasQuery.error} /> : null}

      <section className="tarjeta">
        <p className="etiqueta">Radio personal</p>
        <p className="valor">{(radioMetros / 1000).toFixed(0)} km</p>
        <div className="fila fila--10">
          <Boton variante="paso" onClick={() => cambiarRadio(-PASO_RADIO_METROS)}>
            −1 km
          </Boton>
          <Boton variante="paso" onClick={() => cambiarRadio(PASO_RADIO_METROS)}>
            +1 km
          </Boton>
        </div>
      </section>

      <section className="tarjeta">
        <div className="fila-switch">
          <span className="etiqueta">Ver reportes sin confirmar</span>
          <Interruptor
            etiqueta="Ver reportes sin confirmar"
            valor={preferenciasQuery.data?.ver_no_confirmados ?? true}
            onCambio={(valor) => actualizarPreferencias.mutate({ ver_no_confirmados: valor })}
          />
        </div>
        <div className="fila-switch">
          <span className="etiqueta">Horario de silencio (22:00–07:00)</span>
          <Interruptor
            etiqueta="Horario de silencio"
            valor={horarioSilencioActivo}
            onCambio={alternarHorarioSilencio}
          />
        </div>
        <div className="fila-switch">
          <span className="etiqueta">Permitir alertas críticas en silencio</span>
          <Interruptor
            etiqueta="Permitir alertas críticas en silencio"
            valor={preferenciasQuery.data?.autoriza_alertas_criticas_en_silencio ?? true}
            onCambio={(valor) =>
              actualizarPreferencias.mutate({ autoriza_alertas_criticas_en_silencio: valor })
            }
          />
        </div>
      </section>

      <section className="tarjeta">
        <p className="etiqueta">Categorías activas</p>
        {categoriasQuery.data?.map((categoria) => (
          <div key={categoria.id} className="fila-switch">
            <span>{categoria.nombre}</span>
            <Interruptor
              etiqueta={categoria.nombre}
              valor={categoriaActivaPorId.get(categoria.id) ?? categoria.nombre !== 'Otro'}
              onCambio={(valor) =>
                actualizarCategoriaPreferencia.mutate({ categoriaId: categoria.id, activa: valor })
              }
            />
          </div>
        ))}
      </section>

      <section className="tarjeta">
        <p className="etiqueta">Zonas guardadas</p>
        {zonasQuery.data?.map((zona) => (
          <div key={zona.id} className="fila-switch">
            <span>
              {zona.nombre} ({(zona.radio_metros / 1000).toFixed(1)} km)
            </span>
            <button type="button" className="boton-texto-peligro" onClick={() => borrarZona.mutate(zona.id)}>
              Quitar
            </button>
          </div>
        ))}
        <input
          value={nombreZona}
          onChange={(e) => setNombreZona(e.target.value)}
          placeholder="Nombre (ej. Casa, Trabajo)"
          className="campo campo--claro"
        />
        <Boton variante="secundario" onClick={() => void agregarZona()} disabled={crearZona.isPending}>
          Guardar mi ubicación actual como zona
        </Boton>
      </section>

      {esModerador ? (
        <Boton variante="secundario" onClick={() => navigate('/admin')}>
          Abrir panel de moderación
        </Boton>
      ) : null}

      <section className="tarjeta">
        <p className="etiqueta">Permisos del dispositivo</p>
        <p className="texto-secundario texto-13">Ubicación: {permisos.estadoUbicacion}</p>
        <p className="texto-secundario texto-13">Notificaciones: {permisos.estadoNotificaciones}</p>
        <Boton variante="secundario" onClick={() => void activarSegundoPlano()}>
          Activar actualización de ubicación en segundo plano
        </Boton>
      </section>

      <section className="tarjeta">
        <p className="etiqueta">Privacidad y derechos ARCO</p>
        <p className="texto-secundario texto-13">
          Tu ubicación exacta nunca sale de tu teléfono. El servidor solo guarda tu última celda
          aproximada (H3), sin historial. Puedes acceder, rectificar, cancelar u oponerte al uso de
          tus datos, o borrarlos por completo.
        </p>
        <Boton
          variante="peligro"
          onClick={() => void confirmarBorrarCuenta()}
          disabled={eliminando}
          cargando={eliminando}>
          Borrar mi cuenta y datos
        </Boton>
      </section>

      <Boton
        variante="secundario"
        onClick={async () => {
          await cerrarSesion();
          await detenerSeguimientoEnSegundoPlano();
          navigate('/login', { replace: true });
        }}>
        Cerrar sesión
      </Boton>

      <p className="texto-centrado texto-pequeno texto-tenue">Sesión: {usuario?.email}</p>
    </div>
  );
}
