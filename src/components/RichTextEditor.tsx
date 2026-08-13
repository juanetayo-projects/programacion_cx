import { useEffect, useRef } from 'react'
import { Bold, Italic, Underline, List, ListOrdered } from 'lucide-react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
}

// Editor liviano basado en contentEditable + document.execCommand — evita sumar
// una librería pesada solo para negrita/cursiva/listas en un campo de correo interno.
export default function RichTextEditor({ value, onChange, placeholder, minHeight = '140px' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const ultimoValor = useRef(value)

  useEffect(() => {
    if (ref.current && value !== ultimoValor.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = value
      ultimoValor.current = value
    }
  }, [value])

  function manejarInput() {
    const html = ref.current?.innerHTML ?? ''
    ultimoValor.current = html
    onChange(html)
  }

  function ejecutar(cmd: string) {
    document.execCommand(cmd)
    ref.current?.focus()
    manejarInput()
  }

  const claseBoton = 'rounded p-1.5 text-slate-500 transition hover:bg-white hover:text-[#0D2D6B]'

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 focus-within:border-[#0D2D6B] focus-within:ring-2 focus-within:ring-[#0D2D6B]/20">
      <div className="flex gap-0.5 border-b border-slate-200 bg-slate-50 p-1">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar('bold')} className={claseBoton} title="Negrita"><Bold size={14} /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar('italic')} className={claseBoton} title="Cursiva"><Italic size={14} /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar('underline')} className={claseBoton} title="Subrayado"><Underline size={14} /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar('insertUnorderedList')} className={claseBoton} title="Lista"><List size={14} /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar('insertOrderedList')} className={claseBoton} title="Lista numerada"><ListOrdered size={14} /></button>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={manejarInput}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className="max-h-72 overflow-y-auto px-3 py-2 text-sm text-slate-700 outline-none [&_h3]:mt-2 [&_h3]:font-semibold [&_h3]:text-[#0D2D6B] [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  )
}
