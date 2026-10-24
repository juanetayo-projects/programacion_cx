-- MOS: cada ítem del material de osteosíntesis es un registro independiente
-- (mos_items), para gestionar más adelante la entrega de cada uno por el
-- proveedor. Reemplaza la columna solicitudes_cirugia.mos_items (0021); la
-- copia en mos_correos.items se conserva como parte de la evidencia del correo.

alter table solicitudes_cirugia drop column if exists mos_items;

create table mos_items (
  id bigint generated always as identity primary key,
  solicitud_id bigint not null references solicitudes_cirugia(id) on delete cascade,
  correo_id bigint references mos_correos(id) on delete set null,
  orden int not null default 1,
  cantidad int not null check (cantidad > 0),
  descripcion text not null,
  proveedor text not null,
  -- Seguimiento de la entrega (siguientes pasos del proceso MOS).
  -- 'reemplazado': el ítem quedó sustituido por una notificación posterior.
  estado text not null default 'pendiente_entrega'
    check (estado in ('pendiente_entrega', 'entregado_parcial', 'entregado', 'anulado', 'reemplazado')),
  cantidad_entregada int not null default 0 check (cantidad_entregada >= 0),
  entregado_en timestamptz,
  recibido_por uuid references perfiles(id),
  observaciones_entrega text,
  creado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on mos_items (solicitud_id);
create index on mos_items (estado);

create trigger trg_mos_items_updated_at
  before update on mos_items
  for each row execute function set_updated_at();

-- Los inserta la Edge Function notificar-asegurador (service role); el gestor
-- MOS / administrador los actualiza al registrar las entregas.
alter table mos_items enable row level security;
create policy "mos_items lectura" on mos_items
  for select using (es_mos_o_admin() or es_programador_o_admin());
create policy "mos_items actualizacion" on mos_items
  for update using (es_mos_o_admin()) with check (es_mos_o_admin());
