-- Catálogos base

insert into especialidades (nombre) values
  ('Ortopedia'), ('Neurocirugía'), ('Cirugía Maxilofacial'), ('Cardiovascular'),
  ('Urología'), ('Ginecología'), ('Cirugía General'), ('Estética'), ('Otra');

insert into eps (nombre) values
  ('ADRES'), ('ASMET SALUD'), ('EMSSANAR'), ('NEPS'), ('NUEVA EPS'),
  ('SANIDAD MILITAR'), ('SOAT'), ('SOS'), ('SURA');

insert into unidades (nombre) values
  ('Hospitalización'), ('UCI'), ('UCIN'), ('Urgencias'), ('Ambulatorio'), ('Recuperación');

-- Quirófanos: 5 salas con ficha técnica orientada a los estándares de
-- habilitación de servicios de salud en Colombia (Res. 3100/2019 — talento
-- humano, infraestructura, dotación por área quirúrgica). Áreas y dotación
-- son valores de referencia iniciales; ajustar desde Administración con los
-- datos reales de cada sala.
insert into quirofanos (numero, nombre, tipo, area_m2, clasificacion_riesgo, ubicacion_fisica, capacidad_personas, dotacion_basica, sistema_climatizacion, color_calendario) values
  (1, 'Quirófano 1', 'general', 36, 'limpio', 'Bloque quirúrgico - Piso 3', 8,
    array['Mesa quirúrgica', 'Lámpara cielítica', 'Máquina de anestesia', 'Electrobisturí', 'Monitor de signos vitales', 'Equipo de succión'],
    'Presión positiva, filtro HEPA', '#0D2D6B'),
  (2, 'Quirófano 2', 'general', 36, 'limpio', 'Bloque quirúrgico - Piso 3', 8,
    array['Mesa quirúrgica', 'Lámpara cielítica', 'Máquina de anestesia', 'Electrobisturí', 'Monitor de signos vitales', 'Equipo de succión'],
    'Presión positiva, filtro HEPA', '#16468E'),
  (3, 'Quirófano 3', 'especializado', 42, 'limpio', 'Bloque quirúrgico - Piso 3', 10,
    array['Mesa quirúrgica radiolúcida', 'Lámpara cielítica doble cúpula', 'Máquina de anestesia', 'Electrobisturí', 'Arco en C', 'Monitor de signos vitales'],
    'Presión positiva, filtro HEPA', '#0F766E'),
  (4, 'Quirófano 4', 'especializado', 42, 'limpio', 'Bloque quirúrgico - Piso 3', 10,
    array['Mesa quirúrgica radiolúcida', 'Lámpara cielítica doble cúpula', 'Máquina de anestesia', 'Electrobisturí', 'Torre de laparoscopia', 'Monitor de signos vitales'],
    'Presión positiva, filtro HEPA', '#7C3AED'),
  (5, 'Quirófano 5', 'ambulatorio', 30, 'limpio', 'Bloque quirúrgico - Piso 3', 6,
    array['Mesa quirúrgica', 'Lámpara cielítica', 'Máquina de anestesia', 'Electrobisturí', 'Monitor de signos vitales'],
    'Presión positiva, filtro HEPA', '#B45309');

-- Recomendaciones pre-quirúrgicas base por especialidad (punto de partida,
-- editable desde Administración)
insert into recomendaciones_cirugia (especialidad_id, titulo, contenido)
select id, 'Recomendaciones generales pre-quirúrgicas',
  'Ayuno de mínimo 8 horas antes de la cirugía. Suspender anticoagulantes según indicación médica. Llegar con acompañante mayor de edad. Traer exámenes y valoración preanestésica. No usar esmalte de uñas ni joyas el día de la cirugía. Retirar prótesis dentales removibles antes del ingreso a cirugía.'
from especialidades;
