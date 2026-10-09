-- Endurecimiento post-revisión de advisories de seguridad de Supabase:
-- 1) Revocar EXECUTE de PUBLIC (otorgado por defecto al crear la función) en
--    toda la lógica de negocio sensible; solo queda accesible para
--    `authenticated` (cada función ya valida auth.uid() por su cuenta) o
--    `service_role` (funciones internas del motor de distribución).
-- 2) Fijar search_path en funciones que no lo tenían (evita resolución de
--    nombres de objetos contra un search_path controlado por quien llama).

revoke execute on function public.crear_reporte(uuid, double precision, double precision, text, text, text) from public;
revoke execute on function public.reaccionar_reporte(uuid, public.tipo_reaccion) from public;
revoke execute on function public.actualizar_celda_perfil(text) from public;
revoke execute on function public.actualizar_push_token(text) from public;
revoke execute on function public.eliminar_cuenta_propia() from public;
revoke execute on function public.moderar_verificar_reporte(uuid, public.severidad, text) from public;
revoke execute on function public.moderar_descartar_reporte(uuid, text) from public;
revoke execute on function public.moderar_cerrar_reporte(uuid) from public;

grant execute on function public.crear_reporte(uuid, double precision, double precision, text, text, text) to authenticated;
grant execute on function public.reaccionar_reporte(uuid, public.tipo_reaccion) to authenticated;
grant execute on function public.actualizar_celda_perfil(text) to authenticated;
grant execute on function public.actualizar_push_token(text) to authenticated;
grant execute on function public.eliminar_cuenta_propia() to authenticated;
grant execute on function public.moderar_verificar_reporte(uuid, public.severidad, text) to authenticated;
grant execute on function public.moderar_descartar_reporte(uuid, text) to authenticated;
grant execute on function public.moderar_cerrar_reporte(uuid) to authenticated;

-- Funciones internas (solo se llaman vía `perform` desde otras funciones
-- SECURITY DEFINER, nunca deben ser un endpoint RPC público):
revoke execute on function public.evaluar_corroboracion_automatica(uuid) from public, anon, authenticated;
revoke execute on function public.notificar_motor_distribucion(uuid) from public, anon, authenticated;

-- search_path explícito (quedaron sin fijar en la migración anterior):
create or replace function public.obtener_radio_vigente(
  p_categoria_id uuid,
  p_minutos integer
)
returns integer
language sql
stable
set search_path = public
as $$
  select cr.radio_metros
  from public.categoria_radios cr
  where cr.categoria_id = p_categoria_id
    and cr.minuto_desde <= p_minutos
  order by cr.minuto_desde desc
  limit 1;
$$;

create or replace function public.es_moderador_o_autoridad(p_uid uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = p_uid and rol in ('moderador', 'autoridad')
  );
$$;

create or replace function public.radio_actual_reporte(p_reporte_id uuid)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_reporte public.reportes%rowtype;
  v_categoria public.categorias%rowtype;
  v_elapsed_min integer;
  v_radio_tiempo integer;
  v_radio_anillo2 integer;
begin
  select * into v_reporte from public.reportes where id = p_reporte_id;
  if not found then
    return 0;
  end if;

  if v_reporte.estado in ('cerrada', 'descartada') then
    return 0;
  end if;

  select * into v_categoria from public.categorias where id = v_reporte.categoria_id;

  if v_categoria.requiere_moderacion_obligatoria and v_reporte.estado <> 'verificada' then
    return v_reporte.radio_inicial_metros;
  end if;

  if v_reporte.estado = 'no_confirmada' then
    return v_reporte.radio_inicial_metros;
  end if;

  v_elapsed_min := greatest(0, floor(extract(epoch from (now() - v_reporte.created_at)) / 60.0))::integer;
  v_radio_tiempo := coalesce(
    public.obtener_radio_vigente(v_reporte.categoria_id, v_elapsed_min),
    v_reporte.radio_inicial_metros
  );

  if v_reporte.estado = 'corroborada' then
    select cr.radio_metros into v_radio_anillo2
    from public.categoria_radios cr
    where cr.categoria_id = v_reporte.categoria_id
    order by cr.minuto_desde asc
    offset 1
    limit 1;

    return least(v_radio_tiempo, coalesce(v_radio_anillo2, v_reporte.radio_maximo_metros));
  end if;

  return least(v_radio_tiempo, v_reporte.radio_maximo_metros);
end;
$$;

create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('alerta_cerca.permitir_campos_protegidos', true), 'false') <> 'true' then
    if new.rol is distinct from old.rol
       or new.suspendido_hasta is distinct from old.suspendido_hasta
       or new.reportes_confirmados_contador is distinct from old.reportes_confirmados_contador
       or new.reportes_descartados_contador is distinct from old.reportes_descartados_contador then
      raise exception 'No puedes modificar estos campos directamente.';
    end if;
  end if;
  return new;
end;
$$;
