// Runner de consultas a GoMedisys — se ejecuta en GitHub Actions
// (.github/workflows/gomedisys-consulta.yml), cuyos servidores sí tienen acceso
// a la réplica Azure de GoMedisys (Supabase no).
//
// Toma el trabajo TRABAJO_ID de la tabla gomedisys_trabajos, ejecuta la
// consulta y va reportando progreso y resultado con las funciones gm_runner_*.
//
// IMPORTANTE: el repositorio es público y los logs de Actions también. Aquí
// solo se imprimen conteos y tiempos, NUNCA datos de pacientes.
//
// Tipos de trabajo:
//   masiva   { desde, hasta }   sql/reporte_cirugias_optimizado_6.sql, un día por llamada (3 en paralelo)
//   paciente { valor }          sql/paciente.sql (autocompletado del reporte individual; activos y, si no hay,
//                               cualquier estado) + programaciones del paciente con la v6
//   detalle  { valor, documento } paciente.sql + programaciones del paciente (consulta de una solicitud reportada)
//   componente { componente, solicitud, ingreso }  componente de GoMedisys de un ingreso. Hoy solo 'boleta'
//                               (sql/boleta_quirurgica.sql); el trigger de la migración 0043 lo guarda en notas_gomedisys

import sql from 'mssql'
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const env = (n) => {
  const v = process.env[n]
  if (!v) throw new Error(`Falta la variable ${n}`)
  return v
}

const CLAVE = env('GM_RUNNER_KEY')
const TRABAJO_ID = Number(env('TRABAJO_ID'))
const CONCURRENCIA = 3

const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false } })

async function actualizar(progreso, extra = {}) {
  const { error } = await sb.rpc('gm_runner_actualizar', {
    p_clave: CLAVE, p_id: TRABAJO_ID, p_progreso: progreso,
    p_estado: extra.estado ?? null, p_resultado: extra.resultado ?? null, p_error: extra.error ?? null,
  })
  if (error) console.error('No se pudo reportar el avance:', error.message)
}

function diasEntre(desde, hasta) {
  const r = []
  const d = new Date(`${desde}T12:00:00Z`)
  const fin = new Date(`${hasta}T12:00:00Z`)
  while (d <= fin && r.length < 62) { r.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1) }
  return r
}
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// mssql devuelve Date para datetime; se serializan como texto ISO local
function limpiar(filas) {
  return filas.map((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 19) : v])))
}

const txt = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim())

/**
 * Filas de sql/boleta_quirurgica.sql (una por procedimiento, la boleta más
 * reciente primero) → la boleta vigente del ingreso: la más reciente no
 * suspendida (o la más reciente si todas están suspendidas).
 */
function armarBoleta(filas) {
  if (!filas.length) return null
  const base = filas.find((f) => f.Suspendido !== 'Si') ?? filas[0]
  const deLaBoleta = filas.filter((f) => f.idSurgeryRequest === base.idSurgeryRequest)
  const procedimientos = [...new Set(deLaBoleta
    .map((f) => [txt(f.CodigoProducto), txt(f.Procedimiento)].filter(Boolean).join(' - '))
    .filter(Boolean))]
  const boletas = new Set(filas.map((f) => f.idSurgeryRequest)).size
  const datos = {
    'Prioridad': txt(base.Prioridad),
    'Destino probable': txt(base.Destino),
    'Duración estimada (min)': base.DuracionMinutosCirugia ?? null,
    'Fecha de solicitud': txt(base.FechaSolicitudBoleta)?.replace('T', ' ').slice(0, 16) ?? null,
    'Identificación del profesional': txt(base.IdentificacionProfesional),
    'Procedimientos': procedimientos.join('\n') || null,
    'Observaciones': txt(base.Observaciones),
    'Servicio': txt(base.Servicio),
    'Ubicación': [txt(base.Ubicacion), txt(base.Cama) && `Cama ${txt(base.Cama)}`].filter(Boolean).join(' · ') || null,
    'Contrato': txt(base.Contrato),
    'Plan': txt(base.Plan),
    'Suspendida': base.Suspendido === 'Si' ? 'Sí' : 'No',
    'Fecha de suspensión': base.Suspendido === 'Si' ? txt(base.FechaSuspension)?.replace('T', ' ').slice(0, 16) ?? null : null,
    'Usuario que suspende': base.Suspendido === 'Si' ? txt(base.UsuarioSuspende) : null,
    'Boletas en el ingreso': boletas > 1 ? boletas : null,
    'Id boleta GoMedisys': base.idSurgeryRequest,
  }
  return {
    texto: [txt(base.DescripcionBoleta), txt(base.AnotacionesBoleta)].filter(Boolean).join('\n\n') || null,
    profesional: txt(base.ProfesionalQuesolicita),
    fecha_registro: txt(base.FechaSolicitudBoleta),
    duracion: base.DuracionMinutosCirugia ?? null,
    destino: txt(base.Destino),
    datos: Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== null && v !== '')),
  }
}

async function main() {
  const { data: tomados, error } = await sb.rpc('gm_runner_tomar', { p_clave: CLAVE, p_id: TRABAJO_ID })
  if (error) throw new Error(`No se pudo tomar el trabajo: ${error.message}`)
  const trabajo = tomados?.[0]
  if (!trabajo) { console.log(`Trabajo ${TRABAJO_ID} no está pendiente (ya lo tomó otro runner o no existe).`); return }
  console.log(`Trabajo ${TRABAJO_ID} · tipo ${trabajo.tipo}`)

  const [sqlPaciente, sqlMasiva, sqlBoleta] = await Promise.all([
    readFile(path.join(raiz, 'sql', 'paciente.sql'), 'utf8'),
    readFile(path.join(raiz, 'sql', 'reporte_cirugias_optimizado_6.sql'), 'utf8'),
    readFile(path.join(raiz, 'sql', 'boleta_quirurgica.sql'), 'utf8'),
  ])

  let progreso = [{ etiqueta: 'Conexión', estado: 'consultando' }]
  await actualizar(progreso)
  const t0 = Date.now()
  const pool = await new sql.ConnectionPool({
    server: env('GOMEDISYS_HOST').replace(/^\w+:\/\//, ''),
    port: Number(process.env.GOMEDISYS_PORT || 1433),
    database: env('GOMEDISYS_DATABASE'),
    user: env('GOMEDISYS_USERNAME'),
    password: env('GOMEDISYS_PASSWORD'),
    options: { encrypt: true, trustServerCertificate: false },
    connectionTimeout: 30000,
    requestTimeout: 300000,
    pool: { max: CONCURRENCIA, min: 0 },
  }).connect()
  console.log(`Conectado a GoMedisys en ${Date.now() - t0} ms`)

  const pacienteSegun = async (valor, soloActivos) =>
    (await pool.request().input('valor', sql.VarChar(30), String(valor).trim())
      .input('soloActivos', sql.Bit, soloActivos).query(sqlPaciente)).recordset
  // Primero ingresos activos; si no hay (ambulatorio con ingreso ya cerrado), cualquier ingreso
  const paciente = async (valor) => {
    const activos = await pacienteSegun(valor, 1)
    return activos.length ? activos : pacienteSegun(valor, 0)
  }
  const masiva = async (desde, hasta, idPaciente) =>
    (await pool.request().input('desde', sql.Date, desde).input('hasta', sql.Date, hasta)
      .input('idPaciente', sql.Int, idPaciente).query(sqlMasiva)).recordset

  try {
    if (trabajo.tipo === 'masiva') {
      const { desde, hasta } = trabajo.parametros
      if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) throw new Error('Rango de fechas inválido')
      const dias = diasEntre(desde, hasta)
      progreso = dias.map((d) => ({ etiqueta: ddmm(d), estado: 'pendiente' }))
      await actualizar(progreso)
      const filas = []
      const fallas = []
      let siguiente = 0
      // Se reporta el avance a medida que termina cada día; las llamadas se
      // encadenan para no pisar un progreso con otro más viejo
      let cola = Promise.resolve()
      const reportar = () => { const copia = progreso.map((p) => ({ ...p })); cola = cola.then(() => actualizar(copia)) }
      const trabajador = async () => {
        while (siguiente < dias.length) {
          const i = siguiente++
          progreso[i].estado = 'consultando'
          reportar()
          const t = Date.now()
          try {
            let rows
            try { rows = await masiva(dias[i], dias[i], null) }
            catch { rows = await masiva(dias[i], dias[i], null) } // un reintento
            filas.push(...limpiar(rows))
            Object.assign(progreso[i], { estado: 'listo', filas: rows.length, ms: Date.now() - t })
          } catch (e) {
            fallas.push(`${ddmm(dias[i])}: ${e.message}`)
            Object.assign(progreso[i], { estado: 'error', ms: Date.now() - t })
          }
          console.log(`  ${dias[i]} → ${progreso[i].estado} · ${progreso[i].filas ?? 0} filas · ${progreso[i].ms} ms`)
          reportar()
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, dias.length) }, trabajador))
      await cola
      const ms = Date.now() - t0
      console.log(`Total: ${filas.length} filas en ${ms} ms (${fallas.length} días con error)`)
      await actualizar(progreso, { estado: 'listo', resultado: { filas, fallas, ms } })
    } else if (trabajo.tipo === 'paciente') {
      // Paciente + sus programaciones quirúrgicas (para mostrar en el reporte
      // individual los mismos datos que trae la consulta masiva)
      progreso = [{ etiqueta: 'Paciente', estado: 'consultando' }, { etiqueta: 'Programación', estado: 'pendiente' }]
      await actualizar(progreso)
      const filas = limpiar(await paciente(trabajo.parametros.valor ?? ''))
      progreso[0] = { etiqueta: 'Paciente', estado: 'listo', filas: filas.length }
      progreso[1].estado = 'consultando'
      await actualizar(progreso)
      const idsPaciente = [...new Set(filas.map((f) => f.idPaciente))].slice(0, 3)
      const programaciones = []
      for (const id of idsPaciente) programaciones.push(...limpiar(await masiva(null, null, id)))
      progreso[1] = { etiqueta: 'Programación', estado: 'listo', filas: programaciones.length }
      console.log(`Paciente: ${filas.length} ingresos, ${programaciones.length} programaciones en ${Date.now() - t0} ms`)
      await actualizar(progreso, { estado: 'listo', resultado: { filas, programaciones } })
    } else if (trabajo.tipo === 'detalle') {
      progreso = [{ etiqueta: 'Paciente', estado: 'consultando' }, { etiqueta: 'Programación', estado: 'pendiente' }]
      await actualizar(progreso)
      const { valor, documento } = trabajo.parametros
      let pacientes = limpiar(await paciente(valor ?? ''))
      if (!pacientes.length && documento) pacientes = limpiar(await paciente(documento))
      progreso[0] = { etiqueta: 'Paciente', estado: 'listo', filas: pacientes.length }
      progreso[1].estado = 'consultando'
      await actualizar(progreso)
      const pac = pacientes.find((p) => String(p.NoIngreso) === String(valor)) ?? pacientes[0]
      const programaciones = pac ? limpiar(await masiva(null, null, pac.idPaciente)) : []
      progreso[1] = { etiqueta: 'Programación', estado: 'listo', filas: programaciones.length }
      console.log(`Detalle: ${pacientes.length} ingresos, ${programaciones.length} programaciones en ${Date.now() - t0} ms`)
      await actualizar(progreso, { estado: 'listo', resultado: { pacientes, programaciones } })
    } else if (trabajo.tipo === 'componente') {
      const { componente, ingreso } = trabajo.parametros
      if (componente !== 'boleta') throw new Error(`El componente ${componente} aún no tiene script de consulta`)
      if (!/^[\w-]{1,30}$/.test(String(ingreso ?? ''))) throw new Error('# de ingreso inválido')
      progreso = [{ etiqueta: 'Boleta Qx', estado: 'consultando' }]
      await actualizar(progreso)
      const t = Date.now()
      const filas = limpiar((await pool.request().input('ingreso', sql.VarChar(30), String(ingreso)).query(sqlBoleta)).recordset)
      const boleta = armarBoleta(filas)
      progreso[0] = { etiqueta: 'Boleta Qx', estado: 'listo', filas: filas.length, ms: Date.now() - t }
      console.log(`Boleta: ${filas.length} filas · ${boleta ? 'encontrada' : 'sin boleta'} en ${Date.now() - t0} ms`)
      await actualizar(progreso, { estado: 'listo', resultado: { boleta, filas: filas.length } })
    } else {
      throw new Error(`Tipo de trabajo desconocido: ${trabajo.tipo}`)
    }
  } finally {
    await pool.close()
  }
}

main().catch(async (e) => {
  console.error('Error:', e.message)
  await actualizar(null, { estado: 'error', error: e.message })
  process.exit(1)
})
