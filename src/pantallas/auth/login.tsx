import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { MensajeConfiguracion } from '@/src/components/mensaje-configuracion';
import { iniciarSesion } from '@/src/services/auth';
import { Boton } from '@/src/ui/controles';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutacion = useMutation({
    mutationFn: () => iniciarSesion({ email: email.trim(), password }),
  });

  return (
    <form
      className="pantalla-auth"
      onSubmit={(e) => {
        e.preventDefault();
        mutacion.mutate();
      }}>
      <h1 className="titulo-auth">ALERTA CERCA</h1>
      <p className="subtitulo-auth">Inicia sesión para reportar y recibir alertas cercanas.</p>

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
        placeholder="Contraseña"
        type="password"
        autoComplete="current-password"
      />

      {mutacion.error ? <MensajeConfiguracion error={mutacion.error} /> : null}

      <Boton
        type="submit"
        className="mt-8"
        cargando={mutacion.isPending}
        disabled={mutacion.isPending || !email.trim() || !password}>
        Iniciar sesión
      </Boton>

      <Link to="/registro" replace className="enlace-centrado">
        ¿No tienes cuenta? Regístrate
      </Link>
    </form>
  );
}
