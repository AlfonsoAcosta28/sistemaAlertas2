import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { useHistorialModeracion } from '@/src/hooks/use-moderacion';

const ETIQUETA_ACCION: Record<string, string> = {
  verificar: 'Verificó',
  descartar: 'Descartó',
  cerrar: 'Cerró',
};

export function HistorialModeracionScreen() {
  const historialQuery = useHistorialModeracion();

  return (
    <div className="pantalla pantalla--10 pantalla--16">
      <h2 className="titulo titulo--22">Historial de moderación</h2>

      {historialQuery.error ? <MensajeConfiguracion error={historialQuery.error} /> : null}

      {historialQuery.data?.length ? (
        historialQuery.data.map((entrada) => (
          <article key={entrada.id} className="tarjeta tarjeta--compacta">
            <p className="negrita">{ETIQUETA_ACCION[entrada.accion] ?? entrada.accion}</p>
            <p className="texto-pequeno texto-tenue">
              {new Date(entrada.created_at).toLocaleString('es-MX')}
            </p>
            {entrada.detalle && Object.keys(entrada.detalle as object).length > 0 ? (
              <p className="texto-pequeno texto-secundario">{JSON.stringify(entrada.detalle)}</p>
            ) : null}
          </article>
        ))
      ) : (
        <p className="texto-tenue">Todavía no hay acciones registradas.</p>
      )}
    </div>
  );
}
