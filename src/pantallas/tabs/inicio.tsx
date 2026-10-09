import { Link } from 'react-router';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { useCategorias } from '@/src/hooks/use-categorias';

export function InicioScreen() {
  const categoriasQuery = useCategorias();

  return (
    <div className="pantalla">
      <h2 className="titulo titulo--grande">ALERTA CERCA</h2>
      <p className="subtitulo">Alertamiento comunitario por proximidad</p>

      <div className="estado estado--no-confirmada">
        <p className="estado__titulo">Reporte ciudadano sin confirmar</p>
        <p>Publicación inicial; solo llega dentro del radio inicial de su categoría.</p>
      </div>

      <div className="estado estado--corroborada">
        <p className="estado__titulo">Varios reportes (corroborada)</p>
        <p>Tres o más reportes independientes coinciden: puede pasar al segundo anillo.</p>
      </div>

      <div className="estado estado--verificada">
        <p className="estado__titulo">Alerta verificada</p>
        <p>Confirmada por un moderador o autoridad.</p>
      </div>

      {categoriasQuery.error ? (
        <MensajeConfiguracion error={categoriasQuery.error} />
      ) : (
        <p>
          Categorías activas:{' '}
          {categoriasQuery.data && categoriasQuery.data.length > 0
            ? String(categoriasQuery.data.length)
            : 'Sin datos'}
        </p>
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
