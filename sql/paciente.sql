-- Consulta del paciente en GoMedisys para el sticker de cirugía.
-- Basada en docs/script_consulta.sql, reducida a los campos que usa el sticker
-- (el campo "contrato" se imprime como EPS).
-- Parámetro @valor: número de ingreso (encounters.identifier) o número de documento.
-- Si es un documento con varios ingresos activos, devuelve los más recientes primero.
--
-- Oct-2026:
--  - Se agregan idPaciente, Edad y Telefono (los usa el autocompletado de
--    "Reportar cirugía" y la consulta individual de Solicitudes reportadas).
--  - El filtro "identifier = @valor OR documentNumber = @valor" obligaba a
--    recorrer encounters; ahora son dos búsquedas por índice unidas con UNION
--    (encounters.identifier y users.documentNumber).
--  - identifier es numérico: TRY_CAST evita el error de conversión cuando
--    se digita un documento alfanumérico (pasaporte, PPT).
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

WITH cand AS (
    SELECT e.idEncounter
    FROM encounters AS e
    WHERE e.identifier = TRY_CAST(@valor AS BIGINT)   -- identifier es numérico: un documento con letras no debe romper la consulta
      AND e.idUserCompany = 108240 AND e.idStatus = 2
    UNION
    SELECT e.idEncounter
    FROM users AS u
    INNER JOIN encounters AS e ON e.idUserPatient = u.idUser
    WHERE u.documentNumber = @valor AND e.idUserCompany = 108240 AND e.idStatus = 2
)
SELECT TOP 10
      e.identifier                                     AS NoIngreso
    , CONVERT(VARCHAR(16), e.dateStart, 120)           AS FechaHoraIngreso
    , u.documentNumber                                 AS NoDocumento
    , LTRIM(RTRIM(CONCAT_WS(' ', u.firstGivenName, u.secondGiveName,
                                 u.firstFamilyName, u.secondFamilyName))) AS Paciente
    , c.name                                           AS contrato
    , u.idUser                                         AS idPaciente
    , CAST(DATEDIFF(DAY, up.birthDate, GETDATE()) / 365.25 AS INT) AS Edad
    , up.telecom                                       AS Telefono
FROM cand
INNER JOIN encounters AS e       ON e.idEncounter = cand.idEncounter
INNER JOIN users AS u            ON e.idUserPatient = u.idUser
LEFT JOIN userPeople AS up       ON up.idUser = u.idUser
LEFT JOIN encounterRecords AS er ON e.idEncounter = er.idEncounter
LEFT JOIN contracts AS c         ON er.idPrincipalContract = c.idContract
ORDER BY e.dateStart DESC;
