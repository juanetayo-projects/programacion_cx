-- Ajustes octubre 2026: "Reportar cirugía" con dos sub-opciones
--  1) Reporte individual (como antes) + autocompletado del paciente desde
--     GoMedisys (sql/paciente.sql).
--  2) Consulta masiva de cirugías programadas en GoMedisys
--     (sql/reporte_cirugias_optimizado_6.sql): el usuario marca pacientes y
--     se crean las solicitudes ya "procesadas".
--
-- Anti-duplicados entre usuarios concurrentes:
--  - Índice único parcial sobre gomedisys_id_programacion: dos usuarios no
--    pueden tomar la misma programación (la base de datos arbitra la carrera).
--  - marcar_programaciones_gomedisys() inserta con ON CONFLICT DO NOTHING y
--    devuelve, por cada programación, si quedó para este usuario o quién la
--    tenía ya.
--  - solicitudes_cirugia se publica por Realtime para que la pantalla de la
--    consulta masiva se actualice en vivo cuando otro usuario marca.

-- 1) Columnas de origen GoMedisys ------------------------------------------
alter table solicitudes_cirugia
  add column origen text not null default 'individual' check (origen in ('individual', 'masiva')),
  add column gomedisys_id_programacion bigint,
  add column gomedisys_id_paciente bigint,
  add column eps_gomedisys text,
  add column plan_gomedisys text,
  add column diagnostico_preoperatorio text,
  add column especialista_ordena text,
  add column especialista_opera text,
  add column especialidad_gomedisys text,
  add column quirofano_gomedisys text,
  add column fecha_programada_gomedisys timestamp,
  add column estado_gomedisys text,
  add column tipo_orden text;

create unique index solicitudes_cirugia_programacion_gomedisys_uniq
  on solicitudes_cirugia (gomedisys_id_programacion)
  where gomedisys_id_programacion is not null and estado <> 'cancelado';

create index solicitudes_cirugia_numero_ingreso_idx on solicitudes_cirugia (numero_ingreso);

-- 2) Nuevo módulo "reportar_masivo" en rol_permisos ------------------------
alter table rol_permisos drop constraint rol_permisos_modulo_check;
alter table rol_permisos add constraint rol_permisos_modulo_check
  check (modulo in (
    'dashboard', 'reportar', 'reportar_masivo', 'solicitudes_reportadas', 'solicitudes', 'cirugias_realizadas',
    'quirofanos', 'calor', 'reportes', 'logs', 'admin_usuarios', 'admin_catalogos', 'admin_roles'
  ));

insert into rol_permisos (rol, modulo, permitido) values
  ('administrador', 'reportar_masivo', true),
  ('programador', 'reportar_masivo', true),
  ('medico', 'reportar_masivo', false),
  ('visualizador', 'reportar_masivo', false)
on conflict (rol, modulo) do nothing;

-- 3) Nombres de responsables ----------------------------------------------
-- La RLS de perfiles solo deja ver el perfil propio (o todos al admin). Para
-- avisar "este paciente ya lo tomó Fulano" el resto de usuarios necesita el
-- nombre, y nada más: esta función expone solo id + nombre.
create or replace function nombres_perfiles(p_ids uuid[])
returns table (id uuid, nombre text)
language sql security definer set search_path = public stable as $$
  select p.id, p.nombre from perfiles p where p.id = any(p_ids);
$$;

revoke execute on function nombres_perfiles(uuid[]) from public, anon;
grant execute on function nombres_perfiles(uuid[]) to authenticated;

-- 4) Marcación atómica ------------------------------------------------------
-- p_items: arreglo JSON con los campos de cada programación (ver
-- src/pages/ConsultaMasiva.tsx → marcar()). SECURITY INVOKER: corre con la
-- RLS del usuario (solo programador/administrador pueden insertar aquí).
create or replace function marcar_programaciones_gomedisys(p_items jsonb)
-- (las columnas de salida llevan prefijo r_ para no chocar con las de la
-- tabla dentro de PL/pgSQL)
returns table (
  r_programacion bigint,
  r_solicitud_id bigint,
  r_tomada_por_mi boolean,
  r_responsable text,
  r_estado text
)
language plpgsql security invoker set search_path = public as $$
declare
  it jsonb;
  nuevo_id bigint;
begin
  if not es_programador_o_admin() then
    raise exception 'Solo programadores o administradores pueden marcar pacientes para gestión';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    nuevo_id := null;

    insert into solicitudes_cirugia (
      numero_ingreso, documento_paciente, especialidad_id, reportado_por, estado, origen,
      nombre_paciente, edad, eps_id, telefono_paciente, procedimiento, boleta_quirurgica,
      tiempo_estimado_minutos, gomedisys_consultado_en, gomedisys_resultado,
      gomedisys_id_programacion, gomedisys_id_paciente, eps_gomedisys, plan_gomedisys,
      diagnostico_preoperatorio, especialista_ordena, especialista_opera, especialidad_gomedisys,
      quirofano_gomedisys, fecha_programada_gomedisys, estado_gomedisys, tipo_orden
    ) values (
      coalesce(nullif(it->>'numero_ingreso', ''), 'SIN INGRESO'),
      it->>'documento_paciente',
      (it->>'especialidad_id')::bigint,
      auth.uid(),
      'procesado',
      'masiva',
      it->>'nombre_paciente',
      nullif(it->>'edad', '')::int,
      nullif(it->>'eps_id', '')::bigint,
      it->>'telefono_paciente',
      it->>'procedimiento',
      it->>'boleta_quirurgica',
      nullif(it->>'tiempo_estimado_minutos', '')::int,
      now(),
      'OK',
      (it->>'gomedisys_id_programacion')::bigint,
      nullif(it->>'gomedisys_id_paciente', '')::bigint,
      it->>'eps_gomedisys',
      it->>'plan_gomedisys',
      it->>'diagnostico_preoperatorio',
      it->>'especialista_ordena',
      it->>'especialista_opera',
      it->>'especialidad_gomedisys',
      it->>'quirofano_gomedisys',
      nullif(it->>'fecha_programada_gomedisys', '')::timestamp,
      it->>'estado_gomedisys',
      it->>'tipo_orden'
    )
    on conflict (gomedisys_id_programacion)
      where gomedisys_id_programacion is not null and estado <> 'cancelado'
      do nothing
    returning id into nuevo_id;

    if nuevo_id is not null then
      insert into solicitudes_historial (solicitud_id, accion, usuario_id, detalle)
      values (nuevo_id, 'consulta_api', auth.uid(),
              jsonb_build_object('resultado', 'exitoso', 'origen', 'masiva'));
    end if;

    return query
      select s.gomedisys_id_programacion, s.id, (s.id is not distinct from nuevo_id),
             (select n.nombre from nombres_perfiles(array[s.reportado_por]) n), s.estado
      from solicitudes_cirugia s
      where s.gomedisys_id_programacion = (it->>'gomedisys_id_programacion')::bigint
        and s.estado <> 'cancelado'
      limit 1;
  end loop;
end;
$$;

revoke execute on function marcar_programaciones_gomedisys(jsonb) from public, anon;
grant execute on function marcar_programaciones_gomedisys(jsonb) to authenticated;

-- 5) Realtime ---------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'solicitudes_cirugia'
  ) then
    alter publication supabase_realtime add table solicitudes_cirugia;
  end if;
end $$;
