-- MOS · Recepción de materiales por Esterilización (cierre del proceso MOS)
--  1) Rol 'esterilizacion' y módulo 'esterilizacion' (Recepción de materiales).
--  2) mos_recepciones: un recibo por remisión del proveedor (cantidades por
--     ítem, datos de la remisión, observaciones, quién recibió y el acta HTML
--     como evidencia de auditoría).
--  3) Estado 'material_parcial' y cierre en 'material_recibido', que avisa al
--     equipo de Programación para llevar el material a la sala.

-- 1) Rol y módulo -----------------------------------------------------------
alter table perfiles drop constraint perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('administrador', 'programador', 'medico', 'visualizador', 'mos', 'esterilizacion'));

alter table rol_permisos drop constraint rol_permisos_rol_check;
alter table rol_permisos add constraint rol_permisos_rol_check
  check (rol in ('administrador', 'programador', 'medico', 'visualizador', 'mos', 'esterilizacion'));

alter table rol_permisos drop constraint rol_permisos_modulo_check;
alter table rol_permisos add constraint rol_permisos_modulo_check
  check (modulo in (
    'dashboard', 'reportar', 'reportar_masivo', 'solicitudes_reportadas', 'solicitudes', 'cirugias_realizadas',
    'quirofanos', 'calor', 'reportes', 'logs', 'admin_usuarios', 'admin_catalogos', 'admin_roles', 'mos',
    'esterilizacion'
  ));

insert into rol_permisos (rol, modulo, permitido) values
  ('administrador', 'esterilizacion', true),
  ('programador', 'esterilizacion', false),
  ('medico', 'esterilizacion', false),
  ('visualizador', 'esterilizacion', false),
  ('mos', 'esterilizacion', true)
on conflict (rol, modulo) do nothing;

insert into rol_permisos (rol, modulo, permitido)
select 'esterilizacion', m, m = 'esterilizacion'
from unnest(array[
  'dashboard', 'reportar', 'reportar_masivo', 'solicitudes_reportadas', 'solicitudes', 'cirugias_realizadas',
  'quirofanos', 'calor', 'reportes', 'logs', 'admin_usuarios', 'admin_catalogos', 'admin_roles', 'mos',
  'esterilizacion'
]) as m
on conflict (rol, modulo) do nothing;

create or replace function es_esterilizacion_o_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists(select 1 from perfiles where id = auth.uid() and activo and rol in ('administrador', 'esterilizacion'));
$$;
revoke execute on function es_esterilizacion_o_admin() from anon;

-- Esterilización necesita ver los ítems a recibir
drop policy "mos_items lectura" on mos_items;
create policy "mos_items lectura" on mos_items
  for select using (es_mos_o_admin() or es_programador_o_admin() or es_esterilizacion_o_admin());

-- 2) Recibos (uno por remisión) -----------------------------------------------
create table mos_recepciones (
  id bigint generated always as identity primary key,
  solicitud_id bigint not null references solicitudes_cirugia(id) on delete cascade,
  proveedor_id bigint references proveedores(id),
  proveedor_nombre text not null,
  proveedor_nit text,
  numero_remision text not null,
  fecha_remision date not null,
  entregado_por text,                -- persona del proveedor que entrega
  observaciones text,
  -- [{ itemId, orden, descripcion, solicitada, recibidaAntes, recibida }]
  items jsonb not null default '[]',
  completa boolean not null default false,  -- con este recibo quedó todo el material
  acta_html text not null,                  -- acta de recibo tal como se confirmó
  recibido_por uuid references perfiles(id),
  recibido_por_nombre text,
  recibido_por_email text,
  recibido_en timestamptz not null default now()
);
create index on mos_recepciones (solicitud_id);

-- Evidencia inmutable: la inserta la Edge Function registrar-recepcion.
alter table mos_recepciones enable row level security;
create policy "mos_recepciones lectura" on mos_recepciones
  for select using (es_mos_o_admin() or es_programador_o_admin() or es_esterilizacion_o_admin());

alter table mos_items add column recepcion_id bigint references mos_recepciones(id) on delete set null;

-- 3) Estados -------------------------------------------------------------------
alter table solicitudes_cirugia drop constraint solicitudes_cirugia_estado_mos_check;
alter table solicitudes_cirugia add constraint solicitudes_cirugia_estado_mos_check
  check (estado_mos in (
    'asegurador_notificado', 'asegurador_aprobado', 'asegurador_rechazado',
    'proveedor_notificado', 'proveedor_confirmado', 'material_parcial', 'material_recibido'
  ));
alter table solicitudes_cirugia add column mos_programacion_notificada_en timestamptz;

-- Evidencia del aviso a Programación (paso 'notificacion_programacion')
alter table mos_correos add column destinatarios text[];
