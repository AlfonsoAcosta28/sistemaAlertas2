// Íconos SVG mínimos (sustituyen a @expo/vector-icons / Ionicons).
type PropsIcono = { activo?: boolean; tamano?: number };

function Svg({ children, tamano = 24 }: { children: React.ReactNode; tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      {children}
    </svg>
  );
}

const relleno = (activo?: boolean) => (activo ? 'currentColor' : 'none');

export function IconoInicio({ activo, tamano }: PropsIcono) {
  return (
    <Svg tamano={tamano ?? 24}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill={relleno(activo)} />
    </Svg>
  );
}

export function IconoMapa({ activo, tamano }: PropsIcono) {
  return (
    <Svg tamano={tamano ?? 24}>
      <path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z" fill={relleno(activo)} fillOpacity={0.25} />
      <path d="M9 4v13.5M15 6.5V20" />
    </Svg>
  );
}

export function IconoReportar({ activo, tamano }: PropsIcono) {
  return (
    <Svg tamano={tamano ?? 24}>
      <circle cx="12" cy="12" r="9" fill={relleno(activo)} fillOpacity={0.25} />
      <path d="M12 8v8M8 12h8" />
    </Svg>
  );
}

export function IconoDocumento({ activo, tamano }: PropsIcono) {
  return (
    <Svg tamano={tamano ?? 24}>
      <path d="M6 2h8l4 4v16H6z" fill={relleno(activo)} fillOpacity={0.25} />
      <path d="M9 12h6M9 16h6M14 2v4h4" />
    </Svg>
  );
}

export function IconoAjustes({ activo, tamano }: PropsIcono) {
  return (
    <Svg tamano={tamano ?? 24}>
      <circle cx="12" cy="12" r="3" fill={relleno(activo)} />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Svg>
  );
}

export function IconoAtras({ tamano }: PropsIcono) {
  return (
    <Svg tamano={tamano ?? 22}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  );
}
