-- =====================================================================
-- SkillSwap / Base prioritaria: Knowledge Score, Match y Knowledge Gap.
-- Usa los nombres, estados y columnas del 01_base_a_schema.sql original.
-- =====================================================================

-- Si se aplican estos modulos sobre una instalacion previa del paquete v2,
-- quitar primero las vistas cuyas columnas cambiaron y la funcion dependiente.
DROP FUNCTION IF EXISTS public.fn_obtener_top_tutores(uuid, timestamptz, timestamptz, text);
DROP VIEW IF EXISTS public.v_knowledge_score;
DROP VIEW IF EXISTS public.v_knowledge_gap_index;
DROP VIEW IF EXISTS public.v_command_center_resumen;

-- Impacto de tutores: agregaciones separadas para evitar multiplicacion
-- de filas al combinar RESERVAS y CALIFICACIONES.
CREATE OR REPLACE VIEW public.v_knowledge_score AS
WITH reservas_tutor AS (
    SELECT
        r."id_ofertante" AS id_usuario,
        COUNT(*) FILTER (WHERE r."estado" = 'Completada') AS clases_completadas,
        COUNT(DISTINCT r."id_solicitante")
            FILTER (WHERE r."estado" = 'Completada') AS alumnos_distintos,
        COUNT(*) FILTER (WHERE r."estado" = 'Cancelada') AS clases_canceladas,
        COUNT(*) FILTER (WHERE r."estado" IN ('Completada', 'Cancelada')) AS clases_finalizadas
    FROM public."RESERVAS" r
    GROUP BY r."id_ofertante"
), calificaciones_tutor AS (
    SELECT
        c."id_evaluado" AS id_usuario,
        AVG(c."puntuacion") AS promedio_estrellas,
        COUNT(*) AS total_calificaciones
    FROM public."CALIFICACIONES" c
    JOIN public."RESERVAS" r ON r."id_reserva" = c."id_reserva"
                            AND r."estado" = 'Completada'
    GROUP BY c."id_evaluado"
)
SELECT
    u."id_usuario",
    u."nombre",
    u."apellido",
    COALESCE(rt.clases_completadas, 0)::bigint AS clases_completadas,
    COALESCE(rt.alumnos_distintos, 0)::bigint AS alumnos_distintos,
    COALESCE(rt.clases_canceladas, 0)::bigint AS clases_canceladas,
    COALESCE(ct.total_calificaciones, 0)::bigint AS total_calificaciones,
    ROUND(COALESCE(ct.promedio_estrellas, 0), 2) AS promedio_estrellas,
    CASE
        WHEN COALESCE(rt.clases_finalizadas, 0) = 0 THEN 0::numeric
        ELSE ROUND(
            100.0 * COALESCE(rt.clases_completadas, 0)
            / NULLIF(rt.clases_finalizadas, 0), 2
        )
    END AS tasa_cumplimiento,
    ROUND(
        (COALESCE(rt.clases_completadas, 0) * 0.5)
        + (COALESCE(ct.promedio_estrellas, 0) * 1.5),
        2
    ) AS score_impacto
FROM public."USUARIOS" u
LEFT JOIN reservas_tutor rt ON rt.id_usuario = u."id_usuario"
LEFT JOIN calificaciones_tutor ct ON ct.id_usuario = u."id_usuario"
WHERE u."estado" = 'Activo'
  AND u."rol" = 'Estudiante'
  AND EXISTS (
      SELECT 1
      FROM public."USUARIO_HABILIDADES" uh
      WHERE uh."id_usuario" = u."id_usuario"
  );

COMMENT ON VIEW public.v_knowledge_score IS
  'Metricas de impacto de tutores activos: clases, alumnos, cancelaciones, reputacion y cumplimiento.';

-- Match inteligente. El puntaje suma hasta 100 puntos:
-- 30 dominio, 25 disponibilidad, 20 impacto, 15 cumplimiento y 10
-- experiencia previa en la modalidad solicitada. Si no se pide modalidad,
-- se asignan los 10 puntos de ese criterio.
-- Si se proporciona fecha/hora, la disponibilidad debe cubrir TODO el rango.
CREATE OR REPLACE FUNCTION public.fn_obtener_top_tutores(
    p_id_habilidad uuid,
    p_fecha_inicio timestamptz DEFAULT NULL,
    p_fecha_fin timestamptz DEFAULT NULL,
    p_modalidad text DEFAULT NULL
)
RETURNS TABLE (
    id_tutor uuid,
    nombre_tutor text,
    afinidad numeric(5,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF p_id_habilidad IS NULL THEN
        RAISE EXCEPTION 'Debes indicar una habilidad.' USING ERRCODE = '22004';
    END IF;

    IF (p_fecha_inicio IS NULL) <> (p_fecha_fin IS NULL) THEN
        RAISE EXCEPTION 'Debes indicar ambas fechas o dejar ambas nulas.' USING ERRCODE = '22023';
    END IF;

    IF p_fecha_inicio IS NOT NULL AND p_fecha_fin <= p_fecha_inicio THEN
        RAISE EXCEPTION 'La fecha fin debe ser posterior a la fecha inicio.' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public."HABILIDADES" h
        WHERE h."id_habilidad" = p_id_habilidad AND h."estado" = 'activo'
    ) THEN
        RAISE EXCEPTION 'La habilidad no existe o no esta activa.' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    WITH candidatos AS (
        SELECT
            u."id_usuario",
            (u."nombre" || ' ' || u."apellido")::text AS nombre_completo,
            CASE lower(uh."nivel")
                WHEN 'avanzado' THEN 30::numeric
                WHEN 'intermedio' THEN 20::numeric
                WHEN 'basico' THEN 10::numeric
                ELSE 0::numeric
            END AS puntos_dominio,
            CASE WHEN EXISTS (
                SELECT 1
                FROM public."DISPONIBILIDADES" d
                WHERE d."id_usuario" = u."id_usuario"
                  AND d."estado" = 'disponible'
                  AND (
                      (p_fecha_inicio IS NOT NULL
                       AND d."fecha_inicio" <= p_fecha_inicio
                       AND d."fecha_fin" >= p_fecha_fin)
                      OR
                      (p_fecha_inicio IS NULL AND d."fecha_inicio" > now())
                  )
            ) THEN 25::numeric ELSE 0::numeric END AS puntos_disponibilidad,
            LEAST(20::numeric, COALESCE(ks."score_impacto", 0) * 4) AS puntos_impacto,
            CASE
                WHEN COALESCE(ks."clases_completadas", 0) + COALESCE(ks."clases_canceladas", 0) = 0
                    THEN 7.5::numeric
                ELSE (ks."tasa_cumplimiento" * 0.15)
            END AS puntos_cumplimiento,
            CASE
                WHEN p_modalidad IS NULL OR lower(p_modalidad) IN ('cualquiera', 'indistinto')
                    THEN 10::numeric
                WHEN EXISTS (
                    SELECT 1
                    FROM public."RESERVAS" rm
                    WHERE rm."id_ofertante" = u."id_usuario"
                      AND lower(rm."modalidad") = lower(p_modalidad)
                      AND rm."estado" IN ('Confirmada', 'Completada')
                ) THEN 10::numeric
                ELSE 5::numeric
            END AS puntos_modalidad
        FROM public."USUARIOS" u
        JOIN public."USUARIO_HABILIDADES" uh
          ON uh."id_usuario" = u."id_usuario"
         AND uh."id_habilidad" = p_id_habilidad
        LEFT JOIN public.v_knowledge_score ks
          ON ks."id_usuario" = u."id_usuario"
        WHERE u."estado" = 'Activo'
          AND u."rol" = 'Estudiante'
    )
    SELECT
        c.id_usuario,
        c.nombre_completo,
        ROUND(
            c.puntos_dominio
            + c.puntos_disponibilidad
            + c.puntos_impacto
            + c.puntos_cumplimiento
            + c.puntos_modalidad,
            2
        )::numeric(5,2)
    FROM candidatos c
    ORDER BY 3 DESC, 2 ASC
    LIMIT 3;
END;
$$;

COMMENT ON FUNCTION public.fn_obtener_top_tutores(uuid, timestamptz, timestamptz, text) IS
  'Devuelve hasta tres tutores ordenados por afinidad, utilizando disponibilidad, nivel, impacto y cumplimiento.';

-- Brecha de conocimiento: demanda = solicitudes con estado 'Solicitada'; oferta =
-- estudiantes activos que declaran la habilidad. Se mantienen los estados
-- exactos de la base prioritaria ('Solicitada', 'Activo', 'activo').
CREATE OR REPLACE VIEW public.v_knowledge_gap_index AS
WITH demanda AS (
    SELECT s."id_habilidad", COUNT(*)::bigint AS total_demanda
    FROM public."SOLICITUDES_INTERCAMBIO" s
    WHERE s."estado" = 'Solicitada'
    GROUP BY s."id_habilidad"
), oferta AS (
    SELECT uh."id_habilidad", COUNT(DISTINCT uh."id_usuario")::bigint AS total_tutores
    FROM public."USUARIO_HABILIDADES" uh
    JOIN public."USUARIOS" u ON u."id_usuario" = uh."id_usuario"
    WHERE u."estado" = 'Activo'
      AND u."rol" = 'Estudiante'
    GROUP BY uh."id_habilidad"
), brechas AS (
    SELECT
        h."id_habilidad",
        h."nombre" AS materia,
        COALESCE(d.total_demanda, 0)::bigint AS demanda,
        COALESCE(o.total_tutores, 0)::bigint AS oferta_tutores
    FROM public."HABILIDADES" h
    LEFT JOIN demanda d ON d."id_habilidad" = h."id_habilidad"
    LEFT JOIN oferta o ON o."id_habilidad" = h."id_habilidad"
    WHERE h."estado" = 'activo'
)
SELECT
    b.id_habilidad,
    b.materia,
    b.demanda,
    b.oferta_tutores,
    CASE
        WHEN b.oferta_tutores = 0 AND b.demanda > 0 THEN 100::numeric
        WHEN b.oferta_tutores = 0 THEN 0::numeric
        ELSE ROUND((b.demanda::numeric / b.oferta_tutores) * 100, 2)
    END AS nivel_brecha,
    CASE
        WHEN b.oferta_tutores = 0 AND b.demanda > 0 THEN 'Sin tutores'
        WHEN b.demanda = 0 THEN 'Sin demanda pendiente'
        WHEN (b.demanda::numeric / NULLIF(b.oferta_tutores, 0)) * 100 >= 100 THEN 'Critica'
        WHEN (b.demanda::numeric / NULLIF(b.oferta_tutores, 0)) * 100 >= 50 THEN 'Alta'
        WHEN (b.demanda::numeric / NULLIF(b.oferta_tutores, 0)) * 100 >= 20 THEN 'Media'
        ELSE 'Baja'
    END AS nivel_alerta
FROM brechas b;

COMMENT ON VIEW public.v_knowledge_gap_index IS
  'Indicador de brecha entre solicitudes pendientes de una habilidad y tutores activos que la ofrecen.';

-- Vistas de conveniencia para el equipo de aplicacion.
-- Se conservan tambien las columnas *_decimas para operaciones/depuracion;
-- las columnas *_creditos son NUMERIC y ya vienen divididas entre 10.
CREATE OR REPLACE VIEW public.v_cuentas_credito_app AS
SELECT
    u."id_usuario",
    u."saldo" AS saldo_decimas,
    (u."saldo"::numeric / 10) AS saldo_creditos,
    u."creditos_retenidos" AS retenidos_decimas,
    (u."creditos_retenidos"::numeric / 10) AS retenidos_creditos,
    (u."saldo" - u."creditos_retenidos") AS disponibles_decimas,
    ((u."saldo" - u."creditos_retenidos")::numeric / 10) AS disponibles_creditos
FROM public."USUARIOS" u;

COMMENT ON VIEW public.v_cuentas_credito_app IS
  'Saldos para la app: columnas *_decimas son INTEGER internos y columnas *_creditos son valores visibles divididos entre 10.';

CREATE OR REPLACE VIEW public.v_movimientos_credito_app AS
SELECT
    m."id_movimiento",
    m."id_usuario",
    m."id_reserva",
    m."tipo",
    m."cantidad" AS cantidad_decimas,
    (m."cantidad"::numeric / 10) AS cantidad_creditos,
    m."saldo_anterior" AS saldo_anterior_decimas,
    (m."saldo_anterior"::numeric / 10) AS saldo_anterior_creditos,
    m."saldo_posterior" AS saldo_posterior_decimas,
    (m."saldo_posterior"::numeric / 10) AS saldo_posterior_creditos,
    m."descripcion",
    m."created_at"
FROM public."MOVIMIENTOS_CREDITO" m;

COMMENT ON VIEW public.v_movimientos_credito_app IS
  'Movimientos contables en decimas y su equivalente visible en creditos (division entre 10).';

-- Vista agregada para Command Center / BI, sin nombres ni identificadores personales.
CREATE OR REPLACE VIEW public.v_command_center_resumen AS
WITH saldo_global AS (
    SELECT COALESCE(SUM(u."saldo"), 0)::bigint AS total_decimas
    FROM public."USUARIOS" u
    WHERE u."estado" = 'Activo'
)
SELECT
    (SELECT COUNT(*) FROM public."USUARIOS" u
      WHERE u."estado" = 'Activo' AND u."rol" = 'Estudiante') AS estudiantes_activos,
    (SELECT COUNT(*) FROM public."RESERVAS" r
      WHERE r."estado" = 'Completada') AS clases_completadas,
    (SELECT COUNT(*) FROM public."RESERVAS" r
      WHERE r."estado" = 'Cancelada') AS clases_canceladas,
    (SELECT COUNT(*) FROM public."SOLICITUDES_INTERCAMBIO" s
      WHERE s."estado" = 'Solicitada') AS solicitudes_pendientes,
    (SELECT COUNT(*) FROM public."HABILIDADES" h
      WHERE h."estado" = 'activo') AS habilidades_activas,
    sg.total_decimas AS creditos_en_cuentas_decimas,
    (sg.total_decimas::numeric / 10) AS creditos_en_cuentas
FROM saldo_global sg;

COMMENT ON VIEW public.v_command_center_resumen IS
  'Indicadores agregados para Command Center. creditos_en_cuentas_decimas es el entero interno; creditos_en_cuentas es el importe visible dividido entre 10.';
