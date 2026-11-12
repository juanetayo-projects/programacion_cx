import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/** Arrastre de una ventana flotante, limitado para que el título nunca salga de la pantalla */
export function useArrastre() {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [arrastrando, setArrastrando] = useState(false)
  const reiniciar = useCallback(() => setPos({ x: 0, y: 0 }), [])
  const iniciarArrastre = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return
    const el = ref.current
    if (!el) return
    e.preventDefault()
    const inicio = { x: e.clientX, y: e.clientY }
    let base = { x: 0, y: 0 }
    setPos((p) => { base = p; return p })
    const caja = el.getBoundingClientRect()
    setArrastrando(true)
    const mover = (ev: PointerEvent) => {
      let dx = ev.clientX - inicio.x
      let dy = ev.clientY - inicio.y
      // Mantiene al menos 80 px de la ventana y su barra de título visibles
      dx = Math.min(Math.max(dx, 80 - caja.right), window.innerWidth - 80 - caja.left)
      dy = Math.min(Math.max(dy, -caja.top), window.innerHeight - 48 - caja.top)
      setPos({ x: base.x + dx, y: base.y + dy })
    }
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      // El clic que cierra el modal al soltar fuera se ignora
      setTimeout(() => setArrastrando(false), 0)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }, [])
  return { pos, ref, iniciarArrastre, reiniciar, arrastrando }
}
