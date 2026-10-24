-- MOS · Hitos del proceso (avance visible en todas las vistas):
--   1) Asegurador notificado            → mos_notificado_en
--   2) Respuesta del asegurador         → mos_respuesta_asegurador (aprobado / rechazado)
--   3) Proveedor notificado             → mos_proveedor_notificado_en
--   4) Proveedor confirma disponibilidad → mos_proveedor_confirmado_en (fase de entregas)
--   5) Material recibido en la clínica  → mos_material_recibido_en   (fase de entregas)

alter table solicitudes_cirugia
  add column mos_respuesta_asegurador text check (mos_respuesta_asegurador in ('aprobado', 'rechazado')),
  add column mos_respuesta_en timestamptz,
  add column mos_respuesta_obs text,
  add column mos_respuesta_por uuid references perfiles(id),
  add column mos_proveedor_confirmado_en timestamptz,
  add column mos_material_recibido_en timestamptz;

-- estado_mos refleja el último hito alcanzado
alter table solicitudes_cirugia drop constraint solicitudes_cirugia_estado_mos_check;
alter table solicitudes_cirugia add constraint solicitudes_cirugia_estado_mos_check
  check (estado_mos in (
    'asegurador_notificado', 'asegurador_aprobado', 'asegurador_rechazado',
    'proveedor_notificado', 'proveedor_confirmado', 'material_recibido'
  ));

-- El gestor MOS no tiene permiso de UPDATE sobre solicitudes_cirugia (RLS de
-- programación); registra la respuesta del asegurador con esta función.
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

  update solicitudes_cirugia set
    mos_respuesta_asegurador = p_respuesta,
    mos_respuesta_en = now(),
    mos_respuesta_obs = nullif(trim(p_obs), ''),
    mos_respuesta_por = auth.uid(),
    estado_mos = case
      when p_respuesta = 'rechazado' then 'asegurador_rechazado'
      when estado_mos in ('asegurador_notificado', 'asegurador_rechazado') then 'asegurador_aprobado'
      else estado_mos
    end
  where id = p_solicitud;

  insert into solicitudes_historial (solicitud_id, accion, detalle, usuario_id)
  values (p_solicitud, 'mos_respuesta_asegurador', jsonb_build_object('respuesta', p_respuesta, 'observacion', p_obs), auth.uid());
end;
$$;

revoke execute on function mos_registrar_respuesta(bigint, text, text) from anon;
