type MensajeConfiguracionProps = {
  error: unknown;
};

export function MensajeConfiguracion({ error }: MensajeConfiguracionProps) {
  const mensaje = error instanceof Error ? error.message : 'No fue posible conectarse al backend.';

  return (
    <div className="aviso-config">
      <p className="aviso-config__titulo">Modo sin backend configurado</p>
      <p>{mensaje}</p>
      <p>Revisa .env.example y configura tus variables VITE_*.</p>
    </div>
  );
}
