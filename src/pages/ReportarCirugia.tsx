import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { PageHeader, Boton, Modal } from '../components/ui'
import { SUBESPECIALIDADES_ORTOPEDIA } from '../lib/constantes'
import { UploadCloud, CheckCircle2 } from 'lucide-react'

type Especialidad = { id: number; nombre: string }

export default function ReportarCirugia() {
  const { perfil, session } = useAuth()
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [numeroIngreso, setNumeroIngreso] = useState('')
  const [documento, setDocumento] = useState('')
  const [especialidadId, setEspecialidadId] = useState('')
  const [subespecialidad, setSubespecialidad] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [idCreado, setIdCreado] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('especialidades').select('id, nombre').eq('activo', true).order('nombre').then(({ data }) => {
      setEspecialidades((data ?? []) as Especialidad[])
    })
  }, [])

  const especialidadSeleccionada = especialidades.find((e) => String(e.id) === especialidadId)
  const esOrtopedia = especialidadSeleccionada?.nombre === 'Ortopedia'

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      let soporteUrl: string | null = null
      if (archivo && session) {
        const ruta = `${session.user.id}/${Date.now()}_${archivo.name}`
        const { error: upErr } = await supabase.storage.from('soportes').upload(ruta, archivo)
        if (upErr) throw upErr
        soporteUrl = ruta
      }

      const { data, error: insErr } = await supabase
        .from('solicitudes_cirugia')
        .insert({
          numero_ingreso: numeroIngreso,
          documento_paciente: documento,
          especialidad_id: Number(especialidadId),
          subespecialidad: esOrtopedia ? subespecialidad || null : null,
          soporte_url: soporteUrl,
          reportado_por: session!.user.id,
        })
        .select('id')
        .single()

      if (insErr) throw insErr
      setIdCreado(data.id)
      setNumeroIngreso(''); setDocumento(''); setEspecialidadId(''); setSubespecialidad(''); setArchivo(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader titulo="Reportar cirugía" subtitulo={`Reportado por: ${perfil?.nombre ?? ''}`} />

      <form onSubmit={enviar} className="neu-card space-y-4 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600"># de ingreso (GoMedisys)</label>
            <input
              required
              value={numeroIngreso}
              onChange={(e) => setNumeroIngreso(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0D2D6B] focus:outline-none focus:ring-2 focus:ring-[#0D2D6B]/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Documento del paciente</label>
            <input
              required
              inputMode="numeric"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0D2D6B] focus:outline-none focus:ring-2 focus:ring-[#0D2D6B]/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Especialidad de la cirugía</label>
          <select
            required
            value={especialidadId}
            onChange={(e) => setEspecialidadId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0D2D6B] focus:outline-none focus:ring-2 focus:ring-[#0D2D6B]/20"
          >
            <option value="">Seleccionar…</option>
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </div>

        {esOrtopedia && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Subespecialidad</label>
            <select
              value={subespecialidad}
              onChange={(e) => setSubespecialidad(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0D2D6B] focus:outline-none focus:ring-2 focus:ring-[#0D2D6B]/20"
            >
              <option value="">Seleccionar…</option>
              {SUBESPECIALIDADES_ORTOPEDIA.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Soporte (PDF o foto)</label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 hover:border-[#0D2D6B]">
            <UploadCloud size={18} />
            {archivo ? archivo.name : 'Seleccionar archivo…'}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <Boton type="submit" disabled={enviando} className="w-full justify-center">
          {enviando ? 'Enviando…' : 'Reportar cirugía'}
        </Boton>
      </form>

      <Modal open={idCreado !== null} onClose={() => setIdCreado(null)} titulo="Reporte enviado">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
          <p className="text-sm text-slate-600">Tu reporte se registró exitosamente con el ID:</p>
          <p className="text-2xl font-bold text-[#0D2D6B]">SC-{String(idCreado).padStart(6, '0')}</p>
          <Boton onClick={() => setIdCreado(null)}>Aceptar</Boton>
        </div>
      </Modal>
    </div>
  )
}
