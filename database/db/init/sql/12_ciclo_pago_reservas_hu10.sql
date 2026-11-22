-- =====================================================================
-- HU-10: Ciclo de retencion y pago de creditos de una reserva.
--
-- Flujo acordado con Backend:
-- 1) El estudiante solicita usando el precio de la oferta (snapshot en
--    SOLICITUDES_INTERCAMBIO.creditos_requeridos). Si el tutor acepta, Backend
--    crea RESERVAS en estado 'Confirmada' con ese mismo importe. La BD retiene
--    el importe en USUARIOS.creditos_retenidos.
-- 2) La primera confirmacion solo registra la marca de tiempo.
-- 3) La segunda confirmacion transfiere el importe una sola vez:
--    solicitante: saldo - importe y retenidos - importe;
--    ofertante: saldo + importe.
-- 4) Si se cancela antes del pago, se libera la retencion y el tutor
--    recibe cero. La penalizacion <5h se calcula por el trigger existente.
--
-- El precio acordado del tutor es la fuente de verdad; no recalcularlo al
-- aceptar ni al pagar. Cambios posteriores de la oferta no alteran la solicitud
-- ni la reserva. Todos los importes son NUMERIC en créditos reales: 3.7 se almacena como 3.70.
-- Requiere: 01, 04, 07, 10 y 11.
-- Se incluye en 00_bootstrap.sql, que controla la transaccion global.
-- =====================================================================


-- Evita que una misma reserva tenga dos movimientos de la misma etapa
-- para el mismo usuario. El pago y el ingreso tienen usuarios diferentes.
CREATE UNIQUE INDEX IF NOT EXISTS ux_mov_reserva_usuario_tipo_ciclo
ON public."MOVIMIENTOS_CREDITO" ("id_reserva", "id_usuario", "tipo")
WHERE "id_reserva" IS NOT NULL
  AND "tipo" IN (
      'retencion_reserva',
      'liberacion_retencion',
      'pago_tutoria',
      'ingreso_tutoria'
  );

-- Si la reserva proviene de una solicitud aceptada, el importe y los
-- participantes deben coincidir con la cotizacion guardada en la solicitud.
CREATE OR REPLACE FUNCTION public.fn_validar_reserva_solicitud()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_solicitante uuid;
    v_ofertante uuid;
    v_habilidad uuid;
    v_creditos numeric(12,2);
    v_estado varchar;
BEGIN
    IF NEW."id_solicitud" IS NULL OR NEW."estado" <> 'Confirmada' THEN
        RETURN NEW;
    END IF;

    SELECT s."id_solicitante", s."id_ofertante", s."id_habilidad",
           s."creditos_requeridos", s."estado"
      INTO v_solicitante, v_ofertante, v_habilidad, v_creditos, v_estado
    FROM public."SOLICITUDES_INTERCAMBIO" s
    WHERE s."id_solicitud" = NEW."id_solicitud";

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La solicitud asociada a la reserva no existe.'
          USING ERRCODE = '23503';
    END IF;

    IF v_estado <> 'Aceptada' THEN
        RAISE EXCEPTION 'Solo se puede reservar una solicitud en estado Aceptada.'
          USING ERRCODE = '23514';
    END IF;

    IF NEW."id_solicitante" IS DISTINCT FROM v_solicitante
       OR NEW."id_ofertante" IS DISTINCT FROM v_ofertante
       OR NEW."id_habilidad" IS DISTINCT FROM v_habilidad THEN
        RAISE EXCEPTION 'Los participantes o la habilidad no coinciden con la solicitud.'
          USING ERRCODE = '23514';
    END IF;

    IF NEW."creditos" IS DISTINCT FROM v_creditos THEN
        RAISE EXCEPTION
          'El precio de la reserva (%) debe conservar la cotizacion de la solicitud (%).',
          NEW."creditos", v_creditos
          USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_reserva_solicitud
    ON public."RESERVAS";
CREATE TRIGGER trg_validar_reserva_solicitud
BEFORE INSERT OR UPDATE OF
    "id_solicitud", "id_solicitante", "id_ofertante",
    "id_habilidad", "creditos", "estado"
ON public."RESERVAS"
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_reserva_solicitud();

-- Impide reabrir reservas terminales y completar una clase sin las dos
-- confirmaciones. El pago se ejecuta por el trigger de confirmaciones.
CREATE OR REPLACE FUNCTION public.fn_validar_transicion_reserva_creditos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF OLD."estado" IN ('Completada', 'Cancelada')
       AND NEW."estado" IS DISTINCT FROM OLD."estado" THEN
        RAISE EXCEPTION 'Una reserva Completada o Cancelada no puede reabrirse.'
          USING ERRCODE = '23514';
    END IF;

    IF NEW."estado" = 'Completada'
       AND (NEW."confirmacion_solicitante_at" IS NULL
            OR NEW."confirmacion_ofertante_at" IS NULL) THEN
        RAISE EXCEPTION 'La reserva requiere las dos confirmaciones para completarse.'
          USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_transicion_reserva_creditos
    ON public."RESERVAS";
CREATE TRIGGER trg_validar_transicion_reserva_creditos
BEFORE UPDATE OF "estado" ON public."RESERVAS"
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_transicion_reserva_creditos();

-- 1) Retencion al crear la reserva confirmada (tutor acepto).
CREATE OR REPLACE FUNCTION public.fn_retener_creditos_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_saldo numeric(12,2);
    v_retenidos numeric(12,2);
    v_disponibles numeric(12,2);
    v_retenidos_nuevos numeric(12,2);
BEGIN
    IF NEW."estado" <> 'Confirmada' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD."estado" = 'Confirmada' THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public."MOVIMIENTOS_CREDITO" m
        WHERE m."id_reserva" = NEW."id_reserva"
          AND m."tipo" IN ('retencion_reserva', 'liberacion_retencion')
    ) THEN
        RAISE EXCEPTION 'La reserva ya tiene un movimiento de retencion o liberacion.'
          USING ERRCODE = '23514';
    END IF;

    IF NEW."creditos" <= 0 THEN
        RAISE EXCEPTION 'El importe de la reserva debe ser mayor que cero.'
          USING ERRCODE = '23514';
    END IF;

    SELECT u."saldo", u."creditos_retenidos"
      INTO v_saldo, v_retenidos
    FROM public."USUARIOS" u
    WHERE u."id_usuario" = NEW."id_solicitante"
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el estudiante solicitante.'
          USING ERRCODE = '23503';
    END IF;

    v_disponibles := v_saldo - v_retenidos;
    IF v_disponibles < NEW."creditos" THEN
        RAISE EXCEPTION
          'Saldo disponible insuficiente. Disponible: % créditos; requerido: % créditos.',
          v_disponibles, NEW."creditos"
          USING ERRCODE = '23514';
    END IF;

    v_retenidos_nuevos := v_retenidos + NEW."creditos";

    UPDATE public."USUARIOS"
    SET "creditos_retenidos" = v_retenidos_nuevos
    WHERE "id_usuario" = NEW."id_solicitante";

    -- Una retencion no descuenta el saldo total: cantidad=0.
    -- El importe reservado queda reflejado en retenidos_anterior/posterior.
    INSERT INTO public."MOVIMIENTOS_CREDITO" (
        "id_usuario", "id_reserva", "tipo", "cantidad",
        "saldo_anterior", "saldo_posterior",
        "retenidos_anterior", "retenidos_posterior", "descripcion"
    ) VALUES (
        NEW."id_solicitante", NEW."id_reserva", 'retencion_reserva', 0,
        v_saldo, v_saldo, v_retenidos, v_retenidos_nuevos,
        format('Retención de %s créditos al aceptar la solicitud.', NEW."creditos")
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_retener_creditos_reserva
    ON public."RESERVAS";
CREATE TRIGGER trg_retener_creditos_reserva
AFTER INSERT OR UPDATE OF "estado" ON public."RESERVAS"
FOR EACH ROW
EXECUTE FUNCTION public.fn_retener_creditos_reserva();

-- 2) Transferencia cuando se registra la segunda confirmacion.
CREATE OR REPLACE FUNCTION public.fn_transferir_creditos_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_saldo_estudiante numeric(12,2);
    v_retenidos_estudiante numeric(12,2);
    v_saldo_tutor numeric(12,2);
    v_retenidos_tutor numeric(12,2);
    v_saldo_estudiante_nuevo numeric(12,2);
    v_retenidos_estudiante_nuevos numeric(12,2);
    v_saldo_tutor_nuevo numeric(12,2);
    v_pago_count integer;
    v_ingreso_count integer;
BEGIN
    IF NEW."estado" <> 'Confirmada'
       OR NEW."confirmacion_solicitante_at" IS NULL
       OR NEW."confirmacion_ofertante_at" IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) FILTER (WHERE m."tipo" = 'pago_tutoria'),
           COUNT(*) FILTER (WHERE m."tipo" = 'ingreso_tutoria')
      INTO v_pago_count, v_ingreso_count
    FROM public."MOVIMIENTOS_CREDITO" m
    WHERE m."id_reserva" = NEW."id_reserva";

    IF v_pago_count = 1 AND v_ingreso_count = 1 THEN
        RETURN NEW; -- idempotencia: ya se transfirio.
    ELSIF v_pago_count <> 0 OR v_ingreso_count <> 0 THEN
        RAISE EXCEPTION 'La reserva tiene un libro de pago incompleto; revisar MOVIMIENTOS_CREDITO.'
          USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public."MOVIMIENTOS_CREDITO" m
        WHERE m."id_reserva" = NEW."id_reserva"
          AND m."id_usuario" = NEW."id_solicitante"
          AND m."tipo" = 'retencion_reserva'
    ) THEN
        RAISE EXCEPTION 'No existe retencion previa para esta reserva.'
          USING ERRCODE = '23514';
    END IF;

    -- Bloqueo de las dos cuentas en orden estable para evitar interbloqueos.
    PERFORM u."id_usuario"
    FROM public."USUARIOS" u
    WHERE u."id_usuario" IN (NEW."id_solicitante", NEW."id_ofertante")
    ORDER BY u."id_usuario"
    FOR UPDATE;

    SELECT u."saldo", u."creditos_retenidos"
      INTO v_saldo_estudiante, v_retenidos_estudiante
    FROM public."USUARIOS" u
    WHERE u."id_usuario" = NEW."id_solicitante";

    SELECT u."saldo", u."creditos_retenidos"
      INTO v_saldo_tutor, v_retenidos_tutor
    FROM public."USUARIOS" u
    WHERE u."id_usuario" = NEW."id_ofertante";

    IF v_saldo_estudiante IS NULL OR v_saldo_tutor IS NULL THEN
        RAISE EXCEPTION 'No se encontraron las dos cuentas de la reserva.'
          USING ERRCODE = '23503';
    END IF;

    IF v_retenidos_estudiante < NEW."creditos"
       OR v_saldo_estudiante < NEW."creditos" THEN
        RAISE EXCEPTION
          'La retencion de la reserva no coincide con el importe a transferir.'
          USING ERRCODE = '23514';
    END IF;

    IF v_saldo_tutor > 9999999999.99 - NEW."creditos" THEN
        RAISE EXCEPTION 'El saldo del tutor excederia NUMERIC(12,2).'
          USING ERRCODE = '22003';
    END IF;

    v_saldo_estudiante_nuevo := v_saldo_estudiante - NEW."creditos";
    v_retenidos_estudiante_nuevos := v_retenidos_estudiante - NEW."creditos";
    v_saldo_tutor_nuevo := v_saldo_tutor + NEW."creditos";

    -- Debito del estudiante: el disponible permanece igual:
    -- antes: saldo 10.0 - retenidos 3.7 = 6.3;
    -- después: saldo 6.3 - retenidos 0.0 = 6.3.
    UPDATE public."USUARIOS"
    SET "saldo" = v_saldo_estudiante_nuevo,
        "creditos_retenidos" = v_retenidos_estudiante_nuevos
    WHERE "id_usuario" = NEW."id_solicitante";

    INSERT INTO public."MOVIMIENTOS_CREDITO" (
        "id_usuario", "id_reserva", "tipo", "cantidad",
        "saldo_anterior", "saldo_posterior",
        "retenidos_anterior", "retenidos_posterior", "descripcion"
    ) VALUES (
        NEW."id_solicitante", NEW."id_reserva", 'pago_tutoria', -NEW."creditos",
        v_saldo_estudiante, v_saldo_estudiante_nuevo,
        v_retenidos_estudiante, v_retenidos_estudiante_nuevos,
        format('Pago de tutoría: %s créditos, debitado al recibirse ambas confirmaciones.', NEW."creditos")
    );

    -- El ingreso se registra antes del UPDATE para que, si el tutor tiene
    -- penalizaciones pendientes, el trigger de cobro automatico genere
    -- despues su propio movimiento contable.
    INSERT INTO public."MOVIMIENTOS_CREDITO" (
        "id_usuario", "id_reserva", "tipo", "cantidad",
        "saldo_anterior", "saldo_posterior",
        "retenidos_anterior", "retenidos_posterior", "descripcion"
    ) VALUES (
        NEW."id_ofertante", NEW."id_reserva", 'ingreso_tutoria', NEW."creditos",
        v_saldo_tutor, v_saldo_tutor_nuevo,
        v_retenidos_tutor, v_retenidos_tutor,
        format('Ingreso por tutoría: %s créditos, acreditado al recibirse ambas confirmaciones.', NEW."creditos")
    );

    UPDATE public."USUARIOS"
    SET "saldo" = v_saldo_tutor_nuevo
    WHERE "id_usuario" = NEW."id_ofertante";

    -- La misma transaccion que realiza el pago cierra la reserva.
    UPDATE public."RESERVAS"
    SET "estado" = 'Completada',
        "completed_at" = COALESCE("completed_at", clock_timestamp())
    WHERE "id_reserva" = NEW."id_reserva"
      AND "estado" = 'Confirmada';

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transferir_creditos_reserva
    ON public."RESERVAS";
CREATE TRIGGER trg_transferir_creditos_reserva
AFTER UPDATE OF "confirmacion_solicitante_at", "confirmacion_ofertante_at"
ON public."RESERVAS"
FOR EACH ROW
EXECUTE FUNCTION public.fn_transferir_creditos_reserva();

-- 3) Liberar la retencion si se cancela antes de ambas confirmaciones.
--    El tutor no recibe nada. El trigger de penalizacion existente decide
--    aparte si corresponde cobrar 0.5 créditos por cancelar con menos de 5 h.
CREATE OR REPLACE FUNCTION public.fn_liberar_retencion_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_saldo numeric(12,2);
    v_retenidos numeric(12,2);
    v_retenidos_nuevos numeric(12,2);
BEGIN
    IF NEW."estado" <> 'Cancelada' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD."estado" = 'Cancelada' THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public."MOVIMIENTOS_CREDITO" m
        WHERE m."id_reserva" = NEW."id_reserva"
          AND m."tipo" IN ('pago_tutoria', 'ingreso_tutoria')
    ) THEN
        RAISE EXCEPTION 'No se puede cancelar una reserva cuyo pago ya fue transferido.'
          USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public."MOVIMIENTOS_CREDITO" m
        WHERE m."id_reserva" = NEW."id_reserva"
          AND m."id_usuario" = NEW."id_solicitante"
          AND m."tipo" = 'retencion_reserva'
    ) THEN
        RETURN NEW; -- No habia retencion previa que liberar.
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public."MOVIMIENTOS_CREDITO" m
        WHERE m."id_reserva" = NEW."id_reserva"
          AND m."tipo" = 'liberacion_retencion'
    ) THEN
        RETURN NEW; -- Liberacion idempotente.
    END IF;

    SELECT u."saldo", u."creditos_retenidos"
      INTO v_saldo, v_retenidos
    FROM public."USUARIOS" u
    WHERE u."id_usuario" = NEW."id_solicitante"
    FOR UPDATE;

    IF NOT FOUND OR v_retenidos < NEW."creditos" THEN
        RAISE EXCEPTION 'La retencion de la reserva no coincide con los creditos retenidos del estudiante.'
          USING ERRCODE = '23514';
    END IF;

    v_retenidos_nuevos := v_retenidos - NEW."creditos";

    UPDATE public."USUARIOS"
    SET "creditos_retenidos" = v_retenidos_nuevos
    WHERE "id_usuario" = NEW."id_solicitante";

    INSERT INTO public."MOVIMIENTOS_CREDITO" (
        "id_usuario", "id_reserva", "tipo", "cantidad",
        "saldo_anterior", "saldo_posterior",
        "retenidos_anterior", "retenidos_posterior", "descripcion"
    ) VALUES (
        NEW."id_solicitante", NEW."id_reserva", 'liberacion_retencion', 0,
        v_saldo, v_saldo, v_retenidos, v_retenidos_nuevos,
        format('Liberación de retención de %s créditos por cancelación antes del pago.', NEW."creditos")
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_liberar_retencion_reserva
    ON public."RESERVAS";
CREATE TRIGGER trg_liberar_retencion_reserva
AFTER INSERT OR UPDATE OF "estado" ON public."RESERVAS"
FOR EACH ROW
EXECUTE FUNCTION public.fn_liberar_retencion_reserva();

-- 4) API de confirmacion. El backend debe establecer app.usuario_actual
--    con el UUID autenticado dentro de la transaccion de la peticion.
CREATE OR REPLACE FUNCTION public.fn_confirmar_reserva(p_id_reserva uuid)
RETURNS varchar
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_actor uuid;
    v_solicitante uuid;
    v_ofertante uuid;
    v_estado varchar;
BEGIN
    BEGIN
        v_actor := NULLIF(current_setting('app.usuario_actual', true), '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        v_actor := NULL;
    END;

    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Debe establecerse app.usuario_actual con el usuario autenticado.'
          USING ERRCODE = '28000';
    END IF;

    SELECT r."id_solicitante", r."id_ofertante", r."estado"
      INTO v_solicitante, v_ofertante, v_estado
    FROM public."RESERVAS" r
    WHERE r."id_reserva" = p_id_reserva
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La reserva no existe.'
          USING ERRCODE = 'P0002';
    END IF;

    -- Repetir una confirmacion despues del pago no vuelve a cobrar.
    IF v_estado = 'Completada' THEN
        RETURN v_estado;
    END IF;

    IF v_estado = 'Cancelada' THEN
        RAISE EXCEPTION 'No se puede confirmar una reserva cancelada.'
          USING ERRCODE = '23514';
    END IF;

    IF v_estado <> 'Confirmada' THEN
        RAISE EXCEPTION 'La reserva todavia no esta confirmada por el tutor.'
          USING ERRCODE = '23514';
    END IF;

    IF v_actor = v_solicitante THEN
        UPDATE public."RESERVAS"
        SET "confirmacion_solicitante_at" =
            COALESCE("confirmacion_solicitante_at", clock_timestamp())
        WHERE "id_reserva" = p_id_reserva;
    ELSIF v_actor = v_ofertante THEN
        UPDATE public."RESERVAS"
        SET "confirmacion_ofertante_at" =
            COALESCE("confirmacion_ofertante_at", clock_timestamp())
        WHERE "id_reserva" = p_id_reserva;
    ELSE
        RAISE EXCEPTION 'El usuario autenticado no participa en esta reserva.'
          USING ERRCODE = '42501';
    END IF;

    SELECT r."estado" INTO v_estado
    FROM public."RESERVAS" r
    WHERE r."id_reserva" = p_id_reserva;

    RETURN v_estado;
END;
$$;

COMMENT ON FUNCTION public.fn_confirmar_reserva(uuid) IS
  'Registra la confirmacion del actor app.usuario_actual. La segunda confirmacion transfiere el pago de forma atomica e idempotente.';

REVOKE ALL ON FUNCTION public.fn_validar_reserva_solicitud() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_validar_transicion_reserva_creditos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_retener_creditos_reserva() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_transferir_creditos_reserva() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_liberar_retencion_reserva() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_confirmar_reserva(uuid) FROM PUBLIC;

