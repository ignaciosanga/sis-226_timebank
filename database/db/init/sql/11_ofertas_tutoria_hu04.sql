-- =====================================================================
-- HU-04: Ofertas de tutoria persistentes.
-- Precio: lo define el tutor; una sola cifra decimal, guardado como INTEGER en decimas.
-- La sugerencia dinamica de BD nunca sustituye este precio publicado.
-- 1.0 credito = 10; 3.7 creditos = 37; 3.75 se rechaza.
-- Requiere: 01_base_a_schema.sql y 04_auditoria_automatica.sql.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_creditos_a_decimas(p_creditos numeric)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_decimas numeric;
BEGIN
    IF p_creditos IS NULL OR p_creditos <= 0 THEN
        RAISE EXCEPTION 'El precio debe ser mayor que cero.'
          USING ERRCODE = '22023';
    END IF;

    v_decimas := p_creditos * 10;

    -- El modelo de negocio admite exactamente una cifra decimal.
    IF v_decimas <> trunc(v_decimas) THEN
        RAISE EXCEPTION
          'El precio admite una sola cifra decimal. Valor recibido: %.',
          p_creditos
          USING ERRCODE = '22023';
    END IF;

    IF v_decimas > 2147483647 THEN
        RAISE EXCEPTION 'El precio excede el rango INTEGER.'
          USING ERRCODE = '22003';
    END IF;

    RETURN v_decimas::integer;
END;
$$;

COMMENT ON FUNCTION public.fn_creditos_a_decimas(numeric) IS
  'Convierte creditos visibles a decimas INTEGER. Acepta una sola cifra decimal: 3.7 -> 37; rechaza 3.75.';

CREATE TABLE IF NOT EXISTS public."OFERTAS_TUTORIA" (
    "id_oferta"      uuid        NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario"     uuid        NOT NULL,
    "id_habilidad"   uuid        NOT NULL,
    "titulo"         varchar     NOT NULL,
    "descripcion"    text,
    "fecha_inicio"   timestamptz NOT NULL,
    "fecha_fin"      timestamptz NOT NULL,
    "costo_decimas"  integer     NOT NULL,
    "estado"         varchar     NOT NULL DEFAULT 'Activa',
    "created_at"     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OFERTAS_TUTORIA_pkey" PRIMARY KEY ("id_oferta"),
    CONSTRAINT "OFERTAS_TUTORIA_titulo_no_vacio"
        CHECK (length(btrim("titulo")) > 0),
    CONSTRAINT "OFERTAS_TUTORIA_intervalo_valido"
        CHECK ("fecha_fin" > "fecha_inicio"),
    CONSTRAINT "OFERTAS_TUTORIA_costo_positivo"
        CHECK ("costo_decimas" > 0),
    CONSTRAINT "OFERTAS_TUTORIA_estado_valido"
        CHECK ("estado" IN ('Activa', 'Pausada', 'Cerrada')),
    CONSTRAINT "OFERTAS_TUTORIA_usuario_habilidad_fkey"
        FOREIGN KEY ("id_usuario", "id_habilidad")
        REFERENCES public."USUARIO_HABILIDADES" ("id_usuario", "id_habilidad")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OFERTAS_TUTORIA_usuario_estado_idx"
    ON public."OFERTAS_TUTORIA" ("id_usuario", "estado");
CREATE INDEX IF NOT EXISTS "OFERTAS_TUTORIA_habilidad_estado_fecha_idx"
    ON public."OFERTAS_TUTORIA" ("id_habilidad", "estado", "fecha_inicio");

COMMENT ON TABLE public."OFERTAS_TUTORIA" IS
  'Ofertas de tutoria publicadas por un usuario para una habilidad, con titulo, horario y precio persistente definido por el tutor. Este precio es la fuente de verdad para la solicitud.';
COMMENT ON COLUMN public."OFERTAS_TUTORIA"."costo_decimas" IS
  'Precio definitivo elegido por el tutor. INTEGER en decimas: 37 = 3.7 creditos. La funcion de sugerencia dinamica no lo sobreescribe.';

CREATE OR REPLACE FUNCTION public.fn_validar_oferta_tutoria()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF length(btrim(NEW."titulo")) = 0 THEN
        RAISE EXCEPTION 'El titulo de la oferta es obligatorio.'
          USING ERRCODE = '23514';
    END IF;

    IF NEW."fecha_fin" <= NEW."fecha_inicio" THEN
        RAISE EXCEPTION 'La fecha_fin debe ser posterior a fecha_inicio.'
          USING ERRCODE = '23514';
    END IF;

    IF NEW."costo_decimas" <= 0 THEN
        RAISE EXCEPTION 'El costo de la oferta debe ser mayor que cero.'
          USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public."USUARIOS" u
        JOIN public."USUARIO_HABILIDADES" uh
          ON uh."id_usuario" = u."id_usuario"
        JOIN public."HABILIDADES" h
          ON h."id_habilidad" = uh."id_habilidad"
        WHERE u."id_usuario" = NEW."id_usuario"
          AND uh."id_habilidad" = NEW."id_habilidad"
          AND u."estado" = 'Activo'
          AND h."estado" = 'activo'
    ) THEN
        RAISE EXCEPTION
          'El tutor debe estar activo y tener la habilidad en su perfil.'
          USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        NEW."updated_at" := clock_timestamp();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_oferta_tutoria
    ON public."OFERTAS_TUTORIA";
CREATE TRIGGER trg_validar_oferta_tutoria
BEFORE INSERT OR UPDATE ON public."OFERTAS_TUTORIA"
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_oferta_tutoria();

-- Auditoria de altas, cambios y bajas de ofertas.
DROP TRIGGER IF EXISTS trg_auditar_ofertas_tutoria
    ON public."OFERTAS_TUTORIA";
CREATE TRIGGER trg_auditar_ofertas_tutoria
AFTER INSERT OR UPDATE OR DELETE ON public."OFERTAS_TUTORIA"
FOR EACH ROW
EXECUTE FUNCTION public.fn_auditar('id_oferta');

-- Vista de consumo de la aplicacion. El precio visible se divide entre 10.
CREATE OR REPLACE VIEW public.v_ofertas_tutoria_app AS
SELECT
    o."id_oferta",
    o."id_usuario",
    o."id_habilidad",
    h."nombre" AS "nombre_habilidad",
    o."titulo",
    o."descripcion",
    o."fecha_inicio",
    o."fecha_fin",
    o."costo_decimas",
    (o."costo_decimas" / 10.0)::numeric(12,1) AS "costo_creditos",
    o."estado",
    o."created_at",
    o."updated_at"
FROM public."OFERTAS_TUTORIA" o
JOIN public."HABILIDADES" h
  ON h."id_habilidad" = o."id_habilidad";

COMMIT;
