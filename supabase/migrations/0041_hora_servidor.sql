-- Hora del servidor para medir el desfase del reloj del equipo (nov-2026)
-- La app comparaba con la fecha de emisión del token (iat), pero al recuperar
-- una sesión existente ese token ya tiene minutos de antigüedad y el aviso de
-- "reloj desfasado" salía sin motivo. Ahora mide contra now() del servidor.

create or replace function hora_servidor() returns timestamptz
language sql stable as $$ select now() $$;

revoke execute on function hora_servidor() from public;
grant execute on function hora_servidor() to anon, authenticated;
