-- La migración inicial hace `revoke all on public.reportes from anon, authenticated`
-- para forzar el acceso público a través de `reportes_publicos`. Pero las
-- políticas RLS "lectura reportes propios" y "lectura reportes moderadores"
-- (para "Mis reportes" y el panel de moderación) necesitan que `authenticated`
-- tenga el GRANT base de SELECT sobre la tabla; sin él, Postgres rechaza la
-- consulta (403) antes de llegar a evaluar las políticas. `anon` se queda sin
-- acceso, como estaba previsto.
grant select on public.reportes to authenticated;
