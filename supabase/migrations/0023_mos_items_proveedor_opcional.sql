-- MOS: el proveedor no se pide al notificar al asegurador; se registrará al
-- gestionar la entrega de cada ítem.
alter table mos_items alter column proveedor drop not null;
