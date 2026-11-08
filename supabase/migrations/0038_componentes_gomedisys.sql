-- Componentes de GoMedisys que gobiernan el avance del proceso (nov-2026)
-- ---------------------------------------------------------------------------
-- Decisión del área: todos los datos vienen de GoMedisys. Cada módulo depende
-- de un formulario ("componente") que el médico / el área diligencia allá:
--   boleta                 Boleta quirúrgica          → Gestión Programación Cx
--   nota_mos               Nota administrativa MOS    → Gestión MOS
--   nota_gestion_clinica   Nota administrativa GestionClinica → Gestión clínica
--   nota_posqx             Nota administrativa PosQx  → Gestión postquirúrgica
-- Si el componente no existe, el módulo BLOQUEA el avance y le pide al usuario
-- que solicite al médico diligenciarlo; luego un botón trae SOLO ese
-- componente desde GoMedisys (script en desarrollo: `script_disponible`).
-- Las notas reemplazan lo que hoy se registra en la app para ese módulo.
--
-- `exige` permite al administrador suspender un bloqueo (p. ej. mientras el
-- script de ese componente no está listo) sin desplegar código.
--
-- Además:
--   * requiere_mos: lo marca GoMedisys (null = aún sin dato).
--   * Programar / reprogramar exige: boleta (si se exige) y, si la cirugía
--     requiere MOS, el material recibido en la clínica.

create table componentes_gomedisys (
  id int generated always as identity primary key,
  codigo text not null unique check (codigo in ('boleta', 'nota_mos', 'nota_gestion_clinica', 'nota_posqx')),
  nombre text not null,
  modulo text not null,
  exige boolean not null default true,
  script_disponible boolean not null default false,
  mensaje text
);
insert into componentes_gomedisys (codigo, nombre, modulo, mensaje) values
  ('boleta', 'Boleta quirúrgica', 'Gestión Programación Cx',
   'Solicite al médico diligenciar en GoMedisys la Boleta quirúrgica. Sin ella no se puede programar la cirugía.'),
  ('nota_mos', 'Nota administrativa MOS', 'Gestión MOS',
   'Solicite al médico diligenciar en GoMedisys la Nota administrativa MOS. Sin ella no avanza la gestión del material.'),
  ('nota_gestion_clinica', 'Nota administrativa GestionClinica', 'Gestión clínica',
   'Solicite al médico diligenciar en GoMedisys la Nota administrativa GestionClinica. Sin ella no avanza la gestión clínica.'),
  ('nota_posqx', 'Nota administrativa PosQx', 'Gestión postquirúrgica',
   'Solicite al médico diligenciar en GoMedisys la Nota administrativa PosQx. Sin ella no avanza el seguimiento posquirúrgico.');

alter table componentes_gomedisys enable row level security;
create policy "componentes lectura" on componentes_gomedisys for select using (auth.role() = 'authenticated');
create policy "componentes admin" on componentes_gomedisys for update using (is_admin()) with check (is_admin());

-- Contenido de cada componente traído de GoMedisys (uno vigente por solicitud).
-- Solo lo escribe el runner / Edge Function (service_role); la app lo lee.
create table notas_gomedisys (
  id bigint generated always as identity primary key,
  solicitud_id bigint not null references solicitudes_cirugia(id) on delete cascade,
  componente text not null references componentes_gomedisys(codigo),
  texto text,
  datos jsonb not null default '{}',
  profesional text,
  fecha_registro timestamptz,          -- cuándo se diligenció en GoMedisys
  consultado_en timestamptz not null default now(),
  consultado_por uuid references perfiles(id),
  unique (solicitud_id, componente)
);
create index on notas_gomedisys (componente);
alter table notas_gomedisys enable row level security;
create policy "notas gm lectura" on notas_gomedisys for select using (auth.role() = 'authenticated');

-- ¿La cirugía requiere material de osteosíntesis? Lo marca GoMedisys.
alter table solicitudes_cirugia add column requiere_mos boolean;

-- ¿La solicitud tiene el componente? (la boleta también cuenta si llegó con la consulta masiva)
create or replace function tiene_componente(p_solicitud bigint, p_componente text) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from notas_gomedisys n where n.solicitud_id = p_solicitud and n.componente = p_componente)
      or (p_componente = 'boleta' and exists (
            select 1 from solicitudes_cirugia s where s.id = p_solicitud and nullif(trim(s.boleta_quirurgica), '') is not null));
$$;

-- ¿El componente bloquea hoy? (exigido y no diligenciado)
create or replace function componente_bloquea(p_solicitud bigint, p_componente text) returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select exige from componentes_gomedisys where codigo = p_componente), false)
     and not tiene_componente(p_solicitud, p_componente);
$$;

-- Programar / reprogramar: boleta + MOS (si la cirugía lo requiere)
create or replace function exigir_requisitos_programacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (
       (new.estado = 'programado' and new.estado is distinct from old.estado and old.estado not in ('programado', 'notificado', 'aplazado', 'suspendido', 'realizado'))
    or (new.fecha_programada is not null and new.fecha_programada is distinct from old.fecha_programada)
    or (new.hora_programada is not null and new.hora_programada is distinct from old.hora_programada)
  ) then
    if componente_bloquea(new.id, 'boleta') then
      raise exception 'Sin Boleta quirúrgica no se puede programar la cirugía.'
        using hint = 'Solicite al médico diligenciar la Boleta quirúrgica en GoMedisys y actualice los datos desde la app.';
    end if;
    if new.requiere_mos is true and coalesce(new.estado_mos, '') <> 'material_recibido' then
      raise exception 'La cirugía requiere material de osteosíntesis (MOS) y aún no está recibido en la clínica.'
        using hint = 'La Gestión MOS debe completar el hito 5 · Material en la clínica.';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_exigir_requisitos_programacion before update on solicitudes_cirugia
  for each row execute function exigir_requisitos_programacion();
