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
├── components/    ui.tsx (Card, Modal, FilterBar…), CrudTable.tsx, Shell.tsx,
│                  ProgresoConsulta.tsx (reloj/termómetro de consultas), ReportarTabs.tsx
├── lib/           supabase.ts, auth.tsx, constantes.ts, data.ts, database.types.ts,
│                  gomedisys.ts (consultas a GoMedisys como trabajos)
├── pages/         Login, Dashboard, ReportarCirugia, ConsultaMasiva, Solicitudes, admin/…
sql/               paciente.sql, reporte_cirugias_optimizado_6.sql (T-SQL de GoMedisys)
scripts/gomedisys/ runner de las consultas (lo ejecuta GitHub Actions)
.github/workflows/ deploy.yml (Pages), gomedisys-consulta.yml (consultas bajo demanda)
supabase/
├── migrations/    esquema, RLS, catálogos, trabajos GoMedisys (0001-0017)
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

Integración con GoMedisys (oct-2026): autocompletado del paciente en el
reporte individual, consulta masiva de cirugías programadas con marcación
anti-duplicados entre usuarios, y consulta de las solicitudes reportadas.
Las consultas corren en GitHub Actions (el firewall de la réplica no acepta
conexiones desde Supabase); ver `docs/procx prompt.md` §15.

Configuración de la integración:

- Secrets de GitHub: `GOMEDISYS_HOST/PORT/DATABASE/USERNAME/PASSWORD`,
  `GM_RUNNER_KEY` (su sha256 va en `gomedisys_runner_config`),
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Secret de Supabase (Edge Functions): `GITHUB_DISPATCH_TOKEN` — token
  fine-grained solo para este repo con permiso "Actions: Read and write".
- Las credenciales locales (`db/`) nunca van al repo.

Pendiente: envío de SMS/WhatsApp.

Ver las adendas en `docs/procx prompt.md` (secciones 7 a 15) para el detalle
de las decisiones de diseño tomadas durante el desarrollo.
