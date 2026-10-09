import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter } from 'react-router';

import { useInicializarSesion } from '@/src/hooks/use-sesion';
import { NavegacionRaiz } from '@/src/navegacion/navegacion-raiz';

export function App() {
  const [queryClient] = useState(() => new QueryClient());
  useInicializarSesion();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NavegacionRaiz />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
