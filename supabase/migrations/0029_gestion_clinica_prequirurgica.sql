-- Gestión clínica y Gestión prequirúrgica (oct-2026)
--  1) Rol 'gestor_clinico'; módulos 'gestion_clinica' y 'prequirurgico'.
--  2) Cobro por ítem de material (a quién se carga en facturación).
--  3) Notas de seguimiento inmutables (fecha, hora, usuario, descripción,
--     adjuntos), con cita/evento y control de estado para el seguimiento
--     pre y posquirúrgico.
--  4) Catálogo tipos_seguimiento con los controles habituales.
--  5) Bucket privado 'notas' para los adjuntos.

-- 1) Rol y módulos -----------------------------------------------------------
alter table perfiles drop constraint perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('administrador', 'programador', 'medico', 'visualizador', 'mos', 'esterilizacion', 'gestor_clinico'));

alter table rol_permisos drop constraint rol_permisos_rol_check;
alter table rol_permisos add constraint rol_permisos_rol_check
  check (rol in ('administrador', 'programador', 'medico', 'visualizador', 'mos', 'esterilizacion', 'gestor_clinico'));

alter table rol_permisos drop constraint rol_permisos_modulo_check;
alter table rol_permisos add constraint rol_permisos_modulo_check
  check (modulo in (
    'dashboard', 'reportar', 'reportar_masivo', 'solicitudes_reportadas', 'solicitudes', 'cirugias_realizadas',
    'quirofanos', 'calor', 'reportes', 'logs', 'admin_usuarios', 'admin_catalogos', 'admin_roles', 'mos',
    'esterilizacion', 'gestion_clinica', 'prequirurgico'
  ));

insert into rol_permisos (rol, modulo, permitido) values
  ('administrador', 'gestion_clinica', true), ('administrador', 'prequirurgico', true),
  ('programador', 'gestion_clinica', false), ('programador', 'prequirurgico', true),
  ('medico', 'gestion_clinica', false), ('medico', 'prequirurgico', false),
  ('visualizador', 'gestion_clinica', false), ('visualizador', 'prequirurgico', false),
  ('mos', 'gestion_clinica', false), ('mos', 'prequirurgico', false),
  ('esterilizacion', 'gestion_clinica', false), ('esterilizacion', 'prequirurgico', false)
on conflict (rol, modulo) do nothing;

-- Gestor clínico: consulta (dashboard, solicitudes, MOS) y sus dos módulos
insert into rol_permisos (rol, modulo, permitido)
select 'gestor_clinico', m, m in ('dashboard', 'cirugias_realizadas', 'mos', 'gestion_clinica', 'prequirurgico')
from unnest(array[
  'dashboard', 'reportar', 'reportar_masivo', 'solicitudes_reportadas', 'solicitudes', 'cirugias_realizadas',
  'quirofanos', 'calor', 'reportes', 'logs', 'admin_usuarios', 'admin_catalogos', 'admin_roles', 'mos',
  'esterilizacion', 'gestion_clinica', 'prequirurgico'
]) as m
on conflict (rol, modulo) do nothing;

create or replace function rol_activo_en(p_roles text[]) returns boolean
language sql security definer set search_path = public stable as $$
  select exists(select 1 from perfiles where id = auth.uid() and activo and rol = any(p_roles));
$$;
revoke execute on function rol_activo_en(text[]) from anon;

-- Roles que participan en la gestión del paciente (lectura de la gestión MOS y notas)
create or replace function puede_ver_gestion() returns boolean
language sql security definer set search_path = public stable as $$
  select rol_activo_en(array['administrador', 'programador', 'mos', 'esterilizacion', 'gestor_clinico']);
$$;
revoke execute on function puede_ver_gestion() from anon;

-- El gestor clínico consulta toda la gestión MOS
drop policy "mos_items lectura" on mos_items;
create policy "mos_items lectura" on mos_items for select using (puede_ver_gestion());
drop policy "mos_correos lectura" on mos_correos;
create policy "mos_correos lectura" on mos_correos for select using (puede_ver_gestion());
drop policy "mos_recepciones lectura" on mos_recepciones;
create policy "mos_recepciones lectura" on mos_recepciones for select using (puede_ver_gestion());
drop policy "mos lectura" on storage.objects;
create policy "mos lectura" on storage.objects
  for select using (bucket_id = 'mos' and public.puede_ver_gestion());

-- 2) Cobro por ítem ------------------------------------------------------------
alter table mos_items
  add column cobro_responsable text,
  add column cobro_registrado_en timestamptz,
  add column cobro_registrado_por uuid references perfiles(id),
  add column cobro_registrado_por_nombre text;

create or replace function mos_item_registrar_cobro(p_item bigint, p_responsable text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_solicitud bigint; v_anterior text;
begin
  if not rol_activo_en(array['administrador', 'gestor_clinico']) then
    raise exception 'Solo el gestor clínico o el administrador pueden registrar el cobro';
  end if;
  select solicitud_id, cobro_responsable into v_solicitud, v_anterior from mos_items where id = p_item;
  if v_solicitud is null then raise exception 'Ítem no encontrado'; end if;

  update mos_items set
    cobro_responsable = nullif(trim(p_responsable), ''),
    cobro_registrado_en = now(),
    cobro_registrado_por = auth.uid(),
    cobro_registrado_por_nombre = (select nombre from perfiles where id = auth.uid())
  where id = p_item;

  -- Trazabilidad de cada cambio del cobro
  insert into solicitudes_historial (solicitud_id, accion, detalle, usuario_id)
  values (v_solicitud, 'cobro_item_mos',
          jsonb_build_object('item_id', p_item, 'anterior', v_anterior, 'nuevo', nullif(trim(p_responsable), '')), auth.uid());
end;
$$;
revoke execute on function mos_item_registrar_cobro(bigint, text) from anon;

-- 4) Tipos de seguimiento --------------------------------------------------------
create table tipos_seguimiento (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  fase text not null check (fase in ('prequirurgico', 'posquirurgico', 'general')),
  dias_sugeridos int,           -- días respecto a la fecha de la cirugía (negativo = antes)
  requiere_cita boolean not null default true,
  orden int not null default 100,
  activo boolean not null default true
);
alter table tipos_seguimiento enable row level security;
create policy "tipos_seguimiento lectura" on tipos_seguimiento for select using (auth.role() = 'authenticated');
create policy "tipos_seguimiento escritura" on tipos_seguimiento for all using (is_admin()) with check (is_admin());

insert into tipos_seguimiento (nombre, fase, dias_sugeridos, requiere_cita, orden) values
  ('VALORACIÓN PREANESTÉSICA', 'prequirurgico', -7, true, 10),
  ('EXÁMENES PREQUIRÚRGICOS (LABORATORIO / IMÁGENES)', 'prequirurgico', -7, true, 20),
  ('CONSENTIMIENTO INFORMADO', 'prequirurgico', -3, false, 30),
  ('SUSPENSIÓN DE ANTICOAGULANTES / MEDICAMENTOS', 'prequirurgico', -5, false, 40),
  ('INDICACIONES DE AYUNO Y PREPARACIÓN', 'prequirurgico', -2, false, 50),
  ('RESERVA DE HEMODERIVADOS', 'prequirurgico', -2, false, 60),
  ('RESERVA DE CAMA / UCI', 'prequirurgico', -1, false, 70),
  ('LLAMADA DE CONFIRMACIÓN PREQUIRÚRGICA', 'prequirurgico', -1, true, 80),
  ('LLAMADA DE SEGUIMIENTO POSOPERATORIO (24-72 H)', 'posquirurgico', 2, true, 110),
  ('CURACIÓN DE HERIDA QUIRÚRGICA', 'posquirurgico', 3, true, 120),
  ('RETIRO DE SONDA VESICAL', 'posquirurgico', 3, true, 130),
  ('RETIRO DE DRENES', 'posquirurgico', 5, true, 140),
  ('CONTROL POSQUIRÚRGICO CON ESPECIALISTA', 'posquirurgico', 10, true, 150),
  ('RETIRO DE PUNTOS / SUTURAS', 'posquirurgico', 12, true, 160),
  ('ENTREGA DE RESULTADO DE PATOLOGÍA', 'posquirurgico', 15, true, 170),
  ('CONTROL RADIOLÓGICO', 'posquirurgico', 30, true, 180),
  ('RETIRO DE YESO / FÉRULA', 'posquirurgico', 30, true, 190),
  ('RETIRO DE AGUJAS / MATERIAL DE OSTEOSÍNTESIS', 'posquirurgico', 42, true, 200),
  ('TERAPIA FÍSICA / REHABILITACIÓN', 'posquirurgico', 15, true, 210),
  ('VIGILANCIA DE INFECCIÓN DEL SITIO OPERATORIO (30 DÍAS)', 'posquirurgico', 30, true, 220),
  ('VIGILANCIA DE INFECCIÓN CON IMPLANTE (90 DÍAS)', 'posquirurgico', 90, true, 230),
  ('NOTA DE SEGUIMIENTO GENERAL', 'general', null, false, 900);

-- 3) Notas de seguimiento ------------------------------------------------------------
create table notas_seguimiento (
  id bigint generated always as identity primary key,
  solicitud_id bigint not null references solicitudes_cirugia(id) on delete cascade,
  ambito text not null check (ambito in ('gestion_clinica', 'prequirurgico')),
  mos_item_id bigint references mos_items(id) on delete set null,
  tipo_id bigint references tipos_seguimiento(id),
  tipo_nombre text,                  -- copia del tipo al momento de la nota
  fase text check (fase in ('prequirurgico', 'posquirurgico', 'general')),
  descripcion text not null check (length(trim(descripcion)) > 0),
  fecha_cita timestamptz,            -- cita / evento programado (fecha y hora)
  estado_cita text check (estado_cita in ('programada', 'cumplida', 'no_asistio', 'reprogramada', 'cancelada')),
  estado_actualizado_en timestamptz,
  estado_actualizado_por_nombre text,
  -- [{ nombre, path, bytes, tipo }] — archivos en el bucket 'notas'
  adjuntos jsonb not null default '[]',
  creado_por uuid not null references perfiles(id) default auth.uid(),
  creado_por_nombre text,
  creado_por_rol text,
  created_at timestamptz not null default now()
);
create index on notas_seguimiento (solicitud_id, ambito);
create index on notas_seguimiento (fecha_cita) where fecha_cita is not null;

-- Autor, rol y fecha los fija el servidor (no se pueden suplantar)
create or replace function notas_fijar_autor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.creado_por := auth.uid();
  new.created_at := now();
  select nombre, rol into new.creado_por_nombre, new.creado_por_rol from perfiles where id = auth.uid();
  if new.tipo_id is not null then
    select nombre, fase into new.tipo_nombre, new.fase from tipos_seguimiento where id = new.tipo_id;
  end if;
  if new.fecha_cita is not null and new.estado_cita is null then new.estado_cita := 'programada'; end if;
  new.estado_actualizado_en := null;
  new.estado_actualizado_por_nombre := null;
  return new;
end;
$$;
create trigger trg_notas_autor before insert on notas_seguimiento
  for each row execute function notas_fijar_autor();

alter table notas_seguimiento enable row level security;
create policy "notas lectura" on notas_seguimiento for select using (puede_ver_gestion());
create policy "notas insercion" on notas_seguimiento for insert with check (
  (ambito = 'gestion_clinica' and rol_activo_en(array['administrador', 'gestor_clinico']))
  or (ambito = 'prequirurgico' and rol_activo_en(array['administrador', 'programador', 'gestor_clinico']))
);
-- Sin update/delete: las notas son evidencia. El estado de la cita se controla con:
create or replace function nota_actualizar_estado_cita(p_nota bigint, p_estado text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_nota notas_seguimiento;
begin
  select * into v_nota from notas_seguimiento where id = p_nota;
  if v_nota.id is null or v_nota.fecha_cita is null then raise exception 'La nota no tiene una cita'; end if;
  if not (
    (v_nota.ambito = 'gestion_clinica' and rol_activo_en(array['administrador', 'gestor_clinico']))
    or (v_nota.ambito = 'prequirurgico' and rol_activo_en(array['administrador', 'programador', 'gestor_clinico']))
  ) then
    raise exception 'Sin permiso para actualizar la cita';
  end if;
  if p_estado not in ('programada', 'cumplida', 'no_asistio', 'reprogramada', 'cancelada') then
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
revoke execute on function nota_actualizar_estado_cita(bigint, text) from anon;

-- 5) Adjuntos de notas -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notas', 'notas', false, 10485760, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword', 'application/vnd.ms-excel', 'text/plain'
])
on conflict (id) do nothing;

create policy "notas archivos lectura" on storage.objects
  for select using (bucket_id = 'notas' and public.puede_ver_gestion());
create policy "notas archivos carga" on storage.objects
  for insert with check (bucket_id = 'notas' and public.rol_activo_en(array['administrador', 'programador', 'gestor_clinico']));
