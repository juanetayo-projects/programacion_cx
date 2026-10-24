-- MOS: ítems del material de osteosíntesis detallados desde la boleta
-- quirúrgica [{ cantidad, descripcion, proveedor }]. Se guardan en la evidencia
-- de cada correo y, el último enviado, en la solicitud (para los siguientes pasos).
alter table mos_correos add column items jsonb not null default '[]';
alter table solicitudes_cirugia add column mos_items jsonb;
