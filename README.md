# Programación de Cirugías — CAC Santa Bárbara

Aplicación para la gestión del ciclo completo de una cirugía, desde la
consulta en GoMedisys hasta el seguimiento postquirúrgico:

1. **GoMedisys** — consulta masiva de cirugías programadas (administrador y programación).
2. **Gestión Programación Cx** — validación, programación en quirófano,
   notificación al paciente, cierre de la cirugía realizada.
3. **Gestión clínica** — **autorización del asegurador** (requisito para todo
   el proceso), cargo del cobro de los materiales y notas.
4. **Gestión MOS** — materiales de osteosíntesis: asegurador → proveedores.
5. **Esterilización** — recepción del material por remisión y acta.
6. **Gestión postquirúrgica** — controles, citas y recordatorios por WhatsApp.
7. **Dashboard** — indicadores por fase, mapa de calor (ocupación de quirófanos,
   agenda, actividad y pendientes por fase) y animaciones, con detalle al clic.

## Stack

React 19 + Vite + TypeScript + Tailwind CSS v4, Supabase (Postgres + Auth +
RLS + Edge Functions + Storage), Resend (correo), Recharts, ExcelJS/pdfmake,
despliegue en GitHub Pages (HashRouter).

## Estructura

```
src/
├── components/    ui.tsx, Shell.tsx, PanelLateral.tsx, CrudTable.tsx,
│                  AvanceMos.tsx (5 hitos MOS), Autorizacion.tsx (autorización del asegurador),
│                  CierreCirugia.tsx (registro de cirugía realizada), NotasSeguimiento.tsx,
│                  RecordatorioCita.tsx (WhatsApp), EvidenciasMos.tsx, IndicadoresSeguimiento.tsx,
│                  FiltroEtapaMos.tsx, dashboard/Graficos.tsx (gauges, anillos, popover al clic),
│                  dashboard/MapaCalor.tsx (mapa de calor multivista con movimiento)
├── lib/           supabase.ts, auth.tsx, constantes.ts, autorizacion.ts, filtrosMos.ts,
│                  mensajesNotificacion.ts, mensajesSeguimiento.ts, gomedisys.ts
├── pages/         Dashboard, ReportarCirugia, ConsultaMasiva, Solicitudes (Gestión Programación Cx),
│                  CirugiasRealizadas, GestionClinica, Mos, Esterilizacion, Prequirurgico
│                  (Gestión postquirúrgica), Quirofanos, Calor, Reportes, Logs, admin/…
sql/               consultas T-SQL de GoMedisys
scripts/gomedisys/ runner de las consultas (GitHub Actions)
supabase/
├── migrations/    0001-0039 (esquema, RLS, MOS, recepción, notas, autorización…)
└── functions/     admin-usuarios, consulta-gomedisys, notificar-paciente,
                   notificar-asegurador, notificar-proveedor, registrar-recepcion
docs/
├── procx prompt.md            especificación funcional + adendas de decisiones (§1-§22)
└── PROMPT_FLUJO_INFOGRAFIA.md prompt paso a paso para diseñar la infografía del flujo
```

## Roles

Administrador · Programador de cirugía · Médico cirujano · Visualizador ·
Gestor MOS · Esterilización · Gestor clínico. Los módulos por rol se
configuran en Administración → Roles y permisos.

## Desarrollo local

```bash
npm install
npm run dev
```

Requiere `.env.local` (no versionado) con `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY`.

## Configuración

- Secrets de GitHub: `GOMEDISYS_HOST/PORT/DATABASE/USERNAME/PASSWORD`,
  `GM_RUNNER_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Secrets de Supabase (Edge Functions): `RESEND_API_KEY` (correo, dominio
  `cacsantabarbara.co`), `GITHUB_DISPATCH_TOKEN` (consultas a GoMedisys).
- Datos clínicos (Ley 1581): RLS por rol en todas las tablas; buckets
  privados `soportes`, `mos` y `notas`; credenciales locales (`db/`) fuera de git.

## Reglas de negocio validadas en la base de datos

- Sin **autorización vigente del asegurador** no se programa, reprograma ni
  registra como realizada la cirugía, ni se inicia MOS.
- Sin **cierre de la cirugía** (inicio/fin reales, cirujano, procedimiento,
  destino) no se registran seguimientos posquirúrgicos.
- Entre una **consulta masiva** a GoMedisys y la siguiente deben pasar
  `consulta_masiva_config.intervalo_minutos` (15 por defecto, global para
  todos los usuarios; las consultas fallidas no cuentan). Lo hace cumplir la
  Edge Function `consulta-gomedisys`; mientras tanto la app muestra el
  resultado de la última consulta (`masiva_resultado()`) y las fechas filtran
  dentro del rango consultado. El administrador puede forzar una consulta.
- **Componentes de GoMedisys** (migración 0038, `componentes_gomedisys` /
  `notas_gomedisys`): Boleta quirúrgica (Gestión Programación Cx) y Notas
  administrativas MOS, GestionClinica y PosQx. Cada módulo muestra Sí/No; con
  «No» bloquea el avance (si `exige`) y pide al usuario que el médico lo
  diligencie en GoMedisys; el botón «Traer datos de GoMedisys» se habilita
  con `script_disponible` (script en desarrollo). Las notas reemplazan lo
  registrado en la app; en Gestión MOS y Gestión clínica la nota es
  informativa (su gestión y notificaciones siguen en la app, 0039); sin la
  nota PosQx el seguimiento queda en solo lectura. Se administra en
  Catálogos → Componentes GoMedisys.
- **Autorización del asegurador por correo** (0039, Edge Function
  `notificar-autorizacion`): al registrar la gestión "Solicitada" o
  "Devuelta" (o luego desde el historial) se envía la solicitud al
  asegurador con los soportes adjuntos; la evidencia queda en
  `autorizacion_correos` y en el historial.
- **Programar / reprogramar** exige además la Boleta quirúrgica y, si
  GoMedisys marca `requiere_mos`, el material recibido (hito 5). La
  programación de quirófanos pasará a leerse de GoMedisys (script en construcción).
- Las notificaciones (asegurador, proveedor) no se modifican ni se reenvían;
  notas, correos y actas son evidencia inmutable para auditoría.
