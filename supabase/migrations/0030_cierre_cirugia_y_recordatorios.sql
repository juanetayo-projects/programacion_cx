-- Cierre de la cirugía y recordatorios de citas (oct-2026)
--  1) Registro completo de la cirugía realizada (Programación de cirugía):
--     inicio y fin reales, cirujano, procedimiento realizado, destino
--     posoperatorio y observaciones. Sin este cierre no se permiten
--     seguimientos posquirúrgicos (validado en la base de datos).
--  2) Citas: estado 'confirmada' y registro del recordatorio enviado al
--     paciente (WhatsApp) para alertar a quién falta notificar.

-- 1) Cierre de la cirugía -------------------------------------------------------
alter table solicitudes_cirugia
  add column cirugia_inicio timestamptz,
  add column cirugia_fin timestamptz,
  add column cirujano_realizo text,
  add column procedimiento_realizado text,
  add column destino_postoperatorio text
    check (destino_postoperatorio in ('casa', 'hospitalizacion', 'uci', 'ucin', 'observacion', 'otro')),
  add column cierre_observaciones text,
  add column cierre_registrado_por uuid references perfiles(id),
  add column cierre_registrado_en timestamptz,
  add constraint cirugia_fin_posterior check (cirugia_fin is null or cirugia_inicio is null or cirugia_fin > cirugia_inicio);

-- ¿Programación registró por completo la cirugía realizada?
create or replace function cirugia_cierre_completo(p_solicitud bigint) returns boolean
language sql security definer set search_path = public stable as $$
  select exists(
    select 1 from solicitudes_cirugia
    where id = p_solicitud and estado = 'realizado'
      and cirugia_inicio is not null and cirugia_fin is not null
      and coalesce(trim(cirujano_realizo), '') <> ''
      and coalesce(trim(procedimiento_realizado), '') <> ''
      and destino_postoperatorio is not null
  );
$$;
revoke execute on function cirugia_cierre_completo(bigint) from anon;

-- 2) Citas: confirmación y recordatorio -------------------------------------------
alter table notas_seguimiento drop constraint notas_seguimiento_estado_cita_check;
alter table notas_seguimiento add constraint notas_seguimiento_estado_cita_check
  check (estado_cita in ('programada', 'confirmada', 'cumplida', 'no_asistio', 'reprogramada', 'cancelada'));
alter table notas_seguimiento
  add column recordatorio_en timestamptz,
  add column recordatorio_por_nombre text;

-- Autor y validaciones de la nota (se agrega el bloqueo posquirúrgico)
create or replace function notas_fijar_autor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.creado_por := auth.uid();
  new.created_at := now();
  select nombre, rol into new.creado_por_nombre, new.creado_por_rol from perfiles where id = auth.uid();
  if new.tipo_id is not null then
    select nombre, fase into new.tipo_nombre, new.fase from tipos_seguimiento where id = new.tipo_id;
  end if;
  if new.fase = 'posquirurgico' and not cirugia_cierre_completo(new.solicitud_id) then
    raise exception 'No se puede registrar un seguimiento posquirúrgico: Programación de cirugía aún no ha registrado la cirugía como realizada con su fecha y hora final, cirujano, procedimiento realizado y destino posoperatorio.'
      using hint = 'Programación de cirugía debe completar el registro en Gestión Programación Cx → Marcar como realizada (o Cirugías realizadas → Completar registro).';
  end if;
  if new.fecha_cita is not null and new.estado_cita is null then new.estado_cita := 'programada'; end if;
  new.estado_actualizado_en := null;
  new.estado_actualizado_por_nombre := null;
  new.recordatorio_en := null;
  new.recordatorio_por_nombre := null;
  return new;
end;
$$;

create or replace function nota_puede_gestionar(p_ambito text) returns boolean
language sql security definer set search_path = public stable as $$
  select (p_ambito = 'gestion_clinica' and rol_activo_en(array['administrador', 'gestor_clinico']))
      or (p_ambito = 'prequirurgico' and rol_activo_en(array['administrador', 'programador', 'gestor_clinico']));
$$;
revoke execute on function nota_puede_gestionar(text) from anon;

create or replace function nota_actualizar_estado_cita(p_nota bigint, p_estado text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_nota notas_seguimiento;
begin
  select * into v_nota from notas_seguimiento where id = p_nota;
  if v_nota.id is null or v_nota.fecha_cita is null then raise exception 'La nota no tiene una cita'; end if;
  if not nota_puede_gestionar(v_nota.ambito) then raise exception 'Sin permiso para actualizar la cita'; end if;
  if p_estado not in ('programada', 'confirmada', 'cumplida', 'no_asistio', 'reprogramada', 'cancelada') then
    raise exception 'Estado inválido';
  end if;
  update notas_seguimiento set
    estado_cita = p_estado,
    estado_actualizado_en = now(),
    estado_actualizado_por_nombre = (select nombre from perfiles where id = auth.uid())
  where id = p_nota;
  insert into solicitudes_historial (solicitud_id, accion, detalle, usuario_id)
  values (v_nota.solicitud_id, 'nota_estado_cita', jsonb_build_object('nota_id', p_nota, 'anterior', v_nota.estado_cita, 'nuevo', p_estado), auth.uid());
end;
$$;

-- Registra que se envió el recordatorio de la cita al paciente
create or replace function nota_registrar_recordatorio(p_nota bigint, p_canal text default 'whatsapp')
returns void
language plpgsql security definer set search_path = public as $$
declare v_nota notas_seguimiento;
begin
  select * into v_nota from notas_seguimiento where id = p_nota;
  if v_nota.id is null or v_nota.fecha_cita is null then raise exception 'La nota no tiene una cita'; end if;
  if not nota_puede_gestionar(v_nota.ambito) then raise exception 'Sin permiso para registrar el recordatorio'; end if;
  update notas_seguimiento set
    recordatorio_en = now(),
    recordatorio_por_nombre = (select nombre from perfiles where id = auth.uid())
  where id = p_nota;
  insert into solicitudes_historial (solicitud_id, accion, detalle, usuario_id)
  values (v_nota.solicitud_id, 'nota_recordatorio_cita', jsonb_build_object('nota_id', p_nota, 'canal', p_canal), auth.uid());
end;
$$;
revoke execute on function nota_registrar_recordatorio(bigint, text) from anon;
