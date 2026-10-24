# Prompt para diseñar la infografía del flujo — Programación de Cirugías (CAC Santa Bárbara)

Este documento tiene dos partes:

- **Parte A — Prompt listo para pegar en ChatGPT** (generación de la infografía).
- **Parte B — Modelo completo del proceso** (paso a paso, roles, estados, reglas,
  evidencias e indicadores). Pégalo también si quieres que ChatGPT tenga todo el
  contexto, o úsalo como base de documentación.

---

## Parte A — Prompt listo para pegar

> Actúa como diseñador(a) de información experto en salud. Diseña una
> **infografía vertical (formato 1080 × 2400 px, también útil en A3)** en
> **español** que explique el **flujo completo de gestión de una cirugía** en la
> Clínica CAC Santa Bárbara (Colombia), según el modelo que te doy abajo.
>
> **Estilo visual**
> - Paleta institucional: azul oscuro **#0D2D6B** (títulos, conectores), azul
>   **#16468E** (acentos), fondo gris azulado muy claro **#E4E9F3**, tarjetas
>   blancas con sombra suave y esquinas redondeadas.
> - Un color por fase: GoMedisys **#0EA5E9** · Programación Cx **#0D2D6B** ·
>   Autorización **#10B981** · MOS **#6366F1** · Gestión clínica **#009688** ·
>   Esterilización **#4CAF50** · Cirugía **#16468E** · PostQx **#8B5CF6**.
>   Rojo **#E11D48** solo para bloqueos y alertas.
> - Íconos lineales, estilo médico y limpio (tipo Lucide/Material): base de
>   datos, portapapeles, escudo con check, calendario con reloj, hueso, corazón
>   con pulso, caja con check, estetoscopio, calendario con check, camión,
>   sobre, WhatsApp, documento/acta, candado.
> - Tipografía sans-serif moderna; títulos en negrita; poco texto por bloque
>   (máximo 2 líneas por paso).
>
> **Estructura**
> 1. **Encabezado**: "Ruta de gestión quirúrgica — Programación de Cirugías ·
>    Clínica CAC Santa Bárbara", con la frase "Del reporte a la recuperación del
>    paciente".
> 2. **Línea de tiempo vertical con 8 fases numeradas**, conectadas por una
>    flecha continua. Cada fase es una tarjeta con su ícono, color, el **rol
>    responsable** (chip) y 2–3 viñetas de lo que ocurre:
>    1. Ingreso y consulta en GoMedisys
>    2. Gestión Programación Cx (incluye el tipo de orden: Intra-hospitalaria /
>       Ambulatoria)
>    3. Autorización del asegurador ← marcar como **PUERTA OBLIGATORIA**
>       (candado): "Sin autorización vigente no se programa ni se inicia ningún
>       proceso"
>    4. Gestión MOS (material de osteosíntesis), con sus 5 hitos
>    5. Gestión clínica (cargo del cobro y notas)
>    6. Esterilización (recepción del material y acta)
>    7. Cirugía realizada y cierre ← segunda **PUERTA OBLIGATORIA**: "Sin cierre
>       de la cirugía no hay seguimiento posquirúrgico"
>    8. Gestión postquirúrgica (controles, citas, recordatorios por WhatsApp)
> 3. Bajo la fase 4, un **mini-diagrama de los 5 hitos MOS** en círculos
>    conectados: Asegurador notificado → Aprobación del asegurador → Proveedor
>    notificado → Proveedor confirma → Material en la clínica.
> 4. **Franja de notificaciones** (íconos de sobre/WhatsApp): correo al
>    asegurador (con historia clínica y boleta en PDF), correo a cada proveedor,
>    aviso a Programación cuando llega todo el material, notificación al
>    paciente de su cirugía y recordatorios de citas por WhatsApp.
> 5. **Recuadro "Evidencia para auditoría"**: copia de cada correo, actas de
>    recibo, notas con fecha/hora/usuario y adjuntos, historial de
>    autorizaciones; nada se modifica ni se borra.
> 6. **Pie con el tablero de indicadores**: 6 mini-tarjetas — % autorización
>    vigente, tiempo reporte → cirugía, ciclo MOS, % material recibido a
>    tiempo, % asistencia a controles PostQx, alertas activas.
> 7. **Leyenda de roles** con sus colores: Médico cirujano, Programador de
>    cirugía, Gestor clínico, Gestor MOS, Esterilización, Administrador,
>    Visualizador.
>
> Usa exactamente los nombres de fases, roles y estados del modelo. No
> inventes datos de pacientes. Entrega la imagen y, aparte, una versión en
> texto de los bloques para poder editarla.

*(Pega a continuación la Parte B si quieres más precisión.)*

---

## Parte B — Modelo completo del proceso (paso a paso)

### Contexto
Aplicación web de la Clínica CAC Santa Bárbara (Colombia) para gestionar el
ciclo completo de una cirugía. Integra GoMedisys (historia clínica / HIS),
Supabase (base de datos con seguridad por rol), correo institucional (Resend,
`notificaciones@cacsantabarbara.co`) y WhatsApp Web (recordatorios manuales).
Los datos clínicos están protegidos por la Ley 1581 de 2012.

### Roles
| Rol | Qué hace |
|---|---|
| **Médico cirujano** | Reporta la cirugía (n.º de ingreso, documento, especialidad, soporte). |
| **Programador de cirugía** | Consulta GoMedisys, programa (fecha, hora, quirófano), notifica al paciente, registra la cirugía realizada y hace seguimiento postquirúrgico. |
| **Gestor clínico** | Gestiona la **autorización del asegurador**, asigna a quién se carga el cobro de cada ítem de material, registra notas y apoya el seguimiento postquirúrgico. |
| **Gestor MOS** | Gestiona el material de osteosíntesis con el asegurador y los proveedores. |
| **Esterilización** | Recibe el material por remisión y firma el acta de recibo. |
| **Administrador** | Configura usuarios, roles, catálogos y tiene acceso total. |
| **Visualizador** | Consulta indicadores y reportes. |

### Fase 1 — Ingreso y consulta en GoMedisys
1. El médico **reporta** la cirugía desde el celular, o Programación hace una
   **consulta masiva** de las cirugías programadas en GoMedisys por rango de
   fechas.
2. La app consulta GoMedisys y trae: paciente, edad, EPS/contrato, teléfono,
   procedimiento, diagnóstico, especialista, **boleta quirúrgica** (equipos y
   material requeridos), **tipo de orden** (Intra-hospitalaria / Ambulatoria).
3. Estados: *Reportado* → *Procesado* (validado en GoMedisys) o *Consulta
   fallida*. Un mismo paciente no se toma dos veces (anti-duplicados entre
   usuarios).

### Fase 2 — Gestión Programación Cx
1. Lista de solicitudes con filtros (estado, especialidad, fechas, quirófano,
   etapa MOS) e indicadores por paciente: **AUT** (autorización), **MOS**,
   **ESTERIL.**, **CLÍNICA**, **POSTQX**.
2. **Programar**: fecha, hora, quirófano y duración, con tablero de ocupación
   de quirófanos (evita cruces). Estados: *Programado* → *Notificado* →
   (*Aplazado* / *Suspendido* / *Cancelado*).
3. **Notificar al paciente** por correo (plantilla con fecha, hora y
   recomendaciones por especialidad), WhatsApp y SMS.
4. **Requiere autorización vigente** (fase 3) para programar o reprogramar.

### Fase 3 — Autorización del asegurador (PUERTA OBLIGATORIA · Gestor clínico)
1. **Solicitada**: la clínica radica la solicitud a la EPS/aseguradora (Anexo
   técnico 3, Res. 2335 de 2023) — fecha, n.º de radicado, canal, soporte.
2. Respuesta del asegurador:
   - **Autorizada**: n.º de autorización, fecha, **vigencia**, servicios/CUPS
     (Anexo 4).
   - **Negada**: motivo → reconsideración o información al médico y paciente.
   - **Devuelta**: requiere información adicional → completar y radicar de nuevo.
3. **Vencida**: la vigencia terminó sin cirugía → solicitar prórroga.
4. **No requiere (urgencia)**: atención inicial de urgencias, sin autorización
   previa (Decreto 4747 de 2007), con justificación.
5. **Regla**: sin autorización vigente **no** se programa, reprograma ni
   registra la cirugía como realizada, ni se inicia MOS. La base de datos lo
   impide y la app muestra el motivo y la acción.
6. Alertas: autorizaciones por vencer (≤ 7 días), sin respuesta (> 5 días),
   cirugías próximas sin autorización.

### Fase 4 — Gestión MOS (material de osteosíntesis · Gestor MOS)
Aplica a pacientes con **boleta quirúrgica**. Cinco hitos:
1. **Notificación al asegurador**: el gestor transcribe cada ítem de la boleta
   (cantidad y descripción), adjunta la **historia clínica** y la **boleta en
   PDF** (obligatorios) y envía el correo (remitente "Clínica Santa Bárbara -
   MOS"). Vista previa antes de enviar; una vez enviado no se modifica ni se
   reenvía.
2. **Respuesta del asegurador**: aprobado o rechazado (con observaciones).
3. **Notificación al proveedor**: a cada ítem se le asigna proveedor (con su
   ficha: NIT, dirección, ciudad, teléfono, contacto, correo) y **fecha
   estimada de entrega**; se envía un correo por proveedor.
4. **Proveedor confirma** la disponibilidad del material.
5. **Material en la clínica**: lo registra Esterilización (fase 6).

### Fase 5 — Gestión clínica (Gestor clínico)
1. Consulta toda la información del paciente y de la gestión MOS.
2. Por cada ítem de material registra **a quién se carga el cobro**
   (facturación) — cada cambio queda en el historial.
3. **Notas** con fecha, hora, usuario, descripción y adjuntos (vista previa con
   ícono de ojo); gráfico semanal y línea de tiempo.

### Fase 6 — Esterilización (recepción del material)
1. Por cada **remisión** del proveedor: n.º y fecha de remisión, quién entrega,
   **cantidad recibida por ítem**, observaciones y datos de quien recibe.
2. Vista previa y archivo del **acta de recibo** (evidencia, imprimible).
3. Recepción parcial → *Recibido parcialmente*. Todo recibido → **cierre del
   proceso MOS** y **correo automático al equipo de Programación** para llevar
   el material a la sala de cirugía.

### Fase 7 — Cirugía realizada y cierre (PUERTA OBLIGATORIA · Programación)
1. "Marcar como realizada" exige: **inicio y fin reales** (fecha final),
   **cirujano**, **procedimiento realizado**, **destino posoperatorio** (casa,
   hospitalización, UCI, UCIN, observación) y observaciones.
2. **Regla**: sin este cierre completo no se registran seguimientos
   posquirúrgicos. Alertas: "Pendiente registrar realizada" cuando la fecha
   programada ya pasó.

### Fase 8 — Gestión postquirúrgica (Programación y Gestor clínico)
1. Notas de seguimiento con **tipo**, **fecha y hora de la cita**, comentarios y
   adjuntos. Tipos con días sugeridos:
   - Prequirúrgicos: valoración preanestésica, exámenes, consentimiento
     informado, suspensión de anticoagulantes, ayuno, reserva de hemoderivados,
     cama/UCI, llamada de confirmación.
   - Posquirúrgicos (desde la fecha final real): llamada 24–72 h, curación,
     retiro de sonda vesical, drenes, puntos/suturas, yeso/férula,
     agujas/material, control con especialista, patología, control radiológico,
     terapia física, vigilancia de infección del sitio operatorio a 30 días
     (90 si hay implante).
2. Estado de cada cita: programada → **confirmada** → cumplida / no asistió /
   reprogramada / cancelada.
3. **Alertas**: por notificar (1–7 días de anticipación), notificadas sin
   confirmar, citas de hoy, vencidas sin cerrar, cirugías sin cierre.
4. **Recordatorio por WhatsApp Web**: mensaje listo (saludo, tipo de cita,
   fecha, hora, indicación por tipo de control, responder SI / REPROGRAMAR) y
   registro de la respuesta del paciente.

### Evidencia y auditoría
- Copia de cada correo (HTML exacto, destinatario, adjuntos, fecha y hora,
  usuario).
- Actas de recibo de Esterilización.
- Historial de autorizaciones con soportes.
- Notas inmutables con usuario, rol, fecha y hora.
- Historial de cambios de la solicitud (programación, cobro, estados de citas).

### Indicadores del dashboard
- Generales: solicitudes, programadas, realizadas, % autorización vigente,
  gestión MOS, alertas activas.
- Flujo por fase (conteo y %): ingresadas → validadas GoMedisys → autorizadas →
  programadas → con MOS → material recibido → realizadas → con seguimiento PostQx.
- Por fase: tipo de orden y origen; estados, especialidad, quirófano, tiempo
  reporte → programación y reporte → cirugía; tiempo de respuesta de la EPS,
  por vencer, sin respuesta; hitos MOS, ciclo MOS, rechazos, por asegurador;
  % ítems con cobro y responsables; % material recibido, entrega a tiempo,
  atrasados por proveedor; asistencia a controles, citas por estado y tipo.
- Tendencia semanal, agenda quirúrgica mensual y alertas combinadas.

### Diagrama de referencia (texto)
```
[1 GoMedisys] → [2 Programación Cx] → [3 AUTORIZACIÓN 🔒] ─┬→ [Programar · Notificar paciente]
                                                         └→ [4 MOS: Asegurador → Proveedor] → [6 Esterilización: acta] → aviso a Programación
                                       [5 Gestión clínica: cobro y notas] (en paralelo)
[7 CIRUGÍA REALIZADA + CIERRE 🔒] → [8 PostQx: controles · citas · WhatsApp] → [Dashboard e indicadores]
```
