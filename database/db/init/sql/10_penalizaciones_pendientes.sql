-- =====================================================================
-- SkillSwap / Opcion 3 de la reunion: cancelar sin descontar cuando no
-- hay saldo, dejar la penalizacion PENDIENTE y cobrarla cuando el usuario
-- tenga creditos libres.
-- Los importes se almacenan directamente en créditos reales NUMERIC(12,2).
-- Se carga despues de 07 (redefine fn_aplicar_penalizacion_cancelacion)
-- y antes de 05 (grants).
-- =====================================================================

-- 1) Tabla de deudas de penalizacion --------------------------------
CREATE TABLE IF NOT EXISTS public."PENALIZACIONES_PENDIENTES" (
    "id_penalizacion"     uuid        NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario"          uuid        NOT NULL,
    "id_reserva"          uuid        NOT NULL,
    "monto"               numeric(12,2) NOT NULL,
    "estado"              varchar     NOT NULL DEFAULT 'pendiente',
    "origen"              varchar     NOT NULL DEFAULT 'trigger',
    "id_movimiento_cobro" uuid,
    "created_at"          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cobrada_at"          timestamptz,
    CONSTRAINT "PENALIZACIONES_PENDIENTES_pkey" PRIMARY KEY ("id_penalizacion"),
    CONSTRAINT "PENALIZACIONES_PENDIENTES_reserva_key" UNIQUE ("id_reserva"),
    CONSTRAINT "PENALIZACIONES_PENDIENTES_monto_pos" CHECK ("monto" > 0 AND "monto" = trunc("monto", 1)),
    CONSTRAINT "PENALIZACIONES_PENDIENTES_estado_valido"
        CHECK ("estado" IN ('pendiente', 'cobrada', 'condonada')),
    CONSTRAINT "PENALIZACIONES_PENDIENTES_origen_valido"
        CHECK ("origen" IN ('trigger', 'etl_backfill')),
    CONSTRAINT "PENALIZACIONES_PENDIENTES_cobro_coherente"
        CHECK (("estado" = 'cobrada') = ("cobrada_at" IS NOT NULL)),
    CONSTRAINT "PENALIZACIONES_PENDIENTES_usuario_fkey"
        FOREIGN KEY ("id_usuario") REFERENCES public."USUARIOS"("id_usuario")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PENALIZACIONES_PENDIENTES_reserva_fkey"
        FOREIGN KEY ("id_reserva") REFERENCES public."RESERVAS"("id_reserva")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PENALIZACIONES_PENDIENTES_movimiento_fkey"
        FOREIGN KEY ("id_movimiento_cobro") REFERENCES public."MOVIMIENTOS_CREDITO"("id_movimiento")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PENALIZACIONES_PENDIENTES_usuario_estado_idx"
    ON public."PENALIZACIONES_PENDIENTES" ("id_usuario", "estado", "created_at");

COMMENT ON TABLE public."PENALIZACIONES_PENDIENTES" IS
  'Penalizaciones por cancelacion tardia no cobradas por falta de saldo. Se cobran cuando el usuario tiene creditos libres. Importes en créditos reales.';
COMMENT ON COLUMN public."PENALIZACIONES_PENDIENTES"."monto" IS
  'Importe en créditos reales con una sola cifra decimal; por ejemplo 0.5.';
COMMENT ON COLUMN public."PENALIZACIONES_PENDIENTES"."estado" IS
  'pendiente | cobrada | condonada.';
COMMENT ON COLUMN public."PENALIZACIONES_PENDIENTES"."origen" IS
  'trigger (cancelacion en vivo) | etl_backfill (cargada desde MOVIMIENTOS_CREDITO).';
COMMENT ON COLUMN public."PENALIZACIONES_PENDIENTES"."id_movimiento_cobro" IS
  'Movimiento de MOVIMIENTOS_CREDITO que cobro la deuda (nulo mientras este pendiente).';

-- Auditoria igual que el resto de tablas de negocio.
DROP TRIGGER IF EXISTS trg_auditar_penalizaciones_pendientes ON public."PENALIZACIONES_PENDIENTES";
CREATE TRIGGER trg_auditar_penalizaciones_pendientes
AFTER INSERT OR UPDATE OR DELETE ON public."PENALIZACIONES_PENDIENTES"
FOR EACH ROW EXECUTE FUNCTION public.fn_auditar('id_penalizacion');

-- 2) Cobro de deudas pendientes -------------------------------------
-- Cobra en orden cronologico. Mantiene la regla de 07: no hay cobro
-- parcial; una deuda se cobra completa o sigue pendiente. Devuelve el
-- total cobrado en créditos.
CREATE OR REPLACE FUNCTION public.fn_cobrar_penalizaciones_pendientes(p_id_usuario uuid)
RETURNS numeric(12,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_saldo numeric(12,2);
    v_retenidos numeric(12,2);
    v_saldo_nuevo numeric(12,2);
    v_total numeric(12,2) := 0;
    v_mov uuid;
    r record;
BEGIN
    IF p_id_usuario IS NULL THEN
        RETURN 0;
    END IF;

    SELECT u."saldo", u."creditos_retenidos"
      INTO v_saldo, v_retenidos
    FROM public."USUARIOS" u
    WHERE u."id_usuario" = p_id_usuario
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    FOR r IN
        SELECT p."id_penalizacion", p."id_reserva", p."monto"
        FROM public."PENALIZACIONES_PENDIENTES" p
        WHERE p."id_usuario" = p_id_usuario
          AND p."estado" = 'pendiente'
        ORDER BY p."created_at", p."id_penalizacion"
        FOR UPDATE
    LOOP
        EXIT WHEN (v_saldo - v_retenidos) < r."monto";

        v_saldo_nuevo := v_saldo - r."monto";
        v_mov := gen_random_uuid();

        INSERT INTO public."MOVIMIENTOS_CREDITO" (
            "id_movimiento", "id_usuario", "id_reserva", "tipo", "cantidad",
            "saldo_anterior", "saldo_posterior",
            "retenidos_anterior", "retenidos_posterior", "descripcion"
        ) VALUES (
            v_mov, p_id_usuario, r."id_reserva", 'cobro_penalizacion_pendiente', -r."monto",
            v_saldo, v_saldo_nuevo, v_retenidos, v_retenidos,
            format('Cobro de penalización pendiente: %s créditos.', r."monto")
        );

        UPDATE public."PENALIZACIONES_PENDIENTES"
        SET "estado" = 'cobrada',
            "cobrada_at" = clock_timestamp(),
            "id_movimiento_cobro" = v_mov
        WHERE "id_penalizacion" = r."id_penalizacion";

        v_saldo := v_saldo_nuevo;
        v_total := v_total + r."monto";
    END LOOP;

    IF v_total > 0 THEN
        UPDATE public."USUARIOS" SET "saldo" = v_saldo WHERE "id_usuario" = p_id_usuario;
    END IF;

    RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.fn_cobrar_penalizaciones_pendientes(uuid) IS
  'Cobra penalizaciones pendientes del usuario si tiene saldo libre. Devuelve créditos cobrados.';

-- Cobro automatico cuando el saldo libre (saldo - retenidos) aumenta.
-- Al cobrar, el saldo libre baja, asi que el WHEN impide recursion.
CREATE OR REPLACE FUNCTION public.fn_trg_cobrar_pendientes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    PERFORM public.fn_cobrar_penalizaciones_pendientes(NEW."id_usuario");
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_cobrar_penalizaciones_pendientes ON public."USUARIOS";
CREATE TRIGGER trg_cobrar_penalizaciones_pendientes
AFTER UPDATE OF "saldo", "creditos_retenidos" ON public."USUARIOS"
FOR EACH ROW
WHEN ((NEW."saldo" - NEW."creditos_retenidos") > (OLD."saldo" - OLD."creditos_retenidos"))
EXECUTE FUNCTION public.fn_trg_cobrar_pendientes();

-- 3) Penalizacion en cancelacion: misma logica de 07, pero la rama
--    "sin saldo" ahora registra la deuda en la tabla nueva. ----------
CREATE OR REPLACE FUNCTION public.fn_aplicar_penalizacion_cancelacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_horas_minimas integer;
    v_penalizacion numeric(12,2);
    v_saldo_anterior numeric(12,2);
    v_saldo_posterior numeric(12,2);
    v_retenidos numeric(12,2);
    v_disponibles numeric(12,2);
BEGIN
    IF NEW."estado" <> 'Cancelada' THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public."MOVIMIENTOS_CREDITO" m
        WHERE m."id_reserva" = NEW."id_reserva"
          AND m."tipo" IN ('penalizacion', 'penalizacion_sin_saldo')
    ) THEN
        RETURN NEW;
    END IF;

    IF NEW."cancelado_por" IS NULL OR NEW."cancelled_at" IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT c.valor::integer INTO v_horas_minimas
    FROM public.config_economia c WHERE c.clave = 'horas_minimas_cancelacion';
    v_horas_minimas := COALESCE(v_horas_minimas, 5);

    IF NEW."fecha_inicio" - NEW."cancelled_at" >= make_interval(hours => v_horas_minimas) THEN
        RETURN NEW;
    END IF;

    SELECT c.valor INTO v_penalizacion
    FROM public.config_economia c WHERE c.clave = 'penalizacion_creditos';
    v_penalizacion := GREATEST(0, COALESCE(v_penalizacion, 0.5));

    IF v_penalizacion = 0 THEN
        RETURN NEW;
    END IF;

    SELECT u."saldo", u."creditos_retenidos"
      INTO v_saldo_anterior, v_retenidos
    FROM public."USUARIOS" u
    WHERE u."id_usuario" = NEW."cancelado_por"
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el usuario que cancelo la reserva.' USING ERRCODE = '23503';
    END IF;

    v_disponibles := v_saldo_anterior - v_retenidos;

    IF v_disponibles >= v_penalizacion THEN
        v_saldo_posterior := v_saldo_anterior - v_penalizacion;
        UPDATE public."USUARIOS" SET "saldo" = v_saldo_posterior
        WHERE "id_usuario" = NEW."cancelado_por";

        INSERT INTO public."MOVIMIENTOS_CREDITO" (
            "id_usuario", "id_reserva", "tipo", "cantidad",
            "saldo_anterior", "saldo_posterior",
            "retenidos_anterior", "retenidos_posterior", "descripcion"
        ) VALUES (
            NEW."cancelado_por", NEW."id_reserva", 'penalizacion', -v_penalizacion,
            v_saldo_anterior, v_saldo_posterior, v_retenidos, v_retenidos,
            format('Penalización de %s créditos por cancelar con menos de %s horas de anticipación.',
                   v_penalizacion, v_horas_minimas)
        );
    ELSE
        -- Opcion 3: se cancela sin descontar y queda la deuda registrada.
        INSERT INTO public."MOVIMIENTOS_CREDITO" (
            "id_usuario", "id_reserva", "tipo", "cantidad",
            "saldo_anterior", "saldo_posterior",
            "retenidos_anterior", "retenidos_posterior", "descripcion"
        ) VALUES (
            NEW."cancelado_por", NEW."id_reserva", 'penalizacion_sin_saldo', 0,
            v_saldo_anterior, v_saldo_anterior, v_retenidos, v_retenidos,
            format('Penalización de %s créditos no cobrada: saldo disponible insuficiente. Cancelación con menos de %s horas.',
                   v_penalizacion, v_horas_minimas)
        );

        INSERT INTO public."PENALIZACIONES_PENDIENTES" ("id_usuario", "id_reserva", "monto", "origen")
        VALUES (NEW."cancelado_por", NEW."id_reserva", v_penalizacion, 'trigger')
        ON CONFLICT ("id_reserva") DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- 4) ETL: carga historica desde MOVIMIENTOS_CREDITO ------------------
-- Extract:   movimientos 'penalizacion_sin_saldo' con reserva.
-- Transform: extrae el importe expresado en créditos reales desde la descripción;
--            si no puede leerlo, utiliza el valor configurado. No hay conversión de escala.
-- Load:      INSERT en PENALIZACIONES_PENDIENTES (origen etl_backfill),
--            idempotente por id_reserva. Luego intenta cobrar a quienes
--            ya tengan saldo libre. Devuelve (cargadas, créditos_cobrados).
CREATE OR REPLACE FUNCTION public.fn_etl_penalizaciones_pendientes()
RETURNS TABLE (filas_cargadas integer, creditos_cobrados numeric(12,2))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_defecto numeric(12,2);
    v_cargadas integer;
    v_cobradas numeric(12,2) := 0;
    v_usuario uuid;
BEGIN
    SELECT c.valor INTO v_defecto
    FROM public.config_economia c WHERE c.clave = 'penalizacion_creditos';
    v_defecto := GREATEST(0.1, COALESCE(v_defecto, 0.5));

    INSERT INTO public."PENALIZACIONES_PENDIENTES"
        ("id_usuario", "id_reserva", "monto", "origen", "created_at")
    SELECT m."id_usuario",
           m."id_reserva",
           COALESCE(
             NULLIF((regexp_match(COALESCE(m."descripcion", ''), 'de ([0-9]+([.][0-9]+)?)'))[1], '')::numeric,
             v_defecto
           ),
           'etl_backfill',
           m."created_at"
    FROM public."MOVIMIENTOS_CREDITO" m
    WHERE m."tipo" = 'penalizacion_sin_saldo'
      AND m."id_reserva" IS NOT NULL
    ON CONFLICT ("id_reserva") DO NOTHING;

    GET DIAGNOSTICS v_cargadas = ROW_COUNT;

    FOR v_usuario IN
        SELECT DISTINCT p."id_usuario"
        FROM public."PENALIZACIONES_PENDIENTES" p
        WHERE p."estado" = 'pendiente'
    LOOP
        v_cobradas := v_cobradas + public.fn_cobrar_penalizaciones_pendientes(v_usuario);
    END LOOP;

    RETURN QUERY SELECT v_cargadas, v_cobradas;
END;
$$;

COMMENT ON FUNCTION public.fn_etl_penalizaciones_pendientes() IS
  'ETL idempotente: carga penalizacion_sin_saldo historicas a PENALIZACIONES_PENDIENTES y cobra las que ya se pueden cobrar.';

-- 5) Vistas ----------------------------------------------------------
CREATE OR REPLACE VIEW public.v_penalizaciones_pendientes_app AS
SELECT p."id_penalizacion", p."id_usuario", p."id_reserva",
       p."monto"            AS monto_creditos,
       p."estado", p."origen", p."created_at", p."cobrada_at"
FROM public."PENALIZACIONES_PENDIENTES" p;

CREATE OR REPLACE VIEW public.v_bi_penalizaciones_resumen AS
SELECT p."estado",
       COUNT(*)::bigint            AS penalizaciones,
       COALESCE(SUM(p."monto"), 0)::numeric(14,2) AS total_creditos
FROM public."PENALIZACIONES_PENDIENTES" p
GROUP BY p."estado";

REVOKE ALL ON FUNCTION public.fn_cobrar_penalizaciones_pendientes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_trg_cobrar_pendientes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_etl_penalizaciones_pendientes() FROM PUBLIC;

-- Carga inicial (en una base nueva no hay datos; en una existente, backfill).
SELECT * FROM public.fn_etl_penalizaciones_pendientes();
