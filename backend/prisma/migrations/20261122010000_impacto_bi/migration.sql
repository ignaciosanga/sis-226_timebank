-- =====================================================================
-- SkillSwap / Nexo U
-- HU-07 + IMPACTO | Archivo unico para la base del Backend (Neon)
-- Reemplaza a 14_hu07_vistas_bi_backend.sql (lo incluye completo).
--
-- Que instala:
--   1. v_knowledge_score ........ Knowledge Score por tutor (interno).
--   2. v_bi_reservas_por_hora ... 24 filas, hora local America/La_Paz.
--   3. v_bi_reservas_dia_hora ... 168 filas (7 dias ISO x 24 horas).
--   4. v_bi_materias_oferta_demanda  oferta, demanda e indice de brecha.
--   5. v_bi_materias_sin_tutores .... materias con oferta cero.
--   6. v_bi_knowledge_score ..... score para BI sin datos personales.
--   7. v_knowledge_gap_index .... Knowledge Gap Index con nivel de alerta.
--   8. v_command_center_resumen . indicadores del Command Center.
--   9. fn_obtener_top_tutores ... MOTOR DE MATCHING (top 3 por afinidad).
--
-- Seguridad y alcance:
--   * No crea, altera ni elimina tablas. No modifica datos.
--   * Todo va en UNA transaccion: si falla una comprobacion, no se crea nada.
--   * Antes de crear nada verifica que existan las columnas necesarias y
--     avisa exactamente cual falta.
--   * Detecta si RESERVAS.fecha_inicio es timestamptz o timestamp y ajusta
--     la conversion a hora de La Paz (evita horas desplazadas).
--   * Si la tabla OFERTAS (Fase 3) no existe todavia, calcula la oferta
--     desde USUARIO_HABILIDADES y lo avisa con un NOTICE.
--   * El matching es SECURITY INVOKER: usa los permisos de quien lo llama,
--     asi funciona con el rol que use el Backend sin conceder nada nuevo.
--
-- Como aplicarlo (primero en una RAMA de Neon, luego en la principal):
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f 16_hu07_impacto_completo_backend.sql
--
-- Se puede ejecutar mas de una vez (CREATE OR REPLACE).
-- =====================================================================

BEGIN;
SET LOCAL client_min_messages = NOTICE;

-- ---------------------------------------------------------------------
-- 0) Comprobacion previa: tablas y columnas necesarias.
-- ---------------------------------------------------------------------
DO $pre$
DECLARE
    v_faltan text;
BEGIN
    SELECT string_agg(req.t || '.' || req.c, ', ' ORDER BY req.t, req.c)
      INTO v_faltan
    FROM (VALUES
        ('USUARIOS','id_usuario'), ('USUARIOS','nombre'), ('USUARIOS','apellido'),
        ('USUARIOS','estado'), ('USUARIOS','rol'), ('USUARIOS','saldo'),
        ('RESERVAS','id_reserva'), ('RESERVAS','id_ofertante'), ('RESERVAS','id_solicitante'),
        ('RESERVAS','estado'), ('RESERVAS','fecha_inicio'), ('RESERVAS','modalidad'),
        ('CALIFICACIONES','id_reserva'), ('CALIFICACIONES','id_evaluado'),
        ('CALIFICACIONES','puntuacion'),
        ('SOLICITUDES_INTERCAMBIO','id_habilidad'), ('SOLICITUDES_INTERCAMBIO','estado'),
        ('HABILIDADES','id_habilidad'), ('HABILIDADES','nombre'),
        ('HABILIDADES','id_categoria'), ('HABILIDADES','estado'),
        ('CATEGORIAS','id_categoria'), ('CATEGORIAS','nombre'),
        ('USUARIO_HABILIDADES','id_usuario'), ('USUARIO_HABILIDADES','id_habilidad'),
        ('USUARIO_HABILIDADES','nivel'),
        ('DISPONIBILIDADES','id_usuario'), ('DISPONIBILIDADES','fecha_inicio'),
        ('DISPONIBILIDADES','fecha_fin'), ('DISPONIBILIDADES','estado')
    ) AS req(t, c)
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns ic
        WHERE ic.table_schema = 'public'
          AND ic.table_name = req.t
          AND ic.column_name = req.c
    );

    IF v_faltan IS NOT NULL THEN
        RAISE EXCEPTION
          'No se instalo nada. Faltan estas tablas/columnas en la base: %. Avisar a BD para adaptar el archivo.',
          v_faltan;
    END IF;
END
$pre$;

-- ---------------------------------------------------------------------
-- 1) Knowledge Score (interno). promedio_estrellas es NULL sin
--    calificaciones validas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_knowledge_score AS
WITH reservas_tutor AS (
    SELECT
        r."id_ofertante" AS id_usuario,
        COUNT(*) FILTER (WHERE r."estado" = 'Completada') AS clases_completadas,
        COUNT(DISTINCT r."id_solicitante")
            FILTER (WHERE r."estado" = 'Completada') AS alumnos_distintos,
        COUNT(*) FILTER (WHERE r."estado" = 'Cancelada') AS clases_canceladas,
        COUNT(*) FILTER (
            WHERE r."estado" IN ('Completada', 'Cancelada')
        ) AS clases_finalizadas
    FROM public."RESERVAS" r
    GROUP BY r."id_ofertante"
),
calificaciones_tutor AS (
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
            / NULLIF(rt.clases_finalizadas, 0),
            2
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
'Indicadores de usuarios activos con habilidades registradas. El promedio de estrellas es NULL cuando no existen calificaciones validas.';

-- ---------------------------------------------------------------------
-- 2-4) Vistas con parte dinamica:
--      * conversion a hora de La Paz segun el tipo real de fecha_inicio;
--      * oferta desde OFERTAS (Fase 3) o, si no existe, desde
--        USUARIO_HABILIDADES.
-- ---------------------------------------------------------------------
DO $dyn$
DECLARE
    v_tipo   text;
    v_local  text;
    v_oferta text;
    v_origen text;
BEGIN
    SELECT ic.data_type INTO v_tipo
    FROM information_schema.columns ic
    WHERE ic.table_schema = 'public'
      AND ic.table_name = 'RESERVAS'
      AND ic.column_name = 'fecha_inicio';

    IF v_tipo = 'timestamp with time zone' THEN
        v_local := $e$(r."fecha_inicio" AT TIME ZONE 'America/La_Paz')$e$;
    ELSIF v_tipo = 'timestamp without time zone' THEN
        v_local := $e$((r."fecha_inicio" AT TIME ZONE 'UTC') AT TIME ZONE 'America/La_Paz')$e$;
    ELSE
        RAISE EXCEPTION 'RESERVAS.fecha_inicio tiene un tipo inesperado: %.', v_tipo;
    END IF;

    -- Reservas por hora (24 filas).
    EXECUTE format($q$
        CREATE OR REPLACE VIEW public.v_bi_reservas_por_hora AS
        WITH reservas_locales AS (
            SELECT r."estado", %s AS inicio_local
            FROM public."RESERVAS" r
        ),
        agregado AS (
            SELECT
                EXTRACT(HOUR FROM inicio_local)::integer AS hora_local,
                COUNT(*)::bigint AS total_reservas,
                COUNT(*) FILTER (WHERE "estado" = 'Confirmada')::bigint AS reservas_confirmadas,
                COUNT(*) FILTER (WHERE "estado" = 'Completada')::bigint AS reservas_completadas,
                COUNT(*) FILTER (WHERE "estado" = 'Cancelada')::bigint AS reservas_canceladas
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
    $q$, v_local);

    -- Mapa de calor dia ISO x hora (168 filas).
    EXECUTE format($q$
        CREATE OR REPLACE VIEW public.v_bi_reservas_dia_hora AS
        WITH reservas_locales AS (
            SELECT r."estado", %s AS inicio_local
            FROM public."RESERVAS" r
        ),
        agregado AS (
            SELECT
                EXTRACT(ISODOW FROM inicio_local)::integer AS dia_semana_iso,
                EXTRACT(HOUR FROM inicio_local)::integer AS hora_local,
                COUNT(*)::bigint AS total_reservas,
                COUNT(*) FILTER (WHERE "estado" = 'Confirmada')::bigint AS reservas_confirmadas,
                COUNT(*) FILTER (WHERE "estado" = 'Completada')::bigint AS reservas_completadas,
                COUNT(*) FILTER (WHERE "estado" = 'Cancelada')::bigint AS reservas_canceladas
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
    $q$, v_local);

    -- Oferta: OFERTAS activas (Fase 3) si la tabla existe con sus columnas.
    IF (SELECT COUNT(*) FROM information_schema.columns ic
        WHERE ic.table_schema = 'public' AND ic.table_name = 'OFERTAS'
          AND ic.column_name IN ('id_tutor', 'id_habilidad', 'estado')) = 3 THEN
        v_oferta := $o$
            SELECT o."id_habilidad", COUNT(DISTINCT o."id_tutor")::bigint AS tutores_activos
            FROM public."OFERTAS" o
            JOIN public."USUARIOS" u ON u."id_usuario" = o."id_tutor"
            WHERE o."estado" = 'Activa'
              AND u."estado" = 'Activo'
              AND u."rol" = 'Estudiante'
            GROUP BY o."id_habilidad"
        $o$;
        v_origen := 'OFERTAS (Fase 3)';
    ELSE
        v_oferta := $o$
            SELECT uh."id_habilidad", COUNT(DISTINCT uh."id_usuario")::bigint AS tutores_activos
            FROM public."USUARIO_HABILIDADES" uh
            JOIN public."USUARIOS" u ON u."id_usuario" = uh."id_usuario"
            WHERE u."estado" = 'Activo'
              AND u."rol" = 'Estudiante'
            GROUP BY uh."id_habilidad"
        $o$;
        v_origen := 'USUARIO_HABILIDADES (la tabla OFERTAS aun no existe)';
    END IF;

    EXECUTE format($q$
        CREATE OR REPLACE VIEW public.v_bi_materias_oferta_demanda AS
        WITH oferta AS (%s),
        demanda AS (
            SELECT s."id_habilidad", COUNT(*)::bigint AS solicitudes_pendientes
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
        LEFT JOIN public."CATEGORIAS" c ON c."id_categoria" = h."id_categoria"
        LEFT JOIN oferta o ON o."id_habilidad" = h."id_habilidad"
        LEFT JOIN demanda d ON d."id_habilidad" = h."id_habilidad"
        WHERE h."estado" = 'activo'
    $q$, v_oferta);

    RAISE NOTICE 'HU-07: fecha_inicio es "%"; oferta calculada desde %.', v_tipo, v_origen;
END
$dyn$;

COMMENT ON VIEW public.v_bi_reservas_por_hora IS
'Conteo de reservas por hora de inicio en America/La_Paz. Siempre devuelve las 24 franjas horarias.';
COMMENT ON VIEW public.v_bi_reservas_dia_hora IS
'Conteo de reservas por dia ISO y hora de inicio en America/La_Paz. Siempre devuelve 168 combinaciones.';
COMMENT ON VIEW public.v_bi_materias_oferta_demanda IS
'Catalogo de habilidades activas con tutores que tienen oferta activa y solicitudes pendientes. Incluye oferta cero.';

-- ---------------------------------------------------------------------
-- 5) Materias activas sin oferta.
-- ---------------------------------------------------------------------
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
'Habilidades activas del catalogo que no tienen tutores con oferta activa.';

-- ---------------------------------------------------------------------
-- 6) Knowledge Score para BI: solo id y metricas, sin datos personales.
-- ---------------------------------------------------------------------
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
'Knowledge Score para BI sin nombre, apellido, correo ni credenciales. El promedio permanece NULL sin calificaciones.';

-- ---------------------------------------------------------------------
-- 7) Knowledge Gap Index con nivel de alerta (para el Command Center).
--    nivel_brecha = solicitudes pendientes / tutores activos x 100.
--    Sin tutores y con demanda = 100.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_knowledge_gap_index AS
SELECT
    m.id_habilidad,
    m.materia,
    m.solicitudes_pendientes AS demanda,
    m.tutores_activos AS oferta_tutores,
    m.indice_brecha AS nivel_brecha,
    CASE
        WHEN m.tutores_activos = 0 AND m.solicitudes_pendientes > 0 THEN 'Sin tutores'
        WHEN m.solicitudes_pendientes = 0 THEN 'Sin demanda pendiente'
        WHEN m.indice_brecha >= 100 THEN 'Critica'
        WHEN m.indice_brecha >= 50 THEN 'Alta'
        WHEN m.indice_brecha >= 20 THEN 'Media'
        ELSE 'Baja'
    END AS nivel_alerta
FROM public.v_bi_materias_oferta_demanda m;

COMMENT ON VIEW public.v_knowledge_gap_index IS
'Knowledge Gap Index: brecha entre solicitudes pendientes y tutores activos por habilidad, con nivel de alerta.';

-- ---------------------------------------------------------------------
-- 8) Resumen del Command Center.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_command_center_resumen AS
WITH saldo_global AS (
    SELECT COALESCE(SUM(u."saldo"), 0)::numeric(14,2) AS total_creditos
    FROM public."USUARIOS" u
    WHERE u."estado" = 'Activo'
)
SELECT
    (SELECT COUNT(*) FROM public."USUARIOS" u
      WHERE u."estado" = 'Activo' AND u."rol" = 'Estudiante') AS estudiantes_activos,
    (SELECT COUNT(*) FROM public."RESERVAS" r WHERE r."estado" = 'Completada') AS clases_completadas,
    (SELECT COUNT(*) FROM public."RESERVAS" r WHERE r."estado" = 'Cancelada') AS clases_canceladas,
    (SELECT COUNT(*) FROM public."SOLICITUDES_INTERCAMBIO" s WHERE s."estado" = 'Solicitada') AS solicitudes_pendientes,
    (SELECT COUNT(*) FROM public."HABILIDADES" h WHERE h."estado" = 'activo') AS habilidades_activas,
    sg.total_creditos AS creditos_en_cuentas
FROM saldo_global sg;

COMMENT ON VIEW public.v_command_center_resumen IS
'Indicadores agregados del Command Center: estudiantes activos, clases, solicitudes pendientes, habilidades y creditos en cuentas.';

-- ---------------------------------------------------------------------
-- 9) Motor de matching. Devuelve hasta 3 tutores con su afinidad (0-100):
--    30 dominio + 25 disponibilidad + 20 impacto + 15 cumplimiento
--    + 10 experiencia en la modalidad pedida.
--    Si se indica fecha, la disponibilidad debe cubrir TODO el rango.
--    Uso: SELECT * FROM fn_obtener_top_tutores('<id_habilidad>'::uuid);
--         SELECT * FROM fn_obtener_top_tutores('<id>'::uuid,
--                 '2026-11-25 10:00-04', '2026-11-25 11:00-04', 'Virtual');
-- ---------------------------------------------------------------------
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
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $fn$
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
                WHEN 'experto' THEN 30::numeric
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
$fn$;

COMMENT ON FUNCTION public.fn_obtener_top_tutores(uuid, timestamptz, timestamptz, text) IS
'Motor de matching: hasta tres tutores ordenados por afinidad (dominio, disponibilidad, impacto, cumplimiento y modalidad).';

-- ---------------------------------------------------------------------
-- 10) Permisos: solo a roles que existan. Si BI o el Backend usan otro
--     nombre de rol, conceder SELECT a ese rol despues (ver al final).
-- ---------------------------------------------------------------------
DO $grants$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['dashboards_lectura', 'rol_lectura'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format(
                'GRANT SELECT ON public.v_bi_reservas_por_hora, public.v_bi_reservas_dia_hora, '
                || 'public.v_bi_materias_oferta_demanda, public.v_bi_materias_sin_tutores, '
                || 'public.v_bi_knowledge_score, public.v_knowledge_gap_index, '
                || 'public.v_command_center_resumen TO %I', r);
            RAISE NOTICE 'SELECT concedido a %.', r;
        ELSE
            RAISE NOTICE 'El rol % no existe: no se concedio SELECT. Conceder al rol de BI real.', r;
        END IF;
    END LOOP;
END
$grants$;

-- ---------------------------------------------------------------------
-- 11) Verificacion final (solo lectura). Si algo no cuadra, ROLLBACK total.
-- ---------------------------------------------------------------------
DO $check$
DECLARE
    v_n bigint;
    v_hab uuid;
BEGIN
    SELECT COUNT(*) INTO v_n FROM public.v_bi_reservas_por_hora;
    IF v_n <> 24 THEN RAISE EXCEPTION 'Verificacion: v_bi_reservas_por_hora devolvio % filas (24).', v_n; END IF;

    SELECT COUNT(*) INTO v_n FROM public.v_bi_reservas_dia_hora;
    IF v_n <> 168 THEN RAISE EXCEPTION 'Verificacion: v_bi_reservas_dia_hora devolvio % filas (168).', v_n; END IF;

    -- El total por hora debe coincidir con el total de reservas.
    IF (SELECT COALESCE(SUM(total_reservas), 0) FROM public.v_bi_reservas_por_hora)
       <> (SELECT COUNT(*) FROM public."RESERVAS") THEN
        RAISE EXCEPTION 'Verificacion: el total por hora no coincide con RESERVAS.';
    END IF;
    IF (SELECT COALESCE(SUM(total_reservas), 0) FROM public.v_bi_reservas_dia_hora)
       <> (SELECT COUNT(*) FROM public."RESERVAS") THEN
        RAISE EXCEPTION 'Verificacion: el total por dia/hora no coincide con RESERVAS.';
    END IF;

    -- BI no debe exponer datos personales.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'v_bi_knowledge_score'
          AND column_name IN ('nombre', 'apellido', 'correo', 'password_hash')
    ) THEN
        RAISE EXCEPTION 'Verificacion: v_bi_knowledge_score expone datos personales.';
    END IF;

    -- Promedio NULL sin calificaciones.
    IF EXISTS (
        SELECT 1 FROM public.v_bi_knowledge_score
        WHERE total_calificaciones = 0 AND promedio_estrellas IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Verificacion: hay promedio no NULL sin calificaciones.';
    END IF;

    SELECT COUNT(*) INTO v_n FROM public.v_command_center_resumen;
    IF v_n <> 1 THEN RAISE EXCEPTION 'Verificacion: v_command_center_resumen debe devolver 1 fila.'; END IF;

    PERFORM 1 FROM public.v_knowledge_gap_index LIMIT 1;

    -- El matching se ejecuta de verdad con una habilidad activa (si hay).
    SELECT h."id_habilidad" INTO v_hab
    FROM public."HABILIDADES" h WHERE h."estado" = 'activo' ORDER BY h."nombre" LIMIT 1;
    IF v_hab IS NOT NULL THEN
        PERFORM 1 FROM public.fn_obtener_top_tutores(v_hab);
    END IF;

    RAISE NOTICE 'HU-07 + IMPACTO OK: 9 objetos instalados y verificados (24 horas, 168 combinaciones, matching ejecutado).';
END
$check$;

COMMIT;

-- =====================================================================
-- Consultas rapidas despues de instalar:
--   SELECT * FROM public.v_command_center_resumen;
--   SELECT * FROM public.v_knowledge_gap_index ORDER BY nivel_brecha DESC;
--   SELECT * FROM public.v_bi_knowledge_score ORDER BY score_impacto DESC;
--   SELECT * FROM public.v_bi_reservas_por_hora ORDER BY hora_local;
--   SELECT * FROM public.v_bi_materias_sin_tutores ORDER BY materia;
--   SELECT * FROM public.fn_obtener_top_tutores(
--       (SELECT id_habilidad FROM public."HABILIDADES" WHERE estado='activo' LIMIT 1));
--
-- Si BI se conecta con un rol distinto de rol_lectura, ejecutar (cambiando
-- el nombre del rol):
--   GRANT SELECT ON public.v_bi_reservas_por_hora, public.v_bi_reservas_dia_hora,
--       public.v_bi_materias_oferta_demanda, public.v_bi_materias_sin_tutores,
--       public.v_bi_knowledge_score, public.v_knowledge_gap_index,
--       public.v_command_center_resumen TO nombre_del_rol_bi;
-- =====================================================================
