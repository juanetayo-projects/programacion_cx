import { useState } from 'react'
import { PageHeader } from '../../components/ui'
import { CrudTable } from '../../components/CrudTable'

const TABS = [
  { key: 'especialidades', label: 'Especialidades' },
  { key: 'eps', label: 'EPS' },
  { key: 'aseguradores', label: 'Aseguradores (MOS)' },
  { key: 'proveedores', label: 'Proveedores (MOS)' },
  { key: 'unidades', label: 'Unidades' },
  { key: 'quirofanos', label: 'Quirófanos' },
  { key: 'recomendaciones_cirugia', label: 'Recomendaciones' },
] as const

export default function Catalogos() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('especialidades')

  return (
    <div>
      <PageHeader titulo="Catálogos" subtitulo="Tablas maestras usadas en toda la aplicación" />

      <div className="mb-4 flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.key ? 'border-[#0D2D6B] text-[#0D2D6B]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'especialidades' && (
        <CrudTable
          tabla="especialidades"
          titulo="Especialidades quirúrgicas"
          columnas={[
            { key: 'nombre', label: 'Nombre', tipo: 'text', requerido: true },
            { key: 'activo', label: 'Activo', tipo: 'boolean' },
          ]}
        />
      )}
      {tab === 'eps' && (
        <CrudTable
          tabla="eps"
          titulo="EPS / Aseguradoras"
          columnas={[
            { key: 'nombre', label: 'Nombre', tipo: 'text', requerido: true },
            { key: 'activo', label: 'Activo', tipo: 'boolean' },
          ]}
        />
      )}
      {tab === 'aseguradores' && (
        <CrudTable
          tabla="aseguradores"
          titulo="Aseguradores — contacto para notificaciones MOS"
          columnas={[
            { key: 'nombre', label: 'Nombre asegurador', tipo: 'text', requerido: true },
            { key: 'contacto', label: 'Persona de contacto', tipo: 'text' },
            { key: 'telefono', label: 'Teléfono', tipo: 'text' },
            { key: 'email', label: 'Correo de contacto', tipo: 'text', requerido: true },
            { key: 'activo', label: 'Activo', tipo: 'boolean' },
          ]}
        />
      )}
      {tab === 'proveedores' && (
        <CrudTable
          tabla="proveedores"
          titulo="Proveedores de material de osteosíntesis"
          columnas={[
            { key: 'nombre', label: 'Nombre proveedor', tipo: 'text', requerido: true },
            { key: 'nit', label: 'NIT', tipo: 'text' },
            { key: 'direccion', label: 'Dirección', tipo: 'text' },
            { key: 'ciudad', label: 'Ciudad', tipo: 'text' },
            { key: 'telefono', label: 'Teléfono', tipo: 'text' },
            { key: 'contacto', label: 'Persona de contacto', tipo: 'text' },
            { key: 'email', label: 'Correo de contacto', tipo: 'text', requerido: true },
            { key: 'activo', label: 'Activo', tipo: 'boolean' },
          ]}
        />
      )}
      {tab === 'unidades' && (
        <CrudTable
          tabla="unidades"
          titulo="Unidades / Áreas"
          columnas={[
            { key: 'nombre', label: 'Nombre', tipo: 'text', requerido: true },
            { key: 'activo', label: 'Activo', tipo: 'boolean' },
          ]}
        />
      )}
      {tab === 'quirofanos' && (
        <CrudTable
          tabla="quirofanos"
          titulo="Quirófanos"
          columnas={[
            { key: 'numero', label: '#', tipo: 'number', requerido: true },
            { key: 'nombre', label: 'Nombre', tipo: 'text', requerido: true },
            { key: 'tipo', label: 'Tipo', tipo: 'select', opciones: ['general', 'especializado', 'ambulatorio'] },
            { key: 'area_m2', label: 'Área (m²)', tipo: 'number' },
            { key: 'ubicacion_fisica', label: 'Ubicación física', tipo: 'text' },
            { key: 'capacidad_personas', label: 'Capacidad', tipo: 'number' },
            { key: 'sistema_climatizacion', label: 'Climatización', tipo: 'text' },
            { key: 'responsable', label: 'Responsable', tipo: 'text' },
            { key: 'estado', label: 'Estado', tipo: 'select', opciones: ['activo', 'mantenimiento', 'inactivo'] },
            { key: 'color_calendario', label: 'Color en calendario', tipo: 'text' },
            { key: 'observaciones', label: 'Observaciones', tipo: 'textarea' },
          ]}
        />
      )}
      {tab === 'recomendaciones_cirugia' && (
        <CrudTable
          tabla="recomendaciones_cirugia"
          titulo="Recomendaciones pre-quirúrgicas por especialidad"
          columnas={[
            { key: 'especialidad_id', label: 'Especialidad', tipo: 'select', optionsTable: 'especialidades', optionLabel: 'nombre' },
            { key: 'titulo', label: 'Título', tipo: 'text', requerido: true },
            { key: 'contenido', label: 'Contenido', tipo: 'textarea', requerido: true },
            { key: 'activo', label: 'Activo', tipo: 'boolean' },
          ]}
        />
      )}
    </div>
  )
}
