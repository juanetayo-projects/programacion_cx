-- Consultas a GoMedisys vía GitHub Actions (bajo demanda)
-- ---------------------------------------------------------------------------
-- El firewall de la réplica Azure de GoMedisys no acepta conexiones desde
-- Supabase (AWS, IP dinámicas), pero sí desde los runners de GitHub Actions
-- (Azure) — igual que el sync de mapadecalorurg. Por eso las consultas son
-- "trabajos":
--   1. La app llama a la Edge Function consulta-gomedisys, que valida permisos,
--      crea la fila en gomedisys_trabajos y dispara el workflow
--      .github/workflows/gomedisys-consulta.yml con el id del trabajo.
--   2. El runner (scripts/gomedisys/consulta.js) toma el trabajo, consulta
--      GoMedisys y va reportando progreso y resultado con las funciones gm_runner_*.
--   3. La app escucha la fila por Realtime (progreso en vivo).
--
-- El runner NO usa la service_role key: se autentica con GM_RUNNER_KEY, una
-- clave aleatoria guardada como secret de GitHub; aquí solo se guarda su hash.

create extension if not exists pgcrypto with schema extensions;

create table gomedisys_trabajos (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('masiva', 'paciente', 'detalle')),
  parametros jsonb not null default '{}',
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'despachado', 'en_proceso', 'listo', 'error')),
  progreso jsonb not null default '[]',
  resultado jsonb,
  error text,
  solicitado_por uuid not null references perfiles(id),
  creado_en timestamptz not null default now(),
  iniciado_en timestamptz,
  terminado_en timestamptz
);
create index on gomedisys_trabajos (solicitado_por, creado_en desc);

alter table gomedisys_trabajos enable row level security;

-- Cada usuario ve sus trabajos (el admin, todos). Nadie escribe directo desde
-- el cliente: crea la Edge Function (service_role) y actualiza el runner.
create policy "trabajos propios lectura" on gomedisys_trabajos
  for select using (solicitado_por = auth.uid() or is_admin());

-- Configuración del runner (hash de la clave). Sin políticas: inaccesible
-- para anon/authenticated, solo la leen las funciones security definer.
create table gomedisys_runner_config (
  id int primary key default 1 check (id = 1),
  clave_hash text not null
);
alter table gomedisys_runner_config enable row level security;

create or replace function gm_runner_valida(p_clave text) returns boolean
language sql security definer set search_path = public, extensions stable as $$
  select exists (
    select 1 from gomedisys_runner_config
    where clave_hash = encode(extensions.digest(p_clave, 'sha256'), 'hex')
  );
$$;
revoke execute on function gm_runner_valida(text) from public, anon, authenticated;

-- El runner toma el trabajo (solo si está pendiente/despachado)
create or replace function gm_runner_tomar(p_clave text, p_id bigint)
returns table (id bigint, tipo text, parametros jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if not gm_runner_valida(p_clave) then
    raise exception 'Clave de runner inválida';
  end if;
  return query
    update gomedisys_trabajos t
       set estado = 'en_proceso', iniciado_en = now()
     where t.id = p_id and t.estado in ('pendiente', 'despachado')
    returning t.id, t.tipo, t.parametros;
end;
$$;

-- El runner reporta avance (progreso) y, al final, resultado o error
create or replace function gm_runner_actualizar(
  p_clave text, p_id bigint, p_progreso jsonb,
  p_estado text default null, p_resultado jsonb default null, p_error text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not gm_runner_valida(p_clave) then
    raise exception 'Clave de runner inválida';
  end if;
  if p_estado is not null and p_estado not in ('en_proceso', 'listo', 'error') then
    raise exception 'Estado inválido';
  end if;
  update gomedisys_trabajos
     set progreso = coalesce(p_progreso, progreso),
         estado = coalesce(p_estado, estado),
         resultado = coalesce(p_resultado, resultado),
         error = coalesce(p_error, error),
         terminado_en = case when p_estado in ('listo', 'error') then now() else terminado_en end
   where id = p_id and estado = 'en_proceso';
  -- Retención: los resultados traen datos de pacientes; se borran a los 2 días
  delete from gomedisys_trabajos where creado_en < now() - interval '2 days';
end;
$$;

revoke execute on function gm_runner_tomar(text, bigint) from public;
revoke execute on function gm_runner_actualizar(text, bigint, jsonb, text, jsonb, text) from public;
grant execute on function gm_runner_tomar(text, bigint) to anon, authenticated;
grant execute on function gm_runner_actualizar(text, bigint, jsonb, text, jsonb, text) to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gomedisys_trabajos'
  ) then
    alter publication supabase_realtime add table gomedisys_trabajos;
  end if;
end $$;

-- La clave del runner se registra aparte (no va en el repo):
--   insert into gomedisys_runner_config (clave_hash) values ('<sha256 hex>')
--   on conflict (id) do update set clave_hash = excluded.clave_hash;
