Build: Aplicacion para Programacion de Cirugia

Se requiere construir una app que permita

	.- Construye el proyecto a partir de la ruta de mi pc C:\www\programacion_cx
	En la ruta: C:\www\programacion_cx
	El logo debve ser el mismo utilizado en los proyectos anteriores
	.- El color azul debe utilizar este:#0D2D6B y con constrastes de este azul #16468E
	

1.- Infraestructura
	Github (ya cuento con MCP para todo el despliegue)
		El nombre del repositorio deber ser: permisos_tthh
	Supabase (ya cuento con MCP para todo el despliegue)
		El nombre del repositorio deber ser: permisos_tthh
	Resend (ya cuento con MCP para todo el despliegue)
		La API Key deben llamarse notificacionturnos
		
	
2.- La aplicacion debe tener las siguientes condiciones
		Dos opciones principales
			1. Reporte de Cirugia
				Esta opcion la deben utilizar los medicos cirujanos especialistas
				Idealmente se reporta desde un celular
				Por lo tanto debe contaar con un login y una contraseña
				Debe contener un formulario donde el medico registre:
					# de ingreso (informacion que debe tomar desde GoMedisys)
					# de identificacion del paciente
					Especialidad de la cirugia (Ortopedia, Neurocirugia, Cirugia Maxilofacial, Cardiovascular, Urologia, Ginecologia, Cirguia Gneral, Estetica, otra)
					Opcion de cargar un soporte (pdf, foto)
					La app debe indicasrle al medico que su registro ha sido reportado exitosamente con el Id correspondiente a traves de un modal
			2. Gestion de solicitudes
				Una vez se reporta la cirugia a programar, el personal del area de cirugia debe contar con una vista de estos registros los cuales inicialmente deben estar en un estado "reportado"
				El usuario desde dicha lista debe contar con las siguientes opciones
					Ver: visualizar la solicitud enviada por el medico con todos los datos reportados incialmente
					API: cuando se de clic en esta opcion la app debe ejecutar una API de consulta a GoMedisys para que traiga el resto de informacion del paciente y actualizar la vista del registro,
						 en este momento si la consulta es exitosa se actualizaran los campos de: nombres del paciente, edad, EPS, Ubicacion, valoracion preanestesica, procedimiento, boleta quirurgica, autorizacion del asegurador, tiempo estimado del quirofano (todos estos datos provienen de la API)
						 si la consulta no es exitosa, se debe mostrar un modal con el resultado de la consulta e indicar al usuario que valide directamente en la aplicacion de GoMedisys para confirmar que no hay datos.
						 Si la consulta es exitosa el estado del registro pasa a "procesado", aqui la opcion de lanzar la API debe quedar desactivada, pues ya se cuenta con la informacion proveniente de GoMedisys.
						 Si la consulta es fallida el estado del registro pasa a "fallido" y debe mostrarse o identifiacar con un color 
						 Si la consulta es exitosa, estos datos no pueden ser modificados pues provienen de GoMedisys y son inmdificables.						 
					Editar: El unico campo por el momento modificable sera, el de Autorizacion del asegurador.
							El campo de Observaciones programacion se puede diligenciar con un campo de texto largo
							El campo de Estado material de osteosintesis igualmente sera un campo de texto largo
							El campo de Casa medica que entrega material igualmente sera un campo de texto largo
					Programar: Cuando el usuario seleccion esta opcion la aplicacion debera mostrar un calendario de hoy hacia adelante para que se seleccione la fecha estimada de programacion y el quirofano
								recordar que la Clinica cuenta con 5 quirofanos, debe existir en la configuracion una tabla para regsitrar los datos mas relevantes de un quirofano (la IA debe consultar que tipo de informacion se debe contemplar para esta tabla con respecto a las normas del ministerio de salud de colombia).
								Con este calendario que debe aparecer como un modal flotante, el usuario puede facilmente seleccionar el quirofano, la fecha, la hora de la programacion.
								Asio mismo la aplicacion debe contar con una opcion para que otros usuarios puedan observar como se encuentra la disponibilidad de las salas de cirguia o quirofanos, medir nivel ocupacion y generar un mapa de calor
					Notificar: Opcion que debe permitir enviar una notifiacion al paciente con todas las recomendaciones previas a la Cirugia
								Esta notifiacion debe ser enviada a traves de SMS, Whatsapp, Email con todos los datos de la Programacion
								Por lo tanto la app debe tener una tabla donde se tenga previamente definido cuales son todas las recomendaciones por cada tipo de Cirugia
								Y que al usuario se le permita adicionar alguna otra informacion especifica antes del envio de notificacion
					Reprogramar: Para cuando sea necesario cambiar la fecha de la Programacion
					Cancelar: Debe quedar marcado y con una justificacion
					
					** Una vez se haya realizado la programacion el estado del registro pasa a "programado"
					** Una vez se haya notificado al paciente, el estado del regsitro para a "notificado"
					** Una vez se haya realizado la cirugia, el estado del registro pasa a "realizado"
					
					Por lo tanto la app cuando muestre los registro debe proveer todos los filtros posibles de consulta
					Se debe utilizar iconos relacionados con cada estado
					
			3. Mapa de quirofanos
				Esta informacion se debe mostrar en un calendario flotante que no ocupe todo la pantalla per que sirva visualmente poder apreciar la ocupacion de los quirofanos
				Consultar el tipo de cirugia, datos del paciente, datos del cirujano, tiempo estimado de la cirugia, entre otros
				La vista de este mapa debe utilizarse algun tipo de grafico relacionado con quirofanos hospitalrios y el uso de tooltip para mostrar informacion adicional siempre sera ncesaria.
			
			4. Mapa de Calor y estadisticas de comportamiento de uso de los quirofanos
			
			5. Administracion:
					Usuarios de la AplicacionRoles: Medicos, Programadores, Visualizadores
					Tablas: Se deb contar con CRUD para todas las Tablas
			6. Reportes: Todos los posibles, al exportar a Excel y PDF se debe incluir Logo, Titulos, informacion de los filtros y todo el detalle de cada registro
			
			7. Dashboard: Toda la información en cards metrics utilizando colores y datos relevantes dl manejo de la informacion
			
			8. Para todos los graficos, cards metrics, tablas, etc utilizar bordes sombreados, que se destaquen por encima del color de fondo de la pantalla
				Debe contener opcion de recuperacion de contraseña con el uso de un modal
				Debe existir modal para todo tipo de alerta e informacion vital para avisar al usuario de cualquier evento importante
				Debe contar con un acceso a traves de credenciales basadas en correo electronico y contraseña
				Los usuarios que no tenga credenciales deben tener la opcion de crear su propio usuario y contraseña basado en la estructura del punto anterior
				La notificación de crear el usuario debe llegar al correo utilizando un nombre apropiado como remitente y el link debe ir a la aplicacion con confirmación de usuario
				La habilitacion del usuario debe hacer desde el link que se le envie al correo electronico
				Utiliza el modelo el login de acuerdo al proyecto de "cambiodeturno"
				La app debe crear tablas para los campos que sea tipo lista desplegable
				La app debe ser desplegada (push y commit) desde el momento inicial en Github
				La app debera crear un usuario administrador asi: usuario: juan.etayo@cacsantabarbara.co contraseña: (la misma de los proyectos anteirores) nombres: Juan Carlos Etayo, rol: administrador
				El formulario de solicitud debe ser lo más profesional posible, que ocupe solo una pantalla sin que tengan que hacer scroll vertical
				Utilizar el logo de la Clinica
				Utilizar colores relacionados con el logo

2.1- Reportes
			.- Todos los posibles
			.- Con opcion de exportar a Excel PDF
			.- Los archivos exportados deben contener titulos y logo de la Clínica

2.2.- La base de datos debe estar en Supabase
				Ya cuento con una cuenta de pago en Supabase
				Todas las tablas deben tener opcion (CRUD) para la gestion
				Se debe contemplar todas las opciones de permisos y accesos que requiera Supabase
				Se debe contar con toda la seguridad RLs ofrecida por Supabase
3.- Branding
		Utiliza un diseño "Neumorfismo"
		Color basados en la paleta de colores del logo de la Clínica
		La app debe contar con las cards metrics posibles, deben contar con colores segun el tipo de datos, estas deben tener sombras y relieves para destacar la informacion
		Las cards metris, tablas, graficos, etc deben estar destacados con bordes y sombras
		Las tablas deben resaltarse las filas pares de las impares
		El nombre del usuario debe quedar ubicado en la parte superior izquierda
		El boton de cierre de sesión debe aparecer debejo del nombre del usuario una vez se de clic sobre el
		Utilizar la vista de resumen como en el proyecto de "SIAU" en donde se destacan los campos o inputs de cada variable
        Los datos deben quedar registrada en una tabla de la base de datos de Supabase (recuerda ya cuento con MCP de Supabase)
		Crea el Dashboard de metricas usando shadcn/ui.
		Filtros por año, mes, proceso/area, etc.
		Filtros todos los posibles
		Graficos, tablas con diseño tipo www.odoo.com
		Utiliza todos los botones tipo shadcn/ui.

3.1.- Utiliza los modelos de shadcn/ui
			Para obtener interfaces modernas, consistentes y altamente personalizables, 
			Analiza donde adicionar animaciones para mejorar la experiencia al usuario


3.2.- Debe actuar como si fuera:

		Actúa como:
		
		- Product Designer Senior
		- UX Researcher
		- Product Manager
		
		Diseña el producto completo.
		
		Define:
		
		- módulos
		- navegación
		- arquitectura
		- flujo de usuarios
		- pantallas
		- prioridades
		- qué debe ver cada tipo de usuario
		
		Antes de escribir una sola línea de código.
		
		Quiero conocer:
		
		- experiencia completa
		- recorrido del usuario
		- wireframes
		- navegación
		- botones
		- iconos
		- mensajes
		- estados vacíos
		- errores
		- loading
		- confirmaciones
		- colores
		- mejores prácticas UX		


		Haz una tabla moderna.
		
		Debe parecer diseñada por Stripe.
		
		Debe tener:
		
		- excelente espaciado
		- jerarquía visual
		- tipografía limpia
		- estados hover
		- filtros rápidos
		- búsqueda inmediata
		- columnas configurables
		- skeleton loading
		- acciones contextuales
		- responsive


4.- Logica o flujo de la aplicación

		La aplicacion se diseña para resolver un problema de gestion de documentos en papel y que se lleva actualmente de forma manual
		ver achivo modelo  en la ruta: C:\www\programacion_cx\docs\prog_cx.xlsx
		
		
5.- Resumen
		Se debe generar el super prompt basado en estas notas y todos los cambios que surgan del desarrollo
		Se debe contar con todo el codigo fuente de la aplicacion para futuros cambios o despligues en otro servidor e indicar la carpeta donde queda el codigo fuente
		Se deben generar todos los archivos .MD necesarios
		Se debe generar un informe de la estructura del proyecto
		Debes suministrar la ruta y nombre del archivo de este chat
	
6.- Antes de iniciar el proceso sugiero revises este prompt y has las sugerencias que consideres


7.- ADENDA - Ajustes tras análisis del archivo modelo (2026-08-12)

	Se analizó C:\www\programacion_cx\docs\prog_cx.xlsx (7 pestañas por especialidad,
	92 registros reales abril-agosto 2026; el resto de filas hasta ~900 son formato
	vacío heredado, no datos). Se comparó contra el archivo duplicado
	"PACIENTES PROGRAMADOS Y DE URGENCIAS DEL SERVICIO DE CIRUGIA.xlsx" (snapshot
	más viejo del mismo tracker manual, 91 registros, sin la columna #Ingreso) —
	este último se considera superado por prog_cx.xlsx y no se usa como fuente.

	7.1.- Corrección de nombres (conflicto detectado en el punto 1)
		El nombre correcto de repositorio GitHub y proyecto Supabase es:
		programacion_cx (el punto 1 original decía "permisos_tthh" por error,
		copiado del proyecto anterior).

	7.2.- Integración GoMedisys
		Se confirma conexión SQL Server/Azure SQL directa (mismo patrón que
		bi_gestionclinica y bi_frecuencias), pero en modo consulta EN VIVO
		on-demand (Edge Function invocada por el botón "API" de cada registro),
		no por sync batch/cron. Se reutilizan credenciales ya existentes del
		mismo servidor GoMedisys. Riesgo a validar en desarrollo: si el firewall
		de GoMedisys no permite llamadas on-demand desde Supabase Edge Functions,
		se ajustará a un patrón de cola/polling.

	7.3.- Migración de datos históricos
		Los 92 registros reales de prog_cx.xlsx SÍ se importan a Supabase como
		datos históricos base (estado según corresponda: procesado/programado/
		realizado), en vez de arrancar con las tablas vacías.

	7.4.- Modelo de datos ajustado según hallazgos del Excel
		- Ubicación: se separa en dos campos — Unidad (catálogo: Hospitalización,
		  UCI, Urgencias, Ambulatorio, Recuperación) + Cama/Habitación (texto
		  libre) — en el Excel venían mezclados en un solo texto con variantes
		  de escritura ("HOSPITALIZCION", "HOSPI 8", "706 B", etc).
		- Ortopedia: se agrega campo "Subespecialidad" (Ortopedia general /
		  Ortopedia reconstructiva), tal como aparece dividido en el Excel.
		- Cirujano: no se migra como texto libre; se identifica por el usuario
		  médico autenticado que reporta el caso (login), no por un campo
		  editable aparte.
		- Procedimiento: campo de texto libre con autocompletado por historial
		  (no catálogo cerrado — los procedimientos observados son demasiado
		  variados para forzarlos a una lista fija).
		- Tiempo quirúrgico estimado: se llena desde la consulta a GoMedisys
		  (no lo diligencia el médico en el formulario de reporte).
		- EPS: catálogo maestro con 9 aseguradoras observadas (ADRES, ASMET
		  SALUD, EMSSANAR, NEPS, NUEVA EPS, SANIDAD MILITAR, SOAT, SOS, SURA),
		  normalizando espacios/variantes de escritura del Excel.
		- Autorizacion de aseguradora: se mantiene como en el prompt original
		  (único campo editable manualmente vía "Editar"), sin forzar un
		  booleano, ya que en la práctica combina estado (SI/NO/OK) y número
		  de autorización en texto libre.
		- Cirugía General (columnas L:V del Excel, duplicado del bloque A:K):
		  confirmado 100% vacío, artefacto de copiar/pegar el encabezado — se
		  ignora, no se migra.

	7.5.- Tabla de quirófanos
		Antes de definir el esquema de la tabla de configuración de quirófanos
		(punto 2, opción "Programar"), se investigan los campos exigidos por la
		Resolución 3100 de 2019 (habilitación de servicios de salud, Colombia)
		para la ficha técnica de un quirófano, según lo pedido en el prompt
		original.

	7.6.- Costos
		Proyecto Supabase nuevo "programacion_cx": ~US$10/mes adicionales,
		confirmado con el usuario antes de crearlo.


8.- INFORME FINAL DE DESARROLLO (2026-08-13)

	8.1.- Código fuente
		Ruta local: C:\www\programacion_cx
		Repositorio: https://github.com/juanetayo-projects/programacion_cx (público)
		Desplegado en: https://juanetayo-projects.github.io/programacion_cx/
		Chat de desarrollo: sesión "Programación de Cirugías" en Claude Code
		(este archivo, docs/procx prompt.md, es el registro de las decisiones).

	8.2.- Estructura del proyecto
		src/components/  ui.tsx (Card/Modal/FilterBar/Badge…), CrudTable.tsx
		                 (CRUD genérico con soporte de llaves foráneas),
		                 Shell.tsx (layout), HeatmapDiaHora.tsx (reutilizable)
		src/lib/         supabase.ts, auth.tsx (AuthProvider), constantes.ts,
		                 data.ts, exportar.ts (Excel/PDF), database.types.ts
		src/pages/       Login, Reset, Dashboard, ReportarCirugia, Solicitudes,
		                 Quirofanos, Calor, Reportes, admin/Usuarios,
		                 admin/Catalogos
		supabase/migrations/  0001-0009: esquema, RLS, catálogos, admin
		                 inicial, contacto paciente, helper de secrets,
		                 bucket de soportes (los datos históricos con PII
		                 real, 0006, se aplicaron directo a la base y NO se
		                 versionan en git)
		supabase/functions/   admin-usuarios, consulta-gomedisys,
		                 notificar-paciente
		scripts/migracion/    generar_sql_historico.py (script de migración,
		                 reutilizable si se necesita re-importar)
		docs/            este archivo (el Excel origen NO se versiona, PII)

	8.3.- Módulos entregados y funcionando (verificados en navegador)
		- Auth: login, autorregistro, recuperación de contraseña, roles
		  (administrador/programador/médico/visualizador)
		- Reportar cirugía (médicos, una pantalla, con carga de soporte)
		- Gestión de solicitudes: Ver/Consultar GoMedisys/Editar/Programar/
		  Notificar/Reprogramar/Cancelar, con filtros e iconos por estado
		- Mapa de quirófanos: grilla día×hora por sala con detalle al clic
		- Mapa de calor: ocupación día de la semana × hora + barras por
		  quirófano
		- Reportes: filtros completos + exportación Excel/PDF con logo y
		  título institucional
		- Administración: usuarios (alta/reset/activar-desactivar) y
		  catálogos (especialidades, EPS, unidades, quirófanos,
		  recomendaciones) vía CRUD genérico
		- Dashboard con métricas reales
		- 94 registros históricos migrados desde el Excel

	8.4.- Pendiente para dejar 100% operativo
		- GoMedisys: falta el query T-SQL validado por el cliente y las
		  credenciales (GOMEDISYS_HOST/PORT/DATABASE/USERNAME/PASSWORD como
		  secrets de Supabase) — la Edge Function ya tiene toda la lógica
		  lista, solo falta conectarla a la fuente real
		- Resend: falta configurar RESEND_API_KEY en Supabase Vault para
		  que las notificaciones por correo se envíen de verdad
		- SMS/WhatsApp: no implementado (no se definió proveedor)
		- Confirmación de autorregistro por correo con remitente Resend:
		  requiere configurar SMTP personalizado en Supabase Auth desde el
		  dashboard (fuera del alcance de las herramientas usadas en esta
		  sesión)
		- Contraseña del admin inicial: generada aleatoria y desconocida;
		  usar "¿Olvidaste tu contraseña?" una vez el correo esté configurado
		- Bundle grande por exceljs/pdfmake (import dinámico ya aplicado;
		  se cargan solo al exportar, no en la carga inicial)


9.- AJUSTES DE UI/UX Y ROLES (2026-08-13) — patrones para reusar en nuevos proyectos

	Ronda de feedback tras la primera entrega. Estos ajustes se dejan documentados
	aquí porque este archivo es la base para nuevos proyectos del mismo patrón
	(cac-fullstack-app): son convenciones a aplicar desde el scaffold, no solo
	parches puntuales de esta app.

	9.1.- Branding y contraste
		- La cinta superior (header) debe usar el mismo degradado azul institucional
		  que el sidebar (from-#0D2D6B to-#16468E), no fondo blanco — refuerza marca
		  y evita que el header "flote" desconectado del sidebar.
		- El fondo general de la app debe ser notoriamente más oscuro que las
		  tarjetas/tablas/formularios (ej. #dbe1ec de fondo vs. blanco de las
		  tarjetas). Un fondo demasiado cercano al blanco (como el #eef1f6 inicial)
		  hace que los formularios se confundan visualmente con el fondo.

	9.2.- Modales (componente Modal genérico)
		- Todo modal con título debe incluir un botón de cerrar (X) visible en el
		  header, sin depender solo del clic-afuera o de un botón "Cancelar" al
		  final del formulario.
		- Agregar prop `cerrableFuera` (default true): en modales de solo lectura
		  o que muestran información clínica sensible ("Ver detalle"), desactivarla
		  para que un clic accidental fuera no pierda el contexto de lo que se
		  estaba revisando.
		- En modales de edición que combinan datos de solo lectura (contexto) con
		  campos editables, separar visualmente ambos bloques (ej. bloque gris
		  "solo lectura" arriba, bloque con borde institucional "editable" abajo)
		  en vez de mezclarlos en una sola lista de campos.
		- Si una acción de modal representa una decisión de negocio (p.ej. "qué
		  estado se le comunica al paciente"), esa decisión debe pedirse explícita
		  y obligatoriamente dentro del mismo modal (select requerido) y el botón
		  de envío debe permanecer deshabilitado hasta que se elija.
		- El modal de CRUD genérico (CrudTable) debe usar grilla de 2 columnas y
		  un ancho mayor (max-w-2xl) cuando el catálogo tiene muchos campos, para
		  evitar scroll vertical; los campos `textarea` ocupan el ancho completo
		  (col-span-2).

	9.3.- Filtros
		- Toda vista de listado/gestión debe incluir filtro por rango de fechas
		  (desde/hasta), además de los filtros de categoría/estado que ya tenga.
		- El Dashboard principal debe exponer todos los filtros relevantes del
		  dominio (fecha, estado, categoría, recurso/ubicación) — no debe ser una
		  vista estática de solo cards y gráficos sin poder acotar el periodo o
		  segmento.
		- Las vistas de mapa de calor / ocupación de un recurso compartido (salas,
		  quirófanos, vehículos, etc.) deben incluir filtro por el recurso mismo,
		  no solo por rango de fechas.

	9.4.- Estados con reversa
		- Cualquier estado terminal reversible por naturaleza del negocio (p.ej.
		  "cancelado") debe poder revertirse desde la misma tabla de gestión
		  (acción "Quitar cancelación"), en vez de dejar el registro sin salida.

	9.5.- Contraseñas (alta y reseteo de usuarios)
		- Todo formulario de administración que crea o resetea la contraseña de
		  un usuario debe pedir confirmación de la contraseña y mostrar un
		  medidor de fortaleza (débil/aceptable/fuerte/muy fuerte), deshabilitando
		  el botón de guardar si no coincide o es débil. Componente reutilizable
		  ya extraído: `src/components/PasswordStrength.tsx` (portado del patrón
		  usado en el proyecto `sst`).

	9.6.- Roles y permisos configurables
		- No hardcodear en el código qué rol ve qué módulo (arrays `roles` en la
		  navegación y en los guards de rutas). En su lugar:
		  a) Modelar una tabla `rol_permisos (rol, modulo, permitido)` con RLS
		     (lectura autenticados, escritura solo admin) y semilla que replique
		     el comportamiento inicial esperado.
		  b) `AuthProvider` carga el set de módulos permitidos junto con el
		     perfil al iniciar sesión.
		  c) La navegación (Shell) y el guard de rutas (App.tsx) consultan ese
		     set en vez de una lista de roles fija.
		  d) El rol "administrador" siempre tiene acceso completo e inmodificable
		     en la UI (checkbox deshabilitado) — evita que el propio admin se
		     bloquee el acceso por error.
		  e) Pantalla de administración dedicada ("Roles y permisos") con una
		     matriz módulo × rol y toggles que escriben de inmediato (sin botón
		     "guardar" aparte).
		- Este patrón (antes ausente) se puede replicar tal cual en proyectos
		  nuevos que pidan "roles configurables" o "que el administrador decida
		  los permisos".

	9.7.- Gotcha de auth encontrado durante la verificación
		- Si `Login.tsx` no navega explícitamente tras un `signInWithPassword`
		  exitoso, y la ruta `/login` no tiene guard, el usuario queda "atascado"
		  visualmente en el formulario de login aunque la sesión ya se haya
		  establecido (el estado cambia, pero nada redirige). Solución aplicada:
		  envolver la ruta `/login` en un guard `SoloInvitados` que redirige a
		  "/" si ya hay sesión activa. Verificar este patrón en el scaffold base
		  de login (ver también `references/gotchas.md` del skill
		  cac-fullstack-app) para no repetirlo en próximas apps.


	10.- AJUSTES RONDA 3 — GESTIÓN DE SOLICITUDES Y DASHBOARD (2026-08-13)

		10.1.- Nuevo módulo independiente "Solicitudes reportadas"
			Se separó la cola de intake (estado reportado/fallido) de "Gestión
			de solicitudes" en una página nueva e independiente:
			src/pages/SolicitudesReportadas.tsx, ruta /solicitudes-reportadas,
			módulo "solicitudes_reportadas" en rol_permisos (mismo acceso que
			"solicitudes": administrador y programador sí, médico y
			visualizador no). Esta página solo tiene las acciones Ver /
			Consultar GoMedisys / Cancelar. Cuando la consulta a GoMedisys es
			exitosa (estado pasa a "procesado"), el registro desaparece de
			esta cola y aparece en "Gestión de solicitudes", que ahora excluye
			explícitamente los estados reportado y fallido
			(`.not('estado', 'in', '(reportado,fallido)')`). Este patrón
			(bandeja de intake separada de la bandeja de gestión) es
			reutilizable en otros proyectos con un flujo de "cola de entrada
			→ cola de trabajo".

		10.2.- "Gestión de solicitudes" — ajustes de UI
			- Cards de métricas pequeñas en la parte superior (dos filas: por
			  especialidad y por estado), recalculadas siempre a partir del
			  conjunto ya filtrado (`filtradas`), no de una consulta aparte —
			  garantiza que reflejen exactamente los filtros y la búsqueda
			  vigentes.
			- Cabecera de tabla con fondo azul institucional (`bg-[#0D2D6B]`)
			  y texto blanco, en vez del gris claro por defecto.
			- Columna "# Ingreso" agregada justo después de "Fecha".
			- La columna "Especialidad" ahora muestra debajo, en texto
			  pequeño gris, el nombre del médico que reportó el caso
			  ("Dr(a). …") — resuelto como
			  `nombre_medico_reporta || perfiles.nombre` (fallback al perfil
			  de quien está autenticado como reportante).
			- Nuevos filtros: médico (texto libre, cliente-side), quirófano
			  (select, servidor) y hora (input time, servidor, match exacto
			  contra `hora_programada`).
			- El modal "Ver" se reorganizó en 4 bloques con color de fondo
			  propio: Paciente (azul, existente), Orden Cx (violeta:
			  procedimiento, especialidad, tiempo estimado, reportado por),
			  Boleta Qx (ámbar: valoración preanestésica, autorización
			  aseguradora, material de osteosíntesis, casa médica) y Gestión
			  (gris: estado, programación, notificación, observaciones,
			  motivo de cancelación si aplica).
			- Columna "Programación": ahora muestra primero el nombre del
			  quirófano (línea en negrita) y debajo, en texto más pequeño, la
			  fecha y hora — antes iba en una sola línea con el quirófano al
			  final.
			- Se retiró la acción "Consultar GoMedisys" (rayo) de esta
			  tabla: ya no aplica porque los registros aquí siempre llegaron
			  desde la consulta exitosa; esa acción vive ahora solo en
			  "Solicitudes reportadas".

		10.3.- Reporte de cirugía — nombre del médico cuando reporta un programador
			Columna nueva `solicitudes_cirugia.nombre_medico_reporta` (text,
			nullable). En ReportarCirugia.tsx, si el usuario autenticado
			tiene rol "programador", el formulario pide obligatoriamente el
			nombre del médico cirujano y lo guarda en esa columna; si reporta
			un usuario rol "médico", el campo no se muestra y el nombre se
			resuelve directamente del perfil de quien reporta
			(`perfiles.nombre` vía `reportado_por`). Toda la UI que muestra
			"médico" usa este mismo fallback
			(`nombre_medico_reporta || perfiles.nombre`).

		10.4.- Dashboard — barra "Por especialidad" con desglose de 3 colores
			La barra por especialidad pasó de un solo color proporcional al
			total, a una barra apilada de 3 segmentos por especialidad:
			programadas/en curso (degradado azul institucional), realizadas
			(verde esmeralda) y canceladas (rojo claro), con una leyenda de
			colores debajo del gráfico. Los tres conteos respetan los mismos
			filtros del Dashboard (fecha, estado, especialidad, quirófano).

		10.5.- Migración aplicada
			supabase/migrations/0013_ajustes_ago2026_gestion.sql — agrega la
			columna nombre_medico_reporta y el módulo solicitudes_reportadas
			en rol_permisos (constraint + semilla). Tipos regenerados en
			src/lib/database.types.ts vía MCP de Supabase.

	11.- AJUSTES RONDA 4 — FILTROS, CARDS CLICABLES Y VISTAS DE CALENDARIO (2026-08-13)

		11.1.- Botón "Limpiar filtros"
			Se agregó un botón "Limpiar filtros" (ghost, con ícono X, deshabilitado
			si no hay ningún filtro activo) al final de la barra de filtros en
			todas las páginas con FilterBar: Dashboard, Gestión de solicitudes,
			Solicitudes reportadas, Mapa de calor y Reportes. En Mapa de calor,
			"limpiar" no vacía las fechas sino que las regresa al rango por
			defecto (últimos 90 días), ya que un rango vacío no tiene sentido en
			ese módulo. Patrón reutilizable: cada página define su propio
			`limpiarFiltros()` y un booleano `hayFiltrosActivos` para habilitar
			el botón.

		11.2.- Gestión de solicitudes — cards de métricas con título y clic-filtro
			- Las dos filas de cards ahora llevan un título pequeño encima:
			  "Especialidades" y "Estados".
			- Cada card es ahora un `<button>`: al hacer clic selecciona ese
			  valor como filtro (Especialidad o Estado); un segundo clic sobre
			  la misma card lo deselecciona. La card activa se resalta con un
			  anillo azul institucional (`ring-2 ring-[#0D2D6B]`). Esto convierte
			  las cards de métricas en atajos de filtrado, además de indicadores.
			- La agregación de "por especialidad" pasó a agrupar por
			  `especialidad_id` (no solo por nombre) para poder setear el filtro
			  con el id correcto al hacer clic.

		11.3.- Gestión de solicitudes — reordenar columnas de la tabla
			Se fusionaron las columnas "# Ingreso" y "Documento" dentro de la
			columna "Paciente" (nombre en la primera línea, "Doc: … · Ingreso: …"
			debajo en texto pequeño gris), inmediatamente después de "Fecha".
			Esto libera ancho para "Especialidad" y "Programación", que ahora
			usan `w-56` y `whitespace-nowrap` — la columna Programación quedó en
			una sola línea ("Quirófano · fecha hora", hora recortada a HH:MM en
			vez de HH:MM:SS). Columnas finales: ID, Fecha, Paciente, Especialidad,
			Estado, Programación, Acciones (7, antes 9).

		11.4.- Mapa de quirófanos — selector de vista día / semana / mes
			Se agregó un selector segmentado (botones "dia" / "semana" / "mes")
			junto a la navegación de fecha. El rango de la consulta a
			`solicitudes_cirugia` cambia según la vista (día exacto, semana
			lunes-domingo, o mes calendario completo vía helpers
			`inicioSemana/finSemana/inicioMes/finMes`).
			- Vista día: sin cambios (grilla hora × quirófano existente, clic
			  en un bloque abre el modal de detalle).
			- Vista semana: tabla real (quirófano × día de la semana) con
			  encabezado oscuro (`bg-[#0D2D6B]`) y letra blanca — cada celda
			  muestra el conteo de cirugías de ese quirófano ese día, y un
			  tooltip nativo (`title`, con saltos de línea) al pasar el mouse
			  lista hora + paciente de cada una.
			- Vista mes: tabla-calendario (7 columnas Lun-Dom, encabezado
			  oscuro) con los días fuera del mes atenuados; cada día con
			  cirugías muestra un badge con el conteo y el mismo tooltip nativo
			  (agregando el quirófano entre paréntesis, ya que agrupa todas las
			  salas).
			- Este patrón (tooltip vía atributo `title` con saltos de línea) es
			  intencionalmente simple y consistente con el que ya usaban los
			  bloques de la vista día — se evitó introducir un tooltip flotante
			  a medida para no añadir complejidad no solicitada.

		11.5.- Mapa de calor — tooltip ya existente, sin cambios de código
			Se verificó que el componente reutilizable `HeatmapDiaHora`
			(src/components/HeatmapDiaHora.tsx) ya implementa un tooltip
			flotante al pasar el mouse sobre cada celda día×hora, con una
			tabla mini (Quirófano / Paciente / Especialidad) de los registros
			de esa celda — cumple el requisito sin necesidad de cambios.

	12.- AJUSTES RONDA 5 — CONFLICTOS, ENCABEZADO, CIRUGÍAS REALIZADAS (2026-08-13)

		12.1.- Dashboard: desglose numérico junto a la barra por especialidad
			La barra apilada "Por especialidad" ahora muestra, además del total,
			los tres valores individuales (programadas/en curso, realizadas,
			canceladas) como números de color junto a la barra — antes solo se
			veía el total agregado a la derecha.

		12.2.- Bloqueo de doble programación de quirófano
			Antes de guardar una programación/reprogramación, la app consulta si
			ya existe otra solicitud activa (estado ≠ cancelado) con el mismo
			quirofano_id + fecha_programada + hora_programada. Si existe, se
			muestra un modal "Quirófano ocupado" con los datos de la
			programación existente (paciente, documento, especialidad, estado,
			procedimiento) y un botón "Elegir otro horario" que reabre el modal
			de programación. Como respaldo ante condiciones de carrera (dos
			usuarios guardando casi al mismo tiempo), se agregó también un
			índice único parcial en Postgres:
			`solicitudes_cirugia_quirofano_horario_uniq` (excluye cancelados y
			filas sin quirófano/fecha/hora) — si igual se cuela una violación,
			el error 23505 se traduce a un mensaje claro en vez del error crudo
			de Postgres.

		12.3.- Encabezado de "Gestión de solicitudes" — compacto, sticky y con Excel
			- Se eliminaron los `<select>` de Estado y Especialidad del
			  FilterBar: las cards de métricas clicables (agregadas en la ronda
			  3) ya cumplen esa función, así que mantener el dropdown era
			  redundante y ocupaba espacio. El FilterBar quedó con: Médico,
			  Quirófano, Hora, Reportado desde/hasta y Buscar.
			- El botón "Limpiar filtros" se movió a la fila de cards "Estados",
			  alineado a la derecha.
			- El bloque completo (PageHeader + cards + FilterBar) quedó dentro
			  de un contenedor `sticky top-0 z-10` con márgenes negativos que
			  cancelan el padding de `<main>` (`-mx-6 -mt-6` + `px-6 pt-6`) —
			  patrón reutilizable para fijar encabezados dentro de un
			  `overflow-y-auto` con padding sin que se corte visualmente al
			  hacer scroll. Este patrón se replicó también en "Cirugías
			  realizadas".
			- Botón "Excel" (ícono `FileSpreadsheet`, mismo usado en Reportes)
			  en el PageHeader: exporta `filtradas` (respeta todos los filtros
			  vigentes) con logo, título, subtítulo de filtros aplicados, y
			  color de fondo por fila según el estado
			  (`ESTADOS_COLOR_HEX` en constantes.ts, ARGB paralelo a
			  `ESTADOS_COLOR`). Para soportar esto, `exportarExcel()` en
			  src/lib/exportar.ts ahora acepta un parámetro opcional
			  `coloresFila` que sobreescribe el rayado par/impar por fila
			  cuando se provee.

		12.4.- Editor de texto enriquecido en el modal de Notificar
			Nuevo componente reutilizable `src/components/RichTextEditor.tsx`
			(contentEditable + `document.execCommand`, sin librería externa —
			decisión deliberada para no sumar peso al bundle solo por
			negrita/cursiva/listas). El modal de Notificar ahora prellena este
			editor con las recomendaciones de la especialidad
			(`<h3>título</h3><p>contenido</p>` por cada una) y el usuario puede
			editar el texto antes de enviarlo; ese HTML editado reemplaza el
			campo "notas_notificacion" y se envía tal cual al edge function
			notificar-paciente (que dejó de reconstruir las recomendaciones
			desde la base de datos — ahora solo agrega el saludo y los datos de
			la cirugía alrededor del HTML recibido). El modal "Ver" de Gestión
			de solicitudes ahora renderiza ese HTML con `dangerouslySetInnerHTML`
			(aceptable aquí porque el contenido siempre se origina en este
			mismo editor, escrito por personal interno autenticado con permisos
			de programador/admin — nunca por un paciente ni por texto externo).

		12.5.- Bloqueo atómico contra doble ejecución de la consulta GoMedisys
			El edge function `consulta-gomedisys` ahora "reclama" la solicitud
			con un UPDATE atómico (`WHERE estado IN ('reportado','fallido')`)
			antes de llamar a GoMedisys, en vez de solo leerla. Postgres
			serializa los UPDATE concurrentes sobre la misma fila, así que si
			dos clics (o dos usuarios) disparan la consulta casi al mismo
			tiempo, solo uno logra reclamarla — el otro recibe de inmediato
			`{ok:false, error:"..."}` sin llegar a golpear GoMedisys dos veces.
			El reintento manual tras un estado "fallido" sigue permitido (es
			el comportamiento esperado), lo que cambia es que ya no puede
			dispararse dos veces en paralelo para el mismo registro.

		12.6.- Mapa de quirófanos: tooltip flotante propio (reemplaza el nativo)
			El tooltip de las vistas semana/mes pasó de `title` (nativo del
			navegador) a un panel flotante propio, con el mismo lenguaje visual
			que ya usaba `HeatmapDiaHora` en Mapa de calor: header azul
			institucional con fecha y conteo, tabla mini con Hora/Paciente
			(y Quirófano en la vista mes, que agrupa todas las salas). Se agregó
			un `contRef` + estado `hover` con posición calculada igual que en
			`HeatmapDiaHora` (`getBoundingClientRect` relativo al contenedor).

		12.7.- Nueva vista "Cirugías realizadas"
			Ícono nuevo en la tabla de "Gestión de solicitudes" (`Stethoscope`,
			junto a Notificar/Reprogramar) para marcar una cirugía programada
			como realizada — pide confirmación en un modal, actualiza
			`estado='realizado'` y `realizado_en`. Al marcarla, el registro
			desaparece de "Gestión de solicitudes" (que ahora excluye también
			`realizado` de su consulta, sumado a reportado/fallido de la ronda
			3) y aparece en la nueva página independiente
			src/pages/CirugiasRealizadas.tsx (ruta /cirugias-realizadas, módulo
			`cirugias_realizadas` en rol_permisos, mismo patrón de acceso que
			"solicitudes"). Esta vista tiene cards de métricas por especialidad
			y por quirófano (clicables como filtro, igual que en Gestión),
			filtros completos, modal "Ver" de 4 secciones, exportar a Excel con
			color por estado, y una acción "Quitar marca de realizada" que
			revierte a estado "Programado" (mismo patrón que "Quitar
			cancelación").

		12.8.- Migración aplicada
			supabase/migrations/0014_ajustes_ago2026_realizadas_y_conflictos.sql
			— agrega el módulo cirugias_realizadas en rol_permisos y el índice
			único parcial anti-doble-programación. Edge functions
			consulta-gomedisys y notificar-paciente redesplegadas con los
			cambios de 12.4/12.5.

	13.- AJUSTES RONDA 6 — SCROLL, ENCABEZADO FIJO REAL Y FILTRO DE FECHA (2026-08-13)

		13.1.- Causa raíz encontrada: `main` nunca fue un contenedor de scroll real
			El layout de Shell.tsx usaba `min-h-screen` en el contenedor raíz. Con
			`min-height` (no `height`), cuando el contenido excede el alto de
			pantalla el contenedor simplemente CRECE en vez de recortarse —
			`main` (con `overflow-y-auto`) nunca llegaba a tener una altura
			acotada, así que jamás generaba su propio scroll interno; en la
			práctica el `<body>`/`window` era quien hacía scroll de toda la
			página (sidebar y header incluidos). Esto invalidaba cualquier
			`position: sticky` que dependiera de `main` como referencia: un
			`sticky` necesita que su ancestro de scroll realmente se desplace, y
			`main.scrollTop` se quedaba siempre en 0.
			Corrección en Shell.tsx: contenedor raíz `h-screen overflow-hidden`
			(en vez de `min-h-screen`), y toda la cadena de contenedores flex
			hasta `main` con `min-h-0` (gotcha clásico de flexbox: un hijo
			`flex-1` no se encoge por debajo del tamaño de su contenido a menos
			que también tenga `min-height: 0`). Con esto `main` pasó a ser un
			verdadero "app shell": sidebar y header fijos, y `main` como única
			zona que hace scroll cuando hace falta.

		13.2.- `position: sticky` en `<thead>` no funciona — hay que ponerlo en cada `<th>`
			Aún con `main` corregido, poner `sticky` directamente en `<thead>`
			no funcionó: es una limitación conocida de los navegadores con
			`display: table-header-group` (el grupo de fila de tabla no
			establece correctamente el comportamiento sticky en el layout de
			tablas). La solución es aplicar `position: sticky` a cada `<th>`
			individualmente (con su propio `background`, ya que un `th` sticky
			necesita pintar su propio fondo para tapar las filas que pasan
			debajo).

		13.3.- Patrón final: bloque de filtros fijo + tabla con scroll propio
			En vez de que la página completa (filtros + tabla) comparta el
			scroll de `main` con un offset calculado a mano (frágil, requería
			medir con `ResizeObserver` la altura del bloque de filtros), se
			adoptó un patrón más robusto de "shell interno" por página:
			- La página raíz usa `flex h-full flex-col`.
			- El bloque de PageHeader + cards + FilterBar es `shrink-0` (no
			  necesita `sticky`: como nunca se desplaza dentro de `main`, ya
			  queda siempre visible de forma natural).
			- La tarjeta de la tabla (`neu-card`) es `flex min-h-0 flex-1
			  flex-col overflow-hidden`, y dentro un div interno
			  `min-h-0 flex-1 overflow-auto` es el que realmente hace scroll
			  (vertical y horizontal) del `<table>`. Cada `<th>` usa
			  `sticky top-0` relativo a ESE div (no a `main`), así que no hace
			  falta medir ninguna altura — siempre se ancla en top:0 de su
			  propio contenedor.
			Aplicado en Gestión de solicitudes y Cirugías realizadas. Este es
			el patrón a reutilizar en cualquier página nueva de este proyecto
			(o de otros proyectos del mismo cliente) que combine filtros fijos
			con una tabla larga y encabezado de columnas fijo.

		13.4.- Dashboard y modal Notificar — compactados para no necesitar scroll
			Se redujeron paddings/márgenes en Dashboard.tsx y en los
			componentes compartidos `MetricCard`, `PageHeader` y `FilterBar`
			(src/components/ui.tsx) — cambio aplicado globalmente, se nota en
			todas las páginas como una UI ligeramente más compacta. La lista
			"Por estado" del Dashboard pasó de una columna de 9 filas a una
			grilla de 2 columnas. El modal de Notificar se reorganizó: la
			tarjeta de datos del paciente se redujo a una sola línea, los
			botones de estado a comunicar pasaron de una grilla 2×2 a una fila
			de 4, y el editor de texto enriquecido bajó su alto mínimo por
			defecto a 80px en este modal. Verificado con
			`scrollHeight === clientHeight` (sin necesidad de scroll) tanto en
			Dashboard como en el modal.

		13.5.- Bug real: el filtro de fecha en Gestión de solicitudes filtraba por la fecha equivocada
			"Reportado desde/hasta" filtraba `fecha_reporte` (cuándo el médico
			reportó el caso), pero el filtro de "Hora" ya filtraba
			`hora_programada` (la hora de la cirugía programada) — inconsistencia
			que hacía que, por ejemplo, filtrar por estado "Programado" + una
			fecha de cirugía no devolviera nada (porque esa fecha rara vez
			coincide con la fecha en que se reportó el caso). Se corrigió para
			que ambos filtros usen `fecha_programada`, y se renombraron las
			etiquetas a "Programado desde/hasta". El ícono "Marcar como
			realizada" (que el usuario reportó como "no lo veo") en realidad sí
			existía en el código — simplemente no había ningún registro visible
			para mostrarlo porque el filtro de fecha no encontraba resultados;
			quedó confirmado funcionando una vez corregido el filtro.

	14.- AJUSTES RONDA 7 — COLORES, MAPA DE CALOR Y LOGS DE INTEGRACIÓN (2026-08-13)

		14.1.- Modal de Notificar — colores por estado en los botones de motivo
			Los botones "¿Qué se le va a comunicar al paciente?" usaban un azul
			genérico para el estado seleccionado. Ahora usan los colores ya
			definidos por estado: sin seleccionar, el mismo tono suave de
			`ESTADOS_COLOR` (badge institucional de cada estado); al
			seleccionar, una versión "sólida" nueva —`ESTADOS_COLOR_SOLIDO` en
			constantes.ts— con fondo de color pleno y texto blanco. Este mapa
			de colores sólidos es reutilizable en cualquier otro lugar de la
			app que necesite resaltar un estado seleccionado sin inventar un
			color nuevo.

		14.2.- Mapa de calor — causa raíz de "no muestra información"
			El rango de fechas por defecto era `hoy - 90 días` hasta `hoy`. El
			histórico de la app mezcla datos migrados (fechas pasadas) con
			cirugías recién programadas a futuro (p. ej. 2026-08-14/15) — estas
			últimas quedaban SIEMPRE fuera del rango porque el límite superior
			nunca pasaba de "hoy". Se cambió el límite superior por defecto a
			`hoy + 90 días`. Mismo patrón a vigilar en cualquier vista nueva que
			filtre por `fecha_programada`: el rango por defecto debe cubrir
			también el futuro cercano, no solo el pasado.
			Adicionalmente:
			- Se excluyen las solicitudes canceladas por defecto (antes se
			  contaban aunque su reserva ya no fuera real).
			- Nuevo filtro "Estado": Todas (sin canceladas) / Programadas /
			  Realizadas.
			- El gráfico "Cirugías por quirófano" ahora muestra un mensaje de
			  estado vacío en vez de un `BarChart` en blanco cuando no hay
			  datos con los filtros vigentes.

		14.3.- Nueva vista "Logs de integración"
			src/pages/Logs.tsx, ruta /logs, módulo `logs` en rol_permisos
			(mismo acceso que "solicitudes": admin y programador sí, médico y
			visualizador no). Consulta `solicitudes_historial` filtrando
			`accion = 'consulta_api'` (cada intento de consulta a GoMedisys
			queda ahí, éxito o fallo, gracias al log ya existente en el edge
			function `consulta-gomedisys`) con el detalle del resultado
			(`detalle.resultado` / `detalle.error`), la solicitud asociada y el
			usuario que la ejecutó. Cards de total/exitosas/fallidas, filtros
			por resultado/fecha/búsqueda. Esta es la base para diagnosticar
			fallos de la integración una vez esté conectada a GoMedisys en
			producción — por ahora aparece vacía porque la integración real
			todavía no se ha ejecutado ni una vez (ver sección 8.4).

		14.4.- Migración aplicada
			supabase/migrations/0015_ajustes_ago2026_logs.sql — agrega el
			módulo `logs` en rol_permisos (constraint + semilla).
