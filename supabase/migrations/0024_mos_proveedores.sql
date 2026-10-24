-- MOS · Paso 2: con la autorización del asegurador, se asigna a cada ítem su
-- proveedor y la fecha estimada de entrega, y se envía la solicitud por correo
-- a cada proveedor (un correo por proveedor), con evidencia en mos_correos.

-- 1) Catálogo de proveedores ------------------------------------------------
create table proveedores (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  nit text,
  direccion text,
  ciudad text,
  telefono text,
  contacto text,
  email text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table proveedores enable row level security;
create policy "proveedores lectura" on proveedores for select using (auth.role() = 'authenticated');
create policy "proveedores escritura" on proveedores for all using (es_mos_o_admin()) with check (es_mos_o_admin());

-- Datos ficticios mientras se cargan los reales
insert into proveedores (nombre, nit, direccion, ciudad, telefono, contacto, email) values
  ('ORTOSUR IMPLANTES SAS', '900.100.001-1', 'Calle 10 # 20-30', 'CALI', '602 300 0001', 'María López (ejemplo)', 'pedidos.ortosur@ejemplo.co'),
  ('TRAUMA MEDICAL ANDINA SAS', '900.100.002-2', 'Carrera 45 # 12-40', 'BOGOTÁ', '601 300 0002', 'Jorge Ramírez (ejemplo)', 'ventas.traumaandina@ejemplo.co'),
  ('OSTEOFIX COLOMBIA SAS', '900.100.003-3', 'Avenida 6N # 25-15', 'CALI', '602 300 0003', 'Paula Castro (ejemplo)', 'despachos.osteofix@ejemplo.co'),
  ('BIOSÍNTESIS DEL VALLE SAS', '900.100.004-4', 'Calle 5 # 38-70', 'PALMIRA', '602 300 0004', 'Andrés Mejía (ejemplo)', 'comercial.biosintesis@ejemplo.co');

-- 2) Ítems: proveedor, fecha estimada y correo con el que se solicitó ---------
alter table mos_items
  add column proveedor_id bigint references proveedores(id),
  add column fecha_estimada_entrega date,
  add column correo_proveedor_id bigint references mos_correos(id) on delete set null,
  add column proveedor_notificado_en timestamptz;

-- 3) Evidencia: los correos pueden ir a un asegurador o a un proveedor --------
alter table mos_correos alter column asegurador_nombre drop not null;
alter table mos_correos
  add column proveedor_id bigint references proveedores(id),
  add column proveedor_nombre text,
  add column proveedor_nit text,
  add column proveedor_contacto text,
  add column proveedor_telefono text;

-- 4) Nuevo estado MOS de la solicitud ----------------------------------------
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'solicitudes_cirugia'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%estado_mos%' loop
    execute format('alter table solicitudes_cirugia drop constraint %I', c);
  end loop;
end $$;
alter table solicitudes_cirugia add constraint solicitudes_cirugia_estado_mos_check
  check (estado_mos in ('asegurador_notificado', 'proveedor_notificado'));
alter table solicitudes_cirugia add column mos_proveedor_notificado_en timestamptz;
