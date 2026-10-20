/* =====================================================================
   Consulta masiva de cirugías programadas en GoMedisys — versión 6
   ---------------------------------------------------------------------
   Parámetros:
     @desde, @hasta  (date)  rango de fecha programada (ambos inclusive)
     @idPaciente     (int)   opcional. Si viene, ignora el rango y trae las
                             programaciones de ese paciente de los últimos
                             90 días en adelante (consulta individual).

   Por qué es más rápida que la v5 (medido sobre 8 días / 68 filas):
     v5: ~679.000 lecturas lógicas — 190 s con caché fría, 2-3 s en caliente.
     v6:  ~17.300 lecturas lógicas (39× menos) — 64 s en frío (~300 filas;
          la v5 tardó 239 s en un rango equivalente), 1,3 s en caliente.
     Detalle en docs/procx prompt.md §15.3.

   La v5 resolvía cada subconsulta fila por fila (OUTER APPLY correlacionado)
   y varias no tenían índice que las soportara:
     - surgReq recorría TODA la tabla de solicitudes (27k filas) por cada fila.
     - customAct hacía ~54.000 búsquedas (una por cada evento histórico del
       paciente) aunque solo es un respaldo de ordFecha.
     - ordFecha recorría todas las fórmulas del historial de cada paciente.
     - evt hacía un key lookup de la fecha por cada evento del paciente.
   La v6 primero aísla el conjunto pequeño de programaciones y pacientes
   (#prog / #pac), y después resuelve cada pieza UNA sola vez y en bloque,
   entrando por los índices existentes (la réplica es de solo lectura, no
   se pueden crear índices):
     #ev   eventos de los pacientes      → IX_EHREvents_idPatient (sin lookup)
     #sev  eventos quirúrgicos           → PK de EHREventSurgeryProcedures
     (las pistas LOOP/HASH JOIN fijan ese orden: sin ellas el optimizador
      llegó a recorrer EHREvents completa, 17 M de filas)
     #form órdenes de productos progr.   → índice por idProduct
     #cust actividad custom 708          → ix_..._ehrConfCustomElements
     #enc  ingresos de los pacientes     → IX_encounters_idUserPatient
     #sr   solicitudes de cirugía        → 1 sola lectura de la tabla

   Cambios funcionales respecto a la v5 (documentados):
     1. Se quitaron CirugiaRealizada / EHREventSurgery (columnas comentadas
        que igual se calculaban).
     2. FORMAT() → CONVERT(…, 103) (FORMAT usa CLR y es muy lento).
     3. Rango de fechas con >= / < (el BETWEEN + 86399999 ms redondeaba al
        día siguiente 00:00 en columnas datetime).
     4. NumeroIngreso: si la programación no trae idEncounter se usa el del
        evento quirúrgico y, si no, el último ingreso del paciente en la
        clínica anterior a la fecha programada (IngresoInferido = 1).
     5. Contrato/plan: también se resuelven por el ingreso de la
        programación (antes solo si la cirugía ya se había realizado).
     6. Fallback 708: toma el valor del evento más reciente en vez de MAX()
        de texto (MAX ordenaba fechas 'dd/MM/yyyy' alfabéticamente).
     7. Se agregan idProgramming / idPaciente / Quirofano / HoraProgramada,
        necesarios para la app (llave anti-duplicados y programación).
   ===================================================================== */
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;   -- réplica de lectura: sin bloqueos

DECLARE @ini DATETIME = CAST(@desde AS DATETIME);
DECLARE @fin DATETIME = DATEADD(DAY, 1, CAST(@hasta AS DATETIME));
DECLARE @pac INT      = @idPaciente;

/* 1. Programaciones del rango (o del paciente) ------------------------ */
SELECT ehrp.idProgramming, ehrp.idPatient, ehrp.idEncounter, ehrp.idPhysicalLocation,
       ehrp.dateStart, CAST(ehrp.dateStart AS DATE) AS dia,
       ehrp.isConfirmed, ehrp.isDelete, ehrp.isActive, ehrp.idReprogramming
INTO #prog
FROM EHRProgrammingSurgery AS ehrp
WHERE (@pac IS NULL AND ehrp.dateStart >= @ini AND ehrp.dateStart < @fin)
   OR (@pac IS NOT NULL AND ehrp.idPatient = @pac AND ehrp.dateStart >= DATEADD(DAY, -90, GETDATE()));

SELECT DISTINCT idPatient INTO #pac FROM #prog;
CREATE CLUSTERED INDEX ix ON #pac (idPatient);

/* 2. Eventos de esos pacientes (solo llaves, sin key lookup) ---------- */
SELECT e.idPatient, e.idEHREvent
INTO #ev
FROM EHREvents AS e
INNER JOIN #pac ON #pac.idPatient = e.idPatient;
CREATE CLUSTERED INDEX ix ON #ev (idEHREvent);

/* 3. Eventos quirúrgicos y el del día programado ----------------------
      Primero se filtran las llaves que ya tenemos contra la tabla pequeña
      EHREventSurgeryProcedures; solo después se busca la fecha en EHREvents
      por PK (LOOP JOIN: sin la pista, el optimizador recorría los 17 M de
      filas de EHREvents con un hash join). */
SELECT ev.idPatient, ev.idEHREvent
INTO #sev0
FROM #ev AS ev
WHERE EXISTS (SELECT 1 FROM EHREventSurgeryProcedures AS sp WHERE sp.idEHREvent = ev.idEHREvent);

SELECT s0.idPatient, e.idEHREvent, e.idEncounter, e.actionRecordedDate
INTO #sev
FROM #sev0 AS s0
INNER LOOP JOIN EHREvents AS e ON e.idEHREvent = s0.idEHREvent;

SELECT p.idProgramming, x.idEHREvent, x.idEncounter
INTO #evt
FROM #prog AS p
CROSS APPLY (
    SELECT TOP (1) s.idEHREvent, s.idEncounter
    FROM #sev AS s
    WHERE s.idPatient = p.idPatient
      AND s.actionRecordedDate >= p.dia
      AND s.actionRecordedDate <  DATEADD(DAY, 1, p.dia)
    ORDER BY s.actionRecordedDate DESC
) AS x;

/* 4. Órdenes (fórmulas) de los productos programados ------------------
      Se entra por el índice de idProduct (solo llaves), se cruza con los
      eventos del paciente y solo para las coincidencias se lee la fila
      completa (fecha y médico) por PK. */
SELECT DISTINCT pp.idProduct
INTO #prod
FROM EHRProgrammingSurgeryProducts AS pp
INNER JOIN #prog AS p ON p.idProgramming = pp.idProgramming;

SELECT ev.idPatient, f.idEHREvent, f.idProduct, f.idProductGeneric, f.idRecord
INTO #form0
FROM #prod AS pr
INNER LOOP JOIN EHREventFormulation AS f ON f.idProduct = pr.idProduct
INNER HASH JOIN #ev AS ev ON ev.idEHREvent = f.idEHREvent;

SELECT f0.idPatient, f.idEHREvent, f.idProduct, f.dateRecorded, f.idUserPractitioner
INTO #form
FROM #form0 AS f0
INNER LOOP JOIN EHREventFormulation AS f
        ON f.idEHREvent = f0.idEHREvent AND f.idProduct = f0.idProduct
       AND f.idProductGeneric = f0.idProductGeneric AND f.idRecord = f0.idRecord;

SELECT p.idProgramming, x.dateRecorded, x.idUserPractitioner, x.idEHREvent
INTO #ord
FROM #prog AS p
CROSS APPLY (
    SELECT TOP (1) fo.dateRecorded, fo.idUserPractitioner, fo.idEHREvent
    FROM #form AS fo
    WHERE fo.idPatient = p.idPatient
      AND fo.dateRecorded < p.dateStart
      AND fo.idProduct IN (SELECT pp.idProduct FROM EHRProgrammingSurgeryProducts AS pp
                           WHERE pp.idProgramming = p.idProgramming)
    ORDER BY fo.dateRecorded DESC
) AS x;

/* 5. Respaldo: actividad custom 708 (fecha y especialista que ordena) -
      Índice (idConfigActivity, idElement) → ~10 mil llaves; se cruzan con los
      eventos del paciente y solo las coincidencias leen valueText. */
SELECT ev.idPatient, ca.idEvent, ca.idConfigActivity, ca.idElement, ca.laterality
INTO #cust0
FROM EHREventCustomActivities AS ca
INNER HASH JOIN #ev AS ev ON ev.idEHREvent = ca.idEvent
WHERE ca.idConfigActivity = 708 AND ca.idElement IN (2, 3);

SELECT c0.idPatient, ca.idEvent, ca.idElement, ca.valueText
INTO #cust
FROM #cust0 AS c0
INNER LOOP JOIN EHREventCustomActivities AS ca
        ON ca.idEvent = c0.idEvent AND ca.idConfigActivity = c0.idConfigActivity
       AND ca.idElement = c0.idElement AND ca.laterality = c0.laterality;

/* 6. Ingresos de los pacientes en la clínica -------------------------- */
SELECT enc.idEncounter, enc.idUserPatient, enc.identifier, enc.dateStart
INTO #enc
FROM #pac
INNER LOOP JOIN encounters AS enc ON enc.idUserPatient = #pac.idPatient
WHERE enc.idUserCompany = 108240;
CREATE CLUSTERED INDEX ix ON #enc (idEncounter);

/* 7. Solicitudes de cirugía de esos ingresos (1 sola lectura) --------- */
SELECT enc.idUserPatient, sr.dateStartRequest, sr.equipmentRequirements, sr.annotations,
       sr.requestDate, sr.duration, sr.idPriority, sr.idProbableDestination
INTO #sr
FROM EHREventFormulationSurgeryRequest AS sr
INNER HASH JOIN #enc AS enc ON enc.idEncounter = sr.idEncounter;

/* 8. Resultado -------------------------------------------------------- */
SELECT
    p.idProgramming                                              AS idProgramming,
    p.idPatient                                                  AS idPaciente,
    uctd.name                                                    AS TipoDocumento,
    upa.documentNumber                                           AS DocumentoIdentificacion,
    CONCAT_WS(' ', upa.givenName, upa.familyName)                AS NombrePaciente,
    CAST(DATEDIFF(DAY, up.birthDate, GETDATE()) / 365.25 AS INT) AS [Edad(Anos)],
    ucas.name                                                    AS Genero,
    up.telecom                                                   AS Telefono1,
    ing.identifier                                               AS NumeroIngreso,
    ing.inferido                                                 AS IngresoInferido,
    cs.name                                                      AS ContratoIngresoCirugia,
    cp.name                                                      AS [Plan(Aseguradora)],
    diag.DiagnosticoPreoperatorio,
    CASE ordAct.idAction WHEN 409 THEN 'Intra-Hospitalaria' WHEN 410 THEN 'Ambulatoria' END AS TipoOrden,
    COALESCE(CONVERT(VARCHAR(10), o.dateRecorded, 103), cust.FechaOrdenamientoCustom)       AS FechaOrdenamiento,
    CONVERT(VARCHAR(10), p.dateStart, 103)                       AS FechaProgramada,
    CONVERT(VARCHAR(5),  p.dateStart, 108)                       AS HoraProgramada,
    CONVERT(VARCHAR(10), p.dateStart, 23)                        AS FechaProgramadaISO,
    pl.name                                                      AS Quirofano,
    progProd.ProcedimientosProgramados,
    COALESCE(NULLIF(CONCAT_WS(' ', upd.givenName, upd.familyName), ''), cust.EspecialistaOrdenaCustom)  AS EspecialistaOrdena,
    NULLIF(CONCAT_WS(' ', uopera.givenName, uopera.familyName), '') AS EspecialistaOpera,
    gs.name                                                      AS EspecialidadOpera,
    surgReq.equipmentRequirements                                AS [Descripción Boleta],
    surgReq.annotations                                          AS [Anotaciones Boleta],
    surgReq.requestDate                                          AS FechaSolicitudBoleta,
    surgReq.duration                                             AS DuracionBoleta,
    cgls.name                                                    AS PrioridadBoleta,
    cgld.name                                                    AS DestinoBoleta,
    CASE
        WHEN p.isConfirmed = 0 AND p.isDelete = 0 AND p.idReprogramming IS NULL THEN 'Activa'
        WHEN p.isActive = 1 AND p.isConfirmed = 1 AND p.isDelete = 1 THEN 'Cancelada'
        WHEN p.isActive = 1 AND p.isConfirmed = 1 THEN 'Confirmada'
        WHEN p.isActive = 1 AND p.isDelete = 1 THEN 'Cancelada'
        WHEN p.idReprogramming IS NOT NULL THEN 'Reprogramada'
    END                                                          AS Estado
FROM #prog AS p
INNER JOIN physicalLocations         AS pl   ON pl.idPhysicalLocation = p.idPhysicalLocation
INNER JOIN users                     AS upa  ON upa.idUser = p.idPatient
INNER JOIN userConfTypeDocuments     AS uctd ON uctd.idTypeDocument = upa.idDocumentType
INNER JOIN userPeople                AS up   ON up.idUser = upa.idUser
INNER JOIN userConfAdministrativeSex AS ucas ON ucas.idAdministrativeSex = up.idAdministrativeSex
LEFT  JOIN #evt                      AS evt  ON evt.idProgramming = p.idProgramming

/* Ingreso: el de la programación → el de la cirugía → el último del paciente */
OUTER APPLY (
    SELECT TOP (1) x.idEncounter, x.identifier, x.inferido
    FROM (
        SELECT e1.idEncounter, e1.identifier, 0 AS inferido, 1 AS prioridad, e1.dateStart
        FROM #enc AS e1 WHERE e1.idEncounter = p.idEncounter
        UNION ALL
        SELECT e2.idEncounter, e2.identifier, 0, 2, e2.dateStart
        FROM #enc AS e2 WHERE e2.idEncounter = evt.idEncounter
        UNION ALL
        SELECT e3.idEncounter, e3.identifier, 1, 3, e3.dateStart
        FROM #enc AS e3 WHERE e3.idUserPatient = p.idPatient AND e3.dateStart <= p.dateStart
    ) AS x
    ORDER BY x.prioridad, x.dateStart DESC
) AS ing

OUTER APPLY (
    SELECT TOP (1) r.idPrincipalContract, r.idPrincipalPlan
    FROM encounterRecords AS r
    WHERE r.idEncounter = COALESCE(evt.idEncounter, ing.idEncounter)
) AS ers
LEFT JOIN contracts        AS cs  ON cs.idContract = ers.idPrincipalContract
LEFT JOIN contractPlans    AS cp  ON cp.idPlan = ers.idPrincipalPlan AND cp.idContract = cs.idContract

LEFT JOIN EHREventSurgeryPractitioners AS ehrpract
       ON ehrpract.idEHREvent = evt.idEHREvent AND ehrpract.idOccupation = 2
LEFT JOIN users              AS uopera ON uopera.idUser  = ehrpract.idPractitioner
LEFT JOIN generalSpecialties AS gs     ON gs.idSpecialty = ehrpract.idSpeciality

LEFT JOIN #ord     AS o      ON o.idProgramming = p.idProgramming
LEFT JOIN users    AS upd    ON upd.idUser = o.idUserPractitioner
LEFT JOIN EHREvents AS ordAct ON ordAct.idEHREvent = o.idEHREvent

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

OUTER APPLY (
    SELECT STRING_AGG(CONCAT_WS('-', pr.legalCode, pr.name), CHAR(10))
           WITHIN GROUP (ORDER BY pr.legalCode) AS ProcedimientosProgramados
    FROM EHRProgrammingSurgeryProducts AS ehrpsp
    INNER JOIN products AS pr ON pr.idProduct = ehrpsp.idProduct
    WHERE ehrpsp.idProgramming = p.idProgramming
) AS progProd

/* Solicitud más reciente de los 30 días previos a la fecha programada */
OUTER APPLY (
    SELECT TOP (1) s.equipmentRequirements, s.annotations, s.requestDate, s.duration,
                   s.idPriority, s.idProbableDestination
    FROM #sr AS s
    WHERE s.idUserPatient = p.idPatient
      AND s.dateStartRequest <= p.dateStart
      AND s.dateStartRequest >= DATEADD(DAY, -30, p.dateStart)
    ORDER BY s.dateStartRequest DESC
) AS surgReq
LEFT JOIN EHRConfGlobalLists AS cgls ON cgls.idItem = surgReq.idPriority
LEFT JOIN EHRConfGlobalLists AS cgld ON cgld.idItem = surgReq.idProbableDestination

/* Respaldo 708: solo se usa si no hubo orden en EHREventFormulation */
OUTER APPLY (
    SELECT
        (SELECT TOP (1) c.valueText FROM #cust AS c
          WHERE c.idPatient = p.idPatient AND c.idElement = 3 ORDER BY c.idEvent DESC) AS FechaOrdenamientoCustom,
        (SELECT TOP (1) c.valueText FROM #cust AS c
          WHERE c.idPatient = p.idPatient AND c.idElement = 2 ORDER BY c.idEvent DESC) AS EspecialistaOrdenaCustom
    WHERE o.idProgramming IS NULL
) AS cust

ORDER BY p.dateStart, upa.documentNumber
OPTION (LOOP JOIN);   -- todo se resuelve desde las pocas filas de #prog, por llave

DROP TABLE #prog, #pac, #ev, #sev0, #sev, #evt, #prod, #form0, #form, #ord, #cust0, #cust, #enc, #sr;
