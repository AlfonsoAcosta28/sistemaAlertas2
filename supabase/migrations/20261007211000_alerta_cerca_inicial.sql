-- Extensiones necesarias
create extension if not exists postgis;
create extension if not exists pgcrypto;

-- Tipos de dominio
create type public.estado_reporte as enum (
  'no_confirmada',
  'verificada',
  'rechazada',
  'resuelta',
  'manual_verificada'
);

-- Catálogos
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  activa boolean not null default true,
  color text,
  icono text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categoria_reglas (
  categoria_id uuid primary key references public.categorias(id) on delete cascade,
  umbral_confirmaciones integer not null check (umbral_confirmaciones >= 2),
  ventana_minutos integer not null check (ventana_minutos > 0),
  expiracion_minutos integer not null check (expiracion_minutos > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categoria_radios (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  minuto_desde integer not null check (minuto_desde >= 0),
  radio_metros integer not null check (radio_metros > 0),
  unique (categoria_id, minuto_desde)
);

-- Perfil del usuario con última ubicación (sin historial)
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_visible text,
  ultima_ubicacion geography(point, 4326),
  ultima_ubicacion_actualizada_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reportes (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias(id),
  creador_id uuid not null references auth.users(id) on delete restrict,
  estado public.estado_reporte not null default 'no_confirmada',
  descripcion text,
  ubicacion_exacta geography(point, 4326) not null,
  ubicacion_aproximada geography(point, 4326) not null,
  latitud_aproximada double precision generated always as (st_y(ubicacion_aproximada::geometry)) stored,
  longitud_aproximada double precision generated always as (st_x(ubicacion_aproximada::geometry)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reportes_categoria_estado on public.reportes(categoria_id, estado);
create index if not exists idx_reportes_ubicacion_exacta on public.reportes using gist (ubicacion_exacta);

create table if not exists public.reporte_confirmaciones (
  id uuid primary key default gen_random_uuid(),
  reporte_id uuid not null references public.reportes(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (reporte_id, usuario_id)
);

create table if not exists public.auditoria_administrativa (
  id uuid primary key default gen_random_uuid(),
  reporte_id uuid references public.reportes(id) on delete set null,
  admin_id uuid references auth.users(id) on delete set null,
  accion text not null,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace view public.reportes_publicos as
select
  r.id,
  r.categoria_id,
  c.nombre as categoria_nombre,
  r.estado,
  r.latitud_aproximada,
  r.longitud_aproximada,
  r.created_at,
  r.updated_at
from public.reportes r
join public.categorias c on c.id = r.categoria_id
where c.activa = true;

-- Seguridad y RLS
alter table public.categorias enable row level security;
alter table public.categoria_reglas enable row level security;
alter table public.categoria_radios enable row level security;
alter table public.perfiles enable row level security;
alter table public.reportes enable row level security;
alter table public.reporte_confirmaciones enable row level security;
alter table public.auditoria_administrativa enable row level security;

revoke all on public.reportes from anon, authenticated;
grant select on public.reportes_publicos to anon, authenticated;

grant select on public.categorias to anon, authenticated;

drop policy if exists "lectura categorías activas" on public.categorias;
create policy "lectura categorías activas"
on public.categorias
for select
to anon, authenticated
using (activa = true);

drop policy if exists "lectura reglas categoría" on public.categoria_reglas;
create policy "lectura reglas categoría"
on public.categoria_reglas
for select
to authenticated
using (true);

drop policy if exists "lectura radios categoría" on public.categoria_radios;
create policy "lectura radios categoría"
on public.categoria_radios
for select
to authenticated
using (true);

drop policy if exists "lectura perfil propio" on public.perfiles;
create policy "lectura perfil propio"
on public.perfiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "actualizar perfil propio" on public.perfiles;
create policy "actualizar perfil propio"
on public.perfiles
for all
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "lectura reportes propios" on public.reportes;
create policy "lectura reportes propios"
on public.reportes
for select
to authenticated
using (auth.uid() = creador_id);

drop policy if exists "insertar reportes propios" on public.reportes;
create policy "insertar reportes propios"
on public.reportes
for insert
to authenticated
with check (auth.uid() = creador_id);

drop policy if exists "lectura confirmaciones propias" on public.reporte_confirmaciones;
create policy "lectura confirmaciones propias"
on public.reporte_confirmaciones
for select
to authenticated
using (auth.uid() = usuario_id);

drop policy if exists "insertar confirmaciones propias" on public.reporte_confirmaciones;
create policy "insertar confirmaciones propias"
on public.reporte_confirmaciones
for insert
to authenticated
with check (auth.uid() = usuario_id);

-- Sin política para auditoría administrativa (solo service role).

-- Funciones de negocio (lado servidor)
create or replace function public.obtener_radio_vigente(
  p_categoria_id uuid,
  p_minutos integer
)
returns integer
language sql
stable
as $$
  select cr.radio_metros
  from public.categoria_radios cr
  where cr.categoria_id = p_categoria_id
    and cr.minuto_desde <= p_minutos
  order by cr.minuto_desde desc
  limit 1;
$$;

create or replace function public.evaluar_proximidad_para_verificacion(
  p_reporte_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporte public.reportes%rowtype;
  v_regla public.categoria_reglas%rowtype;
  v_confirmaciones integer;
begin
  select * into v_reporte from public.reportes where id = p_reporte_id;
  if not found then
    raise exception 'Reporte no encontrado';
  end if;

  select * into v_regla from public.categoria_reglas where categoria_id = v_reporte.categoria_id;

  if not found then
    return jsonb_build_object(
      'reporte_id', p_reporte_id,
      'pendiente', true,
      'motivo', 'Falta configuración de reglas para la categoría'
    );
  end if;

  select count(*)
  into v_confirmaciones
  from public.reporte_confirmaciones rc
  where rc.reporte_id = p_reporte_id;

  if (v_confirmaciones + 1) >= v_regla.umbral_confirmaciones then
    update public.reportes
    set estado = 'verificada',
        updated_at = now()
    where id = p_reporte_id;
  end if;

  return jsonb_build_object(
    'reporte_id', p_reporte_id,
    'pendiente', false,
    'confirmaciones', v_confirmaciones,
    'umbral', v_regla.umbral_confirmaciones,
    'nota', 'La validación completa por proximidad y usuarios distintos seguirá evolucionando en servidor.'
  );
end;
$$;

create or replace function public.crear_reporte(
  p_categoria_id uuid,
  p_latitud double precision,
  p_longitud double precision,
  p_descripcion text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_reporte_id uuid;
  v_punto geography(point, 4326);
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  v_punto := st_setsrid(st_makepoint(p_longitud, p_latitud), 4326)::geography;

  insert into public.reportes (
    categoria_id,
    creador_id,
    descripcion,
    ubicacion_exacta,
    ubicacion_aproximada
  ) values (
    p_categoria_id,
    v_uid,
    p_descripcion,
    v_punto,
    st_snaptogrid(v_punto::geometry, 0.001)::geography
  )
  returning id into v_reporte_id;

  perform public.evaluar_proximidad_para_verificacion(v_reporte_id);

  return v_reporte_id;
end;
$$;

create or replace function public.confirmar_reporte(
  p_reporte_id uuid
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
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  select creador_id into v_creador
  from public.reportes
  where id = p_reporte_id;

  if v_creador is null then
    raise exception 'Reporte no encontrado';
  end if;

  if v_creador = v_uid then
    raise exception 'No puedes confirmar tu propio reporte';
  end if;

  insert into public.reporte_confirmaciones (reporte_id, usuario_id)
  values (p_reporte_id, v_uid)
  on conflict (reporte_id, usuario_id) do nothing;

  if not found then
    raise exception 'No puedes confirmar dos veces el mismo reporte';
  end if;

  perform public.evaluar_proximidad_para_verificacion(p_reporte_id);

  return p_reporte_id;
end;
$$;

grant execute on function public.crear_reporte(uuid, double precision, double precision, text) to authenticated;
grant execute on function public.confirmar_reporte(uuid) to authenticated;
grant execute on function public.evaluar_proximidad_para_verificacion(uuid) to authenticated;
