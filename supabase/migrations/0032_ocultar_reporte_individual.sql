-- Oct-2026: se oculta "Reportar cirugía" (reporte individual). El ingreso de
-- pacientes es solo por la consulta masiva GoMedisys, exclusiva de
-- administrador y programación de cirugía.
update public.rol_permisos set permitido = false where modulo = 'reportar';

update public.rol_permisos
   set permitido = (rol in ('administrador', 'programador'))
 where modulo = 'reportar_masivo';
