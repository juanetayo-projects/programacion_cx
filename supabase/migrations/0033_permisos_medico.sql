-- Oct-2026: al ocultarse "Reportar cirugía" el rol Médico cirujano quedó sin
-- módulos; se le asignan Dashboard, Cirugías realizadas y Mapa de quirófanos.
update public.rol_permisos set permitido = true
 where rol = 'medico' and modulo in ('dashboard', 'cirugias_realizadas', 'quirofanos');
