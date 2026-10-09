-- `auditoria_administrativa` tiene RLS activado sin ninguna política (por
-- diseño: nadie debía leerla salvo service_role). Pero el panel de
-- moderación necesita que los moderadores vean su propio historial de
-- acciones, así que se agrega una política de lectura para ellos.
drop policy if exists "lectura auditoria moderadores" on public.auditoria_administrativa;
create policy "lectura auditoria moderadores"
on public.auditoria_administrativa
for select
to authenticated
using (public.es_moderador_o_autoridad(auth.uid()));
