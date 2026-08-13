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

