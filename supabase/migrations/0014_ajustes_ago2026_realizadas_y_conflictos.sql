-- Ajustes solicitados agosto 2026 (ronda 5):
--  1) Nuevo módulo independiente "cirugias_realizadas": separa los registros
--     ya realizados de "Gestión de solicitudes" para no saturar esa vista.
--  2) Índice único parcial: evita programar dos solicitudes activas en el
--     mismo quirófano, misma fecha y misma hora (respaldo a nivel de base de
--     datos ante condiciones de carrera; la app también valida antes de guardar).

-- 1) Nuevo módulo en rol_permisos ----------------------------------------
alter table rol_permisos drop constraint rol_permisos_modulo_check;
alter table rol_permisos add constraint rol_permisos_modulo_check
  check (modulo in (
    'dashboard', 'reportar', 'solicitudes_reportadas', 'solicitudes', 'cirugias_realizadas',
    'quirofanos', 'calor', 'reportes', 'admin_usuarios', 'admin_catalogos', 'admin_roles'
  ));

insert into rol_permisos (rol, modulo, permitido) values
  ('administrador', 'cirugias_realizadas', true),
  ('programador', 'cirugias_realizadas', true),
  ('medico', 'cirugias_realizadas', false),
  ('visualizador', 'cirugias_realizadas', false);

-- 2) Un quirófano no puede tener dos solicitudes activas a la misma
--    fecha y hora (se ignoran las canceladas)
create unique index solicitudes_cirugia_quirofano_horario_uniq
  on solicitudes_cirugia (quirofano_id, fecha_programada, hora_programada)
  where estado <> 'cancelado' and quirofano_id is not null
    and fecha_programada is not null and hora_programada is not null;
