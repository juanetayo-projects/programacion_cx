-- RLS: helpers de rol
create or replace function rol_actual() returns text
language sql security definer set search_path = public stable as $$
  select rol from perfiles where id = auth.uid();
$$;

create or replace function is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists(select 1 from perfiles where id = auth.uid() and rol = 'administrador');
$$;

create or replace function es_programador_o_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists(select 1 from perfiles where id = auth.uid() and rol in ('administrador', 'programador'));
$$;

-- perfiles
alter table perfiles enable row level security;

create policy "perfil propio lectura" on perfiles
  for select using (auth.uid() = id or is_admin());

create policy "perfil propio actualizacion" on perfiles
  for update using (auth.uid() = id or is_admin())
  with check (auth.uid() = id or is_admin());

create policy "perfil autoregistro" on perfiles
  for insert with check (auth.uid() = id);

create policy "admin gestiona perfiles" on perfiles
  for delete using (is_admin());

-- catálogos: lectura para autenticados, escritura solo admin
do $$
declare t text;
begin
  for t in select unnest(array['especialidades', 'eps', 'unidades', 'recomendaciones_cirugia']) loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "cat lectura" on %I for select using (auth.role() = ''authenticated'')', t);
    execute format('create policy "cat escritura admin" on %I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- quirofanos: lectura para autenticados, escritura admin/programador
alter table quirofanos enable row level security;
create policy "quirofanos lectura" on quirofanos for select using (auth.role() = 'authenticated');
create policy "quirofanos escritura" on quirofanos for all using (es_programador_o_admin()) with check (es_programador_o_admin());

alter table quirofano_especialidades enable row level security;
create policy "quirofano_especialidades lectura" on quirofano_especialidades for select using (auth.role() = 'authenticated');
create policy "quirofano_especialidades escritura" on quirofano_especialidades for all using (is_admin()) with check (is_admin());

-- solicitudes_cirugia: dato clínico sensible (Ley 1581)
alter table solicitudes_cirugia enable row level security;

create policy "solicitudes lectura autenticados" on solicitudes_cirugia
  for select using (auth.role() = 'authenticated');

create policy "medico reporta su solicitud" on solicitudes_cirugia
  for insert with check (
    reportado_por = auth.uid()
    and (rol_actual() = 'medico' or is_admin())
  );

create policy "programador gestiona solicitudes" on solicitudes_cirugia
  for update using (es_programador_o_admin())
  with check (es_programador_o_admin());

create policy "admin elimina solicitudes" on solicitudes_cirugia
  for delete using (is_admin());

-- solicitudes_historial: auditoría, visible para programador/admin
alter table solicitudes_historial enable row level security;

create policy "historial lectura gestion" on solicitudes_historial
  for select using (es_programador_o_admin());

create policy "historial insercion autenticados" on solicitudes_historial
  for insert with check (auth.role() = 'authenticated');
