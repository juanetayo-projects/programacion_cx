-- Ajustes solicitados agosto 2026 (ronda 7):
--  Nuevo módulo "logs": bitácora de ejecuciones de la API GoMedisys
--  (consulta-gomedisys), para dar seguimiento a fallos de integración.

alter table rol_permisos drop constraint rol_permisos_modulo_check;
alter table rol_permisos add constraint rol_permisos_modulo_check
  check (modulo in (
    'dashboard', 'reportar', 'solicitudes_reportadas', 'solicitudes', 'cirugias_realizadas',
    'quirofanos', 'calor', 'reportes', 'logs', 'admin_usuarios', 'admin_catalogos', 'admin_roles'
  ));

insert into rol_permisos (rol, modulo, permitido) values
  ('administrador', 'logs', true),
  ('programador', 'logs', true),
  ('medico', 'logs', false),
  ('visualizador', 'logs', false);
