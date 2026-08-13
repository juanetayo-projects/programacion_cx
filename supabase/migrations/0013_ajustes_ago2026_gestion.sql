-- Ajustes solicitados agosto 2026 (ronda 2):
--  1) Nombre del médico cuando reporta un usuario tipo "programador" (el
--     formulario de reporte pide el nombre porque no hay login del médico).
--  2) Nuevo módulo independiente "solicitudes_reportadas": cola de intake
--     (estado reportado/fallido) separada de "Gestión de solicitudes", que
--     ahora solo muestra registros ya procesados por GoMedisys.

-- 1) Nombre del médico reportante (solo aplica si reportado_por es programador)
alter table solicitudes_cirugia add column nombre_medico_reporta text;

-- 2) Nuevo módulo en rol_permisos ----------------------------------------
alter table rol_permisos drop constraint rol_permisos_modulo_check;
alter table rol_permisos add constraint rol_permisos_modulo_check
  check (modulo in (
    'dashboard', 'reportar', 'solicitudes_reportadas', 'solicitudes', 'quirofanos', 'calor', 'reportes',
    'admin_usuarios', 'admin_catalogos', 'admin_roles'
  ));

-- Semilla: mismo acceso que ya tenía "solicitudes" por rol.
insert into rol_permisos (rol, modulo, permitido) values
  ('administrador', 'solicitudes_reportadas', true),
  ('programador', 'solicitudes_reportadas', true),
  ('medico', 'solicitudes_reportadas', false),
  ('visualizador', 'solicitudes_reportadas', false);
