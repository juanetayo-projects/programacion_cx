// Mensaje de WhatsApp para recordar al paciente una cita de seguimiento
// (pre o posquirúrgica) y pedir confirmación de asistencia o reprogramación.

export type DatosRecordatorio = {
  paciente: string | null
  tipo: string | null
  fechaCita: string // ISO
  procedimiento: string | null
}

const LINEA_ATENCION = '350 211 8899'
const EXTENSIONES = '2616 - 2619'

// Indicaciones generales por tipo de control (texto informativo, no reemplaza
// las indicaciones médicas individuales)
const INDICACIONES: [RegExp, string][] = [
  [/PUNTOS|SUTURA/, 'Asista con la herida limpia y seca. No retire el apósito antes de la cita.'],
  [/CURACI/, 'Traiga los insumos de curación que se le hayan entregado y mantenga la herida limpia y seca.'],
  [/SONDA/, 'Mantenga la bolsa recolectora por debajo del nivel de la vejiga y traiga su documento de identidad.'],
  [/DREN/, 'Traiga el registro de la cantidad drenada si se le indicó llevarlo.'],
  [/YESO|FÉRULA|FERULA/, 'No moje el yeso o la férula y asista con ropa cómoda y holgada.'],
  [/AGUJA|MATERIAL DE OSTEOS/, 'Asista con ropa cómoda y con las imágenes diagnósticas que tenga.'],
  [/RADIOL/, 'Traiga sus radiografías o estudios previos.'],
  [/PREANEST/, 'Traiga sus exámenes de laboratorio, la lista de medicamentos que toma y su documento de identidad.'],
  [/EXÁMENES|EXAMENES|LABORATORIO/, 'Si el examen lo requiere, asista en ayunas según la indicación recibida.'],
  [/TERAPIA|REHABILIT/, 'Asista con ropa deportiva y cómoda.'],
  [/PATOLOG/, 'Traiga su documento de identidad para la entrega del resultado.'],
]

function indicacion(tipo: string | null) {
  const t = (tipo ?? '').toUpperCase()
  return INDICACIONES.find(([re]) => re.test(t))?.[1] ?? 'Llegue 15 minutos antes con su documento de identidad.'
}

export function textoRecordatorioCita(d: DatosRecordatorio) {
  const f = new Date(d.fechaCita)
  const fecha = f.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const hora = f.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
  const nombre = (d.paciente ?? '').split(' ').filter(Boolean).slice(0, 2).join(' ').toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())
  return [
    `Hola${nombre ? ` ${nombre}` : ''}, le saludamos de la *Clínica CAC Santa Bárbara* - Programación de Cirugías.`,
    '',
    `Le recordamos su cita de *${(d.tipo ?? 'control').toLowerCase()}*:`,
    `📅 ${fecha.charAt(0).toUpperCase() + fecha.slice(1)}`,
    `🕗 ${hora}`,
    '📍 Clínica CAC Santa Bárbara',
    '',
    `Indicación: ${indicacion(d.tipo)}`,
    '',
    'Por favor confírmenos su asistencia respondiendo este mensaje:',
    '✅ *SI* para confirmar',
    '🔄 *REPROGRAMAR* si necesita otra fecha',
    '',
    `Línea de atención: ${LINEA_ATENCION} (ext. ${EXTENSIONES}).`,
  ].join('\n')
}
