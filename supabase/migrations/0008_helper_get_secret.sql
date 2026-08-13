create or replace function get_secret(secret_name text) returns text
language plpgsql security definer set search_path = public, vault as $$
declare
  secret_value text;
begin
  select decrypted_secret into secret_value from vault.decrypted_secrets where name = secret_name limit 1;
  return secret_value;
end;
$$;

revoke execute on function get_secret(text) from anon, authenticated;
