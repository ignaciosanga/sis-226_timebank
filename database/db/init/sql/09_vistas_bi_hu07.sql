-- =====================================================================
-- HU-07 | Vistas para los tableros de BI - SkillSwap / Nexo U
-- Compatible con el esquema prioritario 01_base_a_schema.sql.
-- No modifica tablas ni tipos de datos.
-- =====================================================================

-- 1) Knowledge Score: el promedio queda NULL cuando el tutor no recibio
-- calificaciones. No se sustituye por cero porque cero seria una nota real.
-- Se conservan los mismos nombres y tipos de columnas de v_knowledge_score
-- para no romper fn_obtener_top_tutores ni las integraciones existentes.
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
    JOIN public."RESERVAS" r
      ON r."id_reserva" = c."id_reserva"
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
    ROUND(ct.promedio_estrellas, 2) AS promedio_estrellas,
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
  'Metricas de tutores activos. promedio_estrellas es NULL cuando no existen calificaciones validas.';

-- 2) Reservas por hora local de La Paz.
-- Se devuelven las 24 horas, incluso las que tienen cero reservas.
-- total_reservas incluye todos los estados; las otras columnas separan
-- Confirmada, Completada y Cancelada para que BI pueda elegir el indicador.
CREATE OR REPLACE VIEW public.v_bi_reservas_por_hora AS
WITH reservas_locales AS (
    SELECT
        r."id_reserva",
        r."estado",
        (r."fecha_inicio" AT TIME ZONE 'America/La_Paz') AS inicio_local
    FROM public."RESERVAS" r
), agregado AS (
    SELECT
        EXTRACT(HOUR FROM inicio_local)::integer AS hora_local,
        COUNT(*)::bigint AS total_reservas,
        (COUNT(*) FILTER (WHERE "estado" = 'Confirmada'))::bigint AS reservas_confirmadas,
        (COUNT(*) FILTER (WHERE "estado" = 'Completada'))::bigint AS reservas_completadas,
        (COUNT(*) FILTER (WHERE "estado" = 'Cancelada'))::bigint AS reservas_canceladas
    FROM reservas_locales
    GROUP BY EXTRACT(HOUR FROM inicio_local)::integer
)
SELECT
    horas.hora_local::smallint AS hora_local,
    LPAD(horas.hora_local::text, 2, '0') || ':00' AS franja_horaria,
    COALESCE(a.total_reservas, 0)::bigint AS total_reservas,
    COALESCE(a.reservas_confirmadas, 0)::bigint AS reservas_confirmadas,
    COALESCE(a.reservas_completadas, 0)::bigint AS reservas_completadas,
    COALESCE(a.reservas_canceladas, 0)::bigint AS reservas_canceladas
FROM generate_series(0, 23) AS horas(hora_local)
LEFT JOIN agregado a ON a.hora_local = horas.hora_local
ORDER BY horas.hora_local;

COMMENT ON VIEW public.v_bi_reservas_por_hora IS
  'Cantidad de reservas agrupadas por hora de inicio en America/La_Paz; siempre devuelve las 24 horas.';

-- 3) Vista complementaria para un mapa de calor por dia de semana y hora.
-- El dia sigue ISO-8601: 1 lunes ... 7 domingo.
CREATE OR REPLACE VIEW public.v_bi_reservas_dia_hora AS
WITH reservas_locales AS (
    SELECT
        r."estado",
        (r."fecha_inicio" AT TIME ZONE 'America/La_Paz') AS inicio_local
    FROM public."RESERVAS" r
), agregado AS (
    SELECT
        EXTRACT(ISODOW FROM inicio_local)::integer AS dia_semana_iso,
        EXTRACT(HOUR FROM inicio_local)::integer AS hora_local,
        COUNT(*)::bigint AS total_reservas,
        (COUNT(*) FILTER (WHERE "estado" = 'Confirmada'))::bigint AS reservas_confirmadas,
        (COUNT(*) FILTER (WHERE "estado" = 'Completada'))::bigint AS reservas_completadas,
        (COUNT(*) FILTER (WHERE "estado" = 'Cancelada'))::bigint AS reservas_canceladas
    FROM reservas_locales
    GROUP BY
        EXTRACT(ISODOW FROM inicio_local)::integer,
        EXTRACT(HOUR FROM inicio_local)::integer
)
SELECT
    dias.dia_semana_iso::smallint AS dia_semana_iso,
    CASE dias.dia_semana_iso
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miercoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sabado'
        WHEN 7 THEN 'Domingo'
    END AS dia_semana,
    horas.hora_local::smallint AS hora_local,
    LPAD(horas.hora_local::text, 2, '0') || ':00' AS franja_horaria,
    COALESCE(a.total_reservas, 0)::bigint AS total_reservas,
    COALESCE(a.reservas_confirmadas, 0)::bigint AS reservas_confirmadas,
    COALESCE(a.reservas_completadas, 0)::bigint AS reservas_completadas,
    COALESCE(a.reservas_canceladas, 0)::bigint AS reservas_canceladas
FROM generate_series(1, 7) AS dias(dia_semana_iso)
CROSS JOIN generate_series(0, 23) AS horas(hora_local)
LEFT JOIN agregado a
  ON a.dia_semana_iso = dias.dia_semana_iso
 AND a.hora_local = horas.hora_local
ORDER BY dias.dia_semana_iso, horas.hora_local;

COMMENT ON VIEW public.v_bi_reservas_dia_hora IS
  'Reservas por dia de semana y hora local de La Paz; devuelve las 168 combinaciones posibles.';

-- 4) Oferta y demanda de cada materia/habilidad del catalogo existente.
-- En el esquema acordado, HABILIDADES es el catalogo fuente para las materias
-- que pueden ofrecerse. Para cubrir todo el pensum, este catalogo debe contener
-- tambien las materias que todavia no tiene ningun tutor.
CREATE OR REPLACE VIEW public.v_bi_materias_oferta_demanda AS
WITH oferta AS (
    SELECT
        uh."id_habilidad",
        COUNT(DISTINCT uh."id_usuario")::bigint AS tutores_activos
    FROM public."USUARIO_HABILIDADES" uh
    JOIN public."USUARIOS" u
      ON u."id_usuario" = uh."id_usuario"
    WHERE u."estado" = 'Activo'
      AND u."rol" = 'Estudiante'
    GROUP BY uh."id_habilidad"
), demanda AS (
    SELECT
        s."id_habilidad",
        COUNT(*)::bigint AS solicitudes_pendientes
    FROM public."SOLICITUDES_INTERCAMBIO" s
    WHERE s."estado" = 'Solicitada'
    GROUP BY s."id_habilidad"
)
SELECT
    h."id_habilidad",
    h."nombre" AS materia,
    c."nombre" AS categoria,
    COALESCE(d.solicitudes_pendientes, 0)::bigint AS solicitudes_pendientes,
    COALESCE(o.tutores_activos, 0)::bigint AS tutores_activos,
    CASE
        WHEN COALESCE(o.tutores_activos, 0) = 0
         AND COALESCE(d.solicitudes_pendientes, 0) > 0 THEN 100::numeric
        WHEN COALESCE(o.tutores_activos, 0) = 0 THEN 0::numeric
        ELSE ROUND(
            COALESCE(d.solicitudes_pendientes, 0)::numeric
            / NULLIF(o.tutores_activos, 0) * 100,
            2
        )
    END AS indice_brecha
FROM public."HABILIDADES" h
LEFT JOIN public."CATEGORIAS" c
  ON c."id_categoria" = h."id_categoria"
LEFT JOIN oferta o ON o."id_habilidad" = h."id_habilidad"
LEFT JOIN demanda d ON d."id_habilidad" = h."id_habilidad"
WHERE h."estado" = 'activo';

COMMENT ON VIEW public.v_bi_materias_oferta_demanda IS
  'Catalogo activo de materias/habilidades con cantidad de tutores activos y solicitudes pendientes; incluye oferta cero.';

-- 5) Subconjunto directo para el criterio alternativo de HU-07:
-- una materia del catalogo sin ningun tutor debe aparecer con oferta cero.
CREATE OR REPLACE VIEW public.v_bi_materias_sin_tutores AS
SELECT
    id_habilidad,
    materia,
    categoria,
    solicitudes_pendientes,
    tutores_activos AS oferta_tutores,
    indice_brecha
FROM public.v_bi_materias_oferta_demanda
WHERE tutores_activos = 0;

COMMENT ON VIEW public.v_bi_materias_sin_tutores IS
  'Materias activas del catalogo HABILIDADES que no tienen ningun tutor activo asociado.';

-- 6) Knowledge Score listo para BI, sin nombre, apellido ni correo.
-- El identificador permite relacionar metricas sin exponer datos personales.
CREATE OR REPLACE VIEW public.v_bi_knowledge_score AS
SELECT
    ks."id_usuario",
    ks."clases_completadas",
    ks."alumnos_distintos",
    ks."clases_canceladas",
    ks."total_calificaciones",
    ks."promedio_estrellas",
    ks."tasa_cumplimiento",
    ks."score_impacto"
FROM public.v_knowledge_score ks;

COMMENT ON VIEW public.v_bi_knowledge_score IS
  'Knowledge Score para BI. No expone nombre, apellido ni correo; promedio_estrellas permanece NULL si no hay calificaciones.';

-- Cuando este modulo se aplica manualmente sobre una base ya existente,
-- concede los permisos si rol_lectura ya existe. En la inicializacion nueva,
-- el rol se crea despues y recibe estos permisos desde 05_seguridad_roles.sql.tpl.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_lectura') THEN
        EXECUTE 'GRANT SELECT ON
            public.v_bi_reservas_por_hora,
            public.v_bi_reservas_dia_hora,
            public.v_bi_materias_oferta_demanda,
            public.v_bi_materias_sin_tutores,
            public.v_bi_knowledge_score
        TO rol_lectura';
    END IF;
END;
$$;
