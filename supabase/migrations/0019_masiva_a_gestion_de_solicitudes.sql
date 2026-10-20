-- Corrección oct-2026: los pacientes marcados en la consulta masiva pasan
-- directo a "Gestión de solicitudes" (estado 'procesado'), como en 0016.
-- Se conserva de 0018 el especialista que ordena como médico que reporta.
create or replace function marcar_programaciones_gomedisys(p_items jsonb)
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
      nombre_medico_reporta,
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
      nullif(it->>'especialista_ordena', ''),
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
