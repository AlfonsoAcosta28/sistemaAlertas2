import { useNavigate, useParams } from 'react-router';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { datosParaMostrar, normalizarCampos } from '@/src/domain/formulario';
import { rutaIconoAlerta } from '@/src/domain/iconos-alerta';
import { obtenerEstiloEstadoReporte } from '@/src/domain/mapa';
import { colorVeracidad } from '@/src/domain/reputacion';
import { useDetalleReporte, useTodasLasCategorias } from '@/src/hooks/use-admin';
import { AccionesValidacion, FotoReporte, ResumenAnalisis } from '@/src/pantallas/admin/moderacion';
import { describirDetalle, ETIQUETA_ACCION } from '@/src/pantallas/admin/historial';
import type { AnalisisFoto } from '@/src/types/database';
import { Boton, Cargando } from '@/src/ui/controles';
import { InsigniaEstado } from '@/src/ui/insignia-estado';

const ESTADO_ENVIO: Record<string, string> = {
  enviado: 'Enviado',
  validado_verdad: 'Validó: VERDAD',
  validado_mentira: 'Validó: MENTIRA',
  cerrado: 'Cerrado',
};

function fecha(valor: string | null) {
  return valor ? new Date(valor).toLocaleString('es-MX') : null;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  if (valor === null || valor === undefined || valor === '') return null;
  return (
    <div>
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

/** Toda la información de un reporte: datos, foto, envíos e historial de acciones. */
export function DetalleReporteScreen() {
  const { reporteId } = useParams();
  const navigate = useNavigate();
  const detalleQuery = useDetalleReporte(reporteId);
  const categoriasQuery = useTodasLasCategorias();

  const volver = (
    <Boton variante="enlace" className="alinear-inicio" onClick={() => navigate(-1)}>
      ‹ Volver
    </Boton>
  );

  if (detalleQuery.isLoading) {
    return (
      <div className="pantalla pantalla--12 pantalla--16">
        <Cargando />
      </div>
    );
  }

  const reporte = detalleQuery.data?.reporte;
  if (detalleQuery.error || !reporte) {
    return (
      <div className="pantalla pantalla--12 pantalla--16">
        {volver}
        {detalleQuery.error ? (
          <MensajeConfiguracion error={detalleQuery.error} />
        ) : (
          <p className="texto-tenue">
            No encontramos este reporte o no tienes permiso para verlo (solo ves los enviados a tu institución).
          </p>
        )}
      </div>
    );
  }

  const categoria = categoriasQuery.data?.find((c) => c.id === reporte.categoria_id);
  const datos = datosParaMostrar(normalizarCampos(categoria?.campos_formulario), reporte.datos);
  const { envios, auditoria } = detalleQuery.data ?? { envios: [], auditoria: [] };
  const mapaUrl = `https://www.google.com/maps?q=${reporte.latitud_exacta},${reporte.longitud_exacta}`;

  return (
    <div className="pantalla pantalla--12 pantalla--16">
      {volver}

      <section className="tarjeta">
        <div className="fila fila--10 alinear-centro">
          <img src={rutaIconoAlerta(categoria?.icono)} alt="" className="icono-detalle" />
          <div className="pila pila--6">
            <p className="titulo-detalle">{categoria?.nombre ?? 'Reporte'}</p>
            <InsigniaEstado estilo={obtenerEstiloEstadoReporte(reporte.estado, reporte.severidad)} />
          </div>
        </div>

        <p className="texto-pequeno">
          <span className="negrita" style={{ color: colorVeracidad(reporte.veracidad) }}>
            {reporte.veracidad}% de veracidad
          </span>{' '}
          <span className="texto-secundario">
            · apoyo {reporte.puntaje_apoyo} / en contra {reporte.puntaje_contra}
          </span>
        </p>

        <dl className="lista-datos">
          <Dato etiqueta="Gravedad" valor={reporte.severidad} />
          <Dato etiqueta="Reportado" valor={fecha(reporte.created_at)} />
          <Dato etiqueta="Pre-validado" valor={fecha(reporte.prevalidado_en)} />
          <Dato etiqueta="Evaluado por institución" valor={fecha(reporte.verificado_en)} />
          <Dato etiqueta="Cerrado" valor={fecha(reporte.cerrado_en)} />
          <Dato etiqueta="Motivo (MENTIRA)" valor={reporte.descartado_motivo} />
          <Dato
            etiqueta="Ubicación exacta"
            valor={
              <a href={mapaUrl} target="_blank" rel="noreferrer">
                {reporte.latitud_exacta.toFixed(5)}, {reporte.longitud_exacta.toFixed(5)}
              </a>
            }
          />
          <Dato etiqueta="Radio" valor={`${reporte.radio_inicial_metros} m`} />
          <Dato etiqueta="Autor" valor={reporte.creador_id ? 'Usuario registrado (anónimo)' : 'Cuenta eliminada'} />
        </dl>
      </section>

      {datos.length > 0 || reporte.descripcion ? (
        <section className="tarjeta">
          <p className="etiqueta">Información del reporte</p>
          {datos.length > 0 ? (
            <dl className="lista-datos">
              {datos.map(({ etiqueta, valor }) => (
                <Dato key={etiqueta} etiqueta={etiqueta} valor={valor} />
              ))}
            </dl>
          ) : null}
          {reporte.descripcion ? <p>{reporte.descripcion}</p> : null}
        </section>
      ) : null}

      {reporte.foto_url ? (
        <section className="tarjeta">
          <p className="etiqueta">Foto</p>
          <FotoReporte rutaFoto={reporte.foto_url} />
          <ResumenAnalisis analisis={reporte.analisis_foto as AnalisisFoto | null} />
        </section>
      ) : null}

      <section className="tarjeta">
        <p className="etiqueta">Instituciones</p>
        {envios.length > 0 ? (
          envios.map((e) => (
            <p key={e.institucion} className="texto-pequeno">
              <span className="negrita">{e.institucion}</span> · {ESTADO_ENVIO[e.estado] ?? e.estado} ·{' '}
              <span className="texto-tenue">{fecha(e.enviado_en)}</span>
            </p>
          ))
        ) : (
          <p className="texto-pequeno texto-tenue">Todavía no se ha enviado (no se ha pre-validado).</p>
        )}
      </section>

      <section className="tarjeta">
        <p className="etiqueta">Historial de este reporte</p>
        <ol className="linea-tiempo">
          <li>
            <span className="negrita">Reportado</span>
            <span className="texto-pequeno texto-tenue">{fecha(reporte.created_at)}</span>
          </li>
          {auditoria.map((a) => {
            const texto = describirDetalle(a.accion, a.detalle);
            return (
              <li key={a.id}>
                <span className="negrita">{ETIQUETA_ACCION[a.accion] ?? a.accion}</span>
                {texto ? <span className="texto-pequeno texto-secundario">{texto}</span> : null}
                <span className="texto-pequeno texto-tenue">
                  {fecha(a.created_at)} · {a.admin_id ? 'Institución / administrador' : 'Automático'}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <AccionesValidacion reporte={reporte} />
    </div>
  );
}
