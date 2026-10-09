import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { registrarUsuario } from '@/src/services/auth';
import { Boton } from '@/src/ui/controles';

export function RegistroScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [requiereConfirmacion, setRequiereConfirmacion] = useState(false);

  const mutacion = useMutation({
    mutationFn: () =>
      registrarUsuario({ email: email.trim(), password, telefono: telefono.trim() || null }),
    onSuccess: (data) => {
      if (!data.session) {
        setRequiereConfirmacion(true);
      }
    },
  });

  if (requiereConfirmacion) {
    return (
      <div className="pantalla-auth">
        <h1 className="titulo-auth">Revisa tu correo</h1>
        <p className="subtitulo-auth">
          Te enviamos un enlace de confirmación a {email.trim()}. Confírmalo y vuelve a iniciar
          sesión.
        </p>
        <Link to="/login" replace className="enlace-centrado">
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form
      className="pantalla-auth"
      onSubmit={(e) => {
        e.preventDefault();
        mutacion.mutate();
      }}>
      <h1 className="titulo-auth">Crear cuenta</h1>
      <p className="subtitulo-auth">
        Tu ubicación exacta nunca sale de tu teléfono: el servidor solo conoce una celda
        aproximada.
      </p>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="campo"
        placeholder="Correo electrónico"
        type="email"
        autoCapitalize="none"
        autoComplete="email"
        inputMode="email"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="campo"
        placeholder="Contraseña (mínimo 6 caracteres)"
        type="password"
        autoComplete="new-password"
      />
      <input
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        className="campo"
        placeholder="Teléfono (opcional)"
        type="tel"
        inputMode="tel"
      />
      <p className="nota">
        El teléfono es opcional en este prototipo; todavía no hay verificación por SMS.
      </p>

      {mutacion.error ? <MensajeConfiguracion error={mutacion.error} /> : null}

      <Boton
        type="submit"
        className="mt-8"
        cargando={mutacion.isPending}
        disabled={mutacion.isPending || !email.trim() || password.length < 6}>
        Registrarme
      </Boton>

      <Link to="/login" replace className="enlace-centrado">
        Ya tengo cuenta
      </Link>
    </form>
  );
}
