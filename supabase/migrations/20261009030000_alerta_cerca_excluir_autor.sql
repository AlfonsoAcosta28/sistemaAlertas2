-- El motor de distribución necesita saber quién creó cada reporte para no
-- mandarle la alerta (ni el "¿Tú también lo ves?") a su propio autor.

drop function if exists public.obtener_reportes_activos_para_motor(uuid);

create function public.obtener_reportes_activos_para_motor(p_reporte_id uuid default null)
returns table (
  id uuid,
  categoria_id uuid,
  estado public.estado_reporte,
  severidad public.severidad,
  latitud double precision,
  longitud double precision,
  radio_actual_metros integer,
  vigencia_minutos integer,
  created_at timestamptz,
  veracidad smallint,
  creador_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.categoria_id,
    r.estado,
    r.severidad,
    st_y(r.ubicacion_exacta::geometry) as latitud,
    st_x(r.ubicacion_exacta::geometry) as longitud,
    public.radio_actual_reporte(r.id) as radio_actual_metros,
    r.vigencia_minutos,
    r.created_at,
    r.veracidad,
    r.creador_id
  from public.reportes r
  where r.estado in ('no_confirmada', 'corroborada', 'verificada')
    and r.created_at + (r.vigencia_minutos || ' minutes')::interval > now()
    and (p_reporte_id is null or r.id = p_reporte_id);
$$;

revoke execute on function public.obtener_reportes_activos_para_motor(uuid) from public, anon, authenticated;
grant execute on function public.obtener_reportes_activos_para_motor(uuid) to service_role;
