\set ON_ERROR_STOP on
SET client_min_messages = warning;

-- HU-10: retención al aceptar, dos confirmaciones, pago único y liberación.
-- Todos los importes se manejan como NUMERIC(12,2) en créditos reales.
-- Ejecutar como administrador en la base V4 inicializada. Todo se revierte.
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
    v_saldo_estudiante numeric(12,2);
    v_retenidos_estudiante numeric(12,2);
    v_disponible_estudiante numeric(12,2);
    v_saldo_tutor numeric(12,2);
    v_snapshot numeric(12,2);
    v_count integer;
    v_rechazado boolean := false;
    v_precio numeric(12,2);
BEGIN
    SELECT c."id_carrera" INTO v_carrera
    FROM public."CARRERAS" c ORDER BY c."nombre" LIMIT 1;
    IF v_carrera IS NULL THEN RAISE EXCEPTION 'HU10: no existe una carrera semilla.'; END IF;

    -- El importe se conserva directamente como 3.70, sin multiplicar por diez.
    v_precio := public.fn_validar_precio_creditos(3.7::numeric);
    IF v_precio IS DISTINCT FROM 3.70::numeric THEN
        RAISE EXCEPTION 'HU10: se esperaba almacenar 3.70 y se obtuvo %.', v_precio;
    END IF;
    BEGIN
        PERFORM public.fn_validar_precio_creditos(3.75::numeric);
        RAISE EXCEPTION 'HU10 FALLA: se aceptó 3.75; solo se admite una cifra decimal.';
    EXCEPTION WHEN SQLSTATE '22023' THEN
        v_rechazado := true;
    END;
    IF NOT v_rechazado THEN RAISE EXCEPTION 'HU10: 3.75 no fue rechazado.'; END IF;

    INSERT INTO public."CATEGORIAS" ("id_categoria", "nombre", "estado")
    VALUES (v_categoria, 'ZZ_HU10_CAT_' || left(v_categoria::text,8), 'activo');
    INSERT INTO public."HABILIDADES" ("id_habilidad", "nombre", "id_categoria", "estado")
    VALUES (v_habilidad, 'ZZ_HU10_HAB_' || left(v_habilidad::text,8), v_categoria, 'activo');
    INSERT INTO public."USUARIOS" (
        "id_usuario", "nombre", "apellido", "correo", "password_hash", "rol",
        "id_carrera", "semestre", "saldo", "creditos_retenidos", "estado"
    ) VALUES
      (v_estudiante, 'Estudiante HU10', 'Pago', 'hu10-estudiante-' || v_estudiante::text || '@test.invalid',
       'hash-no-login', 'Estudiante', v_carrera, 4, 10.0, 0.0, 'Activo'),
      (v_estudiante_cancel, 'Estudiante HU10', 'Cancelación', 'hu10-cancel-' || v_estudiante_cancel::text || '@test.invalid',
       'hash-no-login', 'Estudiante', v_carrera, 4, 10.0, 0.0, 'Activo'),
      (v_estudiante_sin_saldo, 'Estudiante HU10', 'Sin saldo', 'hu10-sinsaldo-' || v_estudiante_sin_saldo::text || '@test.invalid',
       'hash-no-login', 'Estudiante', v_carrera, 4, 2.0, 0.0, 'Activo'),
      (v_tutor, 'Tutor HU10', 'Prueba', 'hu10-tutor-' || v_tutor::text || '@test.invalid',
       'hash-no-login', 'Estudiante', v_carrera, 4, 0.0, 0.0, 'Activo');
    INSERT INTO public."USUARIO_HABILIDADES" ("id_usuario", "id_habilidad", "nivel")
    VALUES (v_tutor, v_habilidad, 'avanzado');

    INSERT INTO public."OFERTAS_TUTORIA" (
        "id_oferta", "id_usuario", "id_habilidad", "titulo", "descripcion",
        "fecha_inicio", "fecha_fin", "costo_creditos", "estado"
    ) VALUES (
        v_oferta_pago, v_tutor, v_habilidad, 'Tutoría HU10 3.7 créditos',
        'Oferta para comprobar la retención y el pago.', v_fecha, v_fecha + interval '1 hour',
        v_precio, 'Activa'
    );

    -- 1) La solicitud conserva el precio publicado, aunque la oferta cambie después.
    SELECT o."costo_creditos" INTO v_precio
    FROM public."OFERTAS_TUTORIA" o WHERE o."id_oferta" = v_oferta_pago;
    INSERT INTO public."SOLICITUDES_INTERCAMBIO" (
        "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio_propuesta", "fecha_fin_propuesta", "creditos_requeridos", "estado", "respondida_at"
    ) VALUES (
        v_solicitud_pago, v_estudiante, v_tutor, v_habilidad,
        v_fecha, v_fecha + interval '1 hour', v_precio, 'Aceptada', clock_timestamp()
    );
    UPDATE public."OFERTAS_TUTORIA"
    SET "costo_creditos" = public.fn_validar_precio_creditos(4.2::numeric)
    WHERE "id_oferta" = v_oferta_pago;
    SELECT s."creditos_requeridos" INTO v_snapshot
    FROM public."SOLICITUDES_INTERCAMBIO" s WHERE s."id_solicitud" = v_solicitud_pago;
    IF v_snapshot IS DISTINCT FROM 3.7::numeric THEN
        RAISE EXCEPTION 'HU10: cambiar la oferta alteró la cotización aceptada: %.', v_snapshot;
    END IF;

    INSERT INTO public."RESERVAS" (
        "id_reserva", "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio", "fecha_fin", "creditos", "modalidad", "lugar", "estado"
    ) VALUES (
        v_reserva_pago, v_solicitud_pago, v_estudiante, v_tutor, v_habilidad,
        v_fecha, v_fecha + interval '1 hour', v_snapshot, 'Virtual', 'Prueba pago 3.7', 'Confirmada'
    );

    SELECT u."saldo", u."creditos_retenidos", u."saldo" - u."creditos_retenidos"
      INTO v_saldo_estudiante, v_retenidos_estudiante, v_disponible_estudiante
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_estudiante;
    SELECT u."saldo" INTO v_saldo_tutor FROM public."USUARIOS" u WHERE u."id_usuario" = v_tutor;
    IF v_saldo_estudiante <> 10.0 OR v_retenidos_estudiante <> 3.7
       OR v_disponible_estudiante <> 6.3 OR v_saldo_tutor <> 0.0 THEN
        RAISE EXCEPTION 'HU10-01: tras aceptar: saldo %, retenido %, disponible %, tutor %.',
          v_saldo_estudiante, v_retenidos_estudiante, v_disponible_estudiante, v_saldo_tutor;
    END IF;
    SELECT COUNT(*) INTO v_count FROM public."MOVIMIENTOS_CREDITO" m
    WHERE m."id_reserva" = v_reserva_pago AND m."id_usuario" = v_estudiante
      AND m."tipo" = 'retencion_reserva' AND m."cantidad" = 0.0
      AND m."retenidos_anterior" = 0.0 AND m."retenidos_posterior" = 3.7;
    IF v_count <> 1 THEN RAISE EXCEPTION 'HU10-01: falta un único movimiento de retención por 3.7.'; END IF;
    RAISE NOTICE 'OK HU10-01: al aceptar se retuvieron 3.7; saldo total 10.0, disponible 6.3, tutor 0.0.';

    -- 2) Primera confirmación: solo deja la marca de tiempo, no transfiere.
    PERFORM set_config('app.usuario_actual', v_estudiante::text, true);
    SELECT public.fn_confirmar_reserva(v_reserva_pago) INTO v_estado;
    IF v_estado <> 'Confirmada' THEN RAISE EXCEPTION 'HU10-02: la primera confirmación completó la reserva.'; END IF;
    SELECT u."saldo", u."creditos_retenidos" INTO v_saldo_estudiante, v_retenidos_estudiante
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_estudiante;
    SELECT u."saldo" INTO v_saldo_tutor FROM public."USUARIOS" u WHERE u."id_usuario" = v_tutor;
    IF v_saldo_estudiante <> 10.0 OR v_retenidos_estudiante <> 3.7 OR v_saldo_tutor <> 0.0 THEN
        RAISE EXCEPTION 'HU10-02: la primera confirmación modificó saldos: estudiante %, retenido %, tutor %.',
          v_saldo_estudiante, v_retenidos_estudiante, v_saldo_tutor;
    END IF;
    PERFORM public.fn_confirmar_reserva(v_reserva_pago);
    SELECT COUNT(*) INTO v_count FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva" = v_reserva_pago AND "tipo" = 'retencion_reserva';
    IF v_count <> 1 THEN RAISE EXCEPTION 'HU10-02: se duplicó la retención al repetir la primera confirmación.'; END IF;
    RAISE NOTICE 'OK HU10-02: la primera confirmación no transfirió créditos ni duplicó la retención.';

    -- 3) Segunda confirmación: transferencia atómica e idempotente.
    PERFORM set_config('app.usuario_actual', v_tutor::text, true);
    SELECT public.fn_confirmar_reserva(v_reserva_pago) INTO v_estado;
    IF v_estado <> 'Completada' THEN RAISE EXCEPTION 'HU10-03: la segunda confirmación no completó la reserva.'; END IF;
    SELECT u."saldo", u."creditos_retenidos", u."saldo" - u."creditos_retenidos"
      INTO v_saldo_estudiante, v_retenidos_estudiante, v_disponible_estudiante
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_estudiante;
    SELECT u."saldo" INTO v_saldo_tutor FROM public."USUARIOS" u WHERE u."id_usuario" = v_tutor;
    IF v_saldo_estudiante <> 6.3 OR v_retenidos_estudiante <> 0.0
       OR v_disponible_estudiante <> 6.3 OR v_saldo_tutor <> 3.7 THEN
        RAISE EXCEPTION 'HU10-03: estudiante saldo %, retenido %, disponible %; tutor saldo %.',
          v_saldo_estudiante, v_retenidos_estudiante, v_disponible_estudiante, v_saldo_tutor;
    END IF;
    SELECT COUNT(*) INTO v_count FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva" = v_reserva_pago AND "id_usuario" = v_estudiante
      AND "tipo" = 'pago_tutoria' AND "cantidad" = -3.7;
    IF v_count <> 1 THEN RAISE EXCEPTION 'HU10-03: se esperaba un único débito de -3.7.'; END IF;
    SELECT COUNT(*) INTO v_count FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva" = v_reserva_pago AND "id_usuario" = v_tutor
      AND "tipo" = 'ingreso_tutoria' AND "cantidad" = 3.7;
    IF v_count <> 1 THEN RAISE EXCEPTION 'HU10-03: se esperaba un único ingreso de 3.7.'; END IF;
    PERFORM set_config('app.usuario_actual', v_estudiante::text, true);
    PERFORM public.fn_confirmar_reserva(v_reserva_pago);
    PERFORM set_config('app.usuario_actual', v_tutor::text, true);
    PERFORM public.fn_confirmar_reserva(v_reserva_pago);
    SELECT COUNT(*) INTO v_count FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva" = v_reserva_pago AND "tipo" IN ('pago_tutoria', 'ingreso_tutoria');
    IF v_count <> 2 THEN RAISE EXCEPTION 'HU10-03: repetir confirmaciones duplicó el pago.'; END IF;
    RAISE NOTICE 'OK HU10-03: la segunda confirmación transfirió 3.7 una sola vez; disponible final 6.3.';

    -- 4) Cancelación válida antes de la segunda confirmación: libera retención.
    INSERT INTO public."SOLICITUDES_INTERCAMBIO" (
        "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio_propuesta", "fecha_fin_propuesta", "creditos_requeridos", "estado", "respondida_at"
    ) VALUES (
        v_solicitud_cancel, v_estudiante_cancel, v_tutor, v_habilidad,
        v_fecha_cancel, v_fecha_cancel + interval '1 hour', 3.7, 'Aceptada', clock_timestamp()
    );
    INSERT INTO public."RESERVAS" (
        "id_reserva", "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio", "fecha_fin", "creditos", "modalidad", "lugar", "estado"
    ) VALUES (
        v_reserva_cancel, v_solicitud_cancel, v_estudiante_cancel, v_tutor, v_habilidad,
        v_fecha_cancel, v_fecha_cancel + interval '1 hour', 3.7, 'Virtual', 'Prueba cancelación válida', 'Confirmada'
    );
    SELECT u."saldo", u."creditos_retenidos" INTO v_saldo_estudiante, v_retenidos_estudiante
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_estudiante_cancel;
    IF v_saldo_estudiante <> 10.0 OR v_retenidos_estudiante <> 3.7 THEN
        RAISE EXCEPTION 'HU10-04: no se retuvieron 3.7 créditos antes de cancelar.';
    END IF;
    PERFORM set_config('app.usuario_actual', v_estudiante_cancel::text, true);
    PERFORM public.fn_confirmar_reserva(v_reserva_cancel);
    IF NOT EXISTS (
        SELECT 1 FROM public."RESERVAS" r
        WHERE r."id_reserva" = v_reserva_cancel
          AND r."confirmacion_solicitante_at" IS NOT NULL
          AND r."confirmacion_ofertante_at" IS NULL
          AND r."estado" = 'Confirmada'
    ) THEN RAISE EXCEPTION 'HU10-04: no se registró la primera confirmación antes de cancelar.'; END IF;
    UPDATE public."RESERVAS"
    SET "estado" = 'Cancelada', "cancelado_por" = v_estudiante_cancel,
        "motivo_cancelacion" = 'Cancelación válida antes del pago'
    WHERE "id_reserva" = v_reserva_cancel;
    SELECT u."saldo", u."creditos_retenidos" INTO v_saldo_estudiante, v_retenidos_estudiante
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_estudiante_cancel;
    SELECT u."saldo" INTO v_saldo_tutor FROM public."USUARIOS" u WHERE u."id_usuario" = v_tutor;
    IF v_saldo_estudiante <> 10.0 OR v_retenidos_estudiante <> 0.0 OR v_saldo_tutor <> 3.7 THEN
        RAISE EXCEPTION 'HU10-04: tras cancelar: estudiante %, retenido %, tutor %.',
          v_saldo_estudiante, v_retenidos_estudiante, v_saldo_tutor;
    END IF;
    SELECT COUNT(*) INTO v_count FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva" = v_reserva_cancel AND "tipo" = 'liberacion_retencion'
      AND "cantidad" = 0.0 AND "retenidos_anterior" = 3.7 AND "retenidos_posterior" = 0.0;
    IF v_count <> 1 THEN RAISE EXCEPTION 'HU10-04: falta la liberación de retención.'; END IF;
    SELECT COUNT(*) INTO v_count FROM public."MOVIMIENTOS_CREDITO"
    WHERE "id_reserva" = v_reserva_cancel AND "tipo" IN ('pago_tutoria','ingreso_tutoria','penalizacion');
    IF v_count <> 0 THEN RAISE EXCEPTION 'HU10-04: la cancelación válida generó pago o penalización.'; END IF;
    RAISE NOTICE 'OK HU10-04: cancelar antes del segundo consentimiento libera 3.7; el tutor no recibe créditos por esa reserva.';

    -- 5) Error: saldo disponible insuficiente para reservar 3.7.
    INSERT INTO public."SOLICITUDES_INTERCAMBIO" (
        "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio_propuesta", "fecha_fin_propuesta", "creditos_requeridos", "estado", "respondida_at"
    ) VALUES (
        v_solicitud_sin_saldo, v_estudiante_sin_saldo, v_tutor, v_habilidad,
        clock_timestamp() + interval '1 day', clock_timestamp() + interval '1 day 1 hour',
        3.7, 'Aceptada', clock_timestamp()
    );
    v_rechazado := false;
    BEGIN
        INSERT INTO public."RESERVAS" (
            "id_reserva", "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
            "fecha_inicio", "fecha_fin", "creditos", "modalidad", "lugar", "estado"
        ) VALUES (
            v_reserva_sin_saldo, v_solicitud_sin_saldo, v_estudiante_sin_saldo, v_tutor,
            v_habilidad, clock_timestamp() + interval '1 day', clock_timestamp() + interval '1 day 1 hour',
            3.7, 'Virtual', 'Prueba saldo insuficiente', 'Confirmada'
        );
        RAISE EXCEPTION 'HU10 FALLA: se permitió retener 3.7 con saldo disponible de 2.0.';
    EXCEPTION WHEN check_violation THEN
        v_rechazado := true;
    END;
    IF NOT v_rechazado THEN RAISE EXCEPTION 'HU10: no se rechazó una reserva sin saldo suficiente.'; END IF;
    RAISE NOTICE 'OK HU10-05: PostgreSQL rechazó una retención de 3.7 cuando solo había 2.0 disponibles.';
END;
$hu10$;

ROLLBACK;
\echo 'HU-10: ciclo de retención, doble confirmación, transferencia y liberación probados. Cambios revertidos.'
