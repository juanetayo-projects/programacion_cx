-- Servicio y ubicación del paciente (nov-2026)
-- ---------------------------------------------------------------------------
-- Todos los módulos muestran en "Datos del paciente" el servicio y la
-- ubicación actuales del paciente en la clínica. Vienen de GoMedisys
-- (encounterRecords del ingreso: idActualService / idActualLocation /
-- idActualBed) con la consulta masiva (sql/reporte_cirugias_optimizado_6.sql)
-- y con la consulta de la Boleta quirúrgica (sql/boleta_quirurgica.sql).
--
-- Son una foto del momento de la consulta: cada nueva consulta a GoMedisys
-- los actualiza (el paciente cambia de servicio o de cama).

alter table solicitudes_cirugia
  add column if not exists servicio_paciente text,
  add column if not exists ubicacion_paciente text;
-- la cama va en la columna existente `cama`

-- Consulta masiva: inserta los nuevos y, si la programación ya estaba
-- marcada, refresca servicio / ubicación / cama con lo último de GoMedisys
create or replace function public.marcar_programaciones_gomedisys(p_items jsonb)
 returns table(r_programacion bigint, r_solicitud_id bigint, r_tomada_por_mi boolean, r_responsable text, r_estado text)
 language plpgsql
 set search_path to 'public'
as $function$
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
      quirofano_gomedisys, fecha_programada_gomedisys, estado_gomedisys, tipo_orden,
      destino, fecha_ingreso, fecha_ordenamiento, contrato_id,
      servicio_paciente, ubicacion_paciente, cama
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
      it->>'tipo_orden',
      nullif(upper(trim(it->>'destino')), ''),
      nullif(it->>'fecha_ingreso', '')::timestamp,
      nullif(it->>'fecha_ordenamiento', '')::date,
      (select a.id from aseguradores a where a.activo and upper(trim(a.nombre)) = upper(trim(it->>'eps_gomedisys')) limit 1),
      nullif(trim(it->>'servicio_paciente'), ''),
      nullif(trim(it->>'ubicacion_paciente'), ''),
      nullif(trim(it->>'cama'), '')
    )
    on conflict (gomedisys_id_programacion)
      where gomedisys_id_programacion is not null and estado <> 'cancelado'
      do nothing
    returning id into nuevo_id;

    if nuevo_id is not null then
      insert into solicitudes_historial (solicitud_id, accion, usuario_id, detalle)
      values (nuevo_id, 'consulta_api', auth.uid(),
              jsonb_build_object('resultado', 'exitoso', 'origen', 'masiva'));
    else
      update solicitudes_cirugia s set
        servicio_paciente = coalesce(nullif(trim(it->>'servicio_paciente'), ''), s.servicio_paciente),
        ubicacion_paciente = coalesce(nullif(trim(it->>'ubicacion_paciente'), ''), s.ubicacion_paciente),
        cama = coalesce(nullif(trim(it->>'cama'), ''), s.cama)
      where s.gomedisys_id_programacion = (it->>'gomedisys_id_programacion')::bigint
        and s.estado <> 'cancelado'
        and (it ? 'servicio_paciente' or it ? 'ubicacion_paciente' or it ? 'cama');
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
$function$;

-- Boleta quirúrgica: además de la boleta, refresca servicio / ubicación / cama
create or replace function guardar_componente_gomedisys() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_solicitud bigint := nullif(new.parametros->>'solicitud', '')::bigint;
  v_componente text := new.parametros->>'componente';
  v_b jsonb := new.resultado->'boleta';
begin
  if v_solicitud is null or v_componente is null or v_b is null or jsonb_typeof(v_b) <> 'object' then
    return new; -- sin boleta en GoMedisys: no se guarda nada y se puede volver a consultar
  end if;

  insert into notas_gomedisys (solicitud_id, componente, texto, datos, profesional, fecha_registro, consultado_en, consultado_por)
  values (v_solicitud, v_componente, nullif(v_b->>'texto', ''), coalesce(v_b->'datos', '{}'::jsonb),
          nullif(v_b->>'profesional', ''), nullif(v_b->>'fecha_registro', '')::timestamptz, now(), new.solicitado_por)
  on conflict (solicitud_id, componente) do nothing;

  if v_componente = 'boleta' then
    update solicitudes_cirugia s set
      boleta_quirurgica = case when boleta_con_contenido(s.boleta_quirurgica) then s.boleta_quirurgica
                               else coalesce(nullif(v_b->>'texto', ''), s.boleta_quirurgica) end,
      tiempo_estimado_minutos = coalesce(s.tiempo_estimado_minutos, round(nullif(v_b->>'duracion', '')::numeric)::int),
      destino = coalesce(nullif(trim(s.destino), ''), nullif(v_b->>'destino', '')),
      servicio_paciente = coalesce(nullif(trim(v_b->>'servicio'), ''), s.servicio_paciente),
      ubicacion_paciente = coalesce(nullif(trim(v_b->>'ubicacion'), ''), s.ubicacion_paciente),
      cama = coalesce(nullif(trim(v_b->>'cama'), ''), s.cama)
    where s.id = v_solicitud;
  end if;

  insert into solicitudes_historial (solicitud_id, accion, usuario_id, detalle)
  values (v_solicitud, 'consulta_api', new.solicitado_por,
          jsonb_build_object('resultado', 'exitoso', 'componente', v_componente, 'trabajo', new.id));
  return new;
end;
$$;
