\set ON_ERROR_STOP on
SET client_min_messages = warning;

-- HU-07. Ejecutar despues de inicializar la base y crear los roles.
DO $$
DECLARE
    v_count bigint;
BEGIN
    -- Deben existir las vistas principales de BI.
    SELECT COUNT(*) INTO v_count
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name IN (
          'v_bi_reservas_por_hora',
          'v_bi_reservas_dia_hora',
          'v_bi_materias_oferta_demanda',
          'v_bi_materias_sin_tutores',
          'v_bi_knowledge_score'
      );
    IF v_count <> 5 THEN
        RAISE EXCEPTION 'HU-07 FALLA: se esperaban 5 vistas BI y se encontraron %', v_count;
    END IF;

    -- Criterio ideal: 24 franjas horarias segun America/La_Paz.
    SELECT COUNT(*) INTO v_count FROM public.v_bi_reservas_por_hora;
    IF v_count <> 24 THEN
        RAISE EXCEPTION 'HU-07 FALLA: v_bi_reservas_por_hora debe devolver 24 filas; devolvio %', v_count;
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.v_bi_reservas_dia_hora;
    IF v_count <> 168 THEN
        RAISE EXCEPTION 'HU-07 FALLA: v_bi_reservas_dia_hora debe devolver 168 combinaciones; devolvio %', v_count;
    END IF;

    -- Compara cada franja con un calculo directo usando la zona horaria de La Paz.
    IF EXISTS (
        WITH esperado AS (
            SELECT
                EXTRACT(HOUR FROM (r."fecha_inicio" AT TIME ZONE 'America/La_Paz'))::integer AS hora_local,
                COUNT(*)::bigint AS total_reservas
            FROM public."RESERVAS" r
            GROUP BY EXTRACT(HOUR FROM (r."fecha_inicio" AT TIME ZONE 'America/La_Paz'))::integer
        )
        SELECT 1
        FROM public.v_bi_reservas_por_hora v
        LEFT JOIN esperado e ON e.hora_local = v.hora_local
        WHERE v.total_reservas <> COALESCE(e.total_reservas, 0)
    ) THEN
        RAISE EXCEPTION 'HU-07 FALLA: el conteo horario no coincide con America/La_Paz';
    END IF;

    -- Criterio alternativo: las materias sin tutor aparecen con oferta cero.
    IF EXISTS (
        SELECT 1
        FROM public.v_bi_materias_sin_tutores
        WHERE oferta_tutores <> 0
    ) THEN
        RAISE EXCEPTION 'HU-07 FALLA: v_bi_materias_sin_tutores contiene oferta distinta de cero';
    END IF;
    SELECT COUNT(*) INTO v_count FROM public.v_bi_materias_sin_tutores;
    IF v_count = 0 THEN
        RAISE NOTICE 'HU-07: no hay materias sin tutor para demostrar el caso alternativo; verificar que HABILIDADES contenga todo el catalogo del pensum.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.v_bi_materias_oferta_demanda
        WHERE tutores_activos < 0 OR solicitudes_pendientes < 0
    ) THEN
        RAISE EXCEPTION 'HU-07 FALLA: hay conteos negativos en oferta o demanda';
    END IF;

    -- Criterio de error: tutor sin calificaciones no debe mostrar promedio cero.
    IF EXISTS (
        SELECT 1
        FROM public.v_bi_knowledge_score
        WHERE total_calificaciones = 0
          AND promedio_estrellas IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'HU-07 FALLA: un tutor sin calificaciones aparece con promedio distinto de NULL';
    END IF;
    SELECT COUNT(*) INTO v_count
    FROM public.v_bi_knowledge_score
    WHERE total_calificaciones = 0;
    IF v_count = 0 THEN
        RAISE NOTICE 'HU-07: no hay tutores sin calificaciones para demostrar el promedio NULL; agregar un tutor de prueba sin calificaciones.';
    END IF;

    -- El rol de BI/lectura debe poder consultar las vistas y no requiere
    -- permisos directos sobre tablas transaccionales de usuarios/reservas.
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_lectura') THEN
        IF NOT has_table_privilege('rol_lectura', 'public.v_bi_reservas_por_hora', 'SELECT')
           OR NOT has_table_privilege('rol_lectura', 'public.v_bi_materias_sin_tutores', 'SELECT')
           OR NOT has_table_privilege('rol_lectura', 'public.v_bi_knowledge_score', 'SELECT') THEN
            RAISE EXCEPTION 'HU-07 FALLA: rol_lectura no tiene SELECT sobre todas las vistas BI requeridas';
        END IF;
    END IF;

    RAISE NOTICE 'HU-07 OK: vistas BI presentes, 24 horas La Paz, materias con oferta cero, promedio NULL y permisos de lectura.';
END;
$$;

-- Evidencia para el criterio de tutor sin calificaciones.
-- Si no devuelve filas, el entorno no tiene todavía un tutor sin calificaciones
-- con el que demostrar el caso; no significa que la vista este mal configurada.
SELECT id_usuario, total_calificaciones, promedio_estrellas
FROM public.v_bi_knowledge_score
WHERE total_calificaciones = 0
ORDER BY id_usuario
LIMIT 20;

-- Evidencia para el criterio de materia sin tutor.
SELECT id_habilidad, materia, categoria, solicitudes_pendientes, oferta_tutores
FROM public.v_bi_materias_sin_tutores
ORDER BY solicitudes_pendientes DESC, materia;

-- Evidencia de las horas pico (America/La_Paz).
SELECT *
FROM public.v_bi_reservas_por_hora
ORDER BY total_reservas DESC, hora_local;
