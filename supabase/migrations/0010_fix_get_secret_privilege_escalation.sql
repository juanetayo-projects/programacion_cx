-- get_secret() se creó SECURITY DEFINER pero PostgreSQL otorga EXECUTE a
-- PUBLIC por defecto al crear una función; el REVOKE previo (a anon,
-- authenticated) no alcanzaba el grant a PUBLIC. Cualquier usuario
-- autenticado -incluso anónimo- podía invocar
-- /rest/v1/rpc/get_secret?secret_name=RESEND_API_KEY y robar la clave.
revoke execute on function get_secret(text) from public;
revoke execute on function get_secret(text) from anon, authenticated;
grant execute on function get_secret(text) to service_role;
