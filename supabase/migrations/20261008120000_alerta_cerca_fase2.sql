-- ALERTA CERCA — Fase 2: modelo de datos completo (anillos, preferencias, H3,
-- verificación/corroboración, moderación, privacidad y motor de distribución).

create extension if not exists pg_net;

-- ======================================================================
-- Tipos de dominio nuevos
-- ======================================================================

create type public.severidad as enum ('baja', 'media', 'alta');
create type public.rol_usuario as enum ('ciudadano', 'moderador', 'autoridad');
create type public.tipo_reaccion as enum ('confirma', 'desmiente');

-- ======================================================================
-- La vista pública depende de reportes.estado: se elimina antes de poder
-- cambiar el tipo de la columna y se recrea al final del archivo.
-- ======================================================================

drop view if exists public.reportes_publicos;

drop function if exists public.confirmar_reporte(uuid);
drop function if exists public.evaluar_proximidad_para_verificacion(uuid);

-- ======================================================================
-- Reconstrucción de estado_reporte con los cinco estados del documento
-- ======================================================================

create type public.estado_reporte_nuevo as enum (
  'no_confirmada',
  'corroborada',
  'verificada',
  'descartada',
  'cerrada'
);

alter table public.reportes alter column estado drop default;

alter table public.reportes
  alter column estado type public.estado_reporte_nuevo
  using (
    case estado::text
      when 'no_confirmada' then 'no_confirmada'
      when 'manual_verificada' then 'verificada'
      when 'verificada' then 'verificada'
      when 'rechazada' then 'descartada'
      when 'resuelta' then 'cerrada'
      else 'no_confirmada'
    end
  )::public.estado_reporte_nuevo;

alter table public.reportes alter column estado set default 'no_confirmada'::public.estado_reporte_nuevo;

drop type public.estado_reporte;
alter type public.estado_reporte_nuevo rename to estado_reporte;

-- ======================================================================
-- Categorías: severidad/radios/vigencia por defecto + seed de las 7 del doc
-- ======================================================================

alter table public.categorias
  add column if not exists severidad_default public.severidad not null default 'baja',
  add column if not exists radio_inicial_metros integer not null default 500,
  add column if not exists radio_maximo_metros integer not null default 3000,
  add column if not exists vigencia_default_minutos integer not null default 180,
  add column if not exists requiere_moderacion_obligatoria boolean not null default false;

insert into public.categorias (
  nombre, descripcion, activa, color, icono,
  severidad_default, radio_inicial_metros, radio_maximo_metros, vigencia_default_minutos,
  requiere_moderacion_obligatoria
) values
  ('Persona desaparecida', 'Búsqueda de persona desaparecida', true, '#B91C1C', 'person-search',
    'alta', 2000, 50000, 4320, true),
  ('Robo de vehículo', 'Robo o reporte de vehículo robado', true, '#D97706', 'car',
    'media', 1000, 20000, 360, false),
  ('Incendio', 'Incendio en curso', true, '#EA580C', 'flame',
    'alta', 1000, 10000, 720, false),
  ('Inundación', 'Inundación o encharcamiento severo', true, '#2563EB', 'water',
    'alta', 2000, 25000, 1440, false),
  ('Accidente vial / bloqueo', 'Accidente o bloqueo vial', true, '#65A30D', 'car-crash',
    'baja', 500, 5000, 180, false),
  ('Riesgo sanitario o fuga', 'Fuga de gas, químico u otro riesgo sanitario', true, '#7C3AED', 'biohazard',
    'alta', 1000, 15000, 720, false),
  ('Otro', 'Otro tipo de incidente', true, '#64748B', 'alert',
    'baja', 500, 3000, 180, false)
on conflict (nombre) do update set
  descripcion = excluded.descripcion,
  color = excluded.color,
  icono = excluded.icono,
  severidad_default = excluded.severidad_default,
  radio_inicial_metros = excluded.radio_inicial_metros,
  radio_maximo_metros = excluded.radio_maximo_metros,
  vigencia_default_minutos = excluded.vigencia_default_minutos,
  requiere_moderacion_obligatoria = excluded.requiere_moderacion_obligatoria;

insert into public.categoria_reglas (categoria_id, umbral_confirmaciones, ventana_minutos, expiracion_minutos)
select id, 3, 15, vigencia_default_minutos
from public.categorias
on conflict (categoria_id) do update set
  umbral_confirmaciones = excluded.umbral_confirmaciones,
  ventana_minutos = excluded.ventana_minutos,
  expiracion_minutos = excluded.expiracion_minutos;

-- Anillos escalonados: 4 pasos entre el radio inicial y el máximo de cada
-- categoría, repartidos sobre su vigencia por defecto.
delete from public.categoria_radios;

insert into public.categoria_radios (categoria_id, minuto_desde, radio_metros)
select
  c.id,
  round(c.vigencia_default_minutos * f.fraccion)::integer,
  round(c.radio_inicial_metros + (c.radio_maximo_metros - c.radio_inicial_metros) * f.fraccion)::integer
from public.categorias c
cross join (values (0.0), (0.25), (0.6), (1.0)) as f(fraccion);

-- ======================================================================
-- Perfiles: celda H3 en vez de coordenada exacta, rol, anti-abuso, reputación
-- ======================================================================

alter table public.perfiles
  drop column if exists ultima_ubicacion,
  drop column if exists ultima_ubicacion_actualizada_en,
  add column if not exists ultima_celda_h3 text,
  add column if not exists ultima_celda_actualizada_en timestamptz,
  add column if not exists rol public.rol_usuario not null default 'ciudadano',
  add column if not exists telefono text,
  add column if not exists suspendido_hasta timestamptz,
  add column if not exists reportes_confirmados_contador integer not null default 0,
  add column if not exists reportes_descartados_contador integer not null default 0,
  add column if not exists onboarding_completado boolean not null default false;

-- Un usuario autenticado no debe poder otorgarse rol de moderador ni limpiar
-- sus propias suspensiones/contadores actualizando la fila directamente.
-- Las funciones de servidor activan esta bandera antes de tocar esos campos.
create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
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

drop trigger if exists trg_proteger_campos_perfil on public.perfiles;
create trigger trg_proteger_campos_perfil
before update on public.perfiles
for each row execute function public.proteger_campos_perfil();

-- ======================================================================
-- Reportes: snapshot de radios/vigencia/severidad, celda H3, moderación
-- ======================================================================

alter table public.reportes
  add column if not exists severidad public.severidad,
  add column if not exists radio_inicial_metros integer,
  add column if not exists radio_maximo_metros integer,
  add column if not exists vigencia_minutos integer,
  add column if not exists creado_en_celda_h3 text,
  add column if not exists verificado_por uuid references auth.users(id) on delete set null,
  add column if not exists verificado_en timestamptz,
  add column if not exists cerrado_en timestamptz,
  add column if not exists descartado_motivo text,
  add column if not exists foto_url text,
  -- Solo visibles para el propio autor o moderadores (RLS en `reportes`); el
  -- mapa público usa `ubicacion_aproximada`, nunca estas columnas.
  add column if not exists latitud_exacta double precision generated always as (st_y(ubicacion_exacta::geometry)) stored,
  add column if not exists longitud_exacta double precision generated always as (st_x(ubicacion_exacta::geometry)) stored;

update public.reportes r
set severidad = coalesce(r.severidad, c.severidad_default),
    radio_inicial_metros = coalesce(r.radio_inicial_metros, c.radio_inicial_metros),
    radio_maximo_metros = coalesce(r.radio_maximo_metros, c.radio_maximo_metros),
    vigencia_minutos = coalesce(r.vigencia_minutos, c.vigencia_default_minutos)
from public.categorias c
where c.id = r.categoria_id;

alter table public.reportes
  alter column severidad set not null,
  alter column severidad set default 'baja',
  alter column radio_inicial_metros set not null,
  alter column radio_maximo_metros set not null,
  alter column vigencia_minutos set not null;

-- La identidad del autor nunca se expone a otros usuarios; para permitir el
-- borrado real de cuenta sin perder el reporte, creador_id debe aceptar null.
alter table public.reportes alter column creador_id drop not null;
alter table public.reportes drop constraint if exists reportes_creador_id_fkey;
alter table public.reportes
  add constraint reportes_creador_id_fkey foreign key (creador_id) references auth.users(id) on delete set null;

-- ======================================================================
-- Reacciones ("yo también lo veo" / "esto no es cierto"), antes "confirmaciones"
-- ======================================================================

alter table public.reporte_confirmaciones rename to reporte_reacciones;
alter table public.reporte_reacciones add column if not exists tipo public.tipo_reaccion not null default 'confirma';

-- ======================================================================
-- Tablas nuevas: preferencias, zonas guardadas, dedupe de notificaciones
-- ======================================================================

create table if not exists public.usuario_preferencias (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  radio_personal_metros integer not null default 5000 check (radio_personal_metros between 1000 and 50000),
  ver_no_confirmados boolean not null default true,
  horario_silencio_inicio time,
  horario_silencio_fin time,
  autoriza_alertas_criticas_en_silencio boolean not null default true,
  push_token text,
  push_token_actualizado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usuario_categoria_preferencias (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  activa boolean not null default true,
  primary key (usuario_id, categoria_id)
);

create table if not exists public.zonas_guardadas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  celda_h3 text not null,
  radio_metros integer not null check (radio_metros between 100 and 50000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notificaciones_enviadas (
  id uuid primary key default gen_random_uuid(),
  reporte_id uuid not null references public.reportes(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  enviado_en timestamptz not null default now(),
  unique (reporte_id, usuario_id)
);

-- ======================================================================
-- Alta automática de perfil/preferencias al registrarse
-- ======================================================================

create or replace function public.manejar_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id) values (new.id)
  on conflict (id) do nothing;

  insert into public.usuario_preferencias (usuario_id) values (new.id)
  on conflict (usuario_id) do nothing;

  insert into public.usuario_categoria_preferencias (usuario_id, categoria_id, activa)
  select new.id, c.id, (c.nombre <> 'Otro')
  from public.categorias c
  on conflict (usuario_id, categoria_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_manejar_nuevo_usuario on auth.users;
create trigger trg_manejar_nuevo_usuario
after insert on auth.users
for each row execute function public.manejar_nuevo_usuario();

-- Backfill para usuarios que ya existieran antes de esta migración.
insert into public.perfiles (id)
select u.id from auth.users u
left join public.perfiles p on p.id = u.id
where p.id is null;

insert into public.usuario_preferencias (usuario_id)
select u.id from auth.users u
left join public.usuario_preferencias up on up.usuario_id = u.id
where up.usuario_id is null;

insert into public.usuario_categoria_preferencias (usuario_id, categoria_id, activa)
select u.id, c.id, (c.nombre <> 'Otro')
from auth.users u
cross join public.categorias c
on conflict (usuario_id, categoria_id) do nothing;

-- ======================================================================
-- RLS de las tablas nuevas
-- ======================================================================

alter table public.usuario_preferencias enable row level security;
alter table public.usuario_categoria_preferencias enable row level security;
alter table public.zonas_guardadas enable row level security;
alter table public.notificaciones_enviadas enable row level security;

drop policy if exists "preferencias propias" on public.usuario_preferencias;
create policy "preferencias propias"
on public.usuario_preferencias
for all
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

drop policy if exists "categorias preferencia propias" on public.usuario_categoria_preferencias;
create policy "categorias preferencia propias"
on public.usuario_categoria_preferencias
for all
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

drop policy if exists "zonas propias" on public.zonas_guardadas;
create policy "zonas propias"
on public.zonas_guardadas
for all
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

-- notificaciones_enviadas no tiene políticas: solo el service role (motor de
-- distribución) puede leer/escribir, igual que auditoria_administrativa.

-- ======================================================================
-- Lectura de reportes (con ubicación exacta) para moderadores/autoridad
-- ======================================================================

create or replace function public.es_moderador_o_autoridad(p_uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = p_uid and rol in ('moderador', 'autoridad')
  );
$$;

drop policy if exists "lectura reportes moderadores" on public.reportes;
create policy "lectura reportes moderadores"
on public.reportes
for select
to authenticated
using (public.es_moderador_o_autoridad(auth.uid()));

-- ======================================================================
-- Storage: fotos de reportes (bucket privado)
-- ======================================================================

insert into storage.buckets (id, name, public)
values ('fotos-reportes', 'fotos-reportes', false)
on conflict (id) do nothing;

drop policy if exists "subir foto propia" on storage.objects;
create policy "subir foto propia"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fotos-reportes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "leer foto propia o moderador" on storage.objects;
create policy "leer foto propia o moderador"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'fotos-reportes'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.es_moderador_o_autoridad(auth.uid())
  )
);

-- ======================================================================
-- Radio vigente de un reporte (respeta estado y moderación obligatoria)
-- ======================================================================

create or replace function public.radio_actual_reporte(p_reporte_id uuid)
returns integer
language plpgsql
stable
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

  -- Persona desaparecida (y cualquier categoría marcada así) nunca se expande
  -- sola por corroboración comunitaria: expone datos de terceros.
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

-- ======================================================================
-- Aviso al motor de distribución (Edge Function) — mejor esfuerzo
-- ======================================================================

create schema if not exists private;

create table if not exists private.configuracion (
  clave text primary key,
  valor text not null
);

create or replace function public.notificar_motor_distribucion(p_reporte_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  select valor into v_url from private.configuracion where clave = 'motor_distribucion_url';
  select valor into v_key from private.configuracion where clave = 'service_role_key';

  if v_url is null or v_key is null then
    -- Edge Function todavía no configurada (ver README); no debe romper el flujo principal.
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object('reporte_id', p_reporte_id)
  );
exception when others then
  null;
end;
$$;

-- ======================================================================
-- Corroboración automática por clustering de reportes independientes
-- ======================================================================

create or replace function public.evaluar_corroboracion_automatica(p_reporte_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporte public.reportes%rowtype;
  v_regla public.categoria_reglas%rowtype;
  v_distintos integer;
begin
  select * into v_reporte from public.reportes where id = p_reporte_id;
  if not found or v_reporte.estado <> 'no_confirmada' then
    return;
  end if;

  select * into v_regla from public.categoria_reglas where categoria_id = v_reporte.categoria_id;
  if not found then
    return;
  end if;

  select count(distinct r.creador_id)
  into v_distintos
  from public.reportes r
  where r.categoria_id = v_reporte.categoria_id
    and r.estado in ('no_confirmada', 'corroborada')
    and r.created_at >= now() - (v_regla.ventana_minutos || ' minutes')::interval
    and st_dwithin(r.ubicacion_exacta, v_reporte.ubicacion_exacta, 500);

  if v_distintos >= v_regla.umbral_confirmaciones then
    update public.reportes
    set estado = 'corroborada', updated_at = now()
    where categoria_id = v_reporte.categoria_id
      and estado = 'no_confirmada'
      and created_at >= now() - (v_regla.ventana_minutos || ' minutes')::interval
      and st_dwithin(ubicacion_exacta, v_reporte.ubicacion_exacta, 500);
  end if;
end;
$$;

-- ======================================================================
-- Crear reporte (GPS real + celda H3 + límites anti-abuso)
-- ======================================================================

create or replace function public.crear_reporte(
  p_categoria_id uuid,
  p_latitud double precision,
  p_longitud double precision,
  p_celda_h3 text,
  p_descripcion text default null,
  p_foto_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_perfil public.perfiles%rowtype;
  v_categoria public.categorias%rowtype;
  v_reporte_id uuid;
  v_punto geography(point, 4326);
  v_reportes_ultima_hora integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into v_perfil from public.perfiles where id = v_uid;
  if found and v_perfil.suspendido_hasta is not null and v_perfil.suspendido_hasta > now() then
    raise exception 'Tu cuenta está suspendida temporalmente para crear reportes hasta %', v_perfil.suspendido_hasta;
  end if;

  select count(*) into v_reportes_ultima_hora
  from public.reportes
  where creador_id = v_uid
    and created_at >= now() - interval '1 hour';

  if v_reportes_ultima_hora >= 10 then
    raise exception 'Alcanzaste el límite de reportes por hora. Intenta más tarde.';
  end if;

  select * into v_categoria from public.categorias where id = p_categoria_id and activa = true;
  if not found then
    raise exception 'Categoría no válida';
  end if;

  v_punto := st_setsrid(st_makepoint(p_longitud, p_latitud), 4326)::geography;

  insert into public.reportes (
    categoria_id, creador_id, descripcion, ubicacion_exacta, ubicacion_aproximada,
    creado_en_celda_h3, severidad, radio_inicial_metros, radio_maximo_metros, vigencia_minutos, foto_url
  ) values (
    p_categoria_id, v_uid, p_descripcion, v_punto, st_snaptogrid(v_punto::geometry, 0.001)::geography,
    p_celda_h3, v_categoria.severidad_default, v_categoria.radio_inicial_metros,
    v_categoria.radio_maximo_metros, v_categoria.vigencia_default_minutos, p_foto_url
  )
  returning id into v_reporte_id;

  if not v_categoria.requiere_moderacion_obligatoria then
    perform public.evaluar_corroboracion_automatica(v_reporte_id);
  end if;

  perform public.notificar_motor_distribucion(v_reporte_id);

  return v_reporte_id;
end;
$$;

-- ======================================================================
-- Reaccionar a un reporte ("yo también lo veo" / "esto no es cierto")
-- ======================================================================

create or replace function public.reaccionar_reporte(p_reporte_id uuid, p_tipo public.tipo_reaccion)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_creador uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  select creador_id into v_creador from public.reportes where id = p_reporte_id;
  if not found then
    raise exception 'Reporte no encontrado';
  end if;

  if v_creador = v_uid then
    raise exception 'No puedes reaccionar a tu propio reporte';
  end if;

  insert into public.reporte_reacciones (reporte_id, usuario_id, tipo)
  values (p_reporte_id, v_uid, p_tipo)
  on conflict (reporte_id, usuario_id)
  do update set tipo = excluded.tipo, created_at = now();

  return p_reporte_id;
end;
$$;

-- ======================================================================
-- Moderación: verificar / descartar / cerrar
-- ======================================================================

create or replace function public.moderar_verificar_reporte(
  p_reporte_id uuid,
  p_severidad_override public.severidad default null,
  p_nota text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_creador uuid;
begin
  v_uid := auth.uid();
  if v_uid is null or not public.es_moderador_o_autoridad(v_uid) then
    raise exception 'No autorizado';
  end if;

  select creador_id into v_creador from public.reportes where id = p_reporte_id;
  if not found then
    raise exception 'Reporte no encontrado';
  end if;

  perform set_config('alerta_cerca.permitir_campos_protegidos', 'true', true);

  update public.reportes
  set estado = 'verificada',
      severidad = coalesce(p_severidad_override, severidad),
      verificado_por = v_uid,
      verificado_en = now(),
      updated_at = now()
  where id = p_reporte_id;

  if v_creador is not null then
    update public.perfiles
    set reportes_confirmados_contador = reportes_confirmados_contador + 1
    where id = v_creador;
  end if;

  insert into public.auditoria_administrativa (reporte_id, admin_id, accion, detalle)
  values (p_reporte_id, v_uid, 'verificar', jsonb_build_object('nota', p_nota));

  perform public.notificar_motor_distribucion(p_reporte_id);

  return p_reporte_id;
end;
$$;

create or replace function public.moderar_descartar_reporte(p_reporte_id uuid, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_creador uuid;
  v_descartados integer;
begin
  v_uid := auth.uid();
  if v_uid is null or not public.es_moderador_o_autoridad(v_uid) then
    raise exception 'No autorizado';
  end if;

  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'El motivo de descarte es obligatorio';
  end if;

  select creador_id into v_creador from public.reportes where id = p_reporte_id;
  if not found then
    raise exception 'Reporte no encontrado';
  end if;

  perform set_config('alerta_cerca.permitir_campos_protegidos', 'true', true);

  update public.reportes
  set estado = 'descartada', descartado_motivo = p_motivo, updated_at = now()
  where id = p_reporte_id;

  if v_creador is not null then
    update public.perfiles
    set reportes_descartados_contador = reportes_descartados_contador + 1
    where id = v_creador
    returning reportes_descartados_contador into v_descartados;

    if v_descartados >= 3 then
      update public.perfiles
      set suspendido_hasta = now() + interval '7 days'
      where id = v_creador;
    end if;
  end if;

  insert into public.auditoria_administrativa (reporte_id, admin_id, accion, detalle)
  values (p_reporte_id, v_uid, 'descartar', jsonb_build_object('motivo', p_motivo));

  return p_reporte_id;
end;
$$;

create or replace function public.moderar_cerrar_reporte(p_reporte_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null or not public.es_moderador_o_autoridad(v_uid) then
    raise exception 'No autorizado';
  end if;

  perform set_config('alerta_cerca.permitir_campos_protegidos', 'true', true);

  update public.reportes
  set estado = 'cerrada', cerrado_en = now(), updated_at = now()
  where id = p_reporte_id;

  insert into public.auditoria_administrativa (reporte_id, admin_id, accion, detalle)
  values (p_reporte_id, v_uid, 'cerrar', '{}'::jsonb);

  return p_reporte_id;
end;
$$;

-- ======================================================================
-- Perfil propio: celda H3, token push, borrado de cuenta
-- ======================================================================

create or replace function public.actualizar_celda_perfil(p_celda_h3 text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  update public.perfiles
  set ultima_celda_h3 = p_celda_h3, ultima_celda_actualizada_en = now()
  where id = v_uid;
end;
$$;

create or replace function public.actualizar_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  update public.usuario_preferencias
  set push_token = p_token, push_token_actualizado_en = now(), updated_at = now()
  where usuario_id = v_uid;
end;
$$;

-- Limpia los datos propios del usuario. El borrado real de auth.users (que
-- requiere la Admin API) lo hace la Edge Function `eliminar-cuenta`.
create or replace function public.eliminar_cuenta_propia()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  delete from public.zonas_guardadas where usuario_id = v_uid;
  delete from public.usuario_categoria_preferencias where usuario_id = v_uid;
  delete from public.usuario_preferencias where usuario_id = v_uid;
  delete from public.reporte_reacciones where usuario_id = v_uid;

  update public.reportes set creador_id = null where creador_id = v_uid;

  update public.perfiles
  set nombre_visible = null, telefono = null, ultima_celda_h3 = null
  where id = v_uid;
end;
$$;

-- ======================================================================
-- Vista pública de reportes (sin identidad, sin coordenada exacta)
-- ======================================================================

create or replace view public.reportes_publicos as
select
  r.id,
  r.categoria_id,
  c.nombre as categoria_nombre,
  r.estado,
  r.severidad,
  r.latitud_aproximada,
  r.longitud_aproximada,
  public.radio_actual_reporte(r.id) as radio_actual_metros,
  r.descripcion,
  r.created_at,
  r.updated_at,
  r.created_at + (r.vigencia_minutos || ' minutes')::interval as expira_en
from public.reportes r
join public.categorias c on c.id = r.categoria_id
where c.activa = true
  and r.estado <> 'descartada';

grant select on public.reportes_publicos to anon, authenticated;

-- ======================================================================
-- Funciones exclusivas del motor de distribución (service role).
-- Exponen coordenadas exactas y tokens push: nunca deben llegar a anon/authenticated.
-- ======================================================================

create or replace function public.obtener_reportes_activos_para_motor(p_reporte_id uuid default null)
returns table (
  id uuid,
  categoria_id uuid,
  estado public.estado_reporte,
  severidad public.severidad,
  latitud double precision,
  longitud double precision,
  radio_actual_metros integer,
  vigencia_minutos integer,
  created_at timestamptz
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
    r.created_at
  from public.reportes r
  where r.estado in ('no_confirmada', 'corroborada', 'verificada')
    and r.created_at + (r.vigencia_minutos || ' minutes')::interval > now()
    and (p_reporte_id is null or r.id = p_reporte_id);
$$;

revoke all on function public.obtener_reportes_activos_para_motor(uuid) from public;
grant execute on function public.obtener_reportes_activos_para_motor(uuid) to service_role;

create or replace function public.obtener_candidatos_para_motor(p_categoria_id uuid, p_celdas text[])
returns table (
  usuario_id uuid,
  push_token text,
  ver_no_confirmados boolean,
  horario_silencio_inicio time,
  horario_silencio_fin time,
  autoriza_alertas_criticas_en_silencio boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    coalesce(p.id, z.usuario_id) as usuario_id,
    up.push_token,
    up.ver_no_confirmados,
    up.horario_silencio_inicio,
    up.horario_silencio_fin,
    up.autoriza_alertas_criticas_en_silencio
  from public.usuario_preferencias up
  left join public.perfiles p on p.id = up.usuario_id and p.ultima_celda_h3 = any(p_celdas)
  left join public.zonas_guardadas z on z.usuario_id = up.usuario_id and z.celda_h3 = any(p_celdas)
  join public.usuario_categoria_preferencias ucp
    on ucp.usuario_id = up.usuario_id and ucp.categoria_id = p_categoria_id
  where ucp.activa = true
    and up.push_token is not null
    and (p.id is not null or z.usuario_id is not null)
    and not exists (
      select 1 from public.perfiles sp
      where sp.id = up.usuario_id and sp.suspendido_hasta is not null and sp.suspendido_hasta > now()
    );
$$;

revoke all on function public.obtener_candidatos_para_motor(uuid, text[]) from public;
grant execute on function public.obtener_candidatos_para_motor(uuid, text[]) to service_role;

create or replace function public.filtrar_no_notificados(p_reporte_id uuid, p_usuario_ids uuid[])
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(u), array[]::uuid[])
  from unnest(p_usuario_ids) as u
  where not exists (
    select 1 from public.notificaciones_enviadas n
    where n.reporte_id = p_reporte_id and n.usuario_id = u
  );
$$;

revoke all on function public.filtrar_no_notificados(uuid, uuid[]) from public;
grant execute on function public.filtrar_no_notificados(uuid, uuid[]) to service_role;

create or replace function public.registrar_notificaciones_enviadas(p_reporte_id uuid, p_usuario_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notificaciones_enviadas (reporte_id, usuario_id)
  select p_reporte_id, u
  from unnest(p_usuario_ids) as u
  on conflict (reporte_id, usuario_id) do nothing;
$$;

revoke all on function public.registrar_notificaciones_enviadas(uuid, uuid[]) from public;
grant execute on function public.registrar_notificaciones_enviadas(uuid, uuid[]) to service_role;

-- ======================================================================
-- Permisos de ejecución
-- ======================================================================

grant execute on function public.radio_actual_reporte(uuid) to anon, authenticated;
grant execute on function public.crear_reporte(uuid, double precision, double precision, text, text, text) to authenticated;
grant execute on function public.reaccionar_reporte(uuid, public.tipo_reaccion) to authenticated;
grant execute on function public.actualizar_celda_perfil(text) to authenticated;
grant execute on function public.actualizar_push_token(text) to authenticated;
grant execute on function public.eliminar_cuenta_propia() to authenticated;
grant execute on function public.moderar_verificar_reporte(uuid, public.severidad, text) to authenticated;
grant execute on function public.moderar_descartar_reporte(uuid, text) to authenticated;
grant execute on function public.moderar_cerrar_reporte(uuid) to authenticated;

-- ======================================================================
-- Barrido periódico para el crecimiento de anillos de alertas activas.
-- Requiere pg_cron habilitado en el proyecto (Dashboard > Database > Extensions
-- si esta línea falla por permisos) y las claves en private.configuracion
-- (ver README: motor_distribucion_url, service_role_key).
-- ======================================================================

do $$
begin
  create extension if not exists pg_cron;
exception when insufficient_privilege then
  raise notice 'pg_cron no se pudo habilitar automáticamente; actívalo desde el Dashboard de Supabase.';
end;
$$;

do $$
begin
  perform cron.unschedule('alerta-cerca-motor-distribucion-sweep');
exception when others then
  null;
end;
$$;

do $$
begin
  perform cron.schedule(
    'alerta-cerca-motor-distribucion-sweep',
    '* * * * *',
    $job$
      select net.http_post(
        url := (select valor from private.configuracion where clave = 'motor_distribucion_url'),
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select valor from private.configuracion where clave = 'service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      )
      where exists (select 1 from private.configuracion where clave = 'motor_distribucion_url');
    $job$
  );
exception when others then
  raise notice 'No se pudo programar el barrido de pg_cron todavía: %', sqlerrm;
end;
$$;
