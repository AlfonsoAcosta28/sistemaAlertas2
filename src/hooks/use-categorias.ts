import { useQuery } from '@tanstack/react-query';

import { listarCategoriasActivas } from '@/src/services/categorias';

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias', 'activas'],
    queryFn: listarCategoriasActivas,
  });
}
