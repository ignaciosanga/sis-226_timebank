\set ON_ERROR_STOP on
SET client_min_messages = warning;

-- HU-04: ofertas persistentes y precio definido por el tutor.
-- Ejecutar como administrador en la base V4 de pruebas. Todo se revierte.
BEGIN;
SET LOCAL TIME ZONE 'America/La_Paz';
SELECT set_config('app.encryption_key',
    'test-encryption-key-only-for-transaction-32-characters', true);
SELECT set_config('app.hash_pepper',
    'test-hash-pepper-only-for-transaction-32-characters', true);
SELECT set_config('app.usuario_actual', '', true);

DO $hu04$
DECLARE
    v_carrera uuid;
    v_categoria uuid := gen_random_uuid();
    v_habilidad uuid := gen_random_uuid();
    v_tutor uuid := gen_random_uuid();
    v_estudiante uuid := gen_random_uuid();
    v_oferta uuid := gen_random_uuid();
    v_oferta_45 uuid := gen_random_uuid();
    v_solicitud uuid := gen_random_uuid();
    v_fecha_inicio timestamptz := ((CURRENT_DATE + 2) + TIME '10:00') AT TIME ZONE 'America/La_Paz';
    v_fecha_fin timestamptz;
    v_precio numeric(12,2);
    v_sugerencia numeric(12,2);
    v_precio_vista numeric(12,2);
    v_snapshot numeric(12,2);
    v_count integer;
    v_rechazado boolean := false;
BEGIN
    SELECT c."id_carrera" INTO v_carrera
    FROM public."CARRERAS" c ORDER BY c."nombre" LIMIT 1;
    IF v_carrera IS NULL THEN
        RAISE EXCEPTION 'HU04: no existe una carrera semilla.';
    END IF;

    IF to_regclass('public."OFERTAS_TUTORIA"') IS NULL
       OR to_regclass('public.v_ofertas_tutoria_app') IS NULL THEN
        RAISE EXCEPTION 'HU04 pendiente: falta OFERTAS_TUTORIA o su vista de aplicación.';
    END IF;

    INSERT INTO public."CATEGORIAS" ("id_categoria", "nombre", "estado")
    VALUES (v_categoria, 'ZZ_HU04_CAT_' || left(v_categoria::text,8), 'activo');
    INSERT INTO public."HABILIDADES" ("id_habilidad", "nombre", "id_categoria", "estado")
    VALUES (v_habilidad, 'ZZ_HU04_HAB_' || left(v_habilidad::text,8), v_categoria, 'activo');
    INSERT INTO public."USUARIOS" (
        "id_usuario", "nombre", "apellido", "correo", "password_hash", "rol",
        "id_carrera", "semestre", "saldo", "creditos_retenidos", "estado"
    ) VALUES
      (v_tutor, 'Tutor HU04', 'Prueba', 'hu04-tutor-' || v_tutor::text || '@test.invalid',
       'hash-no-login', 'Estudiante', v_carrera, 4, 0.0, 0.0, 'Activo'),
      (v_estudiante, 'Estudiante HU04', 'Prueba', 'hu04-estudiante-' || v_estudiante::text || '@test.invalid',
       'hash-no-login', 'Estudiante', v_carrera, 4, 10.0, 0.0, 'Activo');
    INSERT INTO public."USUARIO_HABILIDADES" ("id_usuario", "id_habilidad", "nivel")
    VALUES (v_tutor, v_habilidad, 'avanzado');

    -- Validador: acepta una cifra decimal real y rechaza 3.75.
    IF public.fn_validar_precio_creditos(3.0::numeric) <> 3.0
       OR public.fn_validar_precio_creditos(3.5::numeric) <> 3.5
       OR public.fn_validar_precio_creditos(3.7::numeric) <> 3.7 THEN
        RAISE EXCEPTION 'HU04: el validador no conserva los importes decimales reales.';
    END IF;
    BEGIN
        PERFORM public.fn_validar_precio_creditos(3.75::numeric);
        RAISE EXCEPTION 'HU04 FALLA: se aceptó 3.75; solo se admite una cifra decimal.';
    EXCEPTION WHEN SQLSTATE '22023' THEN
        v_rechazado := true;
    END;
    IF NOT v_rechazado THEN
        RAISE EXCEPTION 'HU04 FALLA: no se rechazó 3.75.';
    END IF;

    -- Una oferta de 60 minutos y otra de 45 minutos conservan el precio total publicado.
    v_fecha_fin := v_fecha_inicio + interval '1 hour';
    INSERT INTO public."OFERTAS_TUTORIA" (
        "id_oferta", "id_usuario", "id_habilidad", "titulo", "descripcion",
        "fecha_inicio", "fecha_fin", "costo_creditos", "estado"
    ) VALUES (
        v_oferta, v_tutor, v_habilidad, 'Tutoría HU04 60 minutos',
        'Precio publicado por el tutor.', v_fecha_inicio, v_fecha_fin, 3.7, 'Activa'
    );

    INSERT INTO public."OFERTAS_TUTORIA" (
        "id_oferta", "id_usuario", "id_habilidad", "titulo", "descripcion",
        "fecha_inicio", "fecha_fin", "costo_creditos", "estado"
    ) VALUES (
        v_oferta_45, v_tutor, v_habilidad, 'Tutoría HU04 45 minutos',
        'El precio es el total de la sesión, no una tarifa prorrateada.',
        v_fecha_inicio + interval '2 hours',
        v_fecha_inicio + interval '2 hours 45 minutes', 3.7, 'Activa'
    );

    SELECT o."costo_creditos" INTO v_precio_vista
    FROM public.v_ofertas_tutoria_app o WHERE o."id_oferta" = v_oferta;
    IF v_precio_vista IS DISTINCT FROM 3.70::numeric THEN
        RAISE EXCEPTION 'HU04 FALLA: la vista no devuelve 3.7; obtuvo %.', v_precio_vista;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public."OFERTAS_TUTORIA" o
        WHERE o."id_oferta" = v_oferta_45
          AND o."fecha_fin" - o."fecha_inicio" = interval '45 minutes'
          AND o."costo_creditos" = 3.7
    ) THEN
        RAISE EXCEPTION 'HU04 FALLA: no se persistió la oferta de 45 minutos a 3.7 créditos.';
    END IF;

    -- La sugerencia económica es orientativa y no reemplaza el precio del tutor.
    v_sugerencia := public.fn_sugerir_precio_clase(v_habilidad, v_tutor, v_fecha_inicio);
    IF v_sugerencia IS NULL OR v_sugerencia = 3.7 THEN
        RAISE EXCEPTION 'HU04: se esperaba una sugerencia dinámica distinta de 3.7; se obtuvo %.', v_sugerencia;
    END IF;

    -- La solicitud conserva el precio snapshot aunque el tutor edite su oferta.
    INSERT INTO public."SOLICITUDES_INTERCAMBIO" (
        "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio_propuesta", "fecha_fin_propuesta", "creditos_requeridos", "estado"
    ) VALUES (
        v_solicitud, v_estudiante, v_tutor, v_habilidad,
        v_fecha_inicio, v_fecha_fin, 3.7, 'Solicitada'
    );
    UPDATE public."OFERTAS_TUTORIA"
    SET "costo_creditos" = public.fn_validar_precio_creditos(4.2::numeric)
    WHERE "id_oferta" = v_oferta;
    SELECT s."creditos_requeridos" INTO v_snapshot
    FROM public."SOLICITUDES_INTERCAMBIO" s WHERE s."id_solicitud" = v_solicitud;
    IF v_snapshot IS DISTINCT FROM 3.7::numeric THEN
        RAISE EXCEPTION 'HU04 FALLA: el cambio de oferta alteró el precio snapshot: %.', v_snapshot;
    END IF;

    -- Error: un precio no positivo debe rechazarse.
    v_rechazado := false;
    BEGIN
        INSERT INTO public."OFERTAS_TUTORIA" (
            "id_usuario", "id_habilidad", "titulo", "fecha_inicio", "fecha_fin", "costo_creditos", "estado"
        ) VALUES (v_tutor, v_habilidad, 'Oferta cero', v_fecha_inicio, v_fecha_fin, 0, 'Activa');
        RAISE EXCEPTION 'HU04 FALLA: se aceptó una oferta con precio cero.';
    EXCEPTION WHEN check_violation OR SQLSTATE '22023' THEN
        v_rechazado := true;
    END;
    IF NOT v_rechazado THEN RAISE EXCEPTION 'HU04: no se rechazó el precio cero.'; END IF;

    -- Error: se intenta insertar 3.75 directamente en la tabla.
    v_rechazado := false;
    BEGIN
        INSERT INTO public."OFERTAS_TUTORIA" (
            "id_usuario", "id_habilidad", "titulo", "fecha_inicio", "fecha_fin", "costo_creditos", "estado"
        ) VALUES (v_tutor, v_habilidad, 'Oferta con 3.75', v_fecha_inicio, v_fecha_fin, 3.75, 'Activa');
        RAISE EXCEPTION 'HU04 FALLA: la tabla aceptó 3.75.';
    EXCEPTION WHEN check_violation OR SQLSTATE '22023' THEN
        v_rechazado := true;
    END;
    IF NOT v_rechazado THEN RAISE EXCEPTION 'HU04: no se rechazó 3.75 al insertar.'; END IF;

    -- Error: intervalo horario invertido.
    v_rechazado := false;
    BEGIN
        INSERT INTO public."OFERTAS_TUTORIA" (
            "id_usuario", "id_habilidad", "titulo", "fecha_inicio", "fecha_fin", "costo_creditos", "estado"
        ) VALUES (v_tutor, v_habilidad, 'Oferta con horario inválido', v_fecha_fin, v_fecha_inicio, 3.7, 'Activa');
        RAISE EXCEPTION 'HU04 FALLA: se aceptó un intervalo horario invertido.';
    EXCEPTION WHEN check_violation THEN
        v_rechazado := true;
    END;
    IF NOT v_rechazado THEN RAISE EXCEPTION 'HU04: no se rechazó el intervalo invertido.'; END IF;

    -- La creación de oferta debe quedar auditada y cifrada.
    SELECT COUNT(*) INTO v_count
    FROM public."AUDITORIA" a
    WHERE a."entidad" = 'OFERTAS_TUTORIA'
      AND a."entidad_id" = v_oferta
      AND a."accion" = 'INSERT'
      AND a."datos_nuevos_enc" IS NOT NULL
      AND a."datos_nuevos" IS NULL;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'HU04: la oferta no generó exactamente un evento de auditoría cifrado.';
    END IF;

    RAISE NOTICE 'OK HU04-01: oferta guardada y recuperable después de consultar la vista.';
    RAISE NOTICE 'OK HU04-02: 3.7 créditos conservados como 3.70, incluida una sesión de 45 minutos.';
    RAISE NOTICE 'OK HU04-PRECIO: sugerencia dinámica % no sustituyó el precio del tutor.', v_sugerencia;
    RAISE NOTICE 'OK HU04-03: precio cero, 3.75 e intervalo inválido rechazados.';
    RAISE NOTICE 'OK HU04-SNAPSHOT: la solicitud conservó 3.7 aunque la oferta cambió a 4.2.';
    RAISE NOTICE 'OK HU04-AUDITORIA: alta de oferta auditada y cifrada.';
END;
$hu04$;

ROLLBACK;
\echo 'HU-04: pruebas finalizadas; todas las filas de prueba fueron revertidas.'
