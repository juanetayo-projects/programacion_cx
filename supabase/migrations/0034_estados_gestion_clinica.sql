-- Estado de la gestión clínica por paciente (oct-2026).
-- Catálogo editable (Administración → Catálogos) + estado actual en la
-- solicitud + historial inmutable de cambios (quién, cuándo, observación).
-- Solo el gestor clínico y el administrador cambian el estado (RPC).

create table estados_gestion_clinica (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  descripcion text,
  color text not null default '#64748B',   -- hex para la insignia y el Dashboard
  orden int not null default 100,
  es_final boolean not null default false, -- gestión terminada (no cuenta como pendiente)
  activo boolean not null default true
);
alter table estados_gestion_clinica enable row level security;
create policy "estados_gc lectura" on estados_gestion_clinica for select using (auth.role() = 'authenticated');
create policy "estados_gc escritura" on estados_gestion_clinica for all using (is_admin()) with check (is_admin());

insert into estados_gestion_clinica (orden, nombre, descripcion, color, es_final) values
  (10,  'TRAMITADO',     'Gestión clínica completada',                         '#10B981', true),
  (20,  'PDTE AUT',      'Pendiente autorización del asegurador',              '#EF4444', false),
  (30,  'PDTE COT',      'Pendiente cotización',                               '#F97316', false),
  (40,  'PDTE VoBo',     'Pendiente visto bueno',                              '#F59E0B', false),
  (50,  'PDTE LLAMAR',   'Pendiente llamar al paciente',                       '#EAB308', false),
  (60,  'PDTE FORMATO',  'Pendiente diligenciar o recibir formato',            '#D97706', false),
  (70,  'PDTE LECTURA',  'Pendiente lectura de estudios o ayudas diagnósticas','#B45309', false),
  (80,  'REMISION',      'Paciente remitido',                                  '#6366F1', false),
  (90,  'CITA',          'Cita asignada',                                      '#0EA5E9', false),
  (100, 'DIFERIDO',      'Gestión diferida',                                   '#94A3B8', false),
  (110, 'HALLAZGO QX',   'Hallazgo quirúrgico',                                '#8B5CF6', false),
  (120, 'P D T E',       'Pendiente (otro motivo)',                            '#64748B', false);

alter table solicitudes_cirugia
  add column estado_gc_id bigint references estados_gestion_clinica(id),
  add column estado_gc_actualizado_en timestamptz,
  add column estado_gc_actualizado_por_nombre text;

create table estados_gc_historial (
  id bigint generated always as identity primary key,
  solicitud_id bigint not null references solicitudes_cirugia(id) on delete cascade,
  estado_id bigint not null references estados_gestion_clinica(id),
  estado_nombre text not null,          -- copia: el historial no cambia si se renombra el estado
  observacion text,
  registrado_por uuid default auth.uid(),
  registrado_por_nombre text,
  created_at timestamptz not null default now()
);
create index estados_gc_historial_solicitud on estados_gc_historial (solicitud_id, created_at desc);
alter table estados_gc_historial enable row level security;
create policy "estados_gc_historial lectura" on estados_gc_historial for select using (puede_ver_gestion());
-- Sin políticas de escritura: solo entra por la RPC (evidencia inmutable)

create or replace function registrar_estado_gestion_clinica(p_solicitud bigint, p_estado bigint, p_observacion text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_nombre text; v_usuario text;
begin
  if not rol_activo_en(array['administrador', 'gestor_clinico']) then
    raise exception 'Solo el gestor clínico o el administrador cambian el estado de la gestión clínica';
  end if;
  select nombre into v_nombre from estados_gestion_clinica where id = p_estado and activo;
  if v_nombre is null then raise exception 'Estado inválido o inactivo'; end if;
  if not exists (select 1 from solicitudes_cirugia where id = p_solicitud) then raise exception 'Solicitud no encontrada'; end if;
  select nombre into v_usuario from perfiles where id = auth.uid();

  insert into estados_gc_historial (solicitud_id, estado_id, estado_nombre, observacion, registrado_por_nombre)
  values (p_solicitud, p_estado, v_nombre, nullif(trim(p_observacion), ''), v_usuario);

  update solicitudes_cirugia set
    estado_gc_id = p_estado,
    estado_gc_actualizado_en = now(),
    estado_gc_actualizado_por_nombre = v_usuario
  where id = p_solicitud;
end;
$$;
revoke execute on function registrar_estado_gestion_clinica(bigint, bigint, text) from anon;
