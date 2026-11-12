-- Boleta sin contenido real (nov-2026)
-- ---------------------------------------------------------------------------
-- Algunas solicitudes traen de la consulta masiva una boleta de relleno
-- (p. ej. "."). No cuenta como boleta: se puede consultar en GoMedisys y la
-- boleta consultada la reemplaza. Se considera boleta solo si tiene al menos
-- 3 caracteres alfanuméricos seguidos.

create or replace function boleta_con_contenido(p_texto text) returns boolean
language sql immutable as $$
  select coalesce(p_texto ~ '[[:alnum:]]{3,}', false);
$$;

create or replace function tiene_componente(p_solicitud bigint, p_componente text) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from notas_gomedisys n where n.solicitud_id = p_solicitud and n.componente = p_componente)
      or (p_componente = 'boleta' and exists (
            select 1 from solicitudes_cirugia s where s.id = p_solicitud and boleta_con_contenido(s.boleta_quirurgica)));
$$;

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

  -- Completa en la solicitud lo que aún no tenga (no pisa datos reales de la consulta masiva)
  if v_componente = 'boleta' then
    update solicitudes_cirugia s set
      boleta_quirurgica = case when boleta_con_contenido(s.boleta_quirurgica) then s.boleta_quirurgica
                               else coalesce(nullif(v_b->>'texto', ''), s.boleta_quirurgica) end,
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
