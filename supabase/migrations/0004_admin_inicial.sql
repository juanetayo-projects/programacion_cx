-- Usuario administrador inicial. La contraseña se genera aleatoria y no se
-- conoce (ni por este script): el admin debe establecer su contraseña usando
-- "¿Olvidaste tu contraseña?" en el login la primera vez que la app esté
-- desplegada y el envío de correo (Resend) esté configurado.
do $$
declare
  new_user_id uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = 'juan.etayo@cacsantabarbara.co') then
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated',
    'juan.etayo@cacsantabarbara.co',
    crypt(gen_random_uuid()::text, gen_salt('bf')),
    now(), now(), now(),
    '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}', '{"nombre":"Juan Carlos Etayo"}',
    false, false
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_user_id::text, new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', 'juan.etayo@cacsantabarbara.co'),
    'email', now(), now(), now()
  );

  insert into perfiles (id, email, nombre, rol, activo)
  values (new_user_id, 'juan.etayo@cacsantabarbara.co', 'Juan Carlos Etayo', 'administrador', true);
end $$;
