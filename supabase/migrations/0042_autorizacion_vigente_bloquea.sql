-- Autorización con código vigente: no admite nuevas gestiones (nov-2026)
-- ---------------------------------------------------------------------------
-- Si la cirugía ya tiene número de autorización del asegurador vigente, no se
-- registran nuevas gestiones (solicitada, devuelta, negada…) ni se envía otra
-- solicitud por correo: una gestión posterior dejaba la autorización como "no
-- vigente" y bloqueaba la programación (caso SC-000002, 2026-11-07).
-- Al vencer la vigencia se puede volver a gestionar (renovación / prórroga).

create or replace function autorizacion_con_codigo_vigente(p_solicitud bigint) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from solicitudes_cirugia s
     where s.id = p_solicitud
       and nullif(trim(s.autorizacion_numero), '') is not null
       and s.autorizacion_vigencia_hasta is not null
       and s.autorizacion_vigencia_hasta >= (now() at time zone 'America/Bogota')::date
  );
$$;

create or replace function registrar_autorizacion(
  p_solicitud bigint, p_estado text, p_numero_radicado text, p_fecha_solicitud date, p_canal text,
  p_numero_autorizacion text, p_fecha_autorizacion date, p_vigencia_hasta date,
  p_servicios text, p_observaciones text, p_adjuntos jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare v_aseg text; v_num text; v_vig date;
begin
  if not rol_activo_en(array['administrador', 'gestor_clinico']) then
    raise exception 'Solo el gestor clínico o el administrador gestionan la autorización del asegurador';
  end if;
  if autorizacion_con_codigo_vigente(p_solicitud) then
    select autorizacion_numero, autorizacion_vigencia_hasta into v_num, v_vig from solicitudes_cirugia where id = p_solicitud;
    raise exception 'La cirugía ya tiene la autorización N.º % vigente hasta %. Podrá registrar una nueva gestión cuando venza.',
      v_num, to_char(v_vig, 'DD/MM/YYYY');
  end if;
  if p_estado not in ('solicitada', 'devuelta', 'autorizada', 'negada', 'no_requiere') then raise exception 'Estado inválido'; end if;
  if p_estado = 'solicitada' and p_fecha_solicitud is null then raise exception 'Indique la fecha de la solicitud'; end if;
  if p_estado = 'autorizada' and (coalesce(trim(p_numero_autorizacion), '') = '' or p_fecha_autorizacion is null or p_vigencia_hasta is null) then
    raise exception 'Para registrar la autorización se requiere el número, la fecha y la vigencia';
  end if;
  if p_estado = 'autorizada' and p_vigencia_hasta < p_fecha_autorizacion then raise exception 'La vigencia no puede ser anterior a la fecha de autorización'; end if;
  if p_estado in ('negada', 'devuelta', 'no_requiere') and coalesce(trim(p_observaciones), '') = '' then
    raise exception 'Indique el motivo / justificación';
  end if;

  select coalesce(s.eps_gomedisys, e.nombre) into v_aseg
  from solicitudes_cirugia s left join eps e on e.id = s.eps_id where s.id = p_solicitud;

  insert into autorizaciones_cirugia (solicitud_id, estado, aseguradora, numero_radicado, fecha_solicitud, canal,
    numero_autorizacion, fecha_autorizacion, vigencia_hasta, servicios_autorizados, observaciones, adjuntos,
    registrado_por, registrado_por_nombre)
  values (p_solicitud, p_estado, v_aseg, nullif(trim(p_numero_radicado), ''), p_fecha_solicitud, nullif(trim(p_canal), ''),
    nullif(trim(p_numero_autorizacion), ''), p_fecha_autorizacion, p_vigencia_hasta, nullif(trim(p_servicios), ''),
    nullif(trim(p_observaciones), ''), coalesce(p_adjuntos, '[]'), auth.uid(), (select nombre from perfiles where id = auth.uid()));

  update solicitudes_cirugia set
    autorizacion_estado = p_estado,
    autorizacion_numero = case when p_estado = 'autorizada' then trim(p_numero_autorizacion) else autorizacion_numero end,
    autorizacion_vigencia_hasta = case when p_estado = 'autorizada' then p_vigencia_hasta when p_estado = 'no_requiere' then null else autorizacion_vigencia_hasta end,
    autorizacion_fecha_solicitud = coalesce(p_fecha_solicitud, autorizacion_fecha_solicitud),
    autorizacion_fecha = case when p_estado = 'autorizada' then p_fecha_autorizacion else autorizacion_fecha end,
    autorizacion_actualizada_en = now(),
    autorizacion_aseguradora = case
      when p_estado = 'autorizada' then 'AUTORIZADA N.º ' || trim(p_numero_autorizacion) || ' · vigente hasta ' || to_char(p_vigencia_hasta, 'DD/MM/YYYY')
      when p_estado = 'no_requiere' then 'NO REQUIERE (URGENCIA)'
      else upper(p_estado) end
  where id = p_solicitud;

  insert into solicitudes_historial (solicitud_id, accion, detalle, usuario_id)
  values (p_solicitud, 'autorizacion_' || p_estado,
    jsonb_build_object('numero', p_numero_autorizacion, 'radicado', p_numero_radicado, 'vigencia', p_vigencia_hasta), auth.uid());
end;
$$;
revoke execute on function registrar_autorizacion(bigint, text, text, date, text, text, date, date, text, text, jsonb) from anon;

-- Corrección de datos: solicitudes que tienen código de autorización vigente
-- pero quedaron en otro estado por una gestión posterior (SC-000002).
update solicitudes_cirugia
   set autorizacion_estado = 'autorizada', autorizacion_actualizada_en = now(),
       autorizacion_aseguradora = 'AUTORIZADA N.º ' || trim(autorizacion_numero) || ' · vigente hasta ' || to_char(autorizacion_vigencia_hasta, 'DD/MM/YYYY')
 where autorizacion_estado is distinct from 'autorizada'
   and nullif(trim(autorizacion_numero), '') is not null
   and autorizacion_vigencia_hasta >= (now() at time zone 'America/Bogota')::date;
