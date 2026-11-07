-- Intervalo mínimo entre consultas masivas a GoMedisys (nov-2026)
-- ---------------------------------------------------------------------------
-- La consulta masiva recorre la réplica de GoMedisys día por día; lanzarla
-- varias veces seguidas (uno o varios usuarios) carga la base de datos.
-- Reglas:
--   * Entre una consulta masiva y la siguiente debe pasar `intervalo_minutos`
--     (global, no por usuario: la carga en GoMedisys es la misma).
--   * Mientras tanto, cualquier usuario con el módulo `reportar_masivo` ve el
--     resultado de la última consulta (sin volver a GoMedisys) y puede filtrar
--     dentro del rango que se consultó.
--   * Las consultas fallidas no cuentan: se puede reintentar enseguida.
--   * El administrador puede forzar una consulta antes de tiempo.
-- La Edge Function consulta-gomedisys hace cumplir el intervalo; la app solo
-- lo muestra (cuenta regresiva y modal de advertencia).

create table if not exists consulta_masiva_config (
  id int primary key default 1 check (id = 1),
  intervalo_minutos int not null default 15 check (intervalo_minutos between 1 and 240),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references perfiles(id)
);
insert into consulta_masiva_config (id, intervalo_minutos) values (1, 15) on conflict (id) do nothing;

alter table consulta_masiva_config enable row level security;
create policy "config masiva lectura" on consulta_masiva_config
  for select using (auth.role() = 'authenticated');
create policy "config masiva admin" on consulta_masiva_config
  for update using (is_admin()) with check (is_admin());

create index if not exists gomedisys_trabajos_tipo_creado on gomedisys_trabajos (tipo, creado_en desc);

-- ¿El usuario actual puede usar la consulta masiva?
create or replace function puede_consulta_masiva() returns boolean
language sql security definer set search_path = public stable as $$
  select is_admin() or exists (
    select 1 from perfiles p join rol_permisos rp on rp.rol = p.rol
     where p.id = auth.uid() and p.activo is not false
       and rp.modulo = 'reportar_masivo' and rp.permitido
  );
$$;

-- Estado de la consulta masiva: intervalo, consulta en curso, última consulta
-- exitosa y hora a partir de la cual se permite la próxima.
create or replace function masiva_estado() returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  v_intervalo int;
  v_curso record;
  v_ultima record;
  v_base timestamptz;
begin
  if not puede_consulta_masiva() then
    raise exception 'Sin permiso para la consulta masiva';
  end if;
  select intervalo_minutos into v_intervalo from consulta_masiva_config where id = 1;
  v_intervalo := coalesce(v_intervalo, 15);

  -- En curso: creada hace menos de 10 min y sin terminar (las colgadas no bloquean)
  select t.id, t.parametros, t.creado_en, t.solicitado_por, p.nombre
    into v_curso
    from gomedisys_trabajos t left join perfiles p on p.id = t.solicitado_por
   where t.tipo = 'masiva' and t.estado in ('pendiente', 'despachado', 'en_proceso')
     and t.creado_en > now() - interval '10 minutes'
   order by t.id desc limit 1;

  select t.id, t.parametros, t.creado_en, t.terminado_en, t.solicitado_por, p.nombre
    into v_ultima
    from gomedisys_trabajos t left join perfiles p on p.id = t.solicitado_por
   where t.tipo = 'masiva' and t.estado = 'listo'
   order by t.id desc limit 1;

  v_base := coalesce(v_ultima.terminado_en, v_ultima.creado_en);

  return jsonb_build_object(
    'ahora', now(),
    'intervalo_minutos', v_intervalo,
    'en_curso', case when v_curso.id is null then null else jsonb_build_object(
      'id', v_curso.id, 'parametros', v_curso.parametros, 'creado_en', v_curso.creado_en,
      'solicitado_por', v_curso.solicitado_por, 'nombre', v_curso.nombre) end,
    'ultima', case when v_ultima.id is null then null else jsonb_build_object(
      'id', v_ultima.id, 'parametros', v_ultima.parametros, 'creado_en', v_ultima.creado_en,
      'terminado_en', v_ultima.terminado_en, 'solicitado_por', v_ultima.solicitado_por, 'nombre', v_ultima.nombre) end,
    'proxima_permitida', case when v_base is null then null else v_base + make_interval(mins => v_intervalo) end
  );
end;
$$;
revoke execute on function masiva_estado() from public, anon;
grant execute on function masiva_estado() to authenticated;

-- Resultado de una consulta masiva exitosa (para reusarla sin volver a
-- GoMedisys). Sin p_id: la última. Cualquier usuario con el módulo puede
-- leerla aunque la haya lanzado otro.
create or replace function masiva_resultado(p_id bigint default null) returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  v record;
begin
  if not puede_consulta_masiva() then
    raise exception 'Sin permiso para la consulta masiva';
  end if;
  select t.id, t.parametros, t.resultado, t.creado_en, t.terminado_en, t.solicitado_por, p.nombre
    into v
    from gomedisys_trabajos t left join perfiles p on p.id = t.solicitado_por
   where t.tipo = 'masiva' and t.estado = 'listo' and (p_id is null or t.id = p_id)
   order by t.id desc limit 1;
  if v.id is null then return null; end if;
  return jsonb_build_object(
    'id', v.id, 'parametros', v.parametros, 'resultado', v.resultado,
    'creado_en', v.creado_en, 'terminado_en', v.terminado_en,
    'solicitado_por', v.solicitado_por, 'nombre', v.nombre);
end;
$$;
revoke execute on function masiva_resultado(bigint) from public, anon;
grant execute on function masiva_resultado(bigint) to authenticated;
