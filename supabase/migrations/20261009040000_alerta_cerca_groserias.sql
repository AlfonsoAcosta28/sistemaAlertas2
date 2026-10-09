-- Filtro de groserías en la descripción y los campos de texto de los reportes.
--
-- Mismo algoritmo que `src/domain/groserias.ts` (el teléfono avisa al momento;
-- aquí se bloquea aunque alguien modifique la app). Si cambias uno, cambia el otro.
-- El administrador edita la lista desde la app (Administración → Lenguaje).

create table if not exists public.palabras_prohibidas (
  palabra text primary key check (length(palabra) between 2 and 60),
  created_at timestamptz not null default now()
);

-- Pasos 1–3: minúsculas, sin acentos (se conserva la ñ), números que imitan
-- letras, signos internos fuera, y letras sueltas seguidas juntas.
create or replace function public.palabras_del_texto(p_texto text)
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_limpio text;
  v_token text;
  v_palabra text;
  v_sueltas text := '';
  v_resultado text[] := array[]::text[];
begin
  if p_texto is null then
    return v_resultado;
  end if;

  v_limpio := translate(
    lower(p_texto),
    'áàäâéèëêíìïîóòöôúùüû013457@$',
    'aaaaeeeeiiiioooouuuuoieastas'
  );

  foreach v_token in array regexp_split_to_array(v_limpio, '\s+')
  loop
    v_palabra := regexp_replace(v_token, '[^a-zñ]', '', 'g');
    continue when v_palabra = '';
    v_resultado := array_append(v_resultado, v_palabra);
    if length(v_palabra) = 1 then
      v_sueltas := v_sueltas || v_palabra;
    else
      if length(v_sueltas) >= 2 then
        v_resultado := array_append(v_resultado, v_sueltas);
      end if;
      v_sueltas := '';
    end if;
  end loop;

  if length(v_sueltas) >= 2 then
    v_resultado := array_append(v_resultado, v_sueltas);
  end if;

  return v_resultado;
end;
$$;

create or replace function public.normalizar_palabra_prohibida(p_palabra text)
returns text
language sql
immutable
set search_path = public
as $$
  select array_to_string(public.palabras_del_texto(p_palabra), ' ');
$$;

-- Devuelve la palabra prohibida encontrada o null.
create or replace function public.buscar_groseria(p_texto text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_palabras text[];
  v_palabra text;
  v_variantes text[];
  v_v text;
  v_encontrada text;
  v_unido text;
begin
  v_palabras := public.palabras_del_texto(p_texto);
  if coalesce(array_length(v_palabras, 1), 0) = 0 then
    return null;
  end if;

  foreach v_palabra in array v_palabras
  loop
    v_variantes := array[
      v_palabra,
      regexp_replace(v_palabra, '(.)\1{2,}', '\1', 'g'),
      regexp_replace(v_palabra, '(.)\1{2,}', '\1\1', 'g')
    ];
    foreach v_v in array v_variantes
    loop
      if length(v_v) > 3 and right(v_v, 1) = 's' then
        v_variantes := array_append(v_variantes, left(v_v, -1));
      end if;
    end loop;

    select p.palabra into v_encontrada
    from public.palabras_prohibidas p
    where position(' ' in p.palabra) = 0 and p.palabra = any(v_variantes)
    limit 1;

    if v_encontrada is not null then
      return v_encontrada;
    end if;
  end loop;

  -- Frases ("hijo de puta"): se buscan en el texto normalizado completo.
  select ' ' || string_agg(regexp_replace(w, '(.)\1{2,}', '\1', 'g'), ' ') || ' '
  into v_unido
  from unnest(v_palabras) as w;

  select p.palabra into v_encontrada
  from public.palabras_prohibidas p
  where position(' ' in p.palabra) > 0
    and position(' ' || p.palabra || ' ' in v_unido) > 0
  limit 1;

  return v_encontrada;
end;
$$;

-- Normaliza lo que agrega el administrador (acentos, mayúsculas, etc.).
create or replace function public.normalizar_palabras_prohibidas()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.palabra := public.normalizar_palabra_prohibida(new.palabra);
  if new.palabra is null or length(new.palabra) < 2 then
    raise exception 'Escribe una palabra válida.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_normalizar_palabras_prohibidas on public.palabras_prohibidas;
create trigger trg_normalizar_palabras_prohibidas
before insert or update on public.palabras_prohibidas
for each row execute function public.normalizar_palabras_prohibidas();

-- Bloqueo en el servidor: descripción y valores de texto de `datos`.
create or replace function public.validar_lenguaje_reporte()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_valor text;
begin
  if public.buscar_groseria(new.descripcion) is not null then
    raise exception 'Usa un lenguaje respetuoso: la descripción tiene palabras ofensivas.';
  end if;

  if jsonb_typeof(new.datos) = 'object' then
    for v_valor in select value from jsonb_each_text(new.datos)
    loop
      if public.buscar_groseria(v_valor) is not null then
        raise exception 'Usa un lenguaje respetuoso: uno de los datos tiene palabras ofensivas.';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_lenguaje_reporte on public.reportes;
create trigger trg_validar_lenguaje_reporte
before insert or update of descripcion, datos on public.reportes
for each row execute function public.validar_lenguaje_reporte();

-- Lista inicial (español de México). Se guarda normalizada por el trigger.
-- Se evitan palabras con significado común no ofensivo (ej. "perra", "coger",
-- "pito", "jota") para no bloquear reportes legítimos.
insert into public.palabras_prohibidas (palabra) values
  ('pendejo'), ('pendeja'), ('pendejada'), ('pendejadas'), ('pendejete'),
  ('puto'), ('puta'), ('putito'), ('putita'), ('putazo'), ('puton'), ('putona'), ('putero'),
  ('verga'), ('vergazo'), ('vergudo'), ('vrg'),
  ('chingar'), ('chinga'), ('chingas'), ('chingada'), ('chingado'), ('chingadera'),
  ('chingon'), ('chingona'), ('chingue'), ('chinguen'), ('chingaron'), ('chingate'),
  ('cabron'), ('cabrona'), ('cabronazo'),
  ('culero'), ('culera'), ('culo'),
  ('mierda'), ('mierdero'),
  ('joto'), ('maricon'), ('marica'), ('mayate'),
  ('pinche'),
  ('mamon'), ('mamona'), ('mamada'), ('mamadas'), ('mamar'),
  ('ojete'), ('ojetes'),
  ('zorra'), ('golfa'), ('ramera'),
  ('joder'), ('jodido'), ('jodida'), ('follar'), ('gilipollas'), ('coño'),
  ('malparido'), ('malparida'), ('hijueputa'),
  ('imbecil'), ('idiota'), ('estupido'), ('estupida'),
  ('ptm'), ('alv'), ('ctm'), ('hdp'), ('hdtpm'), ('nmms'),
  ('hijo de puta'), ('hija de puta'), ('chinga tu madre'), ('chingue a su madre'),
  ('tu puta madre'), ('vete a la verga'), ('a la verga'), ('me vale verga')
on conflict (palabra) do nothing;

-- RLS: cualquiera autenticado lee la lista (el teléfono la usa para avisar);
-- solo el administrador agrega o quita.
alter table public.palabras_prohibidas enable row level security;
grant select, insert, delete on public.palabras_prohibidas to authenticated;

drop policy if exists "lectura palabras prohibidas" on public.palabras_prohibidas;
create policy "lectura palabras prohibidas"
on public.palabras_prohibidas for select to authenticated
using (true);

drop policy if exists "admin agrega palabras prohibidas" on public.palabras_prohibidas;
create policy "admin agrega palabras prohibidas"
on public.palabras_prohibidas for insert to authenticated
with check (public.es_administrador(auth.uid()));

drop policy if exists "admin quita palabras prohibidas" on public.palabras_prohibidas;
create policy "admin quita palabras prohibidas"
on public.palabras_prohibidas for delete to authenticated
using (public.es_administrador(auth.uid()));

revoke execute on function public.buscar_groseria(text) from public, anon;
grant execute on function public.buscar_groseria(text) to authenticated;
