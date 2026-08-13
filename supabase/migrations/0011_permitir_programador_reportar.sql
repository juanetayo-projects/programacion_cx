drop policy "medico reporta su solicitud" on solicitudes_cirugia;

create policy "medico o programador reporta su solicitud" on solicitudes_cirugia
  for insert with check (
    reportado_por = auth.uid()
    and (rol_actual() in ('medico', 'programador') or is_admin())
  );
