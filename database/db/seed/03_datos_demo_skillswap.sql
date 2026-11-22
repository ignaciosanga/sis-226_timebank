-- =====================================================================
-- DATOS DE DEMOSTRACION - SkillSwap / PostgreSQL 16
--
-- Proposito: poblar un conjunto pequeno para probar Match, disponibilidad,
-- solicitudes, reservas, calificaciones, creditos y vistas BI (HU-07).
--
-- IMPORTANTE:
-- 1) Ejecutar SOLO en una base de pruebas.
-- 2) Los seis usuarios tienen password_hash de demostracion y NO pueden
--    iniciar sesion en la aplicacion.
-- 3) El script usa APP_ENCRYPTION_KEY y APP_HASH_PEPPER del entorno Docker.
-- 4) Se puede volver a ejecutar: elimina y recrea unicamente las filas con
--    los UUID reservados para este conjunto DEMO.
-- 5) Todos los importes de credito estan en decimas: 10 = 1.0 credito.
--
-- Ejecucion desde CMD, situado en la carpeta del proyecto:
-- docker compose exec -T db psql -U skillswap_admin -d skillswap -v ON_ERROR_STOP=1 < 03_datos_demo_skillswap.sql
-- =====================================================================

\set ON_ERROR_STOP on

-- Obtener las claves desde las variables de entorno del contenedor.
-- No se escriben las claves dentro de este archivo .sql.
\getenv demo_enc_key APP_ENCRYPTION_KEY
\getenv demo_hash_pepper APP_HASH_PEPPER

\if :{?demo_enc_key}
\else
  \echo ERROR: No se encontro APP_ENCRYPTION_KEY en el entorno del contenedor.
  \quit
\endif
\if :{?demo_hash_pepper}
\else
  \echo ERROR: No se encontro APP_HASH_PEPPER en el entorno del contenedor.
  \quit
\endif

BEGIN;
SET LOCAL TIME ZONE 'America/La_Paz';

-- Las claves solo se establecen para esta transaccion y no se muestran.
SELECT set_config('app.encryption_key', :'demo_enc_key', true) AS configured \gset
SELECT set_config('app.hash_pepper', :'demo_hash_pepper', true) AS configured \gset
\unset configured
\unset demo_enc_key
\unset demo_hash_pepper

DO $$
BEGIN
    IF length(current_setting('app.encryption_key', true)) < 32 THEN
        RAISE EXCEPTION 'APP_ENCRYPTION_KEY no esta configurada o tiene menos de 32 caracteres.';
    END IF;
    IF length(current_setting('app.hash_pepper', true)) < 32 THEN
        RAISE EXCEPTION 'APP_HASH_PEPPER no esta configurada o tiene menos de 32 caracteres.';
    END IF;
    IF current_setting('app.encryption_key', true) = current_setting('app.hash_pepper', true) THEN
        RAISE EXCEPTION 'APP_ENCRYPTION_KEY y APP_HASH_PEPPER deben ser diferentes.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public."CARRERAS" WHERE "id_carrera" = '30000000-0000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'No existe la carrera semilla Ingenieria de Sistemas.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public."CARRERAS" WHERE "id_carrera" = '30000000-0000-4000-8000-000000000002') THEN
        RAISE EXCEPTION 'No existe la carrera semilla Administracion de Empresas.';
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 0) Limpiar solo el conjunto DEMO de una ejecucion anterior.
-- ---------------------------------------------------------------------
DELETE FROM public."MOVIMIENTOS_CREDITO"
WHERE "id_usuario" IN (
    '82000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000004',
    '82000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000006'
);

DELETE FROM public."CALIFICACIONES"
WHERE "id_calificacion" IN (
    '87000000-0000-4000-8000-000000000001', '87000000-0000-4000-8000-000000000002',
    '87000000-0000-4000-8000-000000000003'
)
OR "id_reserva" IN (
    '85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000002',
    '85000000-0000-4000-8000-000000000003', '85000000-0000-4000-8000-000000000004',
    '85000000-0000-4000-8000-000000000005', '85000000-0000-4000-8000-000000000006'
);

DELETE FROM public."RESERVAS"
WHERE "id_reserva" IN (
    '85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000002',
    '85000000-0000-4000-8000-000000000003', '85000000-0000-4000-8000-000000000004',
    '85000000-0000-4000-8000-000000000005', '85000000-0000-4000-8000-000000000006'
);

DELETE FROM public."SOLICITUDES_INTERCAMBIO"
WHERE "id_solicitud" IN (
    '84000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000002',
    '84000000-0000-4000-8000-000000000003', '84000000-0000-4000-8000-000000000004',
    '84000000-0000-4000-8000-000000000005', '84000000-0000-4000-8000-000000000006',
    '84000000-0000-4000-8000-000000000007'
);

DELETE FROM public."DISPONIBILIDADES"
WHERE "id_disponibilidad" IN (
    '83000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000002',
    '83000000-0000-4000-8000-000000000003', '83000000-0000-4000-8000-000000000004',
    '83000000-0000-4000-8000-000000000005', '83000000-0000-4000-8000-000000000006'
);

DELETE FROM public."USUARIO_HABILIDADES"
WHERE "id_usuario" IN (
    '82000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000004',
    '82000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000006'
)
OR "id_habilidad" IN (
    '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000004'
);

DELETE FROM public."USUARIOS"
WHERE "id_usuario" IN (
    '82000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000004',
    '82000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000006'
);

DELETE FROM public."HABILIDADES"
WHERE "id_habilidad" IN (
    '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000004'
);

DELETE FROM public."CATEGORIAS"
WHERE "id_categoria" IN (
    '80000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002'
);

-- ---------------------------------------------------------------------
-- 1) Catalogo de prueba: 2 categorias y 4 habilidades.
-- El prefijo DEMO evita colisiones con el catalogo oficial.
-- ---------------------------------------------------------------------
INSERT INTO public."CATEGORIAS" ("id_categoria", "nombre", "estado") VALUES
('80000000-0000-4000-8000-000000000001', 'DEMO - Programacion', 'activo'),
('80000000-0000-4000-8000-000000000002', 'DEMO - Analisis de datos', 'activo');

INSERT INTO public."HABILIDADES" ("id_habilidad", "nombre", "id_categoria", "estado") VALUES
('81000000-0000-4000-8000-000000000001', 'DEMO - Python',       '80000000-0000-4000-8000-000000000001', 'activo'),
('81000000-0000-4000-8000-000000000002', 'DEMO - SQL',          '80000000-0000-4000-8000-000000000002', 'activo'),
('81000000-0000-4000-8000-000000000003', 'DEMO - Excel',        '80000000-0000-4000-8000-000000000002', 'activo'),
('81000000-0000-4000-8000-000000000004', 'DEMO - Estadistica',  '80000000-0000-4000-8000-000000000002', 'activo');

-- ---------------------------------------------------------------------
-- 2) Usuarios ficticios.
-- Los tutores tambien usan rol='Estudiante', como exige el Match actual.
-- Los saldos iniciales ya reflejan las tres tutorias historicas; la
-- penalizacion de R05 se aplicara automaticamente mas abajo.
-- ---------------------------------------------------------------------
INSERT INTO public."USUARIOS" (
    "id_usuario", "nombre", "apellido", "correo", "password_hash", "rol",
    "id_carrera", "semestre", "saldo", "creditos_retenidos", "estado"
) VALUES
('82000000-0000-4000-8000-000000000001', 'Ana',    'Torres',       'ana.torres@skillswap.test',    '!DEMO_NO_LOGIN!', 'Estudiante', '30000000-0000-4000-8000-000000000001', 5,  76, 0, 'Activo'),
('82000000-0000-4000-8000-000000000002', 'Mateo',  'Rivas',        'mateo.rivas@skillswap.test',   '!DEMO_NO_LOGIN!', 'Estudiante', '30000000-0000-4000-8000-000000000001', 4,   0, 0, 'Activo'),
('82000000-0000-4000-8000-000000000003', 'Bruno',  'Salvatierra',  'bruno.salvatierra@skillswap.test', '!DEMO_NO_LOGIN!', 'Estudiante', '30000000-0000-4000-8000-000000000001', 6,  25, 0, 'Activo'),
('82000000-0000-4000-8000-000000000004', 'Diego',  'Rojas',        'diego.rojas@skillswap.test',   '!DEMO_NO_LOGIN!', 'Estudiante', '30000000-0000-4000-8000-000000000002', 3,   0, 0, 'Activo'),
('82000000-0000-4000-8000-000000000005', 'Carla',  'Mendez',       'carla.mendez@skillswap.test',  '!DEMO_NO_LOGIN!', 'Estudiante', '30000000-0000-4000-8000-000000000001', 2,  24, 0, 'Activo'),
('82000000-0000-4000-8000-000000000006', 'Elena',  'Vargas',       'elena.vargas@skillswap.test',  '!DEMO_NO_LOGIN!', 'Estudiante', '30000000-0000-4000-8000-000000000002', 3,  75, 0, 'Activo');

-- ---------------------------------------------------------------------
-- 3) Habilidades ofrecidas por tutores.
-- NOTA: USUARIO_HABILIDADES no distingue entre "ofrece" y "quiere
-- aprender"; el Match cuenta estas filas como oferta. Por eso solo se
-- registran aqui las habilidades que los tutores realmente ofrecen.
-- La demanda de aprendizaje se representa con SOLICITUDES_INTERCAMBIO.
-- ---------------------------------------------------------------------
INSERT INTO public."USUARIO_HABILIDADES" ("id_usuario", "id_habilidad", "nivel") VALUES
('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'intermedio'),
('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', 'intermedio'),
('82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', 'avanzado'),
('82000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000002', 'avanzado'),
('82000000-0000-4000-8000-000000000004', '81000000-0000-4000-8000-000000000003', 'avanzado');

-- ---------------------------------------------------------------------
-- 4) Disponibilidades para la proxima semana.
-- La fecha se calcula desde el lunes de la semana actual, por lo que el
-- conjunto sigue siendo util aunque se ejecute otro dia.
-- ---------------------------------------------------------------------
INSERT INTO public."DISPONIBILIDADES" (
    "id_disponibilidad", "id_usuario", "fecha_inicio", "fecha_fin", "estado"
) VALUES
('83000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 7) + TIME '18:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 7) + TIME '20:00') AT TIME ZONE 'America/La_Paz', 'disponible'),
('83000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000001', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 9) + TIME '17:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 9) + TIME '19:00') AT TIME ZONE 'America/La_Paz', 'disponible'),
('83000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000002', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 7) + TIME '18:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 7) + TIME '20:00') AT TIME ZONE 'America/La_Paz', 'disponible'),
('83000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000003', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 8) + TIME '16:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 8) + TIME '18:00') AT TIME ZONE 'America/La_Paz', 'disponible'),
('83000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000003', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 10) + TIME '18:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 10) + TIME '20:00') AT TIME ZONE 'America/La_Paz', 'disponible'),
('83000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000004', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 9) + TIME '14:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 9) + TIME '16:00') AT TIME ZONE 'America/La_Paz', 'disponible');

-- ---------------------------------------------------------------------
-- 5) Solicitudes: tres historicas, una aceptada y tres pendientes.
-- Estadistica queda activa en catalogo, pero sin tutores asociados.
-- ---------------------------------------------------------------------
INSERT INTO public."SOLICITUDES_INTERCAMBIO" (
    "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
    "fecha_inicio_propuesta", "fecha_fin_propuesta", "creditos_requeridos",
    "estado", "respondida_at"
) VALUES
('84000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 7) + TIME '18:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 7) + TIME '19:00') AT TIME ZONE 'America/La_Paz', 38, 'Completada', clock_timestamp()),
('84000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 5) + TIME '18:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 5) + TIME '19:00') AT TIME ZONE 'America/La_Paz', 38, 'Completada', clock_timestamp()),
('84000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000002', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 6) + TIME '16:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 6) + TIME '17:00') AT TIME ZONE 'America/La_Paz', 25, 'Completada', clock_timestamp()),
('84000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 7) + TIME '18:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 7) + TIME '19:00') AT TIME ZONE 'America/La_Paz', 38, 'Aceptada', clock_timestamp()),
('84000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000002', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 10) + TIME '18:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 10) + TIME '19:00') AT TIME ZONE 'America/La_Paz', 25, 'Solicitada', NULL),
('84000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000004', '81000000-0000-4000-8000-000000000003', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 9) + TIME '14:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 9) + TIME '15:00') AT TIME ZONE 'America/La_Paz', 25, 'Solicitada', NULL),
('84000000-0000-4000-8000-000000000007', '82000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 7) + TIME '18:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 7) + TIME '19:00') AT TIME ZONE 'America/La_Paz', 38, 'Solicitada', NULL);

-- ---------------------------------------------------------------------
-- 6) Reservas: 3 completadas, 1 confirmada y 2 canceladas.
-- Las cancelaciones usan clock_timestamp() para probar los umbrales reales:
-- R05 se cancela con 4 horas de anticipacion (<5) y R06 con 6 horas (>5).
-- ---------------------------------------------------------------------
INSERT INTO public."RESERVAS" (
    "id_reserva", "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
    "fecha_inicio", "fecha_fin", "creditos", "modalidad", "lugar", "estado", "created_at", "completed_at"
) VALUES
('85000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 7) + TIME '18:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 7) + TIME '19:00') AT TIME ZONE 'America/La_Paz', 38, 'Virtual', 'Sesion DEMO Python 1', 'Completada', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 9) + TIME '10:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 7) + TIME '19:00') AT TIME ZONE 'America/La_Paz'),
('85000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 5) + TIME '18:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 5) + TIME '19:00') AT TIME ZONE 'America/La_Paz', 38, 'Virtual', 'Sesion DEMO Python 2', 'Completada', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 7) + TIME '10:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 5) + TIME '19:00') AT TIME ZONE 'America/La_Paz'),
('85000000-0000-4000-8000-000000000003', '84000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000002', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 6) + TIME '16:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 6) + TIME '17:00') AT TIME ZONE 'America/La_Paz', 25, 'Virtual', 'Sesion DEMO SQL', 'Completada', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 8) + TIME '10:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date - 6) + TIME '17:00') AT TIME ZONE 'America/La_Paz'),
('85000000-0000-4000-8000-000000000004', '84000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 7) + TIME '18:00') AT TIME ZONE 'America/La_Paz', ((date_trunc('week', CURRENT_DATE::timestamp)::date + 7) + TIME '19:00') AT TIME ZONE 'America/La_Paz', 38, 'Virtual', 'Sesion DEMO Python futura', 'Confirmada', clock_timestamp(), NULL),
('85000000-0000-4000-8000-000000000006', NULL, '82000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000004', '81000000-0000-4000-8000-000000000003', clock_timestamp() + interval '6 hours', clock_timestamp() + interval '7 hours', 25, 'Virtual', 'Cancelacion DEMO sin penalizacion', 'Cancelada', clock_timestamp(), NULL);

-- Historial de calificaciones: Ana = 4.5; Bruno = 4.0; Diego = sin notas.
INSERT INTO public."CALIFICACIONES" (
    "id_calificacion", "id_reserva", "id_evaluador", "id_evaluado", "puntuacion", "comentario"
) VALUES
('87000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000001', 4, 'Buena explicacion.'),
('87000000-0000-4000-8000-000000000002', '85000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000001', 5, 'Excelente tutoria.'),
('87000000-0000-4000-8000-000000000003', '85000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000003', 4, 'Sesion satisfactoria.');

-- ---------------------------------------------------------------------
-- 7) Libro de movimientos historicos.
-- Saldos en decimas. Los saldos finales previos a la cancelacion R05 son:
-- Carla 24, Ana 76, Elena 75 y Bruno 25.
-- R05 insertada a continuacion descontara 5 unidades a Carla.
-- ---------------------------------------------------------------------
INSERT INTO public."MOVIMIENTOS_CREDITO" (
    "id_movimiento", "id_usuario", "id_reserva", "tipo", "cantidad",
    "saldo_anterior", "saldo_posterior", "retenidos_anterior", "retenidos_posterior", "descripcion"
) VALUES
('86000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000005', NULL, 'recarga_demo', 100, 0, 100, 0, 0, 'Saldo inicial de demostracion: 10.0 creditos.'),
('86000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000005', '85000000-0000-4000-8000-000000000001', 'pago_tutoria', -38, 100, 62, 0, 0, 'Pago de R01: 3.8 creditos.'),
('86000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000005', '85000000-0000-4000-8000-000000000002', 'pago_tutoria', -38, 62, 24, 0, 0, 'Pago de R02: 3.8 creditos.'),
('86000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000001', 'ingreso_tutoria', 38, 0, 38, 0, 0, 'Ingreso por R01: 3.8 creditos.'),
('86000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000002', 'ingreso_tutoria', 38, 38, 76, 0, 0, 'Ingreso por R02: 3.8 creditos.'),
('86000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000006', NULL, 'recarga_demo', 100, 0, 100, 0, 0, 'Saldo inicial de demostracion: 10.0 creditos.'),
('86000000-0000-4000-8000-000000000007', '82000000-0000-4000-8000-000000000006', '85000000-0000-4000-8000-000000000003', 'pago_tutoria', -25, 100, 75, 0, 0, 'Pago de R03: 2.5 creditos.'),
('86000000-0000-4000-8000-000000000008', '82000000-0000-4000-8000-000000000003', '85000000-0000-4000-8000-000000000003', 'ingreso_tutoria', 25, 0, 25, 0, 0, 'Ingreso por R03: 2.5 creditos.');

-- R05: cancelacion tardia. El trigger debe restar 5 decimas a Carla,
-- crear el movimiento tipo 'penalizacion' y dejar su saldo en 19.
INSERT INTO public."RESERVAS" (
    "id_reserva", "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
    "fecha_inicio", "fecha_fin", "creditos", "modalidad", "lugar", "estado",
    "cancelado_por", "motivo_cancelacion", "cancelled_at", "created_at"
) VALUES (
    '85000000-0000-4000-8000-000000000005', NULL,
    '82000000-0000-4000-8000-000000000005',
    '82000000-0000-4000-8000-000000000003',
    '81000000-0000-4000-8000-000000000002',
    clock_timestamp() + interval '4 hours',
    clock_timestamp() + interval '5 hours',
    public.fn_calcular_costo_clase(
        '81000000-0000-4000-8000-000000000002',
        '82000000-0000-4000-8000-000000000003',
        clock_timestamp() + interval '4 hours'
    ),
    'Virtual', 'Cancelacion DEMO con penalizacion', 'Cancelada',
    '82000000-0000-4000-8000-000000000005',
    'Cancelacion de prueba con menos de cinco horas.',
    clock_timestamp(), clock_timestamp()
);

-- ---------------------------------------------------------------------
-- 8) Comprobaciones: si algun resultado no coincide, la transaccion falla.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    v_saldo_carla integer;
    v_saldo_ana integer;
    v_saldo_elena integer;
    v_saldo_bruno integer;
    v_penalizaciones integer;
    v_notas_ana numeric;
BEGIN
    SELECT "saldo" INTO v_saldo_carla FROM public."USUARIOS" WHERE "id_usuario" = '82000000-0000-4000-8000-000000000005';
    SELECT "saldo" INTO v_saldo_ana   FROM public."USUARIOS" WHERE "id_usuario" = '82000000-0000-4000-8000-000000000001';
    SELECT "saldo" INTO v_saldo_elena FROM public."USUARIOS" WHERE "id_usuario" = '82000000-0000-4000-8000-000000000006';
    SELECT "saldo" INTO v_saldo_bruno FROM public."USUARIOS" WHERE "id_usuario" = '82000000-0000-4000-8000-000000000003';
    SELECT COUNT(*) INTO v_penalizaciones FROM public."MOVIMIENTOS_CREDITO"
      WHERE "id_reserva" = '85000000-0000-4000-8000-000000000005' AND "tipo" = 'penalizacion' AND "cantidad" = -5;
    SELECT AVG("puntuacion") INTO v_notas_ana FROM public."CALIFICACIONES"
      WHERE "id_evaluado" = '82000000-0000-4000-8000-000000000001';

    IF v_saldo_carla <> 19 OR v_saldo_ana <> 76 OR v_saldo_elena <> 75 OR v_saldo_bruno <> 25 THEN
        RAISE EXCEPTION 'Saldos DEMO inesperados: Carla %, Ana %, Elena %, Bruno %.',
            v_saldo_carla, v_saldo_ana, v_saldo_elena, v_saldo_bruno;
    END IF;
    IF v_penalizaciones <> 1 THEN
        RAISE EXCEPTION 'Se esperaba exactamente una penalizacion de 5 decimas para R05; se encontraron %.', v_penalizaciones;
    END IF;
    IF v_notas_ana <> 4.5 THEN
        RAISE EXCEPTION 'El promedio de Ana debia ser 4.5 y se obtuvo %.', v_notas_ana;
    END IF;
END;
$$;

COMMIT;

\echo 'Datos DEMO cargados correctamente.'
\echo 'Usuarios: 6 | Habilidades: 4 | Reservas: 6 | Calificaciones: 3.'
\echo 'Carla debe quedar con 1.9 creditos (19 decimas).'

-- ---------------------------------------------------------------------
-- 9) Consultas de evidencia. Deben mostrar resultados con datos.
-- ---------------------------------------------------------------------
SELECT
    u."nombre", u."apellido", u."saldo" AS saldo_decimas,
    ROUND(u."saldo"::numeric / 10, 1) AS saldo_creditos
FROM public."USUARIOS" u
WHERE u."id_usuario" IN (
    '82000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000004',
    '82000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000006'
)
ORDER BY u."apellido";

SELECT "estado", COUNT(*) AS total
FROM public."RESERVAS"
WHERE "id_reserva" BETWEEN '85000000-0000-4000-8000-000000000001'::uuid
                        AND '85000000-0000-4000-8000-000000000006'::uuid
GROUP BY "estado"
ORDER BY "estado";

SELECT *
FROM public.v_bi_reservas_por_hora
WHERE total_reservas > 0
ORDER BY hora_local;

SELECT materia, solicitudes_pendientes, tutores_activos, indice_brecha
FROM public.v_bi_materias_oferta_demanda
WHERE materia LIKE 'DEMO -%'
ORDER BY materia;

SELECT materia, solicitudes_pendientes, oferta_tutores, indice_brecha
FROM public.v_bi_materias_sin_tutores
WHERE materia LIKE 'DEMO -%'
ORDER BY materia;

-- Match Python para el proximo lunes a las 18:00; deberian aparecer Ana y Mateo.
SELECT *
FROM public.fn_obtener_top_tutores(
    '81000000-0000-4000-8000-000000000001',
    ((date_trunc('week', CURRENT_DATE::timestamp)::date + 7) + TIME '18:00') AT TIME ZONE 'America/La_Paz',
    ((date_trunc('week', CURRENT_DATE::timestamp)::date + 7) + TIME '19:00') AT TIME ZONE 'America/La_Paz',
    'Virtual'
);

-- Promedios y clases completadas para el tablero Knowledge Score.
SELECT "nombre", "clases_completadas", "promedio_estrellas", "score_impacto"
FROM public.v_knowledge_score
WHERE "id_usuario" IN (
    '82000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000003',
    '82000000-0000-4000-8000-000000000004'
)
ORDER BY "nombre";
