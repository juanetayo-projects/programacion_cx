SELECT
    uctd.name                                                    AS TipoDocumento,
    upa.documentNumber                                           AS DocumentoIdentificacion,
    CONCAT_WS(' ', upa.givenName, upa.familyName)                AS NombrePaciente,
    CAST(DATEDIFF(DAY, up.birthDate, GETDATE()) / 365.25 AS INT) AS [Edad(Anos)],
    ucas.name                                                    AS Genero,
    up.telecom                                                   AS Telefono1,
    enc.identifier                                               AS NumeroIngreso,
    cs.name                                                      AS ContratoIngresoCirugia,
    cp.name                                                      AS [Plan(Aseguradora)],
    diag.DiagnosticoPreoperatorio,
       CASE ordFecha.idActionOrden
        WHEN 409 THEN 'Intra-Hospitalaria'
        WHEN 410 THEN 'Ambulatoria'
    END                                                          AS TipoOrden,
    COALESCE(ordFecha.FechaOrdenamiento, customAct.FechaOrdenamientoCustom)   AS FechaOrdenamiento,
    FORMAT(ehrp.dateStart, 'dd/MM/yyyy')                         AS FechaProgramada,
    progProd.ProcedimientosProgramados,
    COALESCE(ordFecha.EspecialistaOrdena, customAct.EspecialistaOrdenaCustom) AS EspecialistaOrdena,
    CONCAT_WS(' ', uopera.givenName, uopera.familyName)          AS EspecialistaOpera,
    gs.name                                                      AS EspecialidadOpera,
 --   pl.name                                                      AS Quirofano,
   -- cirug.CirugiaRealizada,
--    FORMAT(ehrsurg.dateStartSurgery, 'dd/MM/yyyy')               AS FechaInicioCirugia,
 --   FORMAT(ehrsurg.dateEndSurgery, 'dd/MM/yyyy')                 AS FechaFinCirugia,
    surgReq.equipmentRequirements                                AS [Descripción Boleta],
    surgReq.annotations                                          AS [Anotaciones Boleta],
    surgReq.requestDate                                          AS FechaSolicitudBoleta,
    surgReq.duration                                             AS DuracionBoleta,
    cgls.name                                                    AS PrioridadBoleta,
    surgReq.name                                                 AS DestinoBoleta,
    CASE
        WHEN ehrp.isConfirmed = 0 AND ehrp.isDelete = 0 AND ehrp.idReprogramming IS NULL THEN 'Activa'
        WHEN ehrp.isActive = 1 AND ehrp.isConfirmed = 1 AND ehrp.isDelete = 1 THEN 'Cancelada'
        WHEN ehrp.isActive = 1 AND ehrp.isConfirmed = 1 THEN 'Confirmada'
        WHEN ehrp.isActive = 1 AND ehrp.isDelete = 1 THEN 'Cancelada'
        WHEN ehrp.idReprogramming IS NOT NULL THEN 'Reprogramada'
    END                                                           AS Estado
FROM EHRProgrammingSurgery AS ehrp
INNER JOIN physicalLocations         AS pl   ON pl.idPhysicalLocation = ehrp.idPhysicalLocation
INNER JOIN users                     AS upa  ON upa.idUser = ehrp.idPatient
INNER JOIN userConfTypeDocuments     AS uctd ON uctd.idTypeDocument = upa.idDocumentType
INNER JOIN userPeople                AS up   ON up.idUser = upa.idUser
INNER JOIN userConfAdministrativeSex AS ucas ON ucas.idAdministrativeSex = up.idAdministrativeSex

/* -----------------------------------------------------------------
   Resuelve UNA sola vez el evento quirúrgico del día programado.
   Antes este mismo filtro (idPatient + fecha, join a
   EHREventSurgeryProcedures) se repetía en 5 subconsultas distintas.
   ----------------------------------------------------------------- */
OUTER APPLY (
    SELECT TOP (1)
        ehres.idEHREvent,
        ehres.idEncounter
    FROM EHREvents AS ehres
    INNER JOIN EHREventSurgeryProcedures AS ehresps
        ON ehresps.idEHREvent = ehres.idEHREvent
    WHERE ehres.idPatient = upa.idUser
      AND ehres.actionRecordedDate >= CAST(ehrp.dateStart AS DATE)
      AND ehres.actionRecordedDate <  DATEADD(DAY, 1, CAST(ehrp.dateStart AS DATE))
    ORDER BY ehres.actionRecordedDate DESC
) AS evt

LEFT JOIN encounterRecords AS ers ON ers.idEncounter = evt.idEncounter
LEFT JOIN contracts        AS cs  ON cs.idContract    = ers.idPrincipalContract
LEFT JOIN contractPlans    AS cp  ON cp.idPlan = ers.idPrincipalPlan AND cp.idContract = cs.idContract

/* encounters.identifier = número de ingreso. Se usa ehrp.idEncounter
   (propio de EHRProgrammingSurgery) en vez de evt.idEncounter, para
   que también funcione con cirugías programadas que aún no se han
   realizado. */
LEFT JOIN encounters AS enc ON enc.idEncounter = ehrp.idEncounter

LEFT JOIN EHREventSurgery AS ehrsurg ON ehrsurg.idEHREvent = evt.idEHREvent

LEFT JOIN EHREventSurgeryPractitioners AS ehrpract
       ON ehrpract.idEHREvent = evt.idEHREvent AND ehrpract.idOccupation = 2
LEFT JOIN users              AS uopera ON uopera.idUser     = ehrpract.idPractitioner
LEFT JOIN generalSpecialties AS gs     ON gs.idSpecialty    = ehrpract.idSpeciality

OUTER APPLY (
    SELECT STRING_AGG(CONCAT_WS('-', pc.legalCode, pc.name), CHAR(10))
           WITHIN GROUP (ORDER BY pc.legalCode) AS CirugiaRealizada
    FROM EHREventSurgeryProcedures AS ehresppc
    INNER JOIN products AS pc ON pc.idProduct = ehresppc.idProduct
    WHERE ehresppc.idEHREvent = evt.idEHREvent
) AS cirug

/* -----------------------------------------------------------------
   Diagnóstico preoperatorio: ahora filtrado directamente por el
   idEHREvent ya resuelto en "evt", en vez de repetir el join a
   EHREvents + condición de fecha.
   ----------------------------------------------------------------- */
OUTER APPLY (
    SELECT STRING_AGG(DiagnosticosPRE, CHAR(10)) AS DiagnosticoPreoperatorio
    FROM (
        SELECT DISTINCT CONCAT_WS('-', dpre.code, dpre.name) AS DiagnosticosPRE
        FROM EHREventSurgeryDiagnosis AS ehresdpre
        INNER JOIN diagnostics AS dpre ON dpre.idDiagnostic = ehresdpre.idDiagnosis
        WHERE ehresdpre.idEHREvent = evt.idEHREvent
          AND ehresdpre.indBeforeSurgery = 1
    ) AS SingleCell
) AS diag

/* -----------------------------------------------------------------
   Procedimientos programados: no depende de fecha, solo del
   idProgramming de la fila actual (igual que el original, sin cambios
   de fondo, solo se le agregó orden determinístico).
   ----------------------------------------------------------------- */
OUTER APPLY (
    SELECT STRING_AGG(CONCAT_WS('-', p.legalCode, p.name), CHAR(10))
           WITHIN GROUP (ORDER BY p.legalCode) AS ProcedimientosProgramados
    FROM EHRProgrammingSurgeryProducts AS ehrpsp
    INNER JOIN products AS p ON p.idProduct = ehrpsp.idProduct
    WHERE ehrpsp.idProgramming = ehrp.idProgramming
) AS progProd

/* -----------------------------------------------------------------
   Solicitud de cirugía (equipo requerido en sala + anotaciones):
   se relaciona por ehrp.idEncounter (propio de EHRProgrammingSurgery),
   NO por evt.idEncounter. evt solo se resuelve cuando la cirugía ya
   se ejecutó (existe fila en EHREvents); ehrp.idEncounter está
   disponible desde que se crea la programación, así que también
   trae resultados para cirugías aún no realizadas.
   TOP(1) por si llegara a existir más de una solicitud para el
   mismo encounter.
   ----------------------------------------------------------------- */
OUTER APPLY (
    SELECT TOP (1)
        sr.equipmentRequirements,
        sr.annotations,
        sr.requestDate,
        sr.duration,
        sr.idPriority, 
        sr.idProbableDestination,
        cgl.name
    FROM EHREventFormulationSurgeryRequest AS sr
    INNER JOIN encounters AS srenc
        ON srenc.idEncounter = sr.idEncounter
    LEFT JOIN EHRConfGlobalLists AS cgl
       ON cgl.idItem = sr.idProbableDestination
    WHERE srenc.idUserPatient = upa.idUser
      AND sr.dateStartRequest <= ehrp.dateStart          -- solicitada antes/el mismo día de la cirugía
      AND sr.dateStartRequest >= DATEADD(DAY, -30, ehrp.dateStart)  -- ventana de seguridad, ajústala
    ORDER BY sr.dateStartRequest DESC
) AS surgReq

  LEFT JOIN EHRConfGlobalLists AS cgls
       ON cgls.idItem = surgReq.idPriority



/* -----------------------------------------------------------------
   Fecha de ordenamiento + especialista que ordena: antes eran 2
   subconsultas separadas contra EHREventFormulation con el mismo
   WHERE. Ahora es 1 sola que trae ambas columnas.
   ----------------------------------------------------------------- */
OUTER APPLY (
    SELECT TOP (1)
        FORMAT(ehrefd.dateRecorded, 'dd/MM/yyyy')     AS FechaOrdenamiento,
        CONCAT_WS(' ', upd.givenName, upd.familyName) AS EspecialistaOrdena,
        ehred.idAction                                AS idActionOrden
    FROM EHREventFormulation AS ehrefd
    INNER JOIN EHREvents AS ehred ON ehred.idEHREvent = ehrefd.idEHREvent
    INNER JOIN users     AS upd  ON upd.idUser = ehrefd.idUserPractitioner
    WHERE ehred.idPatient = upa.idUser
      AND ehrefd.dateRecorded < ehrp.dateStart
      AND ehrefd.idProduct IN (
            SELECT ehrpspd.idProduct
            FROM EHRProgrammingSurgeryProducts AS ehrpspd
            WHERE ehrpspd.idProgramming = ehrp.idProgramming
      )
    ORDER BY ehrefd.dateRecorded DESC
) AS ordFecha

/* -----------------------------------------------------------------
   Fallback sobre actividad custom 708: antes eran 2 subconsultas
   casi idénticas (una filtrando idElement=3, otra idElement=2).
   Ahora es 1 sola con agregación condicional.
   ----------------------------------------------------------------- */
OUTER APPLY (
    SELECT
        MAX(CASE WHEN ehreca.idElement = 3 THEN ehreca.valueText END) AS FechaOrdenamientoCustom,
        MAX(CASE WHEN ehreca.idElement = 2 THEN ehreca.valueText END) AS EspecialistaOrdenaCustom
    FROM EHREventCustomActivities AS ehreca
    INNER JOIN EHREvents AS ehret ON ehret.idEHREvent = ehreca.idEvent
    WHERE ehreca.idConfigActivity = 708
      AND ehreca.idElement IN (2, 3)
      AND ehret.idPatient = upa.idUser
) AS customAct

WHERE ehrp.dateStart BETWEEN '2026-09-29' AND DATEADD(MILLISECOND, 86399999, '2026-09-29')
ORDER BY ehrp.dateStart, upa.documentNumber;