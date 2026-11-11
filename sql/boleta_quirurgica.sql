-- Boleta quirúrgica de un ingreso (componente 'boleta', ver migración 0043).
-- Parámetro: @ingreso (VarChar) = encounters.identifier (# de ingreso del paciente).
-- Una fila por procedimiento de cada boleta del ingreso, la más reciente primero.
SELECT
  sr.idSurgeryRequest,
  IIF(sr.isCancel = 1, 'Si', 'No') AS Suspendido,
  sr.dateCancelRequest AS FechaSuspension,
  CONCAT_WS(' ', uc.givenName, uc.familyName) AS UsuarioSuspende,
  sr.equipmentRequirements AS DescripcionBoleta,
  sr.annotations AS AnotacionesBoleta,
  sr.observations AS Observaciones,
  sr.requestDate AS FechaSolicitudBoleta,
  sr.duration AS DuracionMinutosCirugia,
  CONCAT_WS(' ', pr.givenName, pr.familyName) AS ProfesionalQuesolicita,
  pr.documentNumber AS IdentificacionProfesional,
  CASE sr.idPriority
    WHEN 342 THEN 'Inmediato'
    WHEN 343 THEN 'Urgente'
    WHEN 344 THEN 'Normal'
    ELSE 'No definida'
  END AS Prioridad,
  cgl.name AS Destino,
  CONCAT_WS(' ', u.givenName, u.familyName) AS Paciente,
  g.name AS Sexo,
  up.birthDate AS FechaNacimiento,
  -- Cálculo preciso de edad considerando años bisiestos y cortes de mes
  CASE
  -- Menos de 1 mes: Mostrar en días
    WHEN DATEDIFF(MONTH, up.birthDate, GETDATE()) - CASE
      WHEN DAY(up.birthDate) > DAY(GETDATE()) THEN 1
      ELSE 0
    END = 0 THEN CAST(
      DATEDIFF(DAY, up.birthDate, GETDATE()) AS VARCHAR(10)
    ) + ' días'
    -- Menos de 1 año: Mostrar en meses
    WHEN DATEDIFF(YEAR, up.birthDate, GETDATE()) - CASE
      WHEN MONTH(up.birthDate) > MONTH(GETDATE())
      OR (
        MONTH(up.birthDate) = MONTH(GETDATE())
        AND DAY(up.birthDate) > DAY(GETDATE())
      ) THEN 1
      ELSE 0
    END = 0 THEN CAST(
      DATEDIFF(MONTH, up.birthDate, GETDATE()) - CASE
        WHEN DAY(up.birthDate) > DAY(GETDATE()) THEN 1
        ELSE 0
      END AS VARCHAR(10)
    ) + ' meses'
    -- 1 año o más: Mostrar en años
    ELSE CAST(
      DATEDIFF(YEAR, up.birthDate, GETDATE()) - CASE
        WHEN MONTH(up.birthDate) > MONTH(GETDATE())
        OR (
          MONTH(up.birthDate) = MONTH(GETDATE())
          AND DAY(up.birthDate) > DAY(GETDATE())
        ) THEN 1
        ELSE 0
      END AS VARCHAR(10)
    ) + ' años'
  END AS Edad,
  CONCAT_WS(' - ', up.telecom, up.phoneHome) AS Telefono,
  u.documentNumber AS IdentificacionPaciente,
  e.identifier AS Ingreso,
  p.name AS Procedimiento,
  p.legalCode AS CodigoProducto,
  hs.name AS Servicio,
  pl.name AS Ubicacion,
  plrb.code AS Cama,
  c.name AS Contrato,
  cp.name AS [Plan],
  ehr.idEHREvent
FROM
  encounters AS e
  INNER JOIN EHREventFormulationSurgeryRequest AS sr ON e.idEncounter = sr.idEncounter
  LEFT JOIN encounterRecords AS er ON e.idEncounter = er.idEncounter
  LEFT JOIN healthservices AS hs ON er.idActualService = hs.idHealthService
  LEFT JOIN physicalLocations AS pl ON er.idActualLocation = pl.idPhysicalLocation
  LEFT JOIN physicalLocationRooms AS plr ON er.idActualRoom = plr.idRoom
  LEFT JOIN physicalLocationRoomBeds AS plrb ON er.idActualBed = plrb.idBed
  LEFT JOIN EHRProgrammingSurgery AS epis ON sr.idProgramming = epis.idProgramming
  INNER JOIN EHREventFormulationSurgeryRequestProcedures AS efsrp ON sr.idSurgeryRequest = efsrp.idSurgeryRequest
  INNER JOIN EHREvents AS ehr ON efsrp.idEHREvent = ehr.idEHREvent
  LEFT JOIN products AS p ON efsrp.idProduct = p.idProduct
  INNER JOIN users AS u ON e.idUserPatient = u.idUser
  LEFT JOIN userPeople AS up ON up.idUser = u.idUser
  LEFT JOIN EHRConfGlobalLists AS cgl ON cgl.idItem = sr.idProbableDestination
  LEFT JOIN contracts AS c ON er.idPrincipalContract = c.idContract
  LEFT JOIN contractPlans AS cp ON er.idPrincipalPlan = cp.idPlan
  LEFT JOIN userConfAdministrativeSex AS g ON up.idAdministrativeSex = g.idAdministrativeSex
  LEFT JOIN users AS pr ON sr.idUserStartRequest = pr.idUser
  LEFT JOIN users AS uc ON sr.idUserCancelRequest = uc.idUser
WHERE
  e.identifier = @ingreso
  AND e.idStatus IN (2, 3)
ORDER BY
  sr.requestDate DESC;