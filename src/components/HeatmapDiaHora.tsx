import { Fragment, useMemo, useRef, useState } from 'react'

export interface HeatCol<T> { header: string; get: (r: T) => string | number }

interface Props<T> {
  registros: T[]
  getFecha: (r: T) => string | Date
  columnas: HeatCol<T>[]
  titulo?: string
  offsetHorasGMT?: number
  dark?: boolean
  maxFilasTooltip?: number
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const PAL_DARK = ['#0d2444', '#13335c', '#185FA5', '#2f7ccb', '#378ADD', '#6aa6e6', '#85B7EB']
const PAL_LIGHT = ['#EAF0FA', '#B5D4F4', '#85B7EB', '#378ADD', '#185FA5', '#0C447C', '#0D2D6B']

export default function HeatmapDiaHora<T>({ registros, getFecha, columnas, titulo, offsetHorasGMT = -5, dark = false, maxFilasTooltip = 8 }: Props<T>) {
  const cont = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ dow: number; hora: number; x: number; y: number } | null>(null)
  const PAL = dark ? PAL_DARK : PAL_LIGHT
  const horas = Array.from({ length: 24 }, (_, h) => h)

  const partes = (f: string | Date) => {
    const d = new Date(f)
    const co = new Date(d.getTime() + offsetHorasGMT * 3_600_000 + d.getTimezoneOffset() * 60_000)
    return { dow: (co.getDay() + 6) % 7, hora: co.getHours() }
  }

  const { matriz, max, porCelda } = useMemo(() => {
    const m: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    const pc = new Map<string, T[]>()
    registros.forEach((r) => {
      const p = partes(getFecha(r))
      m[p.dow][p.hora]++
      const k = p.dow + '-' + p.hora
      const arr = pc.get(k) ?? []; arr.push(r); pc.set(k, arr)
    })
    let mx = 0; m.forEach((row) => row.forEach((v) => { if (v > mx) mx = v }))
    return { matriz: m, max: mx, porCelda: pc }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros])

  const col = dark
    ? { label: '#85B7EB', dim: '#5b7aa6', tipText: '#cfe2f7', tipDark: '#04284f', tipBg: '#0E2548', tipBorder: 'rgba(133,183,235,0.25)', tipHead: '#B5D4F4' }
    : { label: '#16468E', dim: '#94a3b8', tipText: '#0C447C', tipDark: '#fff', tipBg: '#ffffff', tipBorder: 'rgba(13,45,107,0.15)', tipHead: '#0D2D6B' }

  function mostrar(dow: number, hora: number, el: HTMLElement) {
    if (!porCelda.get(dow + '-' + hora) || !cont.current) return
    const cb = cont.current.getBoundingClientRect(), eb = el.getBoundingClientRect()
    let x = eb.left - cb.left
    const y = eb.top - cb.top + eb.height + 6
    if (x + 300 > cb.width) x = Math.max(0, cb.width - 300)
    setHover({ dow, hora, x, y })
  }

  const regs = hover ? (porCelda.get(hover.dow + '-' + hover.hora) ?? []) : []

  return (
    <div ref={cont} style={{ position: 'relative' }}>
      {titulo && <div style={{ fontSize: 13, fontWeight: 500, color: col.tipHead, marginBottom: 10 }}>{titulo}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(24, 1fr)', gap: 3, alignItems: 'center' }}>
        <div />
        {horas.map((h) => <div key={h} style={{ textAlign: 'center', fontSize: 9, color: col.dim }}>{h % 2 === 0 ? h : ''}</div>)}
        {DIAS.map((d, di) => (
          <Fila key={d} dia={d} fila={matriz[di] ?? []} max={max} pal={PAL} col={col}
            onHover={(h, el) => mostrar(di, h, el)} onLeave={() => setHover(null)} />
        ))}
      </div>

      {hover && regs.length > 0 && (
        <div style={{ position: 'absolute', left: hover.x, top: hover.y, width: 300, zIndex: 30, background: col.tipBg, border: `1px solid ${col.tipBorder}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(13,45,107,0.35)', overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ padding: '7px 10px', fontSize: 12, fontWeight: 500, color: col.tipHead, borderBottom: `1px solid ${col.tipBorder}` }}>
            {DIAS[hover.dow]} · {String(hover.hora).padStart(2, '0')}:00 — {regs.length} registro(s)
          </div>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead><tr>{columnas.map((c) => <th key={c.header} style={{ textAlign: 'left', padding: '4px 8px', color: col.label, fontWeight: 500 }}>{c.header}</th>)}</tr></thead>
            <tbody>
              {regs.slice(0, maxFilasTooltip).map((r, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${col.tipBorder}` }}>
                  {columnas.map((c) => <td key={c.header} style={{ padding: '3px 8px', color: dark ? '#E6F1FB' : '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{String(c.get(r) ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {regs.length > maxFilasTooltip && <div style={{ padding: '4px 10px', fontSize: 10, color: col.dim }}>… y {regs.length - maxFilasTooltip} más</div>}
        </div>
      )}
    </div>
  )
}

function Fila({ dia, fila, max, pal, col, onHover, onLeave }: {
  dia: string; fila: number[]; max: number; pal: string[]
  col: { label: string; tipText: string; tipDark: string }
  onHover: (hora: number, el: HTMLElement) => void; onLeave: () => void
}) {
  const horas = Array.from({ length: 24 }, (_, h) => h)
  return (
    <Fragment>
      <div style={{ fontSize: 10, color: col.label, textAlign: 'right', paddingRight: 2 }}>{dia}</div>
      {horas.map((h) => {
        const v = fila[h] ?? 0
        const lvl = max > 0 ? Math.round((v / max) * (pal.length - 1)) : 0
        const pico = max > 0 && v >= 0.85 * max && v > 0
        return (
          <div key={h} className={pico ? 'cm-pulse' : ''}
            onMouseEnter={(e) => onHover(h, e.currentTarget)} onMouseLeave={onLeave}
            style={{ height: 18, borderRadius: 3, background: v > 0 ? pal[lvl] : pal[0], cursor: v > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: lvl >= 4 ? col.tipDark : col.tipText, fontWeight: 500 }}>
            {v > 0 && max <= 40 ? v : ''}
          </div>
        )
      })}
    </Fragment>
  )
}
