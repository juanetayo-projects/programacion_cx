-- MOS: el gestor registra que el proveedor aceptó/confirmó el material (hito 4)
-- y la respuesta del asegurador queda bloqueada una vez notificado el proveedor.

alter table solicitudes_cirugia
  add column mos_proveedor_confirmado_obs text,
  add column mos_proveedor_confirmado_por uuid references perfiles(id);

create or replace function mos_registrar_confirmacion_proveedor(p_solicitud bigint, p_obs text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_mos_o_admin() then
    raise exception 'Solo el gestor MOS o el administrador pueden registrar la confirmación del proveedor';
  end if;
  if not exists (select 1 from solicitudes_cirugia where id = p_solicitud and mos_proveedor_notificado_en is not null) then
    raise exception 'Primero se debe notificar al proveedor';
  end if;
  if exists (select 1 from solicitudes_cirugia where id = p_solicitud and mos_proveedor_confirmado_en is not null) then
    raise exception 'La confirmación del proveedor ya fue registrada';
  end if;

  update solicitudes_cirugia set
    mos_proveedor_confirmado_en = now(),
    mos_proveedor_confirmado_obs = nullif(trim(p_obs), ''),
    mos_proveedor_confirmado_por = auth.uid(),
    estado_mos = case when estado_mos = 'proveedor_notificado' then 'proveedor_confirmado' else estado_mos end
  where id = p_solicitud;

  insert into solicitudes_historial (solicitud_id, accion, detalle, usuario_id)
  values (p_solicitud, 'mos_proveedor_confirmado', jsonb_build_object('observacion', p_obs), auth.uid());
end;
$$;
revoke execute on function mos_registrar_confirmacion_proveedor(bigint, text) from anon;

create or replace function mos_registrar_respuesta(p_solicitud bigint, p_respuesta text, p_obs text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_mos_o_admin() then
    raise exception 'Solo el gestor MOS o el administrador pueden registrar la respuesta del asegurador';
  end if;
  if p_respuesta not in ('aprobado', 'rechazado') then
    raise exception 'Respuesta inválida';
  end if;
  if not exists (select 1 from solicitudes_cirugia where id = p_solicitud and estado_mos is not null) then
    raise exception 'Primero se debe notificar al asegurador';
  end if;
  if exists (select 1 from solicitudes_cirugia where id = p_solicitud and mos_proveedor_notificado_en is not null) then
    raise exception 'El proveedor ya fue notificado; la respuesta del asegurador no se puede modificar';
  end if;

  update solicitudes_cirugia set
    mos_respuesta_asegurador = p_respuesta,
    mos_respuesta_en = now(),
    mos_respuesta_obs = nullif(trim(p_obs), ''),
    mos_respuesta_por = auth.uid(),
    estado_mos = case when p_respuesta = 'rechazado' then 'asegurador_rechazado' else 'asegurador_aprobado' end
  where id = p_solicitud;

  insert into solicitudes_historial (solicitud_id, accion, detalle, usuario_id)
  values (p_solicitud, 'mos_respuesta_asegurador', jsonb_build_object('respuesta', p_respuesta, 'observacion', p_obs), auth.uid());
end;
$$;
