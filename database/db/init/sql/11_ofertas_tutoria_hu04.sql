-- =====================================================================
-- HU-04: Ofertas de tutoria persistentes.
-- Precio: lo define el tutor y se guarda directamente como NUMERIC(12,2).
-- Se admite una sola cifra decimal; 3.7 se almacena como 3.70 y 3.75 se rechaza.
-- La sugerencia dinamica de BD nunca sustituye este precio publicado.
-- Requiere: 01_base_a_schema.sql y 04_auditoria_automatica.sql.
-- Se incluye en 00_bootstrap.sql, que controla la transaccion global.
-- =====================================================================


-- Valida el precio recibido sin cambiar su escala. El parámetro numeric
-- sin typmod permite rechazar 3.75 antes de asignarlo a la columna NUMERIC(12,2).
CREATE OR REPLACE FUNCTION public.fn_validar_precio_creditos(p_creditos numeric)
RETURNS numeric(12,2)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF p_creditos IS NULL OR p_creditos <= 0 THEN
        RAISE EXCEPTION 'El precio debe ser mayor que cero.' USING ERRCODE = '22023';
    END IF;
    IF p_creditos <> trunc(p_creditos, 1) THEN
        RAISE EXCEPTION 'El precio admite una sola cifra decimal. Valor recibido: %.', p_creditos
          USING ERRCODE = '22023';
    END IF;
    RETURN p_creditos::numeric(12,2);
END;
$$;

COMMENT ON FUNCTION public.fn_validar_precio_creditos(numeric) IS
  'Valida y devuelve el precio en créditos reales; admite una cifra decimal, por ejemplo 3.7, y rechaza 3.75.';

CREATE TABLE IF NOT EXISTS public."OFERTAS_TUTORIA" (
    "id_oferta"      uuid        NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario"     uuid        NOT NULL,
    "id_habilidad"   uuid        NOT NULL,
    "titulo"         varchar     NOT NULL,
    "descripcion"    text,
    "fecha_inicio"   timestamptz NOT NULL,
    "fecha_fin"      timestamptz NOT NULL,
    "costo_creditos" numeric(12,2) NOT NULL,
    "estado"         varchar     NOT NULL DEFAULT 'Activa',
    "created_at"     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OFERTAS_TUTORIA_pkey" PRIMARY KEY ("id_oferta"),
    CONSTRAINT "OFERTAS_TUTORIA_titulo_no_vacio"
        CHECK (length(btrim("titulo")) > 0),
    CONSTRAINT "OFERTAS_TUTORIA_intervalo_valido"
        CHECK ("fecha_fin" > "fecha_inicio"),
    CONSTRAINT "OFERTAS_TUTORIA_costo_positivo"
        CHECK ("costo_creditos" > 0 AND "costo_creditos" = trunc("costo_creditos", 1)),
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
COMMENT ON COLUMN public."OFERTAS_TUTORIA"."costo_creditos" IS
  'Precio definitivo elegido por el tutor, almacenado directamente en créditos reales NUMERIC. La sugerencia dinámica no lo sobreescribe.';

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

    NEW."costo_creditos" := public.fn_validar_precio_creditos(NEW."costo_creditos");

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

-- Vista de consumo de la aplicacion. El precio se consulta directamente en créditos reales.
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
    o."costo_creditos",
    o."estado",
    o."created_at",
    o."updated_at"
FROM public."OFERTAS_TUTORIA" o
JOIN public."HABILIDADES" h
  ON h."id_habilidad" = o."id_habilidad";

