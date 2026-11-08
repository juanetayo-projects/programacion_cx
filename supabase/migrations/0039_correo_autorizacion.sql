-- Correo al asegurador con la solicitud de autorización (nov-2026)
-- ---------------------------------------------------------------------------
-- Al registrar la gestión "Solicitada" (o "Devuelta", al volver a radicar), el
-- Gestor clínico puede enviar la solicitud por correo al asegurador con los
-- soportes adjuntos (Anexo 3, historia clínica…). La Edge Function
-- notificar-autorizacion envía el correo (Resend) y deja aquí la evidencia
-- inmutable: destinatarios, asunto, HTML exacto, adjuntos, fecha y usuario.
--
-- Además: Gestión MOS y Gestión clínica conservan su gestión y notificación en
-- la app; su Nota administrativa de GoMedisys pasa a ser informativa.

create table autorizacion_correos (
  id bigint generated always as identity primary key,
  solicitud_id bigint not null references solicitudes_cirugia(id) on delete cascade,
  autorizacion_id bigint references autorizaciones_cirugia(id) on delete set null,
  destinatarios text[] not null,
  copia text[] not null default '{}',
  asunto text not null,
  html text not null,
  adjuntos jsonb not null default '[]',
  enviado_por uuid references perfiles(id),
  enviado_por_nombre text,
  enviado_en timestamptz not null default now()
);
create index on autorizacion_correos (solicitud_id, enviado_en desc);
create index on autorizacion_correos (autorizacion_id);

alter table autorizacion_correos enable row level security;
create policy "autorizacion_correos lectura" on autorizacion_correos
  for select using (auth.role() = 'authenticated');
-- Sin políticas de escritura: solo la Edge Function (service_role) inserta.

-- MOS y Gestión clínica: la nota de GoMedisys no bloquea la gestión en la app
update componentes_gomedisys set exige = false,
  mensaje = 'Solicite al médico diligenciar en GoMedisys la Nota administrativa MOS. La gestión del material continúa en la app.'
where codigo = 'nota_mos';
update componentes_gomedisys set exige = false,
  mensaje = 'Solicite al médico diligenciar en GoMedisys la Nota administrativa GestionClinica. La gestión clínica continúa en la app.'
where codigo = 'nota_gestion_clinica';
