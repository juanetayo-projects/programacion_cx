-- Boleta quirúrgica desde GoMedisys (nov-2026)
-- ---------------------------------------------------------------------------
-- El script de la boleta ya existe (sql/boleta_quirurgica.sql, parámetro:
-- # de ingreso). Desde Gestión Programación Cx y Gestión MOS un botón en el
-- componente "Boleta Qx" lanza un trabajo tipo 'componente'; el runner de
-- GitHub Actions lo ejecuta y deja la boleta en `resultado`. Este trigger la
-- guarda en notas_gomedisys.
--
-- Una vez guardada la boleta de una solicitud, la consulta queda
-- inhabilitada (la Edge Function la rechaza y la app deshabilita el botón)
-- para no consumir recursos de la réplica de GoMedisys.

alter table gomedisys_trabajos drop constraint if exists gomedisys_trabajos_tipo_check;
alter table gomedisys_trabajos add constraint gomedisys_trabajos_tipo_check
  check (tipo in ('masiva', 'paciente', 'detalle', 'componente'));

update componentes_gomedisys set script_disponible = true where codigo = 'boleta';

create or replace function guardar_componente_gomedisys() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_solicitud bigint := nullif(new.parametros->>'solicitud', '')::bigint;
  v_componente text := new.parametros->>'componente';
  v_b jsonb := new.resultado->'boleta';
begin
  if v_solicitud is null or v_componente is null or v_b is null or jsonb_typeof(v_b) <> 'object' then
    return new; -- sin boleta en GoMedisys: no se guarda nada y se puede volver a consultar
  end if;

  insert into notas_gomedisys (solicitud_id, componente, texto, datos, profesional, fecha_registro, consultado_en, consultado_por)
  values (v_solicitud, v_componente, nullif(v_b->>'texto', ''), coalesce(v_b->'datos', '{}'::jsonb),
          nullif(v_b->>'profesional', ''), nullif(v_b->>'fecha_registro', '')::timestamptz, now(), new.solicitado_por)
  on conflict (solicitud_id, componente) do nothing;

  -- Completa en la solicitud lo que aún no tenga (no pisa datos de la consulta masiva)
  if v_componente = 'boleta' then
    update solicitudes_cirugia s set
      boleta_quirurgica = coalesce(nullif(trim(s.boleta_quirurgica), ''), nullif(v_b->>'texto', '')),
      tiempo_estimado_minutos = coalesce(s.tiempo_estimado_minutos, round(nullif(v_b->>'duracion', '')::numeric)::int),
      destino = coalesce(nullif(trim(s.destino), ''), nullif(v_b->>'destino', ''))
    where s.id = v_solicitud;
  end if;

  insert into solicitudes_historial (solicitud_id, accion, usuario_id, detalle)
  values (v_solicitud, 'consulta_api', new.solicitado_por,
          jsonb_build_object('resultado', 'exitoso', 'componente', v_componente, 'trabajo', new.id));
  return new;
end;
$$;

drop trigger if exists trg_guardar_componente_gomedisys on gomedisys_trabajos;
create trigger trg_guardar_componente_gomedisys
  after update of estado on gomedisys_trabajos
  for each row
  when (new.tipo = 'componente' and new.estado = 'listo' and old.estado is distinct from 'listo')
  execute function guardar_componente_gomedisys();
