# Programación de Cirugías — CAC Santa Bárbara

Aplicación para la gestión del ciclo completo de programación de cirugías:
reporte del médico cirujano, gestión de solicitudes, consulta en vivo a
GoMedisys, programación en quirófano, notificación al paciente y reportes.

## Stack

React 19 + Vite + TypeScript + Tailwind CSS v4, Supabase (Postgres + Auth +
RLS + Edge Functions), despliegue en GitHub Pages.

## Estructura

```
src/
├── components/    ui.tsx (Card, Modal, FilterBar…), CrudTable.tsx, Shell.tsx
├── lib/           supabase.ts, auth.tsx, constantes.ts, data.ts, database.types.ts
├── pages/         Login, Dashboard, ReportarCirugia, Solicitudes, admin/…
supabase/
├── migrations/    esquema, RLS, catálogos (0001-0005, 0007)
└── functions/     admin-usuarios, consulta-gomedisys, notificar-paciente
docs/
└── procx prompt.md   especificación funcional + adenda de decisiones
```

## Desarrollo local

```bash
npm install
npm run dev
```

Requiere `.env.local` (no versionado) con:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Estado del proyecto

Módulos funcionales: autenticación y roles, reporte de cirugía, gestión de
solicitudes (ver/editar/programar/notificar/reprogramar/cancelar), dashboard,
administración de usuarios y catálogos, 94 registros históricos migrados
desde el tracker manual en Excel.

Pendiente: integración en vivo con GoMedisys (falta el query T-SQL validado
y las credenciales), mapa de quirófanos (calendario visual), mapa de calor de
ocupación, reportes con exportación Excel/PDF, envío de SMS/WhatsApp.

Ver la adenda en `docs/procx prompt.md` (sección 7) para el detalle de las
decisiones de diseño tomadas durante el desarrollo.
