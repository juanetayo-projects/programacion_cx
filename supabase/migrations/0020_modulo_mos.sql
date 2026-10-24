-- Módulo MOS (Materiales de Osteosíntesis) — oct-2026
--  1) Rol 'mos' y módulo 'mos' en Roles y permisos.
--  2) Catálogo de aseguradores (nombre, contacto, teléfono, correo).
--  3) Estado MOS de la solicitud (independiente del estado de programación).
--  4) Evidencia de cada correo enviado al asegurador (mos_correos): HTML
--     exacto, destinatario, adjuntos, fecha y hora, quién lo envió.
--  5) Bucket privado 'mos' para la historia clínica y la boleta en PDF.

-- 1) Rol y módulo ----------------------------------------------------------
alter table perfiles drop constraint perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('administrador', 'programador', 'medico', 'visualizador', 'mos'));

alter table rol_permisos drop constraint rol_permisos_rol_check;
alter table rol_permisos add constraint rol_permisos_rol_check
  check (rol in ('administrador', 'programador', 'medico', 'visualizador', 'mos'));

alter table rol_permisos drop constraint rol_permisos_modulo_check;
alter table rol_permisos add constraint rol_permisos_modulo_check
  check (modulo in (
    'dashboard', 'reportar', 'reportar_masivo', 'solicitudes_reportadas', 'solicitudes', 'cirugias_realizadas',
    'quirofanos', 'calor', 'reportes', 'logs', 'admin_usuarios', 'admin_catalogos', 'admin_roles', 'mos'
  ));

insert into rol_permisos (rol, modulo, permitido) values
  ('administrador', 'mos', true),
  ('programador', 'mos', false),
  ('medico', 'mos', false),
  ('visualizador', 'mos', false)
on conflict (rol, modulo) do nothing;

insert into rol_permisos (rol, modulo, permitido)
select 'mos', m, m in ('dashboard', 'mos')
from unnest(array[
  'dashboard', 'reportar', 'reportar_masivo', 'solicitudes_reportadas', 'solicitudes', 'cirugias_realizadas',
  'quirofanos', 'calor', 'reportes', 'logs', 'admin_usuarios', 'admin_catalogos', 'admin_roles', 'mos'
]) as m
on conflict (rol, modulo) do nothing;

create or replace function es_mos_o_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists(select 1 from perfiles where id = auth.uid() and activo and rol in ('administrador', 'mos'));
$$;

-- 2) Aseguradores ----------------------------------------------------------
create table aseguradores (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  contacto text,
  telefono text,
  email text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table aseguradores enable row level security;
create policy "aseguradores lectura" on aseguradores for select using (auth.role() = 'authenticated');
create policy "aseguradores escritura" on aseguradores for all using (es_mos_o_admin()) with check (es_mos_o_admin());

-- Datos de ejemplo (contactos ficticios) mientras se cargan los reales
insert into aseguradores (nombre, contacto, telefono, email) values
  ('EMSSANAR', 'Laura Gómez (ejemplo)', '602 731 0000', 'autorizaciones.emssanar@ejemplo.co'),
  ('ASMET SALUD', 'Carlos Ruiz (ejemplo)', '602 820 0000', 'autorizaciones.asmetsalud@ejemplo.co'),
  ('S.O.S', 'Diana Martínez (ejemplo)', '602 489 0000', 'autorizaciones.sos@ejemplo.co'),
  ('SURA', 'Andrés Pérez (ejemplo)', '604 437 0000', 'autorizaciones.sura@ejemplo.co'),
  ('SURA ARL', 'Natalia Rojas (ejemplo)', '604 444 0000', 'autorizaciones.suraarl@ejemplo.co');

-- 3) Estado MOS de la solicitud ---------------------------------------------
-- NULL = pendiente de gestión. Los siguientes pasos del proceso añadirán valores.
alter table solicitudes_cirugia
  add column estado_mos text check (estado_mos in ('asegurador_notificado')),
  add column mos_asegurador_id bigint references aseguradores(id),
  add column mos_notificado_en timestamptz,
  add column mos_notificado_por uuid references perfiles(id);

-- 4) Evidencia de correos ----------------------------------------------------
create table mos_correos (
  id bigint generated always as identity primary key,
  solicitud_id bigint not null references solicitudes_cirugia(id) on delete cascade,
  paso text not null default 'notificacion_asegurador',
  asegurador_id bigint references aseguradores(id),
  -- Copia de los datos del asegurador al momento del envío
  asegurador_nombre text not null,
  asegurador_contacto text,
  asegurador_telefono text,
  destinatario text not null,
  remitente text not null,
  responder_a text,
  asunto text not null,
  html text not null,
  observaciones text,
  -- [{ tipo, nombre, path, bytes }] — los PDF quedan en el bucket 'mos'
  adjuntos jsonb not null default '[]',
  resend_id text,
  enviado_por uuid references perfiles(id),
  enviado_por_nombre text,
  enviado_en timestamptz not null default now()
);
create index on mos_correos (solicitud_id);

-- Evidencia inmutable: solo se lee desde la app; la inserta la Edge Function
-- notificar-asegurador con service role (sin políticas de insert/update/delete).
alter table mos_correos enable row level security;
create policy "mos_correos lectura" on mos_correos
  for select using (es_mos_o_admin() or es_programador_o_admin());

-- 5) Bucket de documentos MOS -------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mos', 'mos', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "mos lectura" on storage.objects
  for select using (bucket_id = 'mos' and (public.es_mos_o_admin() or public.es_programador_o_admin()));

create policy "mos carga" on storage.objects
  for insert with check (bucket_id = 'mos' and public.es_mos_o_admin());
