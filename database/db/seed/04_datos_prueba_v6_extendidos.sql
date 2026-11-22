-- ============================================================================
-- SKILLSWAP V6 | DATOS FICTICIOS ADICIONALES PARA PRUEBAS (NO PRODUCCION)
-- Ejecutar DESPUES de 03_datos_demo_skillswap.sql, en PostgreSQL 16.
-- No cambia el esquema, las funciones, los permisos ni la logica de negocio.
-- Cubre HU-04 / HU-07 / HU-10 / penalizaciones pendientes / notificaciones.
-- Usuarios de prueba: password_hash invalido; no se puede iniciar sesion con ellos.
-- Creditos reales NUMERIC(12,2), una sola cifra decimal; 3.7 = 3.70.
-- Se usa un rango propio de UUID (90..99) para no chocar con la demo (80..87).
-- La recarga inicial es DEMO, no dinero real.
-- ============================================================================
\set ON_ERROR_STOP on

-- No repetir operaciones economicas si los datos ya fueron cargados.
SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public."CATEGORIAS"
    WHERE "id_categoria" = '90000000-0000-4000-8000-000000000001'::uuid
) THEN 'true' ELSE 'false' END AS v6_qa_cargado \gset
\if :v6_qa_cargado
  \echo 'SkillSwap V6: los datos QA adicionales ya estan cargados. Sin cambios.'
  \quit
\endif
\unset v6_qa_cargado

-- Las mismas variables utilizadas por el seed original; no se incrustan secretos.
\getenv qa_enc_key APP_ENCRYPTION_KEY
\getenv qa_hash_pepper APP_HASH_PEPPER
\if :{?qa_enc_key}
\else
  \echo 'ERROR: falta APP_ENCRYPTION_KEY dentro del contenedor.'
  \quit
\endif
\if :{?qa_hash_pepper}
\else
  \echo 'ERROR: falta APP_HASH_PEPPER dentro del contenedor.'
  \quit
\endif

BEGIN;
SET LOCAL TIME ZONE 'America/La_Paz';
SELECT set_config('app.encryption_key', :'qa_enc_key', true) AS configured \gset
SELECT set_config('app.hash_pepper', :'qa_hash_pepper', true) AS configured \gset
\unset configured
\unset qa_enc_key
\unset qa_hash_pepper

-- Asegurar que el paquete v6 y sus reglas de prueba esten presentes.
DO $pre$
BEGIN
  IF current_setting('app.encryption_key', true) IS NULL
     OR length(current_setting('app.encryption_key', true)) < 32
     OR current_setting('app.hash_pepper', true) IS NULL
     OR length(current_setting('app.hash_pepper', true)) < 32 THEN
    RAISE EXCEPTION 'Claves de pruebas ausentes o demasiado cortas.';
  END IF;
  IF to_regclass('public."OFERTAS_TUTORIA"') IS NULL
     OR to_regclass('public."PENALIZACIONES_PENDIENTES"') IS NULL
     OR to_regprocedure('public.fn_confirmar_reserva(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Esta prueba necesita el esquema completo de SkillSwap V6.';
  END IF;
  IF (SELECT "valor" FROM public.config_economia WHERE "clave"='penalizacion_creditos') IS DISTINCT FROM 0.5::numeric
     OR (SELECT "valor" FROM public.config_economia WHERE "clave"='horas_minimas_cancelacion') IS DISTINCT FROM 5.0::numeric THEN
    RAISE EXCEPTION 'Este fixture necesita penalizacion_creditos=0.5 y horas_minimas_cancelacion=5.';
  END IF;
  IF EXISTS (SELECT 1 FROM public."USUARIOS"
             WHERE "id_usuario" BETWEEN '92000000-0000-4000-8000-000000000001'::uuid
                                    AND '92000000-0000-4000-8000-000000000004'::uuid) THEN
    RAISE EXCEPTION 'Algunos UUID QA ya existen; no se mezclaran con datos previos.';
  END IF;
END;
$pre$;

-- A) Catalogo: dos habilidades con tutor y una sin tutor (BI de oferta cero).
INSERT INTO public."CATEGORIAS" ("id_categoria", "nombre", "estado") VALUES
 ('90000000-0000-4000-8000-000000000001', 'QA V6 - Tecnologia', 'activo'),
 ('90000000-0000-4000-8000-000000000002', 'QA V6 - Metodos', 'activo');

INSERT INTO public."HABILIDADES" ("id_habilidad", "nombre", "id_categoria", "estado") VALUES
 ('91000000-0000-4000-8000-000000000001', 'QA V6 - Kotlin', '90000000-0000-4000-8000-000000000001', 'activo'),
 ('91000000-0000-4000-8000-000000000002', 'QA V6 - Excel avanzado', '90000000-0000-4000-8000-000000000002', 'activo'),
 ('91000000-0000-4000-8000-000000000003', 'QA V6 - Probabilidad', '90000000-0000-4000-8000-000000000002', 'activo');

-- B) Cuatro estudiantes ficticios: Lucia/Pablo son tutores; Sofia paga; Hugo sin saldo.
-- Se utiliza una carrera ya sembrada por 01_base_a_schema.sql.
INSERT INTO public."USUARIOS" (
 "id_usuario", "nombre", "apellido", "correo", "password_hash", "rol",
 "id_carrera", "semestre", "saldo", "creditos_retenidos", "estado"
) VALUES
 ('92000000-0000-4000-8000-000000000001','Lucia','Ejemplo','qa-v6-lucia@skillswap.test','!NO_LOGIN_QA_V6!','Estudiante','30000000-0000-4000-8000-000000000001',5,0.0,0.0,'Activo'),
 ('92000000-0000-4000-8000-000000000002','Pablo','Ejemplo','qa-v6-pablo@skillswap.test','!NO_LOGIN_QA_V6!','Estudiante','30000000-0000-4000-8000-000000000001',6,0.0,0.0,'Activo'),
 ('92000000-0000-4000-8000-000000000003','Sofia','Ejemplo','qa-v6-sofia@skillswap.test','!NO_LOGIN_QA_V6!','Estudiante','30000000-0000-4000-8000-000000000001',3,10.0,0.0,'Activo'),
 ('92000000-0000-4000-8000-000000000004','Hugo','Ejemplo','qa-v6-hugo@skillswap.test','!NO_LOGIN_QA_V6!','Estudiante','30000000-0000-4000-8000-000000000002',2,0.0,0.0,'Activo');

INSERT INTO public."MOVIMIENTOS_CREDITO" (
 "id_movimiento","id_usuario","id_reserva","tipo","cantidad",
 "saldo_anterior","saldo_posterior","retenidos_anterior","retenidos_posterior","descripcion"
) VALUES (
 '96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003',NULL,
 'recarga_demo',10.0,0.0,10.0,0.0,0.0,'Recarga ficticia de prueba QA V6: 10.0 creditos.'
);

INSERT INTO public."USUARIO_HABILIDADES" ("id_usuario","id_habilidad","nivel") VALUES
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','avanzado'),
 ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','intermedio');

-- C) Franjas futuras para matching, ofertas a precio elegido por el tutor.
INSERT INTO public."DISPONIBILIDADES" (
 "id_disponibilidad","id_usuario","fecha_inicio","fecha_fin","estado"
) VALUES
 ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '2 days',clock_timestamp() + interval '2 days 2 hours','disponible'),
 ('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002',
  clock_timestamp() + interval '4 days',clock_timestamp() + interval '4 days 2 hours','disponible');

INSERT INTO public."OFERTAS_TUTORIA" (
 "id_oferta","id_usuario","id_habilidad","titulo","descripcion",
 "fecha_inicio","fecha_fin","costo_creditos","estado"
) VALUES
 ('98000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001','QA V6 - Clase de Kotlin 3.7',
  'Oferta ficticia para comprobar el precio decimal y los pagos.',
  clock_timestamp() + interval '2 days',clock_timestamp() + interval '2 days 1 hour',3.7,'Activa'),
 ('98000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000002','QA V6 - Clase de Excel 2.5',
  'Oferta ficticia para comprobar la retencion sin transferir el pago.',
  clock_timestamp() + interval '4 days',clock_timestamp() + interval '4 days 1 hour',2.5,'Activa');

-- D) Cancelaciones tardias con 0 saldo: generan penalizacion pendiente 0.5.
-- Primero se cargan las cancelaciones; luego Lucia recibe 3.7 y su deuda se cobra.
INSERT INTO public."RESERVAS" (
 "id_reserva","id_solicitud","id_solicitante","id_ofertante","id_habilidad",
 "fecha_inicio","fecha_fin","creditos","modalidad","lugar","estado",
 "cancelado_por","motivo_cancelacion","cancelled_at"
) VALUES
 ('95000000-0000-4000-8000-000000000001',NULL,
  '92000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',clock_timestamp()+interval '3 hours',clock_timestamp()+interval '4 hours',
  3.7,'Virtual','QA V6 - Cancelacion tardia de Lucia','Cancelada',
  '92000000-0000-4000-8000-000000000001','QA: tutor sin saldo cancela tarde.',clock_timestamp()),
 ('95000000-0000-4000-8000-000000000002',NULL,
  '92000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000002',clock_timestamp()+interval '3 hours',clock_timestamp()+interval '4 hours',
  2.5,'Virtual','QA V6 - Cancelacion tardia de Pablo','Cancelada',
  '92000000-0000-4000-8000-000000000002','QA: tutor sin saldo cancela tarde.',clock_timestamp());

-- E) Solicitudes para reserva pagada, reserva retenida y pendientes de demanda.
INSERT INTO public."SOLICITUDES_INTERCAMBIO" (
 "id_solicitud","id_solicitante","id_ofertante","id_habilidad",
 "fecha_inicio_propuesta","fecha_fin_propuesta","creditos_requeridos","estado","respondida_at"
) VALUES
 ('94000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',clock_timestamp()+interval '2 days',clock_timestamp()+interval '2 days 1 hour',3.7,'Aceptada',clock_timestamp()),
 ('94000000-0000-4000-8000-000000000002',
  '92000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000002',clock_timestamp()+interval '4 days',clock_timestamp()+interval '4 days 1 hour',2.5,'Aceptada',clock_timestamp()),
 ('94000000-0000-4000-8000-000000000003',
  '92000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',clock_timestamp()+interval '5 days',clock_timestamp()+interval '5 days 1 hour',3.7,'Solicitada',NULL),
 ('94000000-0000-4000-8000-000000000004',
  '92000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000002',clock_timestamp()+interval '6 days',clock_timestamp()+interval '6 days 1 hour',2.5,'Solicitada',NULL);

-- F) Primera reserva: retiene 3.7, se confirma por ambos y paga 3.7.
-- El trigger de USUARIOS cobra entonces la penalizacion pendiente de Lucia.
INSERT INTO public."RESERVAS" (
 "id_reserva","id_solicitud","id_solicitante","id_ofertante","id_habilidad",
 "fecha_inicio","fecha_fin","creditos","modalidad","lugar","estado"
) VALUES (
 '95000000-0000-4000-8000-000000000003','94000000-0000-4000-8000-000000000001',
 '92000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001',
 '91000000-0000-4000-8000-000000000001',clock_timestamp()+interval '2 days',clock_timestamp()+interval '2 days 1 hour',
 3.7,'Virtual','QA V6 - Pago completado de 3.7','Confirmada'
);

DO $confirmaciones$
DECLARE
  v_estado varchar;
BEGIN
  PERFORM set_config('app.usuario_actual','92000000-0000-4000-8000-000000000003',true);
  v_estado := public.fn_confirmar_reserva('95000000-0000-4000-8000-000000000003');
  IF v_estado IS DISTINCT FROM 'Confirmada' THEN
    RAISE EXCEPTION 'QA: tras la primera confirmacion se esperaba Confirmada, se obtuvo %.',v_estado;
  END IF;
  PERFORM set_config('app.usuario_actual','92000000-0000-4000-8000-000000000001',true);
  v_estado := public.fn_confirmar_reserva('95000000-0000-4000-8000-000000000003');
  IF v_estado IS DISTINCT FROM 'Completada' THEN
    RAISE EXCEPTION 'QA: tras las dos confirmaciones se esperaba Completada, se obtuvo %.',v_estado;
  END IF;
  PERFORM set_config('app.usuario_actual','',true);
END;
$confirmaciones$;

-- G) Segunda reserva: precio 2.5 retenido y sin transferir hasta confirmar.
INSERT INTO public."RESERVAS" (
 "id_reserva","id_solicitud","id_solicitante","id_ofertante","id_habilidad",
 "fecha_inicio","fecha_fin","creditos","modalidad","lugar","estado"
) VALUES (
 '95000000-0000-4000-8000-000000000004','94000000-0000-4000-8000-000000000002',
 '92000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002',
 '91000000-0000-4000-8000-000000000002',clock_timestamp()+interval '4 days',clock_timestamp()+interval '4 days 1 hour',
 2.5,'Virtual','QA V6 - Retencion 2.5 sin pago','Confirmada'
);

-- H) Una cancelacion temprana sin multa y otra tardia sin saldo (Hugo).
INSERT INTO public."RESERVAS" (
 "id_reserva","id_solicitud","id_solicitante","id_ofertante","id_habilidad",
 "fecha_inicio","fecha_fin","creditos","modalidad","lugar","estado",
 "cancelado_por","motivo_cancelacion","cancelled_at"
) VALUES
 ('95000000-0000-4000-8000-000000000005',NULL,
  '92000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',clock_timestamp()+interval '10 hours',clock_timestamp()+interval '11 hours',
  3.7,'Virtual','QA V6 - Cancelacion a tiempo','Cancelada',
  '92000000-0000-4000-8000-000000000004','QA: cancelar con mas de cinco horas.',clock_timestamp()),
 ('95000000-0000-4000-8000-000000000006',NULL,
  '92000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',clock_timestamp()+interval '3 hours',clock_timestamp()+interval '4 hours',
  3.7,'Virtual','QA V6 - Penalizacion pendiente de Hugo','Cancelada',
  '92000000-0000-4000-8000-000000000004','QA: cancelar tarde sin creditos.',clock_timestamp());

-- I) Calificaciones y notificaciones de prueba (solo referencias ficticias).
INSERT INTO public."CALIFICACIONES" (
 "id_calificacion","id_reserva","id_evaluador","id_evaluado","puntuacion","comentario"
) VALUES
 ('97000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000003',
  '92000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001',5,'QA V6: tutoria clara.'),
 ('97000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000003',
  '92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003',4,'QA V6: estudiante puntual.');

INSERT INTO public."NOTIFICACIONES" (
 "id_notificacion","id_usuario","tipo","titulo","mensaje","leida"
) VALUES
 ('99000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003',
  'reserva','QA V6: reserva confirmada','Tu reserva ficticia de Excel tiene 2.5 creditos retenidos.',false),
 ('99000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001',
  'pago','QA V6: pago recibido','Recibiste 3.7 creditos ficticios y se cobro una penalizacion de 0.5.',true),
 ('99000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002',
  'penalizacion','QA V6: penalizacion pendiente','Tienes una penalizacion de 0.5 creditos por cobrar.',false);

-- J) Validacion antes de COMMIT: si algo falla no se carga ningun dato QA.
DO $assert$
DECLARE
  v_saldo_sofia numeric(12,2);
  v_ret_sofia numeric(12,2);
  v_saldo_lucia numeric(12,2);
  v_saldo_pablo numeric(12,2);
  v_pen_pend integer;
  v_pen_cob integer;
  v_mov_pago integer;
  v_mov_reten integer;
BEGIN
  SELECT "saldo","creditos_retenidos" INTO v_saldo_sofia,v_ret_sofia
    FROM public."USUARIOS" WHERE "id_usuario"='92000000-0000-4000-8000-000000000003';
  SELECT "saldo" INTO v_saldo_lucia FROM public."USUARIOS" WHERE "id_usuario"='92000000-0000-4000-8000-000000000001';
  SELECT "saldo" INTO v_saldo_pablo FROM public."USUARIOS" WHERE "id_usuario"='92000000-0000-4000-8000-000000000002';
  SELECT COUNT(*) FILTER (WHERE "estado"='pendiente'),
         COUNT(*) FILTER (WHERE "estado"='cobrada')
    INTO v_pen_pend, v_pen_cob
    FROM public."PENALIZACIONES_PENDIENTES"
    WHERE "id_reserva" IN (
      '95000000-0000-4000-8000-000000000001',
      '95000000-0000-4000-8000-000000000002',
      '95000000-0000-4000-8000-000000000006');
  SELECT COUNT(*) INTO v_mov_pago FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva"='95000000-0000-4000-8000-000000000003' AND "tipo"='pago_tutoria' AND "cantidad"=-3.7;
  SELECT COUNT(*) INTO v_mov_reten FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva"='95000000-0000-4000-8000-000000000004' AND "tipo"='retencion_reserva' AND "retenidos_posterior"=2.5;
  IF v_saldo_sofia IS DISTINCT FROM 6.3 OR v_ret_sofia IS DISTINCT FROM 2.5
     OR v_saldo_lucia IS DISTINCT FROM 3.2 OR v_saldo_pablo IS DISTINCT FROM 0.0
     OR v_pen_pend<>2 OR v_pen_cob<>1 OR v_mov_pago<>1 OR v_mov_reten<>1 THEN
    RAISE EXCEPTION
      'Datos QA no concilian: Sofia % retenidos %, Lucia %, Pablo %, pendientes %, cobradas %, pagos %, retenciones %.',
      v_saldo_sofia,v_ret_sofia,v_saldo_lucia,v_saldo_pablo,v_pen_pend,v_pen_cob,v_mov_pago,v_mov_reten;
  END IF;
  IF EXISTS (SELECT 1 FROM public."PENALIZACIONES_PENDIENTES"
             WHERE "id_reserva"='95000000-0000-4000-8000-000000000005') THEN
    RAISE EXCEPTION 'La cancelacion temprana genero una penalizacion incorrecta.';
  END IF;
  RAISE NOTICE 'QA V6 OK: 4 usuarios; 2 ofertas; 6 reservas; 1 pago; 2 pendientes y 1 cobrada.';
END;
$assert$;

COMMIT;
\echo 'Datos QA V6 cargados: 4 usuarios ficticios, 3 habilidades, 2 ofertas y 6 reservas.'
\echo 'Sofia: saldo 6.3, retenidos 2.5. Lucia: saldo 3.2 tras cobrar multa 0.5.'
\echo 'Penalizaciones: 2 pendientes (Pablo/Hugo) y 1 cobrada (Lucia).'
