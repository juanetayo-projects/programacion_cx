-- Autorización del asegurador (Gestión clínica) — oct-2026
-- En Colombia la IPS solicita a la EPS/aseguradora la autorización de los
-- servicios electivos (Anexo técnico 3, actualizado por la Res. 2335/2023);
-- la aseguradora autoriza (n.º de autorización, servicios/CUPS y vigencia),
-- niega (motivo) o devuelve (requiere información). La atención inicial de
-- urgencias no requiere autorización previa (Decreto 4747/2007).
-- Regla de la clínica: sin autorización vigente NO se programa, reprograma ni
-- se registra como realizada la cirugía, ni se inicia la gestión MOS.

create table autorizaciones_cirugia (
  id bigint generated always as identity primary key,
  solicitud_id bigint not null references solicitudes_cirugia(id) on delete cascade,
  estado text not null check (estado in ('solicitada', 'devuelta', 'autorizada', 'negada', 'no_requiere')),
  aseguradora text,
  numero_radicado text,
  fecha_solicitud date,
  canal text,                         -- portal de la EPS, correo, ventanilla…
  numero_autorizacion text,
  fecha_autorizacion date,
  vigencia_hasta date,
  servicios_autorizados text,         -- CUPS / procedimientos autorizados
  observaciones text,                 -- motivo de negación/devolución o justificación de urgencia
  adjuntos jsonb not null default '[]',
  registrado_por uuid references perfiles(id) default auth.uid(),
  registrado_por_nombre text,
  created_at timestamptz not null default now()
);
create index on autorizaciones_cirugia (solicitud_id, created_at desc);

-- Estado vigente desnormalizado en la solicitud (para filtros, indicadores y bloqueos)
alter table solicitudes_cirugia
  add column autorizacion_estado text check (autorizacion_estado in ('solicitada', 'devuelta', 'autorizada', 'negada', 'no_requiere')),
  add column autorizacion_numero text,
  add column autorizacion_vigencia_hasta date,
  add column autorizacion_fecha_solicitud date,
  add column autorizacion_fecha date,
  add column autorizacion_actualizada_en timestamptz;

alter table autorizaciones_cirugia enable row level security;
create policy "autorizaciones lectura" on autorizaciones_cirugia for select using (auth.role() = 'authenticated');
-- Inserción solo con registrar_autorizacion (historial inmutable)

-- ¿La cirugía tiene autorización vigente hoy?
create or replace function autorizacion_vigente_de(p_estado text, p_vigencia date) returns boolean
language sql stable as $$
  -- coalesce: sin autorización registrada (NULL) cuenta como NO vigente
  select coalesce(p_estado = 'no_requiere' or (p_estado = 'autorizada' and (p_vigencia is null or p_vigencia >= (now() at time zone 'America/Bogota')::date)), false);
$$;

create or replace function registrar_autorizacion(
  p_solicitud bigint, p_estado text, p_numero_radicado text, p_fecha_solicitud date, p_canal text,
  p_numero_autorizacion text, p_fecha_autorizacion date, p_vigencia_hasta date,
  p_servicios text, p_observaciones text, p_adjuntos jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare v_aseg text;
begin
  if not rol_activo_en(array['administrador', 'gestor_clinico']) then
    raise exception 'Solo el gestor clínico o el administrador gestionan la autorización del asegurador';
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
    -- Campo de texto heredado que ve Programación
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

-- Bloqueo: programar, reprogramar o registrar realizada exige autorización vigente
create or replace function exigir_autorizacion_cirugia() returns trigger
language plpgsql as $$
begin
  if (
       (new.estado in ('programado', 'notificado', 'realizado') and new.estado is distinct from old.estado and old.estado not in ('programado', 'notificado', 'aplazado', 'suspendido', 'realizado'))
    or (new.estado = 'realizado' and old.estado is distinct from 'realizado')
    or (new.fecha_programada is not null and new.fecha_programada is distinct from old.fecha_programada)
    or (new.hora_programada is distinct from old.hora_programada and new.hora_programada is not null)
  ) and not autorizacion_vigente_de(new.autorizacion_estado, new.autorizacion_vigencia_hasta) then
    raise exception 'Sin autorización vigente del asegurador no se puede programar, reprogramar ni registrar la cirugía como realizada (estado de la autorización: %).',
      coalesce(new.autorizacion_estado, 'sin gestionar')
      using hint = 'El Gestor clínico debe registrar la autorización (número, fecha y vigencia) en Gestión clínica → Autorización del asegurador.';
  end if;
  return new;
end;
$$;
create trigger trg_exigir_autorizacion before update on solicitudes_cirugia
  for each row execute function exigir_autorizacion_cirugia();
