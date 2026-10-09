-- Roles del documento de requisitos:
--   * Usuario normal  -> 'ciudadano' (sin cambios)
--   * Gubernamental   -> antes 'autoridad'; da fe y legalidad a los reportes
--   * Administrador   -> nuevo; carga categorías y quita usuarios
--
-- Va en un archivo aparte porque un valor nuevo de un enum no puede usarse en
-- la misma transacción en la que se agrega (la migración siguiente ya lo usa).
-- El valor 'moderador' se conserva solo por compatibilidad (Postgres no permite
-- quitar valores de un enum); la siguiente migración convierte esas filas a
-- 'gubernamental'.

alter type public.rol_usuario rename value 'autoridad' to 'gubernamental';
alter type public.rol_usuario add value if not exists 'administrador';
