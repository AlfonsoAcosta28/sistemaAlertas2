import type { EstiloEstado } from '@/src/domain/mapa';

export function InsigniaEstado({ estilo }: { estilo: EstiloEstado }) {
  return (
    <span
      className="insignia"
      style={{ borderColor: estilo.colorBorde, backgroundColor: estilo.colorFondo, color: estilo.colorTexto }}>
      {estilo.etiqueta}
    </span>
  );
}
