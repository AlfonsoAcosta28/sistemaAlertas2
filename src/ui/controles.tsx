import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Sustituto de `<Switch>` de React Native. */
export function Interruptor({
  valor,
  onCambio,
  etiqueta,
}: {
  valor: boolean;
  onCambio: (valor: boolean) => void;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      aria-label={etiqueta}
      className={`interruptor${valor ? ' interruptor--activo' : ''}`}
      onClick={() => onCambio(!valor)}>
      <span className="interruptor__perilla" />
    </button>
  );
}

/** Sustituto de `<ActivityIndicator>`. */
export function Cargando({ claro = false }: { claro?: boolean }) {
  return <span className={`spinner${claro ? ' spinner--claro' : ''}`} role="status" aria-label="Cargando" />;
}

type PropsBoton = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'principal' | 'secundario' | 'paso' | 'peligro' | 'contorno' | 'gris' | 'enlace';
  cargando?: boolean;
  children: ReactNode;
};

export function Boton({ variante = 'principal', cargando, children, className, ...resto }: PropsBoton) {
  return (
    <button
      type="button"
      {...resto}
      className={`boton boton--${variante}${className ? ` ${className}` : ''}`}>
      {cargando ? <Cargando claro={variante === 'principal' || variante === 'peligro'} /> : children}
    </button>
  );
}
