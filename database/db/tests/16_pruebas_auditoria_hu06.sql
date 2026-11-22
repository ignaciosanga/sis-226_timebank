\set ON_ERROR_STOP on
\if :{?enc_key}
\else
  \echo 'ERROR: falta enc_key. Pásala desde APP_ENCRYPTION_KEY del contenedor.'
  \quit 3
\endif

-- HU-06: prueba autocontenida. Crea sus propios datos, ejecuta las
-- operaciones como rol_app y termina con ROLLBACK.
BEGIN;
SET LOCAL TIME ZONE 'America/La_Paz';
SELECT set_config('app.encryption_key', :'enc_key', true);
SELECT set_config('app.hash_pepper', 'test-hash-pepper-only-for-transaction-32-characters', true);

DO $preflight$
BEGIN
  IF to_regrole('rol_app') IS NULL OR to_regrole('rol_lectura') IS NULL THEN
    RAISE EXCEPTION 'HU06: primero debe ejecutarse la configuración de roles V4.';
  END IF;
  IF to_regclass('public."AUDITORIA"') IS NULL THEN
    RAISE EXCEPTION 'HU06: no existe public.AUDITORIA.';
  END IF;
  IF NOT has_table_privilege('rol_app', 'public."RESERVAS"', 'UPDATE')
     OR NOT has_table_privilege('rol_app', 'public."USUARIOS"', 'UPDATE') THEN
    RAISE EXCEPTION 'HU06: rol_app debe poder actualizar RESERVAS y USUARIOS.';
  END IF;
  IF NOT has_table_privilege('rol_app', 'public."AUDITORIA"', 'SELECT') THEN
    RAISE EXCEPTION 'HU06: rol_app debe poder consultar auditoría para las validaciones.';
  END IF;
  IF has_table_privilege('rol_app', 'public."AUDITORIA"', 'UPDATE')
     OR has_table_privilege('rol_app', 'public."AUDITORIA"', 'DELETE') THEN
    RAISE EXCEPTION 'HU06: rol_app tiene permisos de escritura sobre AUDITORIA.';
  END IF;
  IF has_table_privilege('rol_lectura', 'public."AUDITORIA"', 'UPDATE')
     OR has_table_privilege('rol_lectura', 'public."AUDITORIA"', 'DELETE') THEN
    RAISE EXCEPTION 'HU06: rol_lectura tiene permisos de escritura sobre AUDITORIA.';
  END IF;
  IF NOT has_function_privilege('rol_app', 'public.decrypt_text(bytea)', 'EXECUTE') THEN
    RAISE EXCEPTION 'HU06: rol_app necesita EXECUTE en decrypt_text para verificar JSON cifrados.';
  END IF;
END;
$preflight$;

CREATE TEMP TABLE hu06_context (
  actor_id uuid NOT NULL,
  tutor_id uuid NOT NULL,
  solicitud_id uuid NOT NULL,
  reserva_id uuid NOT NULL,
  marca text NOT NULL
) ON COMMIT DROP;

DO $crear_datos$
DECLARE
  v_carrera uuid;
  v_categoria uuid := gen_random_uuid();
  v_habilidad uuid := gen_random_uuid();
  v_tutor uuid := gen_random_uuid();
  v_estudiante uuid := gen_random_uuid();
  v_solicitud uuid := gen_random_uuid();
  v_reserva uuid := gen_random_uuid();
  v_inicio timestamptz := clock_timestamp() + interval '8 hours';
  v_marca text := 'HU06_' || gen_random_uuid()::text;
BEGIN
  SELECT c."id_carrera" INTO v_carrera
  FROM public."CARRERAS" c ORDER BY c."nombre" LIMIT 1;
  IF v_carrera IS NULL THEN
    RAISE EXCEPTION 'HU06: no existe una carrera semilla.';
  END IF;

  INSERT INTO public."CATEGORIAS" ("id_categoria", "nombre", "estado")
  VALUES (v_categoria, 'ZZ_HU06_CAT_' || left(v_categoria::text, 8), 'activo');
  INSERT INTO public."HABILIDADES" ("id_habilidad", "nombre", "id_categoria", "estado")
  VALUES (v_habilidad, 'ZZ_HU06_HAB_' || left(v_habilidad::text, 8), v_categoria, 'activo');
  INSERT INTO public."USUARIOS" (
    "id_usuario", "nombre", "apellido", "correo", "password_hash", "rol",
    "id_carrera", "semestre", "saldo", "creditos_retenidos", "estado"
  ) VALUES
    (v_tutor, 'Tutor HU06', 'Prueba', 'hu06-tutor-' || v_tutor::text || '@test.invalid',
     'hash-inicial-no-utilizable', 'Estudiante', v_carrera, 4, 0, 0, 'Activo'),
    (v_estudiante, 'Estudiante HU06', 'Prueba', 'hu06-estudiante-' || v_estudiante::text || '@test.invalid',
     'hash-inicial-no-utilizable', 'Estudiante', v_carrera, 4, 100, 0, 'Activo');
  INSERT INTO public."USUARIO_HABILIDADES" ("id_usuario", "id_habilidad", "nivel")
  VALUES (v_tutor, v_habilidad, 'avanzado');

  INSERT INTO public."SOLICITUDES_INTERCAMBIO" (
    "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
    "fecha_inicio_propuesta", "fecha_fin_propuesta", "creditos_requeridos", "estado", "respondida_at"
  ) VALUES (
    v_solicitud, v_estudiante, v_tutor, v_habilidad,
    v_inicio, v_inicio + interval '1 hour', 37, 'Aceptada', clock_timestamp()
  );

  INSERT INTO hu06_context (actor_id, tutor_id, solicitud_id, reserva_id, marca)
  VALUES (v_estudiante, v_tutor, v_solicitud, v_reserva, v_marca);
END;
$crear_datos$;

SELECT actor_id::text AS hu06_actor_id,
       tutor_id::text AS hu06_tutor_id,
       solicitud_id::text AS hu06_solicitud_id,
       reserva_id::text AS hu06_reserva_id,
       marca AS hu06_marca
FROM hu06_context
\gset

SELECT set_config('app.usuario_actual', :'hu06_actor_id', true);
SELECT set_config('app.hu06_reserva_id', :'hu06_reserva_id', true);
SELECT set_config('app.hu06_marca', :'hu06_marca', true);
SELECT set_config('app.hu06_password_ts', clock_timestamp()::text, true);

-- Crea la reserva con el actor de auditoría ya establecido; la retención
-- se crea automáticamente al pasar a Confirmada.
INSERT INTO public."RESERVAS" (
  "id_reserva", "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
  "fecha_inicio", "fecha_fin", "creditos", "modalidad", "lugar", "estado"
)
SELECT :'hu06_reserva_id'::uuid, c.solicitud_id, c.actor_id, c.tutor_id,
       s."id_habilidad", clock_timestamp() + interval '8 hours',
       clock_timestamp() + interval '9 hours', 37, 'Virtual', :'hu06_marca', 'Confirmada'
FROM hu06_context c
JOIN public."SOLICITUDES_INTERCAMBIO" s ON s."id_solicitud" = c.solicitud_id;

-- Simula el acceso del Backend con su rol operativo.
SET LOCAL ROLE rol_app;

-- HU06-01: cancelación; debe guardar estado anterior/nuevo, actor y fecha.
UPDATE public."RESERVAS"
SET "estado" = 'Cancelada',
    "cancelado_por" = :'hu06_actor_id'::uuid,
    "motivo_cancelacion" = 'Cancelación de prueba HU06'
WHERE "id_reserva" = :'hu06_reserva_id'::uuid;

DO $ideal$
DECLARE
  v_actor uuid;
  v_fecha timestamptz;
  v_antes jsonb;
  v_despues jsonb;
  v_antes_claro jsonb;
  v_despues_claro jsonb;
  v_liberaciones integer;
BEGIN
  SELECT a."id_usuario", a."created_at",
         public.decrypt_text(a."datos_anteriores_enc")::jsonb,
         public.decrypt_text(a."datos_nuevos_enc")::jsonb,
         a."datos_anteriores", a."datos_nuevos"
    INTO v_actor, v_fecha, v_antes, v_despues, v_antes_claro, v_despues_claro
  FROM public."AUDITORIA" a
  WHERE a."entidad" = 'RESERVAS'
    AND a."accion" = 'UPDATE'
    AND a."entidad_id" = current_setting('app.hu06_reserva_id')::uuid
    AND public.decrypt_text(a."datos_nuevos_enc")::jsonb ->> 'lugar'
        = current_setting('app.hu06_marca')
  ORDER BY a."created_at" DESC LIMIT 1;

  IF NOT FOUND OR v_actor IS DISTINCT FROM current_setting('app.usuario_actual')::uuid
     OR v_fecha IS NULL
     OR v_antes ->> 'estado' IS DISTINCT FROM 'Confirmada'
     OR v_despues ->> 'estado' IS DISTINCT FROM 'Cancelada'
     OR v_antes_claro IS NOT NULL OR v_despues_claro IS NOT NULL THEN
    RAISE EXCEPTION 'HU06-01 FALLA: cancelación sin estado anterior/nuevo, actor, fecha o cifrado correcto.';
  END IF;

  SELECT COUNT(*) INTO v_liberaciones
  FROM public."MOVIMIENTOS_CREDITO" m
  WHERE m."id_reserva" = current_setting('app.hu06_reserva_id')::uuid
    AND m."tipo" = 'liberacion_retencion'
    AND m."retenidos_anterior" = 37
    AND m."retenidos_posterior" = 0;
  IF v_liberaciones <> 1 THEN
    RAISE EXCEPTION 'HU06-01 FALLA: se esperaba una liberación de retención; se obtuvo %.', v_liberaciones;
  END IF;
  RAISE NOTICE 'OK HU06-01: reserva auditada con estado anterior/nuevo, actor, fecha y JSON cifrado.';
END;
$ideal$;

-- HU06-02: cambia el hash temporalmente; el hash no debe aparecer en el JSON.
UPDATE public."USUARIOS"
SET "password_hash" = 'HU06_HASH_TEMPORAL_NO_UTILIZAR',
    "ultimo_acceso" = current_setting('app.hu06_password_ts')::timestamptz
WHERE "id_usuario" = :'hu06_actor_id'::uuid;

DO $alternativa$
DECLARE
  v_nuevo jsonb;
  v_nuevo_claro jsonb;
  v_nuevo_cipher bytea;
  v_fecha timestamptz;
BEGIN
  SELECT public.decrypt_text(a."datos_nuevos_enc")::jsonb,
         a."datos_nuevos", a."datos_nuevos_enc", a."created_at"
    INTO v_nuevo, v_nuevo_claro, v_nuevo_cipher, v_fecha
  FROM public."AUDITORIA" a
  WHERE a."entidad" = 'USUARIOS'
    AND a."accion" = 'UPDATE'
    AND a."entidad_id" = current_setting('app.usuario_actual')::uuid
    AND (public.decrypt_text(a."datos_nuevos_enc")::jsonb ->> 'ultimo_acceso')::timestamptz
        = current_setting('app.hu06_password_ts')::timestamptz
  ORDER BY a."created_at" DESC LIMIT 1;

  IF NOT FOUND OR v_nuevo IS NULL OR v_nuevo ? 'password_hash'
     OR v_nuevo_claro IS NOT NULL OR v_nuevo_cipher IS NULL OR v_fecha IS NULL THEN
    RAISE EXCEPTION 'HU06-02 FALLA: password_hash se filtró o el evento no quedó cifrado.';
  END IF;
  RAISE NOTICE 'OK HU06-02: cambio de contraseña auditado sin incluir password_hash.';
END;
$alternativa$;

-- HU06-03: PostgreSQL debe rechazar UPDATE y DELETE bajo rol_app.
DO $error$
DECLARE
  v_denegado boolean;
BEGIN
  v_denegado := false;
  BEGIN
    UPDATE public."AUDITORIA" SET "accion" = "accion" WHERE false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denegado := true;
  END;
  IF NOT v_denegado THEN
    RAISE EXCEPTION 'HU06-03 FALLA: rol_app pudo ejecutar UPDATE sobre AUDITORIA.';
  END IF;

  v_denegado := false;
  BEGIN
    DELETE FROM public."AUDITORIA" WHERE false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denegado := true;
  END;
  IF NOT v_denegado THEN
    RAISE EXCEPTION 'HU06-03 FALLA: rol_app pudo ejecutar DELETE sobre AUDITORIA.';
  END IF;
  RAISE NOTICE 'OK HU06-03: PostgreSQL rechazó UPDATE y DELETE sobre AUDITORIA para rol_app.';
END;
$error$;

RESET ROLE;
ROLLBACK;
\echo 'HU-06: las tres pruebas de aceptación finalizaron correctamente. Todas las filas de prueba fueron revertidas.'
