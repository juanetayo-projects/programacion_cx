-- Datos que la vista de Gestión clínica muestra en el orden de la planilla
-- del área (oct-2026): destino, ubicación, fecha de ingreso, fecha de
-- ordenamiento y última observación de gestión.

alter table solicitudes_cirugia
  add column destino text,                      -- destino de la boleta (GoMedisys), editable
  add column fecha_ingreso timestamp,           -- inicio del ingreso en GoMedisys (hora local)
  add column fecha_ordenamiento date,           -- fecha de la orden quirúrgica (GoMedisys)
  add column estado_gc_observacion text;        -- observación del último cambio de estado

-- La observación del último estado queda en la solicitud para la tabla
create or replace function registrar_estado_gestion_clinica(p_solicitud bigint, p_estado bigint, p_observacion text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_nombre text; v_usuario text;
begin
  if not rol_activo_en(array['administrador', 'gestor_clinico']) then
    raise exception 'Solo el gestor clínico o el administrador cambian el estado de la gestión clínica';
  end if;
  select nombre into v_nombre from estados_gestion_clinica where id = p_estado and activo;
  if v_nombre is null then raise exception 'Estado inválido o inactivo'; end if;
  if not exists (select 1 from solicitudes_cirugia where id = p_solicitud) then raise exception 'Solicitud no encontrada'; end if;
  select nombre into v_usuario from perfiles where id = auth.uid();

  insert into estados_gc_historial (solicitud_id, estado_id, estado_nombre, observacion, registrado_por_nombre)
  values (p_solicitud, p_estado, v_nombre, nullif(trim(p_observacion), ''), v_usuario);

  update solicitudes_cirugia set
    estado_gc_id = p_estado,
    estado_gc_observacion = nullif(trim(p_observacion), ''),
    estado_gc_actualizado_en = now(),
    estado_gc_actualizado_por_nombre = v_usuario
  where id = p_solicitud;
end;
$$;

-- Contrato, plan, tipo de afiliado, destino y ubicación (unidad + cama)
drop function if exists registrar_afiliacion_paciente(bigint, bigint, bigint, bigint);
create or replace function registrar_datos_gestion_clinica(
  p_solicitud bigint, p_contrato bigint, p_plan bigint, p_tipo_afiliado bigint,
  p_destino text, p_unidad bigint, p_cama text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not rol_activo_en(array['administrador', 'gestor_clinico']) then
    raise exception 'Solo el gestor clínico o el administrador registran estos datos';
  end if;
  update solicitudes_cirugia set
    contrato_id = p_contrato, plan_paciente_id = p_plan, tipo_afiliado_id = p_tipo_afiliado,
    destino = nullif(upper(trim(p_destino)), ''), unidad_id = p_unidad, cama = nullif(upper(trim(p_cama)), '')
  where id = p_solicitud;
  if not found then raise exception 'Solicitud no encontrada'; end if;
end;
$$;
revoke execute on function registrar_datos_gestion_clinica(bigint, bigint, bigint, bigint, text, bigint, text) from anon;

-- Consulta masiva: guarda destino, fechas de ingreso y ordenamiento, y asigna
-- el contrato cuando el nombre de GoMedisys coincide con el catálogo
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
      destino, fecha_ingreso, fecha_ordenamiento, contrato_id
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
      (select a.id from aseguradores a where a.activo and upper(trim(a.nombre)) = upper(trim(it->>'eps_gomedisys')) limit 1)
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
$function$;
