-- Contrato (asegurador), plan y tipo de afiliado del paciente, gestionados en
-- Gestión clínica (oct-2026). El contrato usa el catálogo de aseguradores,
-- el mismo que MOS usa para notificar (allí se sugiere el contrato).

-- 1) Aseguradores oficiales. Los 5 de ejemplo se renombran al nombre del
--    contrato (conservan id y datos de contacto de prueba); el resto se crea.
update aseguradores set nombre = 'EMSSANAR ENTIDAD PROMOTORA DE SALUD S.A.S.' where nombre = 'EMSSANAR';
update aseguradores set nombre = 'ASMET SALUD EPS SAS' where nombre = 'ASMET SALUD';
update aseguradores set nombre = 'EPS SERVICIO OCCIDENTAL DE SALUD SA SOS' where nombre = 'S.O.S';
update aseguradores set nombre = 'EPS Y MEDICINA PREPAGADA SURAMERICANA S. A' where nombre = 'SURA';
update aseguradores set nombre = 'SEGUROS DE VIDA SURAMERICANA S.A.' where nombre = 'SURA ARL';

insert into aseguradores (nombre)
select n from unnest(array[
  'ADMINISTRADORA DE LOS RECURSOS DEL SISTEMA GENERAL DE SEGURIDAD SOCIAL EN SALUD',
  'ASMET SALUD EPS SAS',
  'CLINICA DE ALTA COMPLEJIDAD SANTA BARBARA',
  'BMI COLOMBIA COMPAÑIA DE SEGUROS DE VIDA S.A.',
  'COMFENALCO VALLE',
  'DISPENSARIO MEDICO DE CALI',
  'EMSSANAR ENTIDAD PROMOTORA DE SALUD S.A.S.',
  'EPS SERVICIO OCCIDENTAL DE SALUD SA SOS',
  'EPS Y MEDICINA PREPAGADA SURAMERICANA S. A',
  'SALUD TOTAL ENTIDAD PROMOTORA DE SALUD DEL RÉGIMEN CONTRIBUTIVO Y DEL RÉGIMEN SUBSIDIADO',
  'SEGUROS COMERCIALES BOLIVAR S.A.',
  'SEGUROS GENERALES SURAMERICANA S.A.',
  'UNION TEMPORAL GESENCRO',
  'FIDEICOMISOS PATRIMONIOS AUTONOMOS FIDUCIARIA LA PREVISORA SA',
  'COMPAÑIA DE SEGUROS DE VIDA COLMENA SA',
  'HDI SEGUROS COLOMBIA S.A.',
  'LA EQUIDAD SEGUROS GENERALES ORGANISMO COOPERATIVO',
  'LA PREVISORA SA COMPAÑIA DE SEGUROS',
  'ENTIDAD PROMOTORA DE SALUD SANITAS SA',
  'AXA COLPATRIA SEGUROS S.A.',
  'EMSSANAR ENTIDAD PROMOTORA DE SALUD S.A.S. - EVENTO',
  'ASMET SALUD EPS SAS - EVENTO',
  'COMPAÑIA MUNDIAL DE SEGUROS S.A.',
  'SEGUROS DEL ESTADO S.A',
  'SEGUROS DE VIDA SURAMERICANA S.A.',
  'COOSALUD EPS S.A.',
  'ENTIDAD PROMOTORA DE SALUD FAMISANAR S.A.S',
  'COOMEVA MEDICINA PREPAGADA S.A.',
  'COSMITET LTDA',
  'POSITIVA COMPAÑIA DE SEGUROS SA',
  'DEPARTAMENTO DEL VALLE DEL CAUCA',
  'POLICIA NACIONAL DIRECCION DE SANIDAD SECCION VALLE',
  'UNIVERSIDAD NACIONAL DE COLOMBIA',
  'UNIDAD PRESTADORA DE SALUD VALLE DEL CAUCA',
  'ASEGURADORA SOLIDARIA DE COLOMBIA ENTIDAD COOPERATIVA',
  'NUEVA EPS PGP',
  'NUEVA EPS EVENTO',
  'ECOPETROL'
]) as n
where not exists (select 1 from aseguradores a where upper(a.nombre) = upper(n));

-- 2) Tipos de afiliado
create table tipos_afiliado (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  orden int not null default 100,
  activo boolean not null default true
);
alter table tipos_afiliado enable row level security;
create policy "tipos_afiliado lectura" on tipos_afiliado for select using (auth.role() = 'authenticated');
create policy "tipos_afiliado escritura" on tipos_afiliado for all using (is_admin()) with check (is_admin());

insert into tipos_afiliado (orden, nombre) values
  (10, 'COTIZANTE RANGO A'), (20, 'COTIZANTE RANGO B'), (30, 'COTIZANTE RANGO C'),
  (40, 'BENEFICIARIO RANGO A'), (50, 'BENEFICIARIO RANGO B'), (60, 'BENEFICIARIO RANGO C'),
  (70, 'SUBSIDIADO NIVEL 1'), (80, 'SUBSIDIADO NIVEL 2'), (90, 'SUBSIDIADO NIVEL 3'), (100, 'SUBSIDIADO NIVEL N/A'),
  (110, 'CONTRIBUTIVO'), (120, 'BENEFICIARIO');

-- 3) Plan del paciente (complementario al asegurador)
create table planes_paciente (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  orden int not null default 100,
  activo boolean not null default true
);
alter table planes_paciente enable row level security;
create policy "planes_paciente lectura" on planes_paciente for select using (auth.role() = 'authenticated');
create policy "planes_paciente escritura" on planes_paciente for all using (is_admin()) with check (is_admin());

insert into planes_paciente (orden, nombre) values
  (10, 'ARL'), (20, 'SOAT'), (30, 'POLIZA'), (40, 'PARTICULAR'), (50, 'EVENTO'), (60, 'MEDIANA'),
  (70, 'ALTA'), (80, 'PREPAGADA'), (90, 'PGP'), (100, 'RETIRADO'), (110, 'SUSPENDIDO'), (120, 'ESPECIAL');

-- 4) Datos del paciente en la solicitud
alter table solicitudes_cirugia
  add column contrato_id bigint references aseguradores(id),
  add column plan_paciente_id bigint references planes_paciente(id),
  add column tipo_afiliado_id bigint references tipos_afiliado(id);

create or replace function registrar_afiliacion_paciente(p_solicitud bigint, p_contrato bigint, p_plan bigint, p_tipo_afiliado bigint)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not rol_activo_en(array['administrador', 'gestor_clinico']) then
    raise exception 'Solo el gestor clínico o el administrador registran el contrato, el plan y el tipo de afiliado';
  end if;
  update solicitudes_cirugia set contrato_id = p_contrato, plan_paciente_id = p_plan, tipo_afiliado_id = p_tipo_afiliado where id = p_solicitud;
  if not found then raise exception 'Solicitud no encontrada'; end if;
end;
$$;
revoke execute on function registrar_afiliacion_paciente(bigint, bigint, bigint, bigint) from anon;
