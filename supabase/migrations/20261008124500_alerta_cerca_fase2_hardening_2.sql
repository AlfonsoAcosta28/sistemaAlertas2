-- Corrección: revocar EXECUTE de PUBLIC no basta, Supabase otorga EXECUTE a
-- `anon`/`authenticated` directamente al crear la función (no solo vía
-- PUBLIC). Hay que revocarlo explícitamente de cada rol.
--
-- También: la firma de crear_reporte cambió de 4 a 6 parámetros, así que
-- `create or replace` NO sustituyó la función vieja — creó una segunda
-- función con la firma antigua, sin los límites anti-abuso ni la celda H3.
-- Hay que eliminarla explícitamente.

drop function if exists public.crear_reporte(uuid, double precision, double precision, text);

revoke execute on function public.crear_reporte(uuid, double precision, double precision, text, text, text) from public, anon;
revoke execute on function public.reaccionar_reporte(uuid, public.tipo_reaccion) from public, anon;
revoke execute on function public.actualizar_celda_perfil(text) from public, anon;
revoke execute on function public.actualizar_push_token(text) from public, anon;
revoke execute on function public.eliminar_cuenta_propia() from public, anon;
revoke execute on function public.moderar_verificar_reporte(uuid, public.severidad, text) from public, anon;
revoke execute on function public.moderar_descartar_reporte(uuid, text) from public, anon;
revoke execute on function public.moderar_cerrar_reporte(uuid) from public, anon;

-- Funciones que nunca deben ser un endpoint RPC público (solo `perform`
-- interno desde otra función SECURITY DEFINER, o solo service_role):
revoke execute on function public.evaluar_corroboracion_automatica(uuid) from public, anon, authenticated;
revoke execute on function public.notificar_motor_distribucion(uuid) from public, anon, authenticated;
revoke execute on function public.manejar_nuevo_usuario() from public, anon, authenticated;
revoke execute on function public.filtrar_no_notificados(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.obtener_candidatos_para_motor(uuid, text[]) from public, anon, authenticated;
revoke execute on function public.obtener_reportes_activos_para_motor(uuid) from public, anon, authenticated;
revoke execute on function public.registrar_notificaciones_enviadas(uuid, uuid[]) from public, anon, authenticated;

grant execute on function public.filtrar_no_notificados(uuid, uuid[]) to service_role;
grant execute on function public.obtener_candidatos_para_motor(uuid, text[]) to service_role;
grant execute on function public.obtener_reportes_activos_para_motor(uuid) to service_role;
grant execute on function public.registrar_notificaciones_enviadas(uuid, uuid[]) to service_role;
