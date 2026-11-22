-- =====================================================================
-- SkillSwap / Base prioritaria: economia dinamica y penalizacion.
-- Los campos de credito siguen siendo INTEGER, pero se almacenan en
-- DECIMAS DE CREDITO: 1.0 credito = 10; 1.5 = 15; 0.5 = 5.
-- La aplicacion divide los valores almacenados entre 10 para mostrarlos.
-- Umbral de cancelacion: menos de 5 horas. Penalizacion: 0.5 credito = 5.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.config_economia (
    clave          text PRIMARY KEY,
    valor          integer NOT NULL,
    descripcion    text NOT NULL,
    actualizado_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT config_economia_valor_no_negativo CHECK (valor >= 0)
);

-- Los importes de credito se configuran en decimas. Los umbrales de tutores
-- y horas se mantienen en sus unidades naturales (tutores y horas).
INSERT INTO public.config_economia (clave, valor, descripcion) VALUES
    ('costo_base',                    10, 'Costo base: 1.0 credito, almacenado como 10 decimas.'),
    ('mult_escasez',                  15, 'Bonificacion por escasez: 1.5 creditos, almacenada como 15 decimas.'),
    ('mult_demanda',                  13, 'Bonificacion por alta demanda: 1.3 creditos, almacenada como 13 decimas.'),
    ('mult_impacto',                  12, 'Bonificacion por alto impacto: 1.2 creditos, almacenada como 12 decimas.'),
    ('umbral_tutores_escasez',         3, 'Hay escasez cuando existen menos de 3 tutores activos.'),
    ('horas_minimas_cancelacion',      5, 'Se penaliza una cancelacion realizada con menos de 5 horas de anticipacion.'),
    ('penalizacion_creditos',          5, 'Penalizacion de 0.5 creditos, almacenada como 5 decimas.')
ON CONFLICT (clave) DO NOTHING;

COMMENT ON TABLE public.config_economia IS
  'Parametros economicos. Los importes de credito se guardan en decimas (1 credito = 10 unidades enteras); umbrales de tutores y horas usan unidades naturales.';

-- Suma los importes escalados. Ejemplo: 10 + 15 = 25 unidades internas,
-- que la app presenta como 2.5 creditos (25 / 10). No redondear el total.
CREATE OR REPLACE FUNCTION public.fn_calcular_costo_clase(
    p_id_habilidad uuid,
    p_id_ofertante uuid,
    p_fecha_inicio timestamptz
) RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_costo integer;
    v_tutores_activos integer;
    v_promedio_tutor numeric;
    v_factor integer;
    v_umbral integer;
BEGIN
    IF p_id_habilidad IS NULL OR p_id_ofertante IS NULL OR p_fecha_inicio IS NULL THEN
        RAISE EXCEPTION 'Habilidad, ofertante y fecha de inicio son obligatorios.'
          USING ERRCODE = '22004';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public."HABILIDADES" h
        WHERE h."id_habilidad" = p_id_habilidad
          AND h."estado" = 'activo'
    ) THEN
        RAISE EXCEPTION 'La habilidad no existe o no esta activa.'
          USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public."USUARIO_HABILIDADES" uh
        JOIN public."USUARIOS" u ON u."id_usuario" = uh."id_usuario"
        WHERE uh."id_habilidad" = p_id_habilidad
          AND uh."id_usuario" = p_id_ofertante
          AND u."estado" = 'Activo'
          AND u."rol" = 'Estudiante'
    ) THEN
        RAISE EXCEPTION 'El ofertante no tiene registrada esta habilidad o no esta activo.'
          USING ERRCODE = '22023';
    END IF;

    SELECT c.valor INTO v_costo
    FROM public.config_economia c
    WHERE c.clave = 'costo_base';
    v_costo := COALESCE(v_costo, 10);

    SELECT COUNT(DISTINCT uh."id_usuario")
      INTO v_tutores_activos
    FROM public."USUARIO_HABILIDADES" uh
    JOIN public."USUARIOS" u ON u."id_usuario" = uh."id_usuario"
    WHERE uh."id_habilidad" = p_id_habilidad
      AND u."estado" = 'Activo'
      AND u."rol" = 'Estudiante';

    SELECT c.valor INTO v_umbral
    FROM public.config_economia c
    WHERE c.clave = 'umbral_tutores_escasez';
    v_umbral := COALESCE(v_umbral, 3);

    IF v_tutores_activos < v_umbral THEN
        SELECT c.valor INTO v_factor
        FROM public.config_economia c
        WHERE c.clave = 'mult_escasez';
        v_costo := v_costo + COALESCE(v_factor, 0);
    END IF;

    -- La hora se evalua en la zona local de la U.C.B. La Paz,
    -- independientemente de la zona horaria configurada en el contenedor.
    IF EXTRACT(HOUR FROM (p_fecha_inicio AT TIME ZONE 'America/La_Paz')) BETWEEN 18 AND 21 THEN
        SELECT c.valor INTO v_factor
        FROM public.config_economia c
        WHERE c.clave = 'mult_demanda';
        v_costo := v_costo + COALESCE(v_factor, 0);
    END IF;

    SELECT COALESCE(AVG(c."puntuacion"), 0)
      INTO v_promedio_tutor
    FROM public."CALIFICACIONES" c
    WHERE c."id_evaluado" = p_id_ofertante;

    IF v_promedio_tutor > 4.5 THEN
        SELECT c.valor INTO v_factor
        FROM public.config_economia c
        WHERE c.clave = 'mult_impacto';
        v_costo := v_costo + COALESCE(v_factor, 0);
    END IF;

    -- Se devuelve el entero en decimas. Nunca convertirlo a credito entero
    -- ni redondearlo: 25 significa 2.5 creditos y 50 significa 5.0.
    RETURN GREATEST(1, v_costo);
END;
$$;

COMMENT ON FUNCTION public.fn_calcular_costo_clase(uuid, uuid, timestamptz) IS
  'Devuelve INTEGER en decimas de credito. La app divide el resultado entre 10 para mostrar el importe.';

-- Al cancelar, se fija la hora real del evento y se almacena el numero de
-- horas completas en la columna INTEGER existente. El cobro usa el instante
-- exacto cancelled_at, no el valor redondeado de horas_anticipacion_cancelacion.
CREATE OR REPLACE FUNCTION public.fn_preparar_cancelacion_reserva()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW."estado" = 'Cancelada' THEN
        IF TG_OP = 'INSERT' THEN
            NEW."cancelled_at" := COALESCE(NEW."cancelled_at", clock_timestamp());
            NEW."horas_anticipacion_cancelacion" := GREATEST(
                0, FLOOR(EXTRACT(EPOCH FROM (NEW."fecha_inicio" - NEW."cancelled_at")) / 3600)::integer
            );
        ELSIF OLD."estado" IS DISTINCT FROM 'Cancelada' THEN
            NEW."cancelled_at" := clock_timestamp();
            NEW."horas_anticipacion_cancelacion" := GREATEST(
                0, FLOOR(EXTRACT(EPOCH FROM (NEW."fecha_inicio" - NEW."cancelled_at")) / 3600)::integer
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preparar_cancelacion_reserva ON public."RESERVAS";
CREATE TRIGGER trg_preparar_cancelacion_reserva
BEFORE INSERT OR UPDATE OF "estado" ON public."RESERVAS"
FOR EACH ROW
EXECUTE FUNCTION public.fn_preparar_cancelacion_reserva();

-- Penaliza con 0.5 credito (= 5 decimas internas) cuando la cancelacion
-- ocurre a menos de 5 horas del inicio. No cobra dos veces ni deja el saldo
-- por debajo de los creditos retenidos. Si no alcanza el disponible completo,
-- deja un movimiento informativo sin aplicar un descuento parcial.
CREATE OR REPLACE FUNCTION public.fn_aplicar_penalizacion_cancelacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_horas_minimas integer;
    v_penalizacion integer;
    v_saldo_anterior integer;
    v_saldo_posterior integer;
    v_retenidos integer;
    v_disponibles integer;
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

    SELECT c.valor INTO v_horas_minimas
    FROM public.config_economia c
    WHERE c.clave = 'horas_minimas_cancelacion';
    v_horas_minimas := COALESCE(v_horas_minimas, 5);

    -- Umbral estricto: solo es penalizable si faltan MENOS de 5 horas.
    IF NEW."fecha_inicio" - NEW."cancelled_at" >= make_interval(hours => v_horas_minimas) THEN
        RETURN NEW;
    END IF;

    SELECT c.valor INTO v_penalizacion
    FROM public.config_economia c
    WHERE c.clave = 'penalizacion_creditos';
    v_penalizacion := GREATEST(0, COALESCE(v_penalizacion, 5));

    IF v_penalizacion = 0 THEN
        RETURN NEW;
    END IF;

    SELECT u."saldo", u."creditos_retenidos"
      INTO v_saldo_anterior, v_retenidos
    FROM public."USUARIOS" u
    WHERE u."id_usuario" = NEW."cancelado_por"
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el usuario que cancelo la reserva.'
          USING ERRCODE = '23503';
    END IF;

    v_disponibles := v_saldo_anterior - v_retenidos;

    IF v_disponibles >= v_penalizacion THEN
        v_saldo_posterior := v_saldo_anterior - v_penalizacion;
        UPDATE public."USUARIOS"
        SET "saldo" = v_saldo_posterior
        WHERE "id_usuario" = NEW."cancelado_por";

        INSERT INTO public."MOVIMIENTOS_CREDITO" (
            "id_usuario", "id_reserva", "tipo", "cantidad",
            "saldo_anterior", "saldo_posterior",
            "retenidos_anterior", "retenidos_posterior", "descripcion"
        ) VALUES (
            NEW."cancelado_por", NEW."id_reserva", 'penalizacion', -v_penalizacion,
            v_saldo_anterior, v_saldo_posterior,
            v_retenidos, v_retenidos,
            format('Penalizacion de %s decimas ( %s credito(s) ) por cancelar con menos de %s horas de anticipacion.',
                   v_penalizacion, v_penalizacion / 10.0, v_horas_minimas)
        );
    ELSE
        INSERT INTO public."MOVIMIENTOS_CREDITO" (
            "id_usuario", "id_reserva", "tipo", "cantidad",
            "saldo_anterior", "saldo_posterior",
            "retenidos_anterior", "retenidos_posterior", "descripcion"
        ) VALUES (
            NEW."cancelado_por", NEW."id_reserva", 'penalizacion_sin_saldo', 0,
            v_saldo_anterior, v_saldo_anterior,
            v_retenidos, v_retenidos,
            format('Penalizacion de %s decimas no cobrada: saldo disponible insuficiente. Cancelacion con menos de %s horas.',
                   v_penalizacion, v_horas_minimas)
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_penalizacion_cancelacion ON public."RESERVAS";
CREATE TRIGGER trg_aplicar_penalizacion_cancelacion
AFTER INSERT OR UPDATE OF "estado", "cancelado_por" ON public."RESERVAS"
FOR EACH ROW
EXECUTE FUNCTION public.fn_aplicar_penalizacion_cancelacion();

REVOKE ALL ON FUNCTION public.fn_preparar_cancelacion_reserva() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_aplicar_penalizacion_cancelacion() FROM PUBLIC;

-- Indices complementarios para economia y consultas de oferta/demanda.
CREATE INDEX IF NOT EXISTS ix_solicitudes_habilidad_estado
    ON public."SOLICITUDES_INTERCAMBIO" ("id_habilidad", "estado");
CREATE INDEX IF NOT EXISTS ix_reservas_ofertante_estado
    ON public."RESERVAS" ("id_ofertante", "estado");
