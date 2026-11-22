-- =====================================================================
--  Datos de DEMO para el esquema v0.31+ (solo desarrollo y pruebas)
--
--  cambios.txt menciona un seed_data.sql con 20 usuarios que no venía en
--  la carpeta. Si el equipo lo tiene, reemplacen este archivo por ese
--  (con el mismo nombre 02_... para que corra antes de la encriptación).
--
--  Se carga ANTES de la encriptación, igual que el orden de cambios.txt:
--  así el backfill de encriptacion_bd_v2.sql cifra estos datos.
--  Clave de los usuarios demo (para la app): Demo2026!
-- =====================================================================
BEGIN;

INSERT INTO carreras (id_carrera, nombre, facultad) VALUES
 ('a0000000-0000-4000-8000-000000000001', 'Ingeniería de Sistemas', 'Ingeniería'),
 ('a0000000-0000-4000-8000-000000000002', 'Arquitectura', 'Arquitectura y Diseño'),
 ('a0000000-0000-4000-8000-000000000003', 'Psicología', 'Ciencias Sociales y Humanas');

INSERT INTO categorias (id_categoria, nombre) VALUES
 ('b0000000-0000-4000-8000-000000000001', 'Programación'),
 ('b0000000-0000-4000-8000-000000000002', 'Idiomas'),
 ('b0000000-0000-4000-8000-000000000003', 'Diseño');

INSERT INTO habilidades (id_habilidad, nombre, id_categoria) VALUES
 ('c0000000-0000-4000-8000-000000000001', 'Python',                'b0000000-0000-4000-8000-000000000001'),
 ('c0000000-0000-4000-8000-000000000002', 'Java',                  'b0000000-0000-4000-8000-000000000001'),
 ('c0000000-0000-4000-8000-000000000003', 'Inglés conversacional', 'b0000000-0000-4000-8000-000000000002'),
 ('c0000000-0000-4000-8000-000000000004', 'Diseño en Figma',       'b0000000-0000-4000-8000-000000000003');

INSERT INTO usuarios (id_usuario, nombre, apellido, correo, password_hash, rol, id_carrera, semestre, saldo, creditos_retenidos) VALUES
 ('d0000000-0000-4000-8000-000000000001','Ana','Mamani','ana.mamani@ucb.edu.bo',
  '$argon2id$v=19$m=65536,t=3,p=4$AqyJ1Tl5fKHVGsuN2UHIbg$ihd0pbTXDH39tUXy05l61geeymiAI0/pWvwD337kOSw','usuario','a0000000-0000-4000-8000-000000000001',6,4,1),
 ('d0000000-0000-4000-8000-000000000002','Luis','Quispe','luis.quispe@ucb.edu.bo',
  '$argon2id$v=19$m=65536,t=3,p=4$AqyJ1Tl5fKHVGsuN2UHIbg$ihd0pbTXDH39tUXy05l61geeymiAI0/pWvwD337kOSw','usuario','a0000000-0000-4000-8000-000000000002',8,6,0),
 ('d0000000-0000-4000-8000-000000000003','Pedro','Flores','pedro.flores@ucb.edu.bo',
  '$argon2id$v=19$m=65536,t=3,p=4$AqyJ1Tl5fKHVGsuN2UHIbg$ihd0pbTXDH39tUXy05l61geeymiAI0/pWvwD337kOSw','usuario','a0000000-0000-4000-8000-000000000001',4,5,0),
 ('d0000000-0000-4000-8000-000000000004','María','Condori','maria.condori@ucb.edu.bo',
  '$argon2id$v=19$m=65536,t=3,p=4$AqyJ1Tl5fKHVGsuN2UHIbg$ihd0pbTXDH39tUXy05l61geeymiAI0/pWvwD337kOSw','usuario','a0000000-0000-4000-8000-000000000003',5,5,0),
 ('d0000000-0000-4000-8000-000000000005','Admin','Sistema','admin.banco@ucb.edu.bo',
  '$argon2id$v=19$m=65536,t=3,p=4$AqyJ1Tl5fKHVGsuN2UHIbg$ihd0pbTXDH39tUXy05l61geeymiAI0/pWvwD337kOSw','admin',NULL,NULL,0,0);

INSERT INTO usuario_habilidades (id_usuario, id_habilidad, nivel) VALUES
 ('d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003','avanzado'),
 ('d0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000004','avanzado'),
 ('d0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000002','intermedio'),
 ('d0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000001','basico');

INSERT INTO disponibilidades (id_usuario, fecha_inicio, fecha_fin) VALUES
 ('d0000000-0000-4000-8000-000000000001', (current_date + 1) + time '14:00', (current_date + 1) + time '18:00'),
 ('d0000000-0000-4000-8000-000000000002', (current_date + 2) + time '09:00', (current_date + 2) + time '12:00');

-- Solicitudes: una aceptada por cada reserva y una pendiente
INSERT INTO solicitudes_intercambio (id_solicitud, id_solicitante, id_ofertante, id_habilidad,
       fecha_inicio_propuesta, fecha_fin_propuesta, creditos_requeridos, estado, created_at, respondida_at) VALUES
 ('e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000004',
  (current_date - 3) + time '15:00', (current_date - 3) + time '16:00', 1, 'aceptada', now() - interval '6 days', now() - interval '5 days'),
 ('e0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003',
  (current_date + 2) + time '15:00', (current_date + 2) + time '16:00', 1, 'aceptada', now() - interval '1 day', now() - interval '20 hours'),
 ('e0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000002',
  (current_date + 1) + time '10:00', (current_date + 1) + time '11:30', 1, 'aceptada', now() - interval '2 days', now() - interval '2 days'),
 ('e0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003',
  (current_date + 3) + time '16:00', (current_date + 3) + time '17:00', 1, 'pendiente', now() - interval '2 hours', NULL);

-- Reservas: completada, pendiente (próxima) y cancelada
INSERT INTO reservas (id_reserva, id_solicitud, id_solicitante, id_ofertante, id_habilidad, fecha_inicio, fecha_fin,
       creditos, modalidad, lugar, estado, confirmacion_solicitante_at, confirmacion_ofertante_at,
       cancelado_por, motivo_cancelacion, horas_anticipacion_cancelacion, created_at, completed_at, cancelled_at) VALUES
 ('f0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000004',
  (current_date - 3) + time '15:00', (current_date - 3) + time '16:00', 1, 'presencial', 'Biblioteca central', 'completada',
  (current_date - 3) + time '16:05', (current_date - 3) + time '16:10', NULL, NULL, NULL, now() - interval '5 days', (current_date - 3) + time '16:10', NULL),
 ('f0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003',
  (current_date + 2) + time '15:00', (current_date + 2) + time '16:00', 1, 'virtual', 'https://meet.example.com/ingles', 'pendiente',
  NULL, NULL, NULL, NULL, NULL, now() - interval '20 hours', NULL, NULL),
 ('f0000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000002',
  (current_date + 1) + time '10:00', (current_date + 1) + time '11:30', 1, 'presencial', 'Laboratorio 3', 'cancelada',
  NULL, NULL, 'd0000000-0000-4000-8000-000000000004', 'Se cruzó con un examen parcial', 18, now() - interval '2 days', NULL, now() - interval '1 day');

INSERT INTO movimientos_credito (id_usuario, id_reserva, tipo, cantidad, saldo_anterior, saldo_posterior,
       retenidos_anterior, retenidos_posterior, descripcion, created_at) VALUES
 ('d0000000-0000-4000-8000-000000000001', NULL, 'bono_inicial', 5, 0, 5, 0, 0, 'Bono de bienvenida', now() - interval '10 days'),
 ('d0000000-0000-4000-8000-000000000002', NULL, 'bono_inicial', 5, 0, 5, 0, 0, 'Bono de bienvenida', now() - interval '10 days'),
 ('d0000000-0000-4000-8000-000000000003', NULL, 'bono_inicial', 5, 0, 5, 0, 0, 'Bono de bienvenida', now() - interval '10 days'),
 ('d0000000-0000-4000-8000-000000000004', NULL, 'bono_inicial', 5, 0, 5, 0, 0, 'Bono de bienvenida', now() - interval '10 days'),
 ('d0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','consumo',       1, 5, 4, 0, 0, 'Pago clase de Figma', now() - interval '3 days'),
 ('d0000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000001','transferencia', 1, 5, 6, 0, 0, 'Cobro clase de Figma', now() - interval '3 days'),
 ('d0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000002','retencion',     1, 5, 5, 0, 1, 'Reserva inglés con Ana', now() - interval '20 hours');

INSERT INTO calificaciones (id_reserva, id_evaluador, id_evaluado, puntuacion, comentario) VALUES
 ('f0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002',5,'Muy claro, recomendado'),
 ('f0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001',4,NULL);

INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje, leida) VALUES
 ('d0000000-0000-4000-8000-000000000001','solicitud','Nueva solicitud','María quiere una clase de inglés.', false),
 ('d0000000-0000-4000-8000-000000000002','reserva','Crédito recibido','Recibiste 1 crédito por la clase de Figma.', true),
 ('d0000000-0000-4000-8000-000000000003','cancelacion','Clase cancelada','María canceló la clase de Java.', false);

INSERT INTO auditoria (id_usuario, accion, entidad, entidad_id, datos_anteriores, datos_nuevos, ip, created_at) VALUES
 ('d0000000-0000-4000-8000-000000000004','INSERT','usuarios','d0000000-0000-4000-8000-000000000004', NULL,
  '{"correo":"maria.condori@ucb.edu.bo"}', '192.168.1.20', now() - interval '10 days'),
 ('d0000000-0000-4000-8000-000000000004','INSERT','solicitudes_intercambio','e0000000-0000-4000-8000-000000000004', NULL,
  '{"estado":"pendiente"}', '192.168.1.20', now() - interval '2 hours'),
 ('d0000000-0000-4000-8000-000000000004','UPDATE','reservas','f0000000-0000-4000-8000-000000000003',
  '{"estado":"pendiente"}', '{"estado":"cancelada"}', '192.168.1.20', now() - interval '1 day');

COMMIT;
