import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, XCircle, Database, Send, Server, Search } from 'lucide-react'

export type EstadoTramo = 'pendiente' | 'consultando' | 'listo' | 'error'
export type Tramo = { etiqueta: string; estado: EstadoTramo; filas?: number; ms?: number }

/** Estado del trabajo en gomedisys_trabajos (ver src/lib/gomedisys.ts) */
type EstadoTrabajo = 'pendiente' | 'despachado' | 'en_proceso' | 'listo' | 'error'

const ETAPAS = [
  { icono: Send, texto: 'Solicitud enviada' },
  { icono: Server, texto: 'Servidor de consulta' },
  { icono: Search, texto: 'Consultando GoMedisys' },
  { icono: CheckCircle2, texto: 'Resultados' },
]

const MENSAJES_ESPERA = [
  'Encendiendo el servidor de consulta seguro…',
  'Preparando la conexión con la réplica de GoMedisys…',
  'Esto suele tardar entre 20 y 60 segundos…',
]
const MENSAJES_CONSULTA = [
  'Leyendo programaciones quirúrgicas…',
  'Cruzando órdenes médicas y boletas…',
  'Resolviendo contratos y diagnósticos…',
  'Casi listo, organizando los resultados…',
]

function mmss(seg: number) {
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Overlay de progreso de las consultas a GoMedisys: cronómetro con anillo de
 * avance, termómetro animado, etapas del trabajo, tiempo transcurrido y estado
 * de cada tramo (día) consultado.
 */
export default function ProgresoConsulta({
  tramos, inicio, estado, titulo = 'Consultando GoMedisys',
}: { tramos: Tramo[]; inicio: number; estado: EstadoTrabajo; titulo?: string }) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const etapa = estado === 'pendiente' ? 0 : estado === 'despachado' ? 1 : estado === 'en_proceso' ? 2 : 3
  const total = tramos.length || 1
  const hechos = tramos.filter((t) => t.estado === 'listo' || t.estado === 'error').length
  const enCurso = tramos.filter((t) => t.estado === 'consultando').length
  const seg = Math.floor((ahora - inicio) / 1000)

  // 0-15 %: arranque del servidor (avanza lento con el tiempo, nunca se congela);
  // 15-100 %: días consultados (los que están en curso suman medio punto)
  const arranque = etapa === 0 ? Math.min(4, seg) : etapa === 1 ? Math.min(15, 4 + seg * 0.25) : 15
  const pct = etapa >= 3 ? 100 : Math.min(99, Math.round(etapa < 2 ? arranque : 15 + ((hechos + enCurso * 0.5) / total) * 85))
  const filas = tramos.reduce((s, t) => s + (t.filas ?? 0), 0)
  const mensajes = etapa < 2 ? MENSAJES_ESPERA : MENSAJES_CONSULTA
  const mensaje = mensajes[Math.floor(seg / 5) % mensajes.length]

  const R = 70
  const C = 2 * Math.PI * R

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071a40]/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D2D6B] via-[#123b80] to-[#16468E] text-white shadow-2xl">
        <div className="flex flex-col items-center gap-5 px-6 pb-5 pt-7 sm:flex-row sm:items-center">
          {/* Cronómetro */}
          <div className="relative h-44 w-44 shrink-0">
            <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
              <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="12" />
              <circle
                cx="90" cy="90" r={R} fill="none" stroke="url(#gradProgreso)" strokeWidth="12" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
              <defs>
                <linearGradient id="gradProgreso" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#5eead4" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
            </svg>
            {/* Esfera con marcas y manecilla girando */}
            <div className="absolute inset-[22px] rounded-full bg-white/10 shadow-inner">
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute left-1/2 top-1 h-2 w-0.5 rounded bg-white/40"
                  style={{ transform: `translateX(-50%) rotate(${i * 30}deg)`, transformOrigin: '50% 63px' }}
                />
              ))}
              <span className="reloj-manecilla absolute bottom-1/2 left-1/2 h-[46px] w-1 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]" />
              <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300" />
            </div>
            <div className="absolute inset-x-0 bottom-[34px] text-center text-2xl font-bold tabular-nums drop-shadow">{pct}%</div>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-200 sm:justify-start">
              <Database size={14} className="animate-pulse" /> {titulo}
            </div>
            <div className="mt-1 text-4xl font-bold tabular-nums">{mmss(seg)}</div>
            <div className="text-xs text-white/60">tiempo transcurrido</div>
            <p className="mt-3 min-h-[1.25rem] text-sm text-white/85">{mensaje}</p>
            {tramos.length > 0 && etapa >= 2 && (
              <p className="mt-1 text-xs text-white/60">
                {hechos} de {total} {total === 1 ? 'tramo' : 'días'} consultados · {filas} {filas === 1 ? 'registro' : 'registros'} encontrados
              </p>
            )}
          </div>
        </div>

        {/* Etapas */}
        <div className="grid grid-cols-4 gap-1 px-6 pb-4">
          {ETAPAS.map((e, i) => {
            const hecho = i < etapa
            const activo = i === etapa
            return (
              <div key={e.texto} className="flex flex-col items-center gap-1 text-center">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  hecho ? 'bg-emerald-400 text-[#0D2D6B]' : activo ? 'bg-amber-300 text-[#0D2D6B] cm-pulse' : 'bg-white/10 text-white/40'
                }`}>
                  {activo && i < 3 ? <Loader2 size={15} className="animate-spin" /> : <e.icono size={15} />}
                </span>
                <span className={`text-[10px] leading-tight ${hecho || activo ? 'text-white' : 'text-white/40'}`}>{e.texto}</span>
              </div>
            )
          })}
        </div>

        {/* Termómetro */}
        <div className="px-6">
          <div className="relative h-5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
            <div
              className="termometro-relleno h-full rounded-full"
              style={{ width: `${Math.max(pct, 4)}%`, transition: 'width 0.6s ease' }}
            />
          </div>
        </div>

        {/* Tramos (días) */}
        <div className="flex max-h-40 flex-wrap justify-center gap-1.5 overflow-y-auto px-6 pb-6 pt-4">
          {tramos.map((t) => (
            <span
              key={t.etiqueta}
              title={t.ms ? `${(t.ms / 1000).toFixed(1)} s` : undefined}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                t.estado === 'listo' ? 'bg-emerald-400/20 text-emerald-100'
                : t.estado === 'error' ? 'bg-red-400/25 text-red-100'
                : t.estado === 'consultando' ? 'bg-amber-300/25 text-amber-100 animate-pulse'
                : 'bg-white/10 text-white/50'
              }`}
            >
              {t.estado === 'listo' && <CheckCircle2 size={12} />}
              {t.estado === 'error' && <XCircle size={12} />}
              {t.estado === 'consultando' && <Loader2 size={12} className="animate-spin" />}
              {t.etiqueta}
              {t.estado === 'listo' && t.filas !== undefined && <span className="opacity-70">· {t.filas}</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
