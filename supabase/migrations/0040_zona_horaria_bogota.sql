-- Zona horaria de la base de datos: America/Bogota (UTC-05:00) — nov-2026
-- ---------------------------------------------------------------------------
-- La base estaba en UTC: now()::date, current_date y la salida de los
-- timestamptz (PostgREST, SQL Editor) se veían en hora UTC, 5 horas adelante
-- de Colombia (después de las 7 p. m. "hoy" ya era mañana).
-- Los instantes guardados (timestamptz) NO cambian; solo cambia la zona con la
-- que se presentan y la fecha de "hoy" en SQL. Las columnas `date` y
-- `timestamp without time zone` (datos de GoMedisys) ya están en hora local.
-- La app hace lo mismo en el navegador (src/lib/fechas.ts).

alter database postgres set timezone to 'America/Bogota';
alter role authenticator set timezone to 'America/Bogota';
