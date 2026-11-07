import { useEffect } from 'react'

// Ajusta cada `.tabla-scroll` para que termine justo en el borde inferior de la
// ventana. Así lo que se desplaza es la tabla (con su fila de títulos fija) y no
// la página, que se llevaría los encabezados. Las tablas de un modal llevan
// `data-alto-fijo` y conservan su alto propio.
const MARGEN_INFERIOR = 24
const ALTO_MINIMO = 360

function ajustar() {
  const main = document.querySelector('main')
  if (!main) return
  const mr = main.getBoundingClientRect()
  document.querySelectorAll<HTMLElement>('.tabla-scroll:not([data-alto-fijo])').forEach((el) => {
    // Posición de la tabla medida desde el inicio del contenido, no desde lo que se ve ahora.
    const top = el.getBoundingClientRect().top - mr.top + main.scrollTop
    let alto = main.clientHeight - top - MARGEN_INFERIOR
    // Si algo grande queda encima (p. ej. la barra lateral en pantallas angostas), la
    // tabla usa casi toda la ventana: se baja una vez y luego se desplaza la tabla.
    if (alto < ALTO_MINIMO) alto = main.clientHeight - 80
    el.style.maxHeight = `${Math.max(ALTO_MINIMO, Math.round(alto))}px`
  })
}

export function useTablasAlAlto(clave: string) {
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    let frame = 0
    const programar = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(ajustar) }
    programar()
    // Solo cambios de estructura (cargó la tabla, apareció un aviso): el estilo que ponemos no lo dispara.
    const mo = new MutationObserver(programar)
    mo.observe(main, { childList: true, subtree: true })
    window.addEventListener('resize', programar)
    return () => { cancelAnimationFrame(frame); mo.disconnect(); window.removeEventListener('resize', programar) }
  }, [clave])
}
