import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { obtenerEtiquetaEstadoReporte } from '@/src/domain/mapa';
import { useCategorias } from '@/src/hooks/use-categorias';
import {
  useCerrarReporte,
  useDescartarReporte,
  useReportesPendientesModeracion,
  useVerificarReporte,
} from '@/src/hooks/use-moderacion';
import { obtenerUrlFirmadaFoto } from '@/src/services/moderacion';
import type { Database } from '@/src/types/database';
import { Boton, Cargando } from '@/src/ui/controles';

type Reporte = Database['public']['Tables']['reportes']['Row'];

function FotoReporte({ rutaFoto }: { rutaFoto: string }) {
  const urlQuery = useQuery({
    queryKey: ['foto-firmada', rutaFoto],
    queryFn: () => obtenerUrlFirmadaFoto(rutaFoto),
  });

  if (urlQuery.isLoading) {
    return <Cargando />;
  }

  if (!urlQuery.data) {
    return null;
  }

  return <img src={urlQuery.data} alt="Foto del reporte" className="foto-moderacion" />;
}

function FilaReporte({ reporte, nombreCategoria }: { reporte: Reporte; nombreCategoria: string }) {
  const verificar = useVerificarReporte();
  const descartar = useDescartarReporte();
  const cerrar = useCerrarReporte();
  const [motivo, setMotivo] = useState('');

  return (
    <article className="tarjeta tarjeta--12">
      <div className="fila fila--entre">
        <span className="etiqueta">{nombreCategoria}</span>
        <span className="texto-ambar">{obtenerEtiquetaEstadoReporte(reporte.estado)}</span>
      </div>

      <p className="texto-pequeno texto-secundario">
        Ubicación exacta: {reporte.latitud_exacta.toFixed(5)}, {reporte.longitud_exacta.toFixed(5)}
      </p>

      {reporte.descripcion ? <p>{reporte.descripcion}</p> : null}
      {reporte.foto_url ? <FotoReporte rutaFoto={reporte.foto_url} /> : null}

      <div className="fila fila--8">
        <Boton
          className="boton--verde"
          onClick={() => verificar.mutate({ reporteId: reporte.id })}
          disabled={verificar.isPending}>
          Verificar
        </Boton>
        <Boton className="boton--pizarra" onClick={() => cerrar.mutate(reporte.id)} disabled={cerrar.isPending}>
          Cerrar
        </Boton>
      </div>

      <input
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo de descarte (obligatorio para descartar)"
        className="campo campo--claro campo--8"
      />
      <Boton
        variante="peligro"
        onClick={() => {
          descartar.mutate({ reporteId: reporte.id, motivo });
          setMotivo('');
        }}
        disabled={descartar.isPending || !motivo.trim()}>
        Descartar
      </Boton>

      {verificar.error || descartar.error || cerrar.error ? (
        <MensajeConfiguracion error={verificar.error ?? descartar.error ?? cerrar.error} />
      ) : null}
    </article>
  );
}

export function ModeracionScreen() {
  const pendientesQuery = useReportesPendientesModeracion();
  const categoriasQuery = useCategorias();
  const nombrePorCategoria = new Map((categoriasQuery.data ?? []).map((c) => [c.id, c.nombre]));

  return (
    <div className="pantalla pantalla--12 pantalla--16">
      <h2 className="titulo titulo--22">Cola de moderación</h2>
      <Link to="/admin/historial">Ver historial de acciones</Link>

      {pendientesQuery.error ? <MensajeConfiguracion error={pendientesQuery.error} /> : null}

      {pendientesQuery.data?.length ? (
        pendientesQuery.data.map((reporte) => (
          <FilaReporte
            key={reporte.id}
            reporte={reporte}
            nombreCategoria={nombrePorCategoria.get(reporte.categoria_id) ?? 'Categoría'}
          />
        ))
      ) : (
        <p className="texto-tenue">No hay reportes pendientes de moderación.</p>
      )}
    </div>
  );
}
