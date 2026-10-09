-- ALERTA CERCA — Ajuste al documento de requisitos:
--   1. Las 7 categorías del documento (agrega Asalto, Choque y Zona obstruida).
--   2. Radios y umbrales de credibilidad por categoría según la tabla.
--   3. Campos de formulario por categoría (placas, datos de la persona, etc.).
--   4. Instituciones y envío automático del reporte al pre-validarse.
--   5. Reputación con puntos, votos ponderados y porcentaje de veracidad.
--   6. Roles Gubernamental / Administrador y funciones de administración.
--   7. Datos del análisis de foto (NSFW / rostros / calidad) hecho en el teléfono.

-- Los campos protegidos de `perfiles` solo se pueden tocar con esta bandera
-- (ver trigger proteger_campos_perfil). Se activa para toda la migración.
select set_config('alerta_cerca.permitir_campos_protegidos', 'true', false);

-- ======================================================================
-- Instituciones (bomberos, policía, protección civil...)
-- ======================================================================

create table if not exists public.instituciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo text not null default 'otra',
  telefono text,
  correo text,
  -- Opcional: URL a la que se hace POST con el reporte cuando se le envía.
  webhook_url text,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categoria_instituciones (
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  institucion_id uuid not null references public.instituciones(id) on delete cascade,
  primary key (categoria_id, institucion_id)
);

create table if not exists public.reporte_envios (
  id uuid primary key default gen_random_uuid(),
  reporte_id uuid not null references public.reportes(id) on delete cascade,
  institucion_id uuid not null references public.instituciones(id) on delete cascade,
  estado text not null default 'enviado'
    check (estado in ('enviado', 'validado_verdad', 'validado_mentira', 'cerrado')),
  enviado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (reporte_id, institucion_id)
);

create index if not exists idx_reporte_envios_institucion on public.reporte_envios(institucion_id, estado);

insert into public.instituciones (nombre, tipo, telefono) values
  ('Bomberos', 'bomberos', '911'),
  ('Policía / Seguridad Pública', 'policia', '911'),
  ('Protección Civil', 'proteccion_civil', '911'),
  ('Comisión de Búsqueda de Personas', 'busqueda', null),
  ('Fiscalía', 'fiscalia', null),
  ('Tránsito y Vialidad', 'transito', null),
  ('Servicios médicos de emergencia', 'emergencias', '911')
on conflict (nombre) do nothing;

-- ======================================================================
-- Perfiles: reputación e institución del usuario gubernamental
-- ======================================================================

alter table public.perfiles
  add column if not exists reputacion integer not null default 0,
  add column if not exists institucion_id uuid references public.instituciones(id) on delete set null;

update public.perfiles set rol = 'gubernamental' where rol = 'moderador';

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
       or new.reportes_descartados_contador is distinct from old.reportes_descartados_contador
       or new.reputacion is distinct from old.reputacion
       or new.institucion_id is distinct from old.institucion_id then
      raise exception 'No puedes modificar estos campos directamente.';
    end if;
  end if;
  return new;
end;
$$;

create table if not exists public.reputacion_movimientos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  reporte_id uuid references public.reportes(id) on delete set null,
  puntos integer not null,
  motivo text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reputacion_movimientos_usuario on public.reputacion_movimientos(usuario_id, created_at desc);

-- ======================================================================
-- Roles: funciones de apoyo (SECURITY DEFINER para poder usarse en RLS de
-- `perfiles` sin recursión)
-- ======================================================================

create or replace function public.es_administrador(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = p_uid and rol = 'administrador');
$$;

-- Se conserva el nombre por compatibilidad: "puede validar reportes".
create or replace function public.es_moderador_o_autoridad(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = p_uid and rol in ('moderador', 'gubernamental', 'administrador')
  );
$$;

-- Administrador: cualquier reporte. Gubernamental con institución: solo los
-- reportes enviados a su institución. Gubernamental sin institución asignada:
-- todos (autoridad general).
create or replace function public.puede_gestionar_reporte(p_uid uuid, p_reporte_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.id = p_uid
      and (
        p.rol in ('administrador', 'moderador')
        or (p.rol = 'gubernamental' and p.institucion_id is null)
        or (
          p.rol = 'gubernamental'
          and exists (
            select 1 from public.reporte_envios e
            where e.reporte_id = p_reporte_id and e.institucion_id = p.institucion_id
          )
        )
      )
  );
$$;

drop policy if exists "lectura reportes moderadores" on public.reportes;
create policy "lectura reportes moderadores"
on public.reportes
for select
to authenticated
using (public.puede_gestionar_reporte(auth.uid(), id));

-- ======================================================================
-- Categorías: campos de formulario, foto obligatoria, umbral >= 1
-- ======================================================================

alter table public.categorias
  add column if not exists campos_formulario jsonb not null default '[]'::jsonb,
  add column if not exists requiere_foto boolean not null default false,
  add column if not exists foto_requiere_rostro boolean not null default false;

alter table public.categorias drop constraint if exists categorias_campos_formulario_es_arreglo;
alter table public.categorias
  add constraint categorias_campos_formulario_es_arreglo check (jsonb_typeof(campos_formulario) = 'array');

-- "Persona desaparecida" tiene credibilidad 1 (el propio reporte).
alter table public.categoria_reglas drop constraint if exists categoria_reglas_umbral_confirmaciones_check;
alter table public.categoria_reglas
  add constraint categoria_reglas_umbral_confirmaciones_check check (umbral_confirmaciones >= 1);

-- "Accidente vial / bloqueo" se convierte en "Choque" (conserva sus reportes);
-- "Zona obstruida" pasa a ser una categoría propia.
update public.categorias
set nombre = 'Choque', updated_at = now()
where nombre = 'Accidente vial / bloqueo'
  and not exists (select 1 from public.categorias where nombre = 'Choque');

insert into public.categorias (
  nombre, descripcion, activa, color, icono,
  severidad_default, radio_inicial_metros, radio_maximo_metros, vigencia_default_minutos,
  requiere_moderacion_obligatoria, requiere_foto, foto_requiere_rostro, campos_formulario
) values
  ('Persona desaparecida', 'Búsqueda de persona desaparecida', true, '#B91C1C', 'person-search',
    'alta', 2000, 2000, 4320, true, true, true,
    '[
      {"clave": "nombre", "etiqueta": "Nombre completo", "tipo": "texto", "requerido": true},
      {"clave": "edad", "etiqueta": "Edad", "tipo": "numero", "requerido": true},
      {"clave": "descripcion_fisica", "etiqueta": "Descripción física y vestimenta", "tipo": "texto_largo", "requerido": true},
      {"clave": "visto_por_ultima_vez", "etiqueta": "¿Dónde y cuándo se le vio por última vez?", "tipo": "texto_largo", "requerido": true}
    ]'::jsonb),
  ('Robo de vehículo', 'Robo de automóvil, camioneta o motocicleta', true, '#D97706', 'car',
    'media', 3000, 3000, 360, false, false, false,
    '[
      {"clave": "placas", "etiqueta": "Placas", "tipo": "texto", "requerido": false, "mayusculas": true,
       "ayuda": "Si no conoces las placas, describe el vehículo abajo."},
      {"clave": "tipo_vehiculo", "etiqueta": "Tipo de vehículo", "tipo": "opciones", "requerido_si_vacio": "placas",
       "opciones": ["Automóvil", "Camioneta", "Motocicleta", "Camión", "Otro"]},
      {"clave": "marca", "etiqueta": "Marca y modelo", "tipo": "texto", "requerido_si_vacio": "placas"},
      {"clave": "color", "etiqueta": "Color", "tipo": "texto", "requerido_si_vacio": "placas"}
    ]'::jsonb),
  ('Incendio', 'Incendio en curso (avistamiento)', true, '#EA580C', 'flame',
    'alta', 700, 700, 720, false, false, false, '[]'::jsonb),
  ('Inundación', 'Inundación o deslave (avistamiento)', true, '#2563EB', 'water',
    'alta', 500, 1000, 1440, false, false, false,
    '[
      {"clave": "identificacion", "etiqueta": "¿Qué ves?", "tipo": "opciones", "requerido": true,
       "opciones": ["Inundación", "Deslave", "Encharcamiento severo"]}
    ]'::jsonb),
  ('Asalto', 'Asalto o robo a persona (avistamiento)', true, '#7C3AED', 'robbery',
    'media', 500, 500, 180, false, false, false, '[]'::jsonb),
  ('Choque', 'Choque o accidente vial', true, '#65A30D', 'car-crash',
    'media', 500, 500, 180, false, false, false, '[]'::jsonb),
  ('Zona obstruida', 'Calle bloqueada u obstruida', true, '#0D9488', 'road-block',
    'baja', 500, 500, 240, false, false, false, '[]'::jsonb)
on conflict (nombre) do update set
  descripcion = excluded.descripcion,
  activa = true,
  color = excluded.color,
  icono = excluded.icono,
  severidad_default = excluded.severidad_default,
  radio_inicial_metros = excluded.radio_inicial_metros,
  radio_maximo_metros = excluded.radio_maximo_metros,
  vigencia_default_minutos = excluded.vigencia_default_minutos,
  requiere_moderacion_obligatoria = excluded.requiere_moderacion_obligatoria,
  requiere_foto = excluded.requiere_foto,
  foto_requiere_rostro = excluded.foto_requiere_rostro,
  campos_formulario = excluded.campos_formulario,
  updated_at = now();

-- Las categorías que no están en el documento quedan desactivadas (el
-- administrador puede reactivarlas desde la app).
update public.categorias
set activa = false, updated_at = now()
where nombre in ('Riesgo sanitario o fuga', 'Otro', 'Accidente vial / bloqueo');

-- Umbrales de credibilidad (personas, contando el reporte original).
insert into public.categoria_reglas (categoria_id, umbral_confirmaciones, ventana_minutos, expiracion_minutos)
select c.id, v.umbral, 30, c.vigencia_default_minutos
from public.categorias c
join (values
  ('Persona desaparecida', 1),
  ('Robo de vehículo', 5),
  ('Incendio', 5),
  ('Inundación', 3),
  ('Asalto', 2),
  ('Choque', 2),
  ('Zona obstruida', 5)
) as v(nombre, umbral) on v.nombre = c.nombre
on conflict (categoria_id) do update set
  umbral_confirmaciones = excluded.umbral_confirmaciones,
  ventana_minutos = excluded.ventana_minutos,
  expiracion_minutos = excluded.expiracion_minutos,
  updated_at = now();

-- Anillos: 4 pasos entre radio inicial y máximo (con inicial = máximo el
-- radio queda fijo, como pide el documento).
create or replace function public.regenerar_anillos_categoria(p_categoria_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.categoria_radios where categoria_id = p_categoria_id;
  insert into public.categoria_radios (categoria_id, minuto_desde, radio_metros)
  select
    c.id,
    round(c.vigencia_default_minutos * f.fraccion)::integer,
    round(c.radio_inicial_metros + (c.radio_maximo_metros - c.radio_inicial_metros) * f.fraccion)::integer
  from public.categorias c
  cross join (values (0.0), (0.25), (0.6), (1.0)) as f(fraccion)
  where c.id = p_categoria_id
  on conflict (categoria_id, minuto_desde) do update set radio_metros = excluded.radio_metros;
$$;

select public.regenerar_anillos_categoria(id) from public.categorias;

-- Institución(es) a la(s) que se manda cada categoría.
insert into public.categoria_instituciones (categoria_id, institucion_id)
select c.id, i.id
from (values
  ('Persona desaparecida', 'Comisión de Búsqueda de Personas'),
  ('Persona desaparecida', 'Fiscalía'),
  ('Robo de vehículo', 'Policía / Seguridad Pública'),
  ('Robo de vehículo', 'Fiscalía'),
  ('Incendio', 'Bomberos'),
  ('Incendio', 'Protección Civil'),
  ('Inundación', 'Protección Civil'),
  ('Inundación', 'Bomberos'),
  ('Asalto', 'Policía / Seguridad Pública'),
  ('Choque', 'Tránsito y Vialidad'),
  ('Choque', 'Servicios médicos de emergencia'),
  ('Zona obstruida', 'Tránsito y Vialidad')
) as m(categoria, institucion)
join public.categorias c on c.nombre = m.categoria
join public.instituciones i on i.nombre = m.institucion
on conflict do nothing;

-- Preferencias de las categorías nuevas para los usuarios que ya existen.
insert into public.usuario_categoria_preferencias (usuario_id, categoria_id, activa)
select up.usuario_id, c.id, true
from public.usuario_preferencias up
cross join public.categorias c
on conflict (usuario_id, categoria_id) do nothing;

-- ======================================================================
-- Reportes: datos del formulario, análisis de foto y validación ponderada
-- ======================================================================

alter table public.reportes
  add column if not exists datos jsonb not null default '{}'::jsonb,
  add column if not exists analisis_foto jsonb,
  add column if not exists puntaje_apoyo numeric(8, 2) not null default 0,
  add column if not exists puntaje_contra numeric(8, 2) not null default 0,
  add column if not exists veracidad smallint not null default 0 check (veracidad between 0 and 100),
  add column if not exists prevalidado_en timestamptz;

-- Peso del voto según la reputación: 0 puntos = 1 voto; +100 = 2 votos (tope);
-- -75 o menos = 0.25 de voto (piso).
create or replace function public.peso_reputacion(p_reputacion integer)
returns numeric
language sql
immutable
set search_path = public
as $$
  select greatest(0.25, least(2.0, 1.0 + coalesce(p_reputacion, 0) / 100.0))::numeric;
$$;

create or replace function public.aplicar_reputacion(
  p_usuario_id uuid,
  p_reporte_id uuid,
  p_puntos integer,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_usuario_id is null or p_puntos = 0 then
    return;
  end if;

  perform set_config('alerta_cerca.permitir_campos_protegidos', 'true', true);

  update public.perfiles set reputacion = reputacion + p_puntos, updated_at = now()
  where id = p_usuario_id;

  insert into public.reputacion_movimientos (usuario_id, reporte_id, puntos, motivo)
  values (p_usuario_id, p_reporte_id, p_puntos, p_motivo);
end;
$$;

-- Manda el reporte a las instituciones de su categoría (una sola vez por
-- institución) y avisa por webhook a las que lo tengan configurado.
create or replace function public.enviar_reporte_a_instituciones(p_reporte_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporte public.reportes%rowtype;
  v_categoria public.categorias%rowtype;
  v_inst record;
  v_nuevas text[] := array[]::text[];
begin
  select * into v_reporte from public.reportes where id = p_reporte_id;
  if not found then
    return 0;
  end if;
  select * into v_categoria from public.categorias where id = v_reporte.categoria_id;

  for v_inst in
    insert into public.reporte_envios (reporte_id, institucion_id)
    select p_reporte_id, ci.institucion_id
    from public.categoria_instituciones ci
    join public.instituciones i on i.id = ci.institucion_id and i.activa
    where ci.categoria_id = v_reporte.categoria_id
    on conflict (reporte_id, institucion_id) do nothing
    returning institucion_id
  loop
    select array_append(v_nuevas, i.nombre) into v_nuevas
    from public.instituciones i where i.id = v_inst.institucion_id;

    begin
      perform net.http_post(
        url := i.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'evento', 'reporte_prevalidado',
          'reporte_id', v_reporte.id,
          'categoria', v_categoria.nombre,
          'estado', v_reporte.estado,
          'veracidad', v_reporte.veracidad,
          'severidad', v_reporte.severidad,
          'latitud', v_reporte.latitud_exacta,
          'longitud', v_reporte.longitud_exacta,
          'descripcion', v_reporte.descripcion,
          'datos', v_reporte.datos,
          'creado_en', v_reporte.created_at
        )
      )
      from public.instituciones i
      where i.id = v_inst.institucion_id and i.webhook_url is not null and length(trim(i.webhook_url)) > 0;
    exception when others then
      null; -- El webhook es de mejor esfuerzo; el envío ya quedó registrado.
    end;
  end loop;

  if array_length(v_nuevas, 1) > 0 then
    insert into public.auditoria_administrativa (reporte_id, admin_id, accion, detalle)
    values (p_reporte_id, null, 'enviar_instituciones', jsonb_build_object('instituciones', to_jsonb(v_nuevas)));
  end if;

  return coalesce(array_length(v_nuevas, 1), 0);
end;
$$;

-- Recalcula apoyo/contra/veracidad de un reporte y lo pre-valida si supera el
-- umbral de su categoría. Devuelve true si el reporte acaba de pre-validarse.
--
--   apoyo  = peso(autor) + Σ peso("yo también lo veo")
--            + Σ peso(autores de otros reportes iguales y cercanos)
--   contra = Σ peso("esto no es cierto")
--   pre-validado cuando apoyo − contra ≥ umbral de la categoría
--   veracidad = 100 × apoyo/(apoyo+contra) × min(1, apoyo/umbral)
create or replace function public.recalcular_validacion(p_reporte_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporte public.reportes%rowtype;
  v_umbral integer;
  v_ventana integer;
  v_apoyo numeric := 0;
  v_contra numeric := 0;
  v_extra numeric := 0;
  v_veracidad integer;
  v_prevalidar boolean := false;
begin
  select * into v_reporte from public.reportes where id = p_reporte_id for update;
  if not found or v_reporte.estado in ('descartada', 'cerrada') then
    return false;
  end if;

  select coalesce(cr.umbral_confirmaciones, 2), coalesce(cr.ventana_minutos, 30)
  into v_umbral, v_ventana
  from public.categorias c
  left join public.categoria_reglas cr on cr.categoria_id = c.id
  where c.id = v_reporte.categoria_id;
  v_umbral := coalesce(v_umbral, 2);
  v_ventana := coalesce(v_ventana, 30);

  -- Autor
  select public.peso_reputacion(p.reputacion) into v_apoyo
  from public.perfiles p where p.id = v_reporte.creador_id;
  v_apoyo := coalesce(v_apoyo, 1.0);

  -- Reacciones
  select
    coalesce(sum(public.peso_reputacion(p.reputacion)) filter (where rr.tipo = 'confirma'), 0),
    coalesce(sum(public.peso_reputacion(p.reputacion)) filter (where rr.tipo = 'desmiente'), 0)
  into v_extra, v_contra
  from public.reporte_reacciones rr
  left join public.perfiles p on p.id = rr.usuario_id
  where rr.reporte_id = v_reporte.id;
  v_apoyo := v_apoyo + v_extra;

  -- Otros reportes independientes de la misma categoría, cerca y en la
  -- ventana de tiempo (un voto por persona; no cuenta a quien ya reaccionó).
  select coalesce(sum(public.peso_reputacion(s.reputacion)), 0) into v_extra
  from (
    select distinct on (r2.creador_id) p.reputacion
    from public.reportes r2
    left join public.perfiles p on p.id = r2.creador_id
    where r2.id <> v_reporte.id
      and r2.categoria_id = v_reporte.categoria_id
      and r2.creador_id is not null
      and r2.creador_id is distinct from v_reporte.creador_id
      and r2.estado in ('no_confirmada', 'corroborada', 'verificada')
      and abs(extract(epoch from (r2.created_at - v_reporte.created_at))) <= v_ventana * 60
      and st_dwithin(r2.ubicacion_exacta, v_reporte.ubicacion_exacta, greatest(500, v_reporte.radio_inicial_metros / 2))
      and not exists (
        select 1 from public.reporte_reacciones rr
        where rr.reporte_id = v_reporte.id and rr.usuario_id = r2.creador_id
      )
    order by r2.creador_id
  ) s;
  v_apoyo := v_apoyo + v_extra;

  if v_reporte.estado = 'verificada' then
    v_veracidad := 100;
  else
    v_veracidad := round(
      100 * (v_apoyo / greatest(v_apoyo + v_contra, 0.0001)) * least(1, v_apoyo / greatest(v_umbral, 1))
    )::integer;
    v_prevalidar := v_reporte.estado = 'no_confirmada' and (v_apoyo - v_contra) >= v_umbral;
  end if;

  update public.reportes
  set puntaje_apoyo = round(v_apoyo, 2),
      puntaje_contra = round(v_contra, 2),
      veracidad = greatest(0, least(100, v_veracidad)),
      estado = case when v_prevalidar then 'corroborada'::public.estado_reporte else estado end,
      prevalidado_en = case when v_prevalidar then now() else prevalidado_en end,
      updated_at = now()
  where id = v_reporte.id;

  if v_prevalidar then
    perform public.enviar_reporte_a_instituciones(v_reporte.id);
  end if;

  return v_prevalidar;
end;
$$;

-- Compatibilidad: el nombre anterior ahora usa la validación ponderada.
create or replace function public.evaluar_corroboracion_automatica(p_reporte_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.recalcular_validacion(p_reporte_id) then
    perform public.notificar_motor_distribucion(p_reporte_id);
  end if;
end;
$$;

-- ======================================================================
-- Radio vigente: mientras está "Reportada" el aviso de confirmación llega a
-- la mitad del radio de la categoría; pre-validada o validada, al radio completo.
-- ======================================================================

-- SECURITY DEFINER: la vista pública la llama con los permisos de quien
-- consulta, y con RLS un usuario no puede leer reportes ajenos (devolvía 0).
create or replace function public.radio_actual_reporte(p_reporte_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reporte public.reportes%rowtype;
  v_categoria public.categorias%rowtype;
  v_elapsed_min integer;
  v_radio_tiempo integer;
begin
  select * into v_reporte from public.reportes where id = p_reporte_id;
  if not found then
    return 0;
  end if;

  if v_reporte.estado in ('cerrada', 'descartada') then
    return 0;
  end if;

  select * into v_categoria from public.categorias where id = v_reporte.categoria_id;

  if v_reporte.estado = 'no_confirmada' then
    return greatest(100, ceil(v_reporte.radio_inicial_metros / 2.0)::integer);
  end if;

  if v_categoria.requiere_moderacion_obligatoria and v_reporte.estado <> 'verificada' then
    return v_reporte.radio_inicial_metros;
  end if;

  v_elapsed_min := greatest(0, floor(extract(epoch from (now() - v_reporte.created_at)) / 60.0))::integer;
  v_radio_tiempo := coalesce(
    public.obtener_radio_vigente(v_reporte.categoria_id, v_elapsed_min),
    v_reporte.radio_inicial_metros
  );

  return greatest(v_reporte.radio_inicial_metros, least(v_radio_tiempo, v_reporte.radio_maximo_metros));
end;
$$;

-- ======================================================================
-- Crear reporte (ahora con datos del formulario y análisis de foto)
-- ======================================================================

drop function if exists public.crear_reporte(uuid, double precision, double precision, text, text, text);

create or replace function public.crear_reporte(
  p_categoria_id uuid,
  p_latitud double precision,
  p_longitud double precision,
  p_celda_h3 text,
  p_descripcion text default null,
  p_foto_url text default null,
  p_datos jsonb default '{}'::jsonb,
  p_analisis_foto jsonb default null
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
  v_campo jsonb;
  v_clave text;
  v_valor text;
  v_requerido boolean;
  v_datos jsonb := '{}'::jsonb;
  v_hermano record;
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

  -- Foto obligatoria y análisis de contenido (hecho en el teléfono).
  if v_categoria.requiere_foto and (p_foto_url is null or length(trim(p_foto_url)) = 0) then
    raise exception 'Esta categoría requiere una foto.';
  end if;

  if p_foto_url is not null and p_analisis_foto is not null then
    if coalesce((p_analisis_foto ->> 'nsfw')::boolean, false) then
      raise exception 'La foto fue rechazada por contenido inapropiado.';
    end if;
    if v_categoria.foto_requiere_rostro
       and coalesce((p_analisis_foto ->> 'disponible')::boolean, false)
       and coalesce((p_analisis_foto ->> 'rostros')::integer, 0) < 1 then
      raise exception 'La foto debe mostrar claramente el rostro de la persona.';
    end if;
  end if;

  -- Campos del formulario de la categoría: valida obligatorios y guarda solo
  -- las claves conocidas.
  for v_campo in select * from jsonb_array_elements(v_categoria.campos_formulario)
  loop
    v_clave := v_campo ->> 'clave';
    continue when v_clave is null;

    v_valor := nullif(trim(coalesce(p_datos ->> v_clave, '')), '');
    v_requerido := coalesce((v_campo ->> 'requerido')::boolean, false)
      or (
        v_campo ? 'requerido_si_vacio'
        and nullif(trim(coalesce(p_datos ->> (v_campo ->> 'requerido_si_vacio'), '')), '') is null
      );

    if v_valor is null then
      if v_requerido then
        raise exception 'Falta el campo: %', coalesce(v_campo ->> 'etiqueta', v_clave);
      end if;
      continue;
    end if;

    if v_campo ->> 'tipo' = 'numero' and v_valor !~ '^\d{1,3}(\.\d+)?$' then
      raise exception 'El campo "%" debe ser un número.', coalesce(v_campo ->> 'etiqueta', v_clave);
    end if;

    if v_campo ->> 'tipo' = 'opciones'
       and jsonb_typeof(v_campo -> 'opciones') = 'array'
       and not (v_campo -> 'opciones') ? v_valor then
      raise exception 'Opción no válida para "%".', coalesce(v_campo ->> 'etiqueta', v_clave);
    end if;

    if coalesce((v_campo ->> 'mayusculas')::boolean, false) then
      v_valor := upper(v_valor);
    end if;

    v_datos := v_datos || jsonb_build_object(v_clave, left(v_valor, 500));
  end loop;

  v_punto := st_setsrid(st_makepoint(p_longitud, p_latitud), 4326)::geography;

  insert into public.reportes (
    categoria_id, creador_id, descripcion, ubicacion_exacta, ubicacion_aproximada,
    creado_en_celda_h3, severidad, radio_inicial_metros, radio_maximo_metros, vigencia_minutos,
    foto_url, datos, analisis_foto
  ) values (
    p_categoria_id, v_uid, nullif(left(trim(coalesce(p_descripcion, '')), 1000), ''), v_punto,
    st_snaptogrid(v_punto::geometry, 0.001)::geography,
    p_celda_h3, v_categoria.severidad_default, v_categoria.radio_inicial_metros,
    v_categoria.radio_maximo_metros, v_categoria.vigencia_default_minutos,
    p_foto_url, v_datos, p_analisis_foto
  )
  returning id into v_reporte_id;

  perform public.recalcular_validacion(v_reporte_id);

  -- Un reporte nuevo también cuenta como apoyo para los reportes iguales que
  -- ya estaban cerca.
  for v_hermano in
    select r2.id
    from public.reportes r2
    join public.categoria_reglas cr on cr.categoria_id = r2.categoria_id
    where r2.id <> v_reporte_id
      and r2.categoria_id = p_categoria_id
      and r2.estado = 'no_confirmada'
      and r2.created_at >= now() - (cr.ventana_minutos || ' minutes')::interval
      and st_dwithin(r2.ubicacion_exacta, v_punto, greatest(500, r2.radio_inicial_metros / 2))
  loop
    if public.recalcular_validacion(v_hermano.id) then
      perform public.notificar_motor_distribucion(v_hermano.id);
    end if;
  end loop;

  perform public.notificar_motor_distribucion(v_reporte_id);

  return v_reporte_id;
end;
$$;

-- ======================================================================
-- Reaccionar ("¿Tú también lo ves?") recalcula la validación
-- ======================================================================

create or replace function public.reaccionar_reporte(p_reporte_id uuid, p_tipo public.tipo_reaccion)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_reporte public.reportes%rowtype;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into v_reporte from public.reportes where id = p_reporte_id;
  if not found then
    raise exception 'Reporte no encontrado';
  end if;

  if v_reporte.creador_id = v_uid then
    raise exception 'No puedes reaccionar a tu propio reporte';
  end if;

  if v_reporte.estado in ('descartada', 'cerrada') then
    raise exception 'Este reporte ya fue cerrado.';
  end if;

  insert into public.reporte_reacciones (reporte_id, usuario_id, tipo)
  values (p_reporte_id, v_uid, p_tipo)
  on conflict (reporte_id, usuario_id)
  do update set tipo = excluded.tipo, created_at = now();

  if public.recalcular_validacion(p_reporte_id) then
    perform public.notificar_motor_distribucion(p_reporte_id);
  end if;

  return p_reporte_id;
end;
$$;

-- ======================================================================
-- Validación institucional: VERDAD / MENTIRA con puntos de reputación
-- ======================================================================

-- Puntos: autor +10 / −15; "lo veo" +5 / −5; "no es cierto" −5 / +5.
create or replace function public.repartir_reputacion(p_reporte_id uuid, p_es_verdad boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creador uuid;
  v_reaccion record;
begin
  select creador_id into v_creador from public.reportes where id = p_reporte_id;

  perform public.aplicar_reputacion(
    v_creador, p_reporte_id,
    case when p_es_verdad then 10 else -15 end,
    case when p_es_verdad then 'Tu reporte fue validado como verdadero'
         else 'Tu reporte fue validado como falso' end
  );

  for v_reaccion in
    select usuario_id, tipo from public.reporte_reacciones where reporte_id = p_reporte_id
  loop
    perform public.aplicar_reputacion(
      v_reaccion.usuario_id, p_reporte_id,
      case when (v_reaccion.tipo = 'confirma') = p_es_verdad then 5 else -5 end,
      case when (v_reaccion.tipo = 'confirma') = p_es_verdad then 'Acertaste al validar un reporte'
           else 'Fallaste al validar un reporte' end
    );
  end loop;
end;
$$;

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
  v_reporte public.reportes%rowtype;
begin
  v_uid := auth.uid();
  if v_uid is null or not public.puede_gestionar_reporte(v_uid, p_reporte_id) then
    raise exception 'No autorizado';
  end if;

  select * into v_reporte from public.reportes where id = p_reporte_id for update;
  if not found then
    raise exception 'Reporte no encontrado';
  end if;
  if v_reporte.estado not in ('no_confirmada', 'corroborada') then
    raise exception 'Este reporte ya fue evaluado.';
  end if;

  perform set_config('alerta_cerca.permitir_campos_protegidos', 'true', true);

  update public.reportes
  set estado = 'verificada',
      veracidad = 100,
      severidad = coalesce(p_severidad_override, severidad),
      verificado_por = v_uid,
      verificado_en = now(),
      updated_at = now()
  where id = p_reporte_id;

  if v_reporte.creador_id is not null then
    update public.perfiles
    set reportes_confirmados_contador = reportes_confirmados_contador + 1
    where id = v_reporte.creador_id;
  end if;

  perform public.repartir_reputacion(p_reporte_id, true);

  -- Si se validó sin haber pasado por pre-validación, se registra el envío.
  perform public.enviar_reporte_a_instituciones(p_reporte_id);
  update public.reporte_envios set estado = 'validado_verdad', actualizado_en = now()
  where reporte_id = p_reporte_id;

  insert into public.auditoria_administrativa (reporte_id, admin_id, accion, detalle)
  values (p_reporte_id, v_uid, 'verificar', jsonb_build_object('resultado', 'VERDAD', 'nota', p_nota));

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
  v_reporte public.reportes%rowtype;
  v_descartados integer;
begin
  v_uid := auth.uid();
  if v_uid is null or not public.puede_gestionar_reporte(v_uid, p_reporte_id) then
    raise exception 'No autorizado';
  end if;

  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'El motivo es obligatorio';
  end if;

  select * into v_reporte from public.reportes where id = p_reporte_id for update;
  if not found then
    raise exception 'Reporte no encontrado';
  end if;
  if v_reporte.estado not in ('no_confirmada', 'corroborada') then
    raise exception 'Este reporte ya fue evaluado.';
  end if;

  perform set_config('alerta_cerca.permitir_campos_protegidos', 'true', true);

  update public.reportes
  set estado = 'descartada', veracidad = 0, descartado_motivo = p_motivo,
      verificado_por = v_uid, verificado_en = now(), updated_at = now()
  where id = p_reporte_id;

  if v_reporte.creador_id is not null then
    update public.perfiles
    set reportes_descartados_contador = reportes_descartados_contador + 1
    where id = v_reporte.creador_id
    returning reportes_descartados_contador into v_descartados;

    if v_descartados >= 3 then
      update public.perfiles
      set suspendido_hasta = now() + interval '7 days'
      where id = v_reporte.creador_id;
    end if;
  end if;

  perform public.repartir_reputacion(p_reporte_id, false);

  update public.reporte_envios set estado = 'validado_mentira', actualizado_en = now()
  where reporte_id = p_reporte_id;

  insert into public.auditoria_administrativa (reporte_id, admin_id, accion, detalle)
  values (p_reporte_id, v_uid, 'descartar', jsonb_build_object('resultado', 'MENTIRA', 'motivo', p_motivo));

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
  if v_uid is null or not public.puede_gestionar_reporte(v_uid, p_reporte_id) then
    raise exception 'No autorizado';
  end if;

  update public.reportes
  set estado = 'cerrada', cerrado_en = now(), updated_at = now()
  where id = p_reporte_id;

  update public.reporte_envios set estado = 'cerrado', actualizado_en = now()
  where reporte_id = p_reporte_id;

  insert into public.auditoria_administrativa (reporte_id, admin_id, accion, detalle)
  values (p_reporte_id, v_uid, 'cerrar', '{}'::jsonb);

  return p_reporte_id;
end;
$$;

-- ======================================================================
-- Administración: categorías y usuarios
-- ======================================================================

create or replace function public.admin_guardar_categoria(p_id uuid, p_datos jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := p_id;
  v_nombre text := nullif(trim(coalesce(p_datos ->> 'nombre', '')), '');
  v_radio_inicial integer := coalesce((p_datos ->> 'radio_inicial_metros')::integer, 500);
  v_radio_maximo integer := coalesce((p_datos ->> 'radio_maximo_metros')::integer, v_radio_inicial);
  v_umbral integer := coalesce((p_datos ->> 'umbral_confirmaciones')::integer, 2);
  v_ventana integer := coalesce((p_datos ->> 'ventana_minutos')::integer, 30);
  v_vigencia integer := coalesce((p_datos ->> 'vigencia_default_minutos')::integer, 180);
  v_campos jsonb := coalesce(p_datos -> 'campos_formulario', '[]'::jsonb);
  v_instituciones jsonb := coalesce(p_datos -> 'instituciones', '[]'::jsonb);
begin
  if v_uid is null or not public.es_administrador(v_uid) then
    raise exception 'Solo un administrador puede gestionar categorías.';
  end if;
  if v_nombre is null then
    raise exception 'El nombre es obligatorio.';
  end if;
  if v_radio_inicial < 100 or v_radio_inicial > 50000 then
    raise exception 'El radio debe estar entre 100 m y 50 km.';
  end if;
  if v_radio_maximo < v_radio_inicial or v_radio_maximo > 50000 then
    raise exception 'El radio máximo debe ser mayor o igual al inicial (y máximo 50 km).';
  end if;
  if v_umbral < 1 or v_umbral > 50 then
    raise exception 'El umbral de credibilidad debe estar entre 1 y 50.';
  end if;
  if v_ventana < 1 or v_vigencia < 1 then
    raise exception 'La ventana y la vigencia deben ser mayores a cero.';
  end if;
  if jsonb_typeof(v_campos) <> 'array' or jsonb_typeof(v_instituciones) <> 'array' then
    raise exception 'Formato inválido de campos o instituciones.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_campos) c
    where nullif(trim(coalesce(c ->> 'clave', '')), '') is null
       or nullif(trim(coalesce(c ->> 'etiqueta', '')), '') is null
       or coalesce(c ->> 'tipo', '') not in ('texto', 'texto_largo', 'numero', 'opciones')
  ) then
    raise exception 'Cada campo necesita clave, etiqueta y un tipo válido.';
  end if;

  if v_id is null then
    insert into public.categorias (nombre) values (v_nombre) returning id into v_id;
  end if;

  update public.categorias set
    nombre = v_nombre,
    descripcion = nullif(trim(coalesce(p_datos ->> 'descripcion', '')), ''),
    activa = coalesce((p_datos ->> 'activa')::boolean, true),
    color = coalesce(nullif(p_datos ->> 'color', ''), '#64748B'),
    icono = coalesce(nullif(p_datos ->> 'icono', ''), 'alert'),
    severidad_default = coalesce((p_datos ->> 'severidad_default')::public.severidad, 'baja'),
    radio_inicial_metros = v_radio_inicial,
    radio_maximo_metros = v_radio_maximo,
    vigencia_default_minutos = v_vigencia,
    requiere_moderacion_obligatoria = coalesce((p_datos ->> 'requiere_moderacion_obligatoria')::boolean, false),
    requiere_foto = coalesce((p_datos ->> 'requiere_foto')::boolean, false),
    foto_requiere_rostro = coalesce((p_datos ->> 'foto_requiere_rostro')::boolean, false),
    campos_formulario = v_campos,
    updated_at = now()
  where id = v_id;

  if not found then
    raise exception 'Categoría no encontrada.';
  end if;

  insert into public.categoria_reglas (categoria_id, umbral_confirmaciones, ventana_minutos, expiracion_minutos)
  values (v_id, v_umbral, v_ventana, v_vigencia)
  on conflict (categoria_id) do update set
    umbral_confirmaciones = excluded.umbral_confirmaciones,
    ventana_minutos = excluded.ventana_minutos,
    expiracion_minutos = excluded.expiracion_minutos,
    updated_at = now();

  perform public.regenerar_anillos_categoria(v_id);

  delete from public.categoria_instituciones where categoria_id = v_id;
  insert into public.categoria_instituciones (categoria_id, institucion_id)
  select v_id, i.id
  from jsonb_array_elements_text(v_instituciones) as x(valor)
  join public.instituciones i on i.id::text = x.valor
  on conflict do nothing;

  insert into public.usuario_categoria_preferencias (usuario_id, categoria_id, activa)
  select up.usuario_id, v_id, true from public.usuario_preferencias up
  on conflict (usuario_id, categoria_id) do nothing;

  insert into public.auditoria_administrativa (reporte_id, admin_id, accion, detalle)
  values (null, v_uid, 'guardar_categoria', jsonb_build_object('categoria_id', v_id, 'nombre', v_nombre));

  return v_id;
end;
$$;

create or replace function public.admin_listar_usuarios(p_busqueda text default null)
returns table (
  id uuid,
  email text,
  telefono text,
  rol public.rol_usuario,
  institucion_id uuid,
  reputacion integer,
  suspendido_hasta timestamptz,
  reportes_confirmados_contador integer,
  reportes_descartados_contador integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_administrador(auth.uid()) then
    raise exception 'Solo un administrador puede ver usuarios.';
  end if;

  return query
  select
    p.id,
    u.email::text,
    coalesce(p.telefono, u.phone::text),
    p.rol,
    p.institucion_id,
    p.reputacion,
    p.suspendido_hasta,
    p.reportes_confirmados_contador,
    p.reportes_descartados_contador,
    p.created_at
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p_busqueda is null
     or length(trim(p_busqueda)) = 0
     or u.email ilike '%' || trim(p_busqueda) || '%'
     or coalesce(p.telefono, u.phone, '') ilike '%' || trim(p_busqueda) || '%'
  order by p.created_at desc
  limit 200;
end;
$$;

create or replace function public.admin_cambiar_rol(
  p_usuario_id uuid,
  p_rol public.rol_usuario,
  p_institucion_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.es_administrador(v_uid) then
    raise exception 'Solo un administrador puede cambiar roles.';
  end if;
  if p_usuario_id = v_uid then
    raise exception 'No puedes cambiar tu propio rol.';
  end if;
  if p_rol = 'moderador' then
    raise exception 'El rol "moderador" ya no se usa; elige gubernamental.';
  end if;

  perform set_config('alerta_cerca.permitir_campos_protegidos', 'true', true);

  update public.perfiles
  set rol = p_rol,
      institucion_id = case when p_rol = 'gubernamental' then p_institucion_id else null end,
      updated_at = now()
  where id = p_usuario_id;

  if not found then
    raise exception 'Usuario no encontrado.';
  end if;

  insert into public.auditoria_administrativa (reporte_id, admin_id, accion, detalle)
  values (null, v_uid, 'cambiar_rol', jsonb_build_object(
    'usuario_id', p_usuario_id, 'rol', p_rol, 'institucion_id', p_institucion_id));
end;
$$;

-- p_dias = 0 quita la suspensión.
create or replace function public.admin_suspender_usuario(p_usuario_id uuid, p_dias integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.es_administrador(v_uid) then
    raise exception 'Solo un administrador puede suspender usuarios.';
  end if;
  if p_usuario_id = v_uid then
    raise exception 'No puedes suspenderte a ti mismo.';
  end if;

  perform set_config('alerta_cerca.permitir_campos_protegidos', 'true', true);

  update public.perfiles
  set suspendido_hasta = case when coalesce(p_dias, 0) <= 0 then null else now() + make_interval(days => p_dias) end,
      updated_at = now()
  where id = p_usuario_id;

  insert into public.auditoria_administrativa (reporte_id, admin_id, accion, detalle)
  values (null, v_uid, case when coalesce(p_dias, 0) <= 0 then 'quitar_suspension' else 'suspender' end,
          jsonb_build_object('usuario_id', p_usuario_id, 'dias', p_dias));
end;
$$;

-- Limpieza de datos previa al borrado de auth.users (lo hace la Edge
-- Function `admin-eliminar-usuario` con service role).
create or replace function public.admin_preparar_eliminacion(p_admin_id uuid, p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_administrador(p_admin_id) then
    raise exception 'Solo un administrador puede eliminar usuarios.';
  end if;
  if p_admin_id = p_usuario_id then
    raise exception 'No puedes eliminar tu propia cuenta desde el panel.';
  end if;

  delete from public.zonas_guardadas where usuario_id = p_usuario_id;
  delete from public.usuario_categoria_preferencias where usuario_id = p_usuario_id;
  delete from public.usuario_preferencias where usuario_id = p_usuario_id;
  delete from public.reporte_reacciones where usuario_id = p_usuario_id;
  update public.reportes set creador_id = null where creador_id = p_usuario_id;

  insert into public.auditoria_administrativa (reporte_id, admin_id, accion, detalle)
  values (null, p_admin_id, 'eliminar_usuario', jsonb_build_object('usuario_id', p_usuario_id));
end;
$$;

-- ======================================================================
-- Foto pública de persona desaparecida (solo cuando ya fue validada)
-- ======================================================================

create or replace function public.foto_es_publica(p_ruta text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reportes r
    join public.categorias c on c.id = r.categoria_id
    where r.foto_url = p_ruta
      and r.estado = 'verificada'
      and c.requiere_moderacion_obligatoria
  );
$$;

drop policy if exists "leer foto publica validada" on storage.objects;
create policy "leer foto publica validada"
on storage.objects
for select
to authenticated
using (bucket_id = 'fotos-reportes' and public.foto_es_publica(name));

-- Permitir que un gubernamental vea las fotos de los reportes que le tocan.
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
-- Vista pública (columnas nuevas al final)
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
  r.created_at + (r.vigencia_minutos || ' minutes')::interval as expira_en,
  r.veracidad,
  case when not c.requiere_moderacion_obligatoria or r.estado = 'verificada'
       then r.datos else '{}'::jsonb end as datos,
  case when c.requiere_moderacion_obligatoria and r.estado = 'verificada'
       then r.foto_url end as foto_url,
  coalesce((
    select array_agg(i.nombre order by i.nombre)
    from public.reporte_envios e
    join public.instituciones i on i.id = e.institucion_id
    where e.reporte_id = r.id
  ), array[]::text[]) as enviado_a,
  c.icono as categoria_icono
from public.reportes r
join public.categorias c on c.id = r.categoria_id
where c.activa = true
  and r.estado <> 'descartada';

grant select on public.reportes_publicos to anon, authenticated;

-- ======================================================================
-- Motor de distribución: ahora también recibe la veracidad
-- ======================================================================

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
  veracidad smallint
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
    r.veracidad
  from public.reportes r
  where r.estado in ('no_confirmada', 'corroborada', 'verificada')
    and r.created_at + (r.vigencia_minutos || ' minutes')::interval > now()
    and (p_reporte_id is null or r.id = p_reporte_id);
$$;

-- ======================================================================
-- RLS de las tablas nuevas
-- ======================================================================

alter table public.instituciones enable row level security;
alter table public.categoria_instituciones enable row level security;
alter table public.reporte_envios enable row level security;
alter table public.reputacion_movimientos enable row level security;

grant select on public.instituciones, public.categoria_instituciones, public.reporte_envios,
  public.reputacion_movimientos to authenticated;
grant insert, update on public.instituciones to authenticated;

drop policy if exists "lectura instituciones" on public.instituciones;
create policy "lectura instituciones"
on public.instituciones for select to authenticated
using (activa or public.es_administrador(auth.uid()));

drop policy if exists "admin crea instituciones" on public.instituciones;
create policy "admin crea instituciones"
on public.instituciones for insert to authenticated
with check (public.es_administrador(auth.uid()));

drop policy if exists "admin edita instituciones" on public.instituciones;
create policy "admin edita instituciones"
on public.instituciones for update to authenticated
using (public.es_administrador(auth.uid()))
with check (public.es_administrador(auth.uid()));

drop policy if exists "lectura categoria instituciones" on public.categoria_instituciones;
create policy "lectura categoria instituciones"
on public.categoria_instituciones for select to authenticated
using (true);

drop policy if exists "lectura envios" on public.reporte_envios;
create policy "lectura envios"
on public.reporte_envios for select to authenticated
using (
  public.puede_gestionar_reporte(auth.uid(), reporte_id)
  or exists (select 1 from public.reportes r where r.id = reporte_id and r.creador_id = auth.uid())
);

drop policy if exists "lectura movimientos propios" on public.reputacion_movimientos;
create policy "lectura movimientos propios"
on public.reputacion_movimientos for select to authenticated
using (usuario_id = auth.uid());

-- El administrador ve también las categorías desactivadas.
drop policy if exists "admin lee todas las categorias" on public.categorias;
create policy "admin lee todas las categorias"
on public.categorias for select to authenticated
using (public.es_administrador(auth.uid()));

-- ======================================================================
-- Permisos de ejecución (mismo criterio que *_hardening*.sql)
-- ======================================================================

revoke execute on function public.crear_reporte(uuid, double precision, double precision, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.crear_reporte(uuid, double precision, double precision, text, text, text, jsonb, jsonb) to authenticated;

revoke execute on function public.reaccionar_reporte(uuid, public.tipo_reaccion) from public, anon;
grant execute on function public.reaccionar_reporte(uuid, public.tipo_reaccion) to authenticated;

revoke execute on function public.moderar_verificar_reporte(uuid, public.severidad, text) from public, anon;
revoke execute on function public.moderar_descartar_reporte(uuid, text) from public, anon;
revoke execute on function public.moderar_cerrar_reporte(uuid) from public, anon;
grant execute on function public.moderar_verificar_reporte(uuid, public.severidad, text) to authenticated;
grant execute on function public.moderar_descartar_reporte(uuid, text) to authenticated;
grant execute on function public.moderar_cerrar_reporte(uuid) to authenticated;

revoke execute on function public.admin_guardar_categoria(uuid, jsonb) from public, anon;
revoke execute on function public.admin_listar_usuarios(text) from public, anon;
revoke execute on function public.admin_cambiar_rol(uuid, public.rol_usuario, uuid) from public, anon;
revoke execute on function public.admin_suspender_usuario(uuid, integer) from public, anon;
grant execute on function public.admin_guardar_categoria(uuid, jsonb) to authenticated;
grant execute on function public.admin_listar_usuarios(text) to authenticated;
grant execute on function public.admin_cambiar_rol(uuid, public.rol_usuario, uuid) to authenticated;
grant execute on function public.admin_suspender_usuario(uuid, integer) to authenticated;

-- Funciones de apoyo que se usan en políticas RLS: deben poder ejecutarlas
-- los usuarios autenticados (solo devuelven verdadero/falso).
revoke execute on function public.es_administrador(uuid) from public, anon;
revoke execute on function public.es_moderador_o_autoridad(uuid) from public, anon;
revoke execute on function public.puede_gestionar_reporte(uuid, uuid) from public, anon;
revoke execute on function public.foto_es_publica(text) from public, anon;
grant execute on function public.es_administrador(uuid) to authenticated;
grant execute on function public.es_moderador_o_autoridad(uuid) to authenticated;
grant execute on function public.puede_gestionar_reporte(uuid, uuid) to authenticated;
grant execute on function public.foto_es_publica(text) to authenticated;

-- Internas: nunca un endpoint RPC público.
revoke execute on function public.recalcular_validacion(uuid) from public, anon, authenticated;
revoke execute on function public.enviar_reporte_a_instituciones(uuid) from public, anon, authenticated;
revoke execute on function public.aplicar_reputacion(uuid, uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.repartir_reputacion(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.regenerar_anillos_categoria(uuid) from public, anon, authenticated;
revoke execute on function public.evaluar_corroboracion_automatica(uuid) from public, anon, authenticated;
revoke execute on function public.admin_preparar_eliminacion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_preparar_eliminacion(uuid, uuid) to service_role;

revoke execute on function public.obtener_reportes_activos_para_motor(uuid) from public, anon, authenticated;
grant execute on function public.obtener_reportes_activos_para_motor(uuid) to service_role;

-- Recalcula la veracidad de los reportes activos que ya existían.
select public.recalcular_validacion(id)
from public.reportes
where estado in ('no_confirmada', 'corroborada', 'verificada');

select set_config('alerta_cerca.permitir_campos_protegidos', 'false', false);
