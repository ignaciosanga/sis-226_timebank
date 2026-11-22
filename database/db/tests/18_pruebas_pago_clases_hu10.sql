\set ON_ERROR_STOP on
SET client_min_messages = warning;

-- HU-10: retencion al aceptar, dos confirmaciones, pago unico y liberacion.
-- Ejecutar como administrador en la base V4 actualizada.
-- Todo se revierte al final.
BEGIN;
SET LOCAL TIME ZONE 'America/La_Paz';
SELECT set_config('app.encryption_key',
    'test-encryption-key-only-for-transaction-32-characters', true);
SELECT set_config('app.hash_pepper',
    'test-hash-pepper-only-for-transaction-32-characters', true);

DO $hu10$
DECLARE
    v_carrera uuid;
    v_categoria uuid := gen_random_uuid();
    v_habilidad uuid := gen_random_uuid();
    v_estudiante uuid := gen_random_uuid();
    v_estudiante_cancel uuid := gen_random_uuid();
    v_estudiante_sin_saldo uuid := gen_random_uuid();
    v_tutor uuid := gen_random_uuid();
    v_solicitud_pago uuid := gen_random_uuid();
    v_oferta_pago uuid := gen_random_uuid();
    v_reserva_pago uuid := gen_random_uuid();
    v_solicitud_cancel uuid := gen_random_uuid();
    v_reserva_cancel uuid := gen_random_uuid();
    v_solicitud_sin_saldo uuid := gen_random_uuid();
    v_reserva_sin_saldo uuid := gen_random_uuid();
    v_fecha timestamptz := clock_timestamp() + interval '2 days';
    v_fecha_cancel timestamptz := clock_timestamp() + interval '8 hours';
    v_estado varchar;
    v_saldo_estudiante integer;
    v_retenidos_estudiante integer;
    v_disponible_estudiante integer;
    v_saldo_tutor integer;
    v_count integer;
    v_rechazado boolean;
    v_precio integer;
BEGIN
    SELECT c."id_carrera" INTO v_carrera
    FROM public."CARRERAS" c
    ORDER BY c."nombre"
    LIMIT 1;

    IF v_carrera IS NULL THEN
        RAISE EXCEPTION 'HU10: no existe una carrera semilla.';
    END IF;

    -- La regla de precios admite una sola cifra decimal.
    v_precio := public.fn_creditos_a_decimas(3.7::numeric);
    IF v_precio <> 37 THEN
        RAISE EXCEPTION 'HU10: 3.7 creditos debe almacenarse como 37.';
    END IF;

    v_rechazado := false;
    BEGIN
        PERFORM public.fn_creditos_a_decimas(3.75::numeric);
        RAISE EXCEPTION 'HU10 FALLA: se acepto 3.75 aunque solo se admite una decimal.';
    EXCEPTION WHEN SQLSTATE '22023' THEN
        v_rechazado := true;
    END;
    IF NOT v_rechazado THEN
        RAISE EXCEPTION 'HU10: 3.75 no fue rechazado.';
    END IF;

    INSERT INTO public."CATEGORIAS" ("id_categoria", "nombre", "estado")
    VALUES (v_categoria, 'ZZ_HU10_CAT_' || left(v_categoria::text, 8), 'activo');
    INSERT INTO public."HABILIDADES" ("id_habilidad", "nombre", "id_categoria", "estado")
    VALUES (v_habilidad, 'ZZ_HU10_HAB_' || left(v_habilidad::text, 8), v_categoria, 'activo');

    INSERT INTO public."USUARIOS" (
        "id_usuario", "nombre", "apellido", "correo", "password_hash", "rol",
        "id_carrera", "semestre", "saldo", "creditos_retenidos", "estado"
    ) VALUES
      (v_estudiante, 'Estudiante HU10', 'Pago',
       'hu10-estudiante-' || v_estudiante::text || '@test.invalid',
       'hash-no-login', 'Estudiante', v_carrera, 4, 100, 0, 'Activo'),
      (v_estudiante_cancel, 'Estudiante HU10', 'Cancelacion',
       'hu10-cancel-' || v_estudiante_cancel::text || '@test.invalid',
       'hash-no-login', 'Estudiante', v_carrera, 4, 100, 0, 'Activo'),
      (v_estudiante_sin_saldo, 'Estudiante HU10', 'SinSaldo',
       'hu10-sinsaldo-' || v_estudiante_sin_saldo::text || '@test.invalid',
       'hash-no-login', 'Estudiante', v_carrera, 4, 20, 0, 'Activo'),
      (v_tutor, 'Tutor HU10', 'Prueba',
       'hu10-tutor-' || v_tutor::text || '@test.invalid',
       'hash-no-login', 'Estudiante', v_carrera, 4, 0, 0, 'Activo');

    INSERT INTO public."USUARIO_HABILIDADES" ("id_usuario", "id_habilidad", "nivel")
    VALUES (v_tutor, v_habilidad, 'avanzado');

    -- El tutor publica 3.7 creditos. La funcion dinamica solo puede sugerir;
    -- no debe reemplazar el precio que el tutor eligio.
    INSERT INTO public."OFERTAS_TUTORIA" (
        "id_oferta", "id_usuario", "id_habilidad", "titulo", "descripcion",
        "fecha_inicio", "fecha_fin", "costo_decimas", "estado"
    ) VALUES (
        v_oferta_pago, v_tutor, v_habilidad, 'Tutoria HU10 por 3.7',
        'Oferta para comprobar el precio pactado.', v_fecha, v_fecha + interval '1 hour',
        v_precio, 'Activa'
    );

    -- ===============================================================
    -- 1. El estudiante solicita 3.7. El precio queda fijado en la solicitud.
    -- ===============================================================
    SELECT o."costo_decimas" INTO v_precio
    FROM public."OFERTAS_TUTORIA" o
    WHERE o."id_oferta" = v_oferta_pago;

    INSERT INTO public."SOLICITUDES_INTERCAMBIO" (
        "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio_propuesta", "fecha_fin_propuesta",
        "creditos_requeridos", "estado", "respondida_at"
    ) VALUES (
        v_solicitud_pago, v_estudiante, v_tutor, v_habilidad,
        v_fecha, v_fecha + interval '1 hour', v_precio, 'Aceptada', clock_timestamp()
    );

    -- El tutor cambia su oferta a 4.2 despues de la solicitud. La solicitud
    -- debe conservar las 37 decimas aceptadas originalmente.
    UPDATE public."OFERTAS_TUTORIA"
    SET "costo_decimas" = public.fn_creditos_a_decimas(4.2::numeric)
    WHERE "id_oferta" = v_oferta_pago;

    SELECT s."creditos_requeridos" INTO v_count
    FROM public."SOLICITUDES_INTERCAMBIO" s
    WHERE s."id_solicitud" = v_solicitud_pago;
    IF v_count IS DISTINCT FROM 37 THEN
        RAISE EXCEPTION 'HU10 FALLA: cambiar la oferta altero el precio aceptado en la solicitud (esperado 37, obtenido %).', v_count;
    END IF;

    INSERT INTO public."RESERVAS" (
        "id_reserva", "id_solicitud", "id_solicitante", "id_ofertante",
        "id_habilidad", "fecha_inicio", "fecha_fin", "creditos",
        "modalidad", "lugar", "estado"
    ) VALUES (
        v_reserva_pago, v_solicitud_pago, v_estudiante, v_tutor,
        v_habilidad, v_fecha, v_fecha + interval '1 hour', v_precio,
        'Virtual', 'Prueba HU10 pago 3.7', 'Confirmada'
    );

    SELECT u."saldo", u."creditos_retenidos",
           u."saldo" - u."creditos_retenidos"
      INTO v_saldo_estudiante, v_retenidos_estudiante, v_disponible_estudiante
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_estudiante;

    IF v_saldo_estudiante <> 100 OR v_retenidos_estudiante <> 37
       OR v_disponible_estudiante <> 63 THEN
        RAISE EXCEPTION
          'HU10-01 FALLA retencion: saldo %, retenidos %, disponible %.',
          v_saldo_estudiante, v_retenidos_estudiante, v_disponible_estudiante;
    END IF;

    SELECT u."saldo" INTO v_saldo_tutor
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_tutor;
    IF v_saldo_tutor <> 0 THEN
        RAISE EXCEPTION 'HU10-01 FALLA: el tutor recibio creditos antes de las confirmaciones.';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public."MOVIMIENTOS_CREDITO" m
    WHERE m."id_reserva" = v_reserva_pago
      AND m."id_usuario" = v_estudiante
      AND m."tipo" = 'retencion_reserva'
      AND m."cantidad" = 0
      AND m."retenidos_anterior" = 0
      AND m."retenidos_posterior" = 37;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'HU10-01 FALLA: no se registro una sola retencion de 37 decimas.';
    END IF;

    RAISE NOTICE 'OK HU10-01: el precio del tutor (3.7) quedo como snapshot en la solicitud/reserva; saldo 10.0, retenido 3.7 y disponible 6.3; tutor recibe 0.';

    -- ===============================================================
    -- 2. Primera confirmacion: registra fecha, no transfiere dinero.
    -- ===============================================================
    PERFORM set_config('app.usuario_actual', v_estudiante::text, true);
    SELECT public.fn_confirmar_reserva(v_reserva_pago) INTO v_estado;

    IF v_estado <> 'Confirmada' THEN
        RAISE EXCEPTION 'HU10-02 FALLA: la primera confirmacion no debe completar la reserva.';
    END IF;

    SELECT u."saldo", u."creditos_retenidos"
      INTO v_saldo_estudiante, v_retenidos_estudiante
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_estudiante;
    SELECT u."saldo" INTO v_saldo_tutor
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_tutor;

    IF v_saldo_estudiante <> 100 OR v_retenidos_estudiante <> 37 OR v_saldo_tutor <> 0 THEN
        RAISE EXCEPTION 'HU10-02 FALLA: la primera confirmacion modifico los saldos.';
    END IF;

    -- Repetir la primera confirmacion no duplica la retencion.
    PERFORM public.fn_confirmar_reserva(v_reserva_pago);
    SELECT COUNT(*) INTO v_count
    FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva" = v_reserva_pago AND "tipo" = 'retencion_reserva';
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'HU10-02 FALLA: la primera confirmacion duplico la retencion.';
    END IF;

    RAISE NOTICE 'OK HU10-02: primera confirmacion; saldo 10.0 y disponible 6.3 sin transferencia.';

    -- ===============================================================
    -- 3. Segunda confirmacion: pago y abono atomicos, una sola vez.
    -- ===============================================================
    PERFORM set_config('app.usuario_actual', v_tutor::text, true);
    SELECT public.fn_confirmar_reserva(v_reserva_pago) INTO v_estado;

    IF v_estado <> 'Completada' THEN
        RAISE EXCEPTION 'HU10-03 FALLA: la segunda confirmacion no completo la reserva.';
    END IF;

    SELECT u."saldo", u."creditos_retenidos",
           u."saldo" - u."creditos_retenidos"
      INTO v_saldo_estudiante, v_retenidos_estudiante, v_disponible_estudiante
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_estudiante;
    SELECT u."saldo" INTO v_saldo_tutor
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_tutor;

    IF v_saldo_estudiante <> 63 OR v_retenidos_estudiante <> 0
       OR v_disponible_estudiante <> 63 OR v_saldo_tutor <> 37 THEN
        RAISE EXCEPTION
          'HU10-03 FALLA: estudiante saldo %, retenidos %, disponible %; tutor saldo %.',
          v_saldo_estudiante, v_retenidos_estudiante, v_disponible_estudiante, v_saldo_tutor;
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva" = v_reserva_pago
      AND "tipo" = 'pago_tutoria'
      AND "id_usuario" = v_estudiante
      AND "cantidad" = -37;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'HU10-03 FALLA: se esperaba exactamente un debito de -37.';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva" = v_reserva_pago
      AND "tipo" = 'ingreso_tutoria'
      AND "id_usuario" = v_tutor
      AND "cantidad" = 37;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'HU10-03 FALLA: se esperaba exactamente un ingreso de +37.';
    END IF;

    -- Repetir las confirmaciones ya completadas no cobra ni abona de nuevo.
    PERFORM set_config('app.usuario_actual', v_estudiante::text, true);
    PERFORM public.fn_confirmar_reserva(v_reserva_pago);
    PERFORM set_config('app.usuario_actual', v_tutor::text, true);
    PERFORM public.fn_confirmar_reserva(v_reserva_pago);

    SELECT COUNT(*) INTO v_count
    FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva" = v_reserva_pago
      AND "tipo" IN ('pago_tutoria', 'ingreso_tutoria');
    IF v_count <> 2 THEN
        RAISE EXCEPTION 'HU10-03 FALLA: repetir confirmaciones duplico los movimientos.';
    END IF;

    RAISE NOTICE 'OK HU10-03: segunda confirmacion transfirio 3.7 una sola vez; disponible continuo en 6.3.';

    -- ===============================================================
    -- 4. Cancelacion valida antes del pago: libera toda la retencion.
    --    Se usa un segundo estudiante con saldo inicial 10.0.
    -- ===============================================================
    INSERT INTO public."SOLICITUDES_INTERCAMBIO" (
        "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio_propuesta", "fecha_fin_propuesta",
        "creditos_requeridos", "estado", "respondida_at"
    ) VALUES (
        v_solicitud_cancel, v_estudiante_cancel, v_tutor, v_habilidad,
        v_fecha_cancel, v_fecha_cancel + interval '1 hour', v_precio, 'Aceptada', clock_timestamp()
    );

    INSERT INTO public."RESERVAS" (
        "id_reserva", "id_solicitud", "id_solicitante", "id_ofertante",
        "id_habilidad", "fecha_inicio", "fecha_fin", "creditos",
        "modalidad", "lugar", "estado"
    ) VALUES (
        v_reserva_cancel, v_solicitud_cancel, v_estudiante_cancel, v_tutor,
        v_habilidad, v_fecha_cancel, v_fecha_cancel + interval '1 hour', v_precio,
        'Virtual', 'Prueba HU10 cancelacion valida', 'Confirmada'
    );

    SELECT "saldo", "creditos_retenidos"
      INTO v_saldo_estudiante, v_retenidos_estudiante
    FROM public."USUARIOS" WHERE "id_usuario" = v_estudiante_cancel;
    IF v_saldo_estudiante <> 100 OR v_retenidos_estudiante <> 37 THEN
        RAISE EXCEPTION 'HU10-04 FALLA: no se retuvieron las 37 decimas del segundo estudiante.';
    END IF;

    -- Primera confirmacion registrada, pero aun no hay segunda confirmacion
    -- ni pago. La cancelacion valida posterior debe liberar la retencion.
    PERFORM set_config('app.usuario_actual', v_estudiante_cancel::text, true);
    PERFORM public.fn_confirmar_reserva(v_reserva_cancel);

    IF NOT EXISTS (
        SELECT 1 FROM public."RESERVAS" r
        WHERE r."id_reserva" = v_reserva_cancel
          AND r."confirmacion_solicitante_at" IS NOT NULL
          AND r."confirmacion_ofertante_at" IS NULL
          AND r."estado" = 'Confirmada'
    ) THEN
        RAISE EXCEPTION 'HU10-04 FALLA: no se registro la primera confirmacion antes de cancelar.';
    END IF;

    UPDATE public."RESERVAS"
    SET "estado" = 'Cancelada',
        "cancelado_por" = v_estudiante_cancel,
        "motivo_cancelacion" = 'HU10: cancelacion valida antes del pago'
    WHERE "id_reserva" = v_reserva_cancel;

    SELECT "saldo", "creditos_retenidos"
      INTO v_saldo_estudiante, v_retenidos_estudiante
    FROM public."USUARIOS" WHERE "id_usuario" = v_estudiante_cancel;
    SELECT "saldo" INTO v_saldo_tutor
    FROM public."USUARIOS" WHERE "id_usuario" = v_tutor;

    IF v_saldo_estudiante <> 100 OR v_retenidos_estudiante <> 0
       OR v_saldo_tutor <> 37 THEN
        RAISE EXCEPTION 'HU10-04 FALLA: estudiante saldo %, retenidos %, tutor saldo %.',
          v_saldo_estudiante, v_retenidos_estudiante, v_saldo_tutor;
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva" = v_reserva_cancel
      AND "tipo" = 'liberacion_retencion'
      AND "cantidad" = 0
      AND "retenidos_anterior" = 37
      AND "retenidos_posterior" = 0;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'HU10-04 FALLA: no se registro la liberacion de las 37 decimas.';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva" = v_reserva_cancel
      AND "tipo" IN ('pago_tutoria', 'ingreso_tutoria', 'penalizacion');
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'HU10-04 FALLA: cancelacion valida genero pago o penalizacion.';
    END IF;

    RAISE NOTICE 'OK HU10-04: tras una primera confirmacion, la cancelacion valida libero 3.7; estudiante recupero 10.0 disponibles y tutor recibio 0 por esa reserva.';

    -- ===============================================================
    -- 5. Error: el saldo disponible no alcanza para retener 3.7.
    -- ===============================================================
    INSERT INTO public."SOLICITUDES_INTERCAMBIO" (
        "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio_propuesta", "fecha_fin_propuesta",
        "creditos_requeridos", "estado", "respondida_at"
    ) VALUES (
        v_solicitud_sin_saldo, v_estudiante_sin_saldo, v_tutor, v_habilidad,
        clock_timestamp() + interval '1 day',
        clock_timestamp() + interval '1 day 1 hour',
        37, 'Aceptada', clock_timestamp()
    );

    v_rechazado := false;
    BEGIN
        INSERT INTO public."RESERVAS" (
            "id_reserva", "id_solicitud", "id_solicitante", "id_ofertante",
            "id_habilidad", "fecha_inicio", "fecha_fin", "creditos",
            "modalidad", "lugar", "estado"
        ) VALUES (
            v_reserva_sin_saldo, v_solicitud_sin_saldo,
            v_estudiante_sin_saldo, v_tutor, v_habilidad,
            clock_timestamp() + interval '1 day',
            clock_timestamp() + interval '1 day 1 hour',
            37, 'Virtual', 'Prueba saldo insuficiente', 'Confirmada'
        );
        RAISE EXCEPTION 'HU10 FALLA: se permitio retener 3.7 con saldo disponible de 2.0.';
    EXCEPTION WHEN check_violation THEN
        v_rechazado := true;
    END;

    IF NOT v_rechazado THEN
        RAISE EXCEPTION 'HU10: no se rechazo una reserva sin saldo suficiente.';
    END IF;

    RAISE NOTICE 'OK HU10-05: PostgreSQL rechazo la reserva cuando el saldo disponible era insuficiente.';
END;
$hu10$;

ROLLBACK;
\echo 'HU-10: retencion, doble confirmacion, transferencia unica y liberacion probados. Cambios revertidos.'
