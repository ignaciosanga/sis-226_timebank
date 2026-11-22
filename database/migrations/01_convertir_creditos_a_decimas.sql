-- =====================================================================
-- MIGRACION MANUAL Y DE UNA SOLA VEZ:
-- Convierte una base ANTIGUA cuyos INTEGER representaban creditos enteros
-- a la nueva escala donde 1 credito = 10 unidades INTEGER (decimas).
-- NO ejecutar en una base nueva inicializada con los scripts v3, ni si los
-- saldos ya estan guardados en decimas. Hacer backup antes de ejecutar.
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.skillswap_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

SELECT pg_advisory_xact_lock(hashtext('skillswap_creditos_decimas_v1'));

DO $$
DECLARE
    v_tipo_valor text;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.skillswap_migrations
        WHERE version = '2026-11-creditos-decimas-x10'
    ) THEN
        RAISE NOTICE 'La migracion de creditos a decimas ya fue aplicada; no se repite.';
        RETURN;
    END IF;

    -- Multiplicar importes historicos por 10. Los tipos permanecen INTEGER.
    UPDATE public."USUARIOS"
       SET "saldo" = ("saldo"::bigint * 10)::integer,
           "creditos_retenidos" = ("creditos_retenidos"::bigint * 10)::integer;

    UPDATE public."SOLICITUDES_INTERCAMBIO"
       SET "creditos_requeridos" = ("creditos_requeridos"::bigint * 10)::integer;

    UPDATE public."RESERVAS"
       SET "creditos" = ("creditos"::bigint * 10)::integer;

    UPDATE public."MOVIMIENTOS_CREDITO"
       SET "cantidad" = ("cantidad"::bigint * 10)::integer,
           "saldo_anterior" = ("saldo_anterior"::bigint * 10)::integer,
           "saldo_posterior" = ("saldo_posterior"::bigint * 10)::integer,
           "retenidos_anterior" = ("retenidos_anterior"::bigint * 10)::integer,
           "retenidos_posterior" = ("retenidos_posterior"::bigint * 10)::integer;

    -- Si existe config_economia de una version anterior (numeric en creditos
    -- visibles), convertir las reglas monetarias a decimas y el tipo a INTEGER.
    IF to_regclass('public.config_economia') IS NOT NULL THEN
        SELECT c.data_type INTO v_tipo_valor
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'config_economia'
          AND c.column_name = 'valor';

        IF v_tipo_valor IN ('numeric', 'real', 'double precision') THEN
            UPDATE public.config_economia
               SET valor = CASE
                   WHEN clave IN ('costo_base', 'mult_escasez', 'mult_demanda',
                                  'mult_impacto', 'penalizacion_creditos')
                       THEN ROUND(valor * 10)
                   ELSE ROUND(valor)
               END;
            ALTER TABLE public.config_economia
                ALTER COLUMN valor TYPE integer USING ROUND(valor)::integer;
        END IF;

        -- Politica acordada: penalizacion de 0.5 creditos = 5 decimas.
        UPDATE public.config_economia
           SET valor = 5, actualizado_at = CURRENT_TIMESTAMP
         WHERE clave = 'penalizacion_creditos';
    END IF;

    INSERT INTO public.skillswap_migrations (version)
    VALUES ('2026-11-creditos-decimas-x10');
END;
$$;

COMMIT;

-- Verificacion: los siguientes importes se muestran dividiendo entre 10.
-- SELECT id_usuario, saldo, saldo::numeric / 10 AS saldo_visible FROM public."USUARIOS";
