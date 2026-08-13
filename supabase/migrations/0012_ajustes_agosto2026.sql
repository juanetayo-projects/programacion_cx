-- Ajustes solicitados agosto 2026:
--  1) Nuevos estados de solicitud: aplazado, suspendido (usados desde el
--     modal de notificación al paciente).
--  2) Roles y permisos configurables: el administrador decide a qué
--     módulos tiene acceso cada rol, sin tocar código.

-- 1) Nuevos estados -----------------------------------------------------
alter table solicitudes_cirugia drop constraint solicitudes_cirugia_estado_check;
alter table solicitudes_cirugia add constraint solicitudes_cirugia_estado_check
  check (estado in ('reportado', 'procesado', 'fallido', 'programado', 'notificado', 'aplazado', 'suspendido', 'realizado', 'cancelado'));

-- 2) Roles y permisos -----------------------------------------------------
create table rol_permisos (
  rol text not null check (rol in ('administrador', 'programador', 'medico', 'visualizador')),
  modulo text not null check (modulo in (
    'dashboard', 'reportar', 'solicitudes', 'quirofanos', 'calor', 'reportes',
    'admin_usuarios', 'admin_catalogos', 'admin_roles'
  )),
  permitido boolean not null default false,
  primary key (rol, modulo)
);

alter table rol_permisos enable row level security;

create policy "rol_permisos lectura autenticados" on rol_permisos
  for select using (auth.role() = 'authenticated');

create policy "rol_permisos escritura admin" on rol_permisos
  for all using (is_admin()) with check (is_admin());

-- Semilla: replica el comportamiento que ya tenía la app antes de que
-- estos permisos fueran editables (Shell.tsx / App.tsx).
insert into rol_permisos (rol, modulo, permitido) values
  ('administrador', 'dashboard', true),
  ('administrador', 'reportar', true),
  ('administrador', 'solicitudes', true),
  ('administrador', 'quirofanos', true),
  ('administrador', 'calor', true),
  ('administrador', 'reportes', true),
  ('administrador', 'admin_usuarios', true),
  ('administrador', 'admin_catalogos', true),
  ('administrador', 'admin_roles', true),

  ('programador', 'dashboard', true),
  ('programador', 'reportar', true),
  ('programador', 'solicitudes', true),
  ('programador', 'quirofanos', true),
  ('programador', 'calor', true),
  ('programador', 'reportes', true),
  ('programador', 'admin_usuarios', false),
  ('programador', 'admin_catalogos', false),
  ('programador', 'admin_roles', false),

  ('medico', 'dashboard', false),
  ('medico', 'reportar', true),
  ('medico', 'solicitudes', false),
  ('medico', 'quirofanos', false),
  ('medico', 'calor', false),
  ('medico', 'reportes', false),
  ('medico', 'admin_usuarios', false),
  ('medico', 'admin_catalogos', false),
  ('medico', 'admin_roles', false),

  ('visualizador', 'dashboard', true),
  ('visualizador', 'reportar', false),
  ('visualizador', 'solicitudes', false),
  ('visualizador', 'quirofanos', true),
  ('visualizador', 'calor', true),
  ('visualizador', 'reportes', true),
  ('visualizador', 'admin_usuarios', false),
  ('visualizador', 'admin_catalogos', false),
  ('visualizador', 'admin_roles', false);
