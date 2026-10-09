import { Link, useNavigate } from 'react-router';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { rutaIconoAlerta } from '@/src/domain/iconos-alerta';
import { useReglasCategorias } from '@/src/hooks/use-admin';
import { useCategorias } from '@/src/hooks/use-categorias';
import { useRol } from '@/src/hooks/use-perfil';
import { Boton } from '@/src/ui/controles';

export function InicioScreen() {
  const categoriasQuery = useCategorias();
  const reglasQuery = useReglasCategorias();
  const { puedeValidar, esAdministrador } = useRol();
  const navigate = useNavigate();

  return (
    <div className="pantalla">
      <h2 className="titulo titulo--grande">ALERTA CERCA</h2>
      <p className="subtitulo">Alertamiento comunitario por proximidad</p>

      {/* Solo para roles Gubernamental y Administrador. */}
      {puedeValidar ? (
        <Boton className="boton-panel" onClick={() => navigate('/admin')}>
          {esAdministrador ? 'Abrir panel de administrador' : 'Abrir panel de validación'}
        </Boton>
      ) : null}

      <div className="estado estado--no-confirmada">
        <p className="estado__titulo">1. Reportada</p>
        <p>Un vecino lo reporta. Les preguntamos a quienes están más cerca: ¿tú también lo ves?</p>
      </div>

      <div className="estado estado--corroborada">
        <p className="estado__titulo">2. Pre-validada</p>
        <p>
          Suficientes personas lo confirmaron (cada voto pesa según la reputación). Se calcula un % de veracidad
          y se envía a la institución correspondiente.
        </p>
      </div>

      <div className="estado estado--verificada">
        <p className="estado__titulo">3. Validada</p>
        <p>La institución confirma si es VERDAD o MENTIRA; quienes participaron ganan o pierden reputación.</p>
      </div>

      {categoriasQuery.error ? (
        <MensajeConfiguracion error={categoriasQuery.error} />
      ) : (
        <section className="tarjeta tarjeta--compacta">
          <p className="etiqueta">Tipos de alerta</p>
          {categoriasQuery.data?.map((c) => {
            const umbral = reglasQuery.data?.get(c.id)?.umbral_confirmaciones;
            return (
              <div key={c.id} className="fila fila--8 alinear-centro">
                <img src={rutaIconoAlerta(c.icono)} alt="" className="icono-categoria" />
                <span className="negrita">{c.nombre}</span>
                <span className="texto-pequeno texto-tenue">
                  {c.radio_inicial_metros >= 1000
                    ? `${(c.radio_inicial_metros / 1000).toFixed(c.radio_inicial_metros % 1000 ? 1 : 0)} km`
                    : `${c.radio_inicial_metros} m`}
                  {umbral ? ` · ${umbral} ${umbral === 1 ? 'persona' : 'personas'}` : ''}
                </span>
              </div>
            );
          }) ?? <p>Sin datos</p>}
        </section>
      )}

      <div className="pila pila--8 mt-8">
        <Link to="/mapa" replace>Ir al mapa</Link>
        <Link to="/crear-reporte" replace>Crear reporte</Link>
        <Link to="/mis-reportes" replace>Ver mis reportes</Link>
        <Link to="/ajustes" replace>Abrir ajustes</Link>
      </div>
    </div>
  );
}
