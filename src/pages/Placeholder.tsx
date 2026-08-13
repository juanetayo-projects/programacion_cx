import { PageHeader } from '../components/ui'
import { Construction } from 'lucide-react'

export default function Placeholder({ titulo }: { titulo: string }) {
  return (
    <div>
      <PageHeader titulo={titulo} />
      <div className="neu-card flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
        <Construction size={32} />
        <p className="text-sm">Este módulo está en construcción.</p>
      </div>
    </div>
  )
}
