-- Programación de Cirugías — esquema inicial

create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null,
  rol text not null default 'visualizador'
    check (rol in ('administrador', 'programador', 'medico', 'visualizador')),
  especialidad text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table especialidades (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  activo boolean not null default true
);

create table eps (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  activo boolean not null default true
);

create table unidades (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  activo boolean not null default true
);

-- Ficha técnica de quirófano (campos orientados a los estándares de
-- habilitación de servicios de salud, Res. 3100/2019: talento humano,
-- infraestructura, dotación y clasificación de áreas asépticas)
create table quirofanos (
  id bigint generated always as identity primary key,
  numero int not null unique,
  nombre text not null,
  tipo text not null default 'general'
    check (tipo in ('general', 'especializado', 'ambulatorio')),
  area_m2 numeric(6,2),
  clasificacion_riesgo text
    check (clasificacion_riesgo in ('limpio', 'limpio-contaminado', 'contaminado', 'sucio')),
  ubicacion_fisica text,
  capacidad_personas int,
  dotacion_basica text[] not null default '{}',
  sistema_climatizacion text,
  estado text not null default 'activo'
    check (estado in ('activo', 'mantenimiento', 'inactivo')),
  responsable text,
  color_calendario text not null default '#0D2D6B',
  observaciones text,
  created_at timestamptz not null default now()
);

create table quirofano_especialidades (
  quirofano_id bigint not null references quirofanos(id) on delete cascade,
  especialidad_id bigint not null references especialidades(id) on delete cascade,
  primary key (quirofano_id, especialidad_id)
);

create table recomendaciones_cirugia (
  id bigint generated always as identity primary key,
  especialidad_id bigint not null references especialidades(id) on delete cascade,
  titulo text not null,
  contenido text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table solicitudes_cirugia (
  id bigint generated always as identity primary key,

  -- Reporte inicial (médico)
  numero_ingreso text not null,
  documento_paciente text not null,
  especialidad_id bigint not null references especialidades(id),
  subespecialidad text,
  soporte_url text,
  reportado_por uuid not null references perfiles(id),
  fecha_reporte timestamptz not null default now(),

  estado text not null default 'reportado'
    check (estado in ('reportado', 'procesado', 'fallido', 'programado', 'notificado', 'realizado', 'cancelado')),

  -- Datos GoMedisys (inmodificables tras consulta exitosa)
  nombre_paciente text,
  edad int,
  eps_id bigint references eps(id),
  unidad_id bigint references unidades(id),
  cama text,
  valoracion_preanestesica text,
  procedimiento text,
  boleta_quirurgica text,
  tiempo_estimado_minutos int,
  gomedisys_consultado_en timestamptz,
  gomedisys_resultado text,

  -- Editables por programador (único bloque editable manualmente)
  autorizacion_aseguradora text,
  observaciones_programacion text,
  estado_material_osteosintesis text,
  casa_medica_material text,

  -- Programación
  quirofano_id bigint references quirofanos(id),
  fecha_programada date,
  hora_programada time,
  programado_por uuid references perfiles(id),
  programado_en timestamptz,

  -- Notificación al paciente
  notificado_en timestamptz,
  canales_notificacion text[] not null default '{}',
  notas_notificacion text,

  -- Cancelación
  cancelado boolean not null default false,
  motivo_cancelacion text,
  cancelado_por uuid references perfiles(id),
  cancelado_en timestamptz,

  -- Realizado
  realizado_en timestamptz,

  -- Migración histórica desde prog_cx.xlsx
  es_historico boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on solicitudes_cirugia (estado);
create index on solicitudes_cirugia (especialidad_id);
create index on solicitudes_cirugia (fecha_programada);
create index on solicitudes_cirugia (quirofano_id);
create index on solicitudes_cirugia (reportado_por);

create table solicitudes_historial (
  id bigint generated always as identity primary key,
  solicitud_id bigint not null references solicitudes_cirugia(id) on delete cascade,
  accion text not null,
  detalle jsonb,
  usuario_id uuid references perfiles(id),
  creado_en timestamptz not null default now()
);
create index on solicitudes_historial (solicitud_id);

-- updated_at automático
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_solicitudes_updated_at
  before update on solicitudes_cirugia
  for each row execute function set_updated_at();
