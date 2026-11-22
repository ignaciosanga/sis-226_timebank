-- =====================================================================
-- SkillSwap / Base prioritaria: economia dinamica y penalizacion.
-- Los importes se almacenan como NUMERIC(12,2) en créditos reales.
-- La regla funcional admite una sola cifra decimal: 3.7, 1.5, 1.3, 0.5.
-- Umbral de cancelación: menos de 5 horas. Penalización: 0.5 créditos.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.config_economia (
    clave          text PRIMARY KEY,
    valor          numeric(12,2) NOT NULL,
    descripcion    text NOT NULL,
    actualizado_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT config_economia_valor_no_negativo CHECK (valor >= 0),
    CONSTRAINT config_economia_una_decimal CHECK (valor = trunc(valor, 1)),
    CONSTRAINT config_economia_umbrales_enteros CHECK (
      clave NOT IN ('umbral_tutores_escasez', 'horas_minimas_cancelacion')
      OR valor = trunc(valor)
    )
);

-- Los importes se configuran directamente en créditos reales. Los umbrales de
-- tutores y horas se mantienen en unidades enteras (tutores y horas).
INSERT INTO public.config_economia (clave, valor, descripcion) VALUES
    ('costo_base',                   1.0, 'Costo base sugerido: 1.0 credito.'),
    ('mult_escasez',                  1.5, 'Componente sugerido por escasez: 1.5 creditos.'),
    ('mult_demanda',                  1.3, 'Componente sugerido por demanda: 1.3 creditos.'),
    ('mult_impacto',                  1.2, 'Componente sugerido por impacto: 1.2 creditos.'),
    ('umbral_tutores_escasez',       3.0, 'Hay escasez cuando existen menos de 3 tutores activos.'),
    ('horas_minimas_cancelacion',    5.0, 'Se penaliza una cancelacion realizada con menos de 5 horas de anticipacion.'),
    ('penalizacion_creditos',        0.5, 'Penalizacion de 0.5 creditos.')
ON CONFLICT (clave) DO NOTHING;

COMMENT ON TABLE public.config_economia IS
  'Parámetros económicos expresados en créditos reales; se admite una cifra decimal. Los umbrales de tutores y horas son enteros.';

-- Suma los componentes como créditos reales. Ejemplo: 1.0 + 1.5 = 2.5 créditos.
CREATE OR REPLACE FUNCTION public.fn_calcular_costo_clase(
    p_id_habilidad uuid,
    p_id_ofertante uuid,
    p_fecha_inicio timestamptz
) RETURNS numeric(12,2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_costo numeric(12,2);
    v_tutores_activos integer;
    v_promedio_tutor numeric;
    v_factor numeric(12,2);
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
    v_costo := COALESCE(v_costo, 1.0);

    SELECT COUNT(DISTINCT uh."id_usuario")
      INTO v_tutores_activos
    FROM public."USUARIO_HABILIDADES" uh
    JOIN public."USUARIOS" u ON u."id_usuario" = uh."id_usuario"
    WHERE uh."id_habilidad" = p_id_habilidad
      AND u."estado" = 'Activo'
      AND u."rol" = 'Estudiante';

    SELECT c.valor::integer INTO v_umbral
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

    -- Se devuelve el precio sugerido en créditos reales. No se utiliza como
    -- precio de cobro; el precio definitivo es el publicado por el tutor.
    RETURN GREATEST(0.1::numeric, v_costo);
END;
$$;

COMMENT ON FUNCTION public.fn_calcular_costo_clase(uuid, uuid, timestamptz) IS
  'DEPRECADA COMO PRECIO DE COBRO. Devuelve una referencia calculada por reglas dinamicas; nunca reemplaza el precio elegido por el tutor ni la cotizacion guardada en SOLICITUDES_INTERCAMBIO.';

-- Nombre explicito para el uso permitido desde la aplicacion: mostrar una
-- sugerencia al tutor. El precio definitivo sigue siendo OFERTAS_TUTORIA.costo_creditos.
CREATE OR REPLACE FUNCTION public.fn_sugerir_precio_clase(
    p_id_habilidad uuid,
    p_id_ofertante uuid,
    p_fecha_inicio timestamptz
) RETURNS numeric(12,2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT public.fn_calcular_costo_clase(
        p_id_habilidad, p_id_ofertante, p_fecha_inicio
    );
$$;

COMMENT ON FUNCTION public.fn_sugerir_precio_clase(uuid, uuid, timestamptz) IS
  'Devuelve un precio sugerido en créditos reales según oferta/demanda/impacto. Es orientativo: no modifica ofertas, solicitudes ni reservas.';

REVOKE ALL ON FUNCTION public.fn_sugerir_precio_clase(uuid, uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_calcular_costo_clase(uuid, uuid, timestamptz) FROM PUBLIC;

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

-- Penaliza con 0.5 créditos cuando la cancelación
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
            format('Penalización de %s créditos por cancelar con menos de %s horas de anticipación.',
                   v_penalizacion, v_horas_minimas)
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
            format('Penalización de %s créditos no cobrada: saldo disponible insuficiente. Cancelación con menos de %s horas.',
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
