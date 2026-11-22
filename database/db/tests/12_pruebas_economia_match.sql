\set ON_ERROR_STOP on
-- Ejecutar conectado como administrador/propietario de la base.
-- Todas las filas de prueba se revierten al final (ROLLBACK).
BEGIN;
SET LOCAL TIME ZONE 'America/La_Paz';
SELECT set_config('app.encryption_key', 'test-encryption-key-only-for-transaction-32-characters', true);
SELECT set_config('app.hash_pepper', 'test-hash-pepper-only-for-transaction-32-characters', true);

CREATE TEMP TABLE resultados_prueba (
    numero integer GENERATED ALWAYS AS IDENTITY,
    prueba text NOT NULL,
    resultado text NOT NULL,
    detalle text
) ON COMMIT DROP;

DO $$
DECLARE
    v_carrera uuid;
    v_categoria uuid := gen_random_uuid();
    v_habilidad uuid := gen_random_uuid();
    v_tutor uuid := gen_random_uuid();
    v_solicitante uuid := gen_random_uuid();
    v_reserva_historial uuid := gen_random_uuid();
    v_reserva_corta uuid := gen_random_uuid();
    v_reserva_larga uuid := gen_random_uuid();
    v_inicio_normal timestamptz;
    v_inicio_alta_demanda timestamptz;
    v_inicio_match timestamptz;
    v_fin_match timestamptz;
    v_costo integer;
    v_saldo integer;
    v_horas integer;
    v_count integer;
    v_tipo_credito text;
    v_cantidad integer;
    v_saldo_visible numeric;
    v_movimiento_visible numeric;
BEGIN
    SELECT c."id_carrera" INTO v_carrera
    FROM public."CARRERAS" c
    ORDER BY c."nombre"
    LIMIT 1;

    IF v_carrera IS NULL THEN
        RAISE EXCEPTION 'No existe una carrera semilla para la prueba.';
    END IF;

    INSERT INTO public."CATEGORIAS" ("id_categoria", "nombre", "estado")
    VALUES (v_categoria, 'ZZ_TEST_ECONOMIA_' || left(v_categoria::text, 8), 'activo');

    INSERT INTO public."HABILIDADES" ("id_habilidad", "nombre", "id_categoria", "estado")
    VALUES (v_habilidad, 'ZZ_TEST_SKILL_' || left(v_habilidad::text, 8), v_categoria, 'activo');

    -- 50 unidades internas = 5.0 creditos que la app muestra como 5.0.
    INSERT INTO public."USUARIOS" (
        "id_usuario", "nombre", "apellido", "correo", "password_hash", "rol",
        "id_carrera", "semestre", "saldo", "creditos_retenidos", "estado"
    ) VALUES
      (v_tutor, 'Tutor', 'Prueba', 'tutor-' || v_tutor::text || '@test.invalid', 'hash-no-login',
       'Estudiante', v_carrera, 4, 50, 0, 'Activo'),
      (v_solicitante, 'Solicitante', 'Prueba', 'solicitante-' || v_solicitante::text || '@test.invalid', 'hash-no-login',
       'Estudiante', v_carrera, 4, 50, 0, 'Activo');

    INSERT INTO public."USUARIO_HABILIDADES" ("id_usuario", "id_habilidad", "nivel")
    VALUES (v_tutor, v_habilidad, 'avanzado');

    -- La habilidad tiene un tutor: aplica escasez. A las 10:00 no aplica demanda.
    v_inicio_normal := ((CURRENT_DATE + 10) + TIME '10:00') AT TIME ZONE 'America/La_Paz';
    v_costo := public.fn_sugerir_precio_clase(v_habilidad, v_tutor, v_inicio_normal);
    IF v_costo IS DISTINCT FROM 25 THEN
        RAISE EXCEPTION 'FALLO escala de decimas: se esperaba 25 (2.5 creditos) y se obtuvo %.', v_costo;
    END IF;
    INSERT INTO resultados_prueba (prueba, resultado, detalle)
    VALUES ('Precio sugerido base + escasez en decimas', 'OK',
            '10 + 15 = 25 unidades internas; la app muestra 25 / 10 = 2.5 creditos.');

    -- Crear historial completado y calificacion 5 para activar el bono de impacto.
    INSERT INTO public."RESERVAS" (
        "id_reserva", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio", "fecha_fin", "creditos", "modalidad", "lugar", "estado", "completed_at"
    ) VALUES (
        v_reserva_historial, v_solicitante, v_tutor, v_habilidad,
        clock_timestamp() - interval '3 days', clock_timestamp() - interval '2 days',
        10, 'Virtual', 'Prueba historial', 'Completada', clock_timestamp()
    );

    INSERT INTO public."CALIFICACIONES" (
        "id_calificacion", "id_reserva", "id_evaluador", "id_evaluado", "puntuacion", "comentario"
    ) VALUES (
        gen_random_uuid(), v_reserva_historial, v_solicitante, v_tutor, 5, 'Excelente clase de prueba'
    );

    -- A las 19:00 aplican escasez + demanda + alto impacto:
    -- 10 + 15 + 13 + 12 = 50 unidades internas = 5.0 creditos visibles.
    v_inicio_alta_demanda := ((CURRENT_DATE + 10) + TIME '19:00') AT TIME ZONE 'America/La_Paz';
    v_costo := public.fn_sugerir_precio_clase(v_habilidad, v_tutor, v_inicio_alta_demanda);
    IF v_costo IS DISTINCT FROM 50 THEN
        RAISE EXCEPTION 'FALLO suma de bonificaciones: se esperaba 50 (5.0 creditos) y se obtuvo %.', v_costo;
    END IF;
    INSERT INTO resultados_prueba (prueba, resultado, detalle)
    VALUES ('Suma de los componentes del precio sugerido', 'OK',
            '10 + 15 + 13 + 12 = 50 unidades internas; la app muestra 50 / 10 = 5.0 creditos.');

    -- Disponibilidad y solicitud para probar match y Knowledge Gap.
    v_inicio_match := clock_timestamp() + interval '2 hours';
    v_fin_match := v_inicio_match + interval '1 hour';
    INSERT INTO public."DISPONIBILIDADES" (
        "id_disponibilidad", "id_usuario", "fecha_inicio", "fecha_fin", "estado"
    ) VALUES (
        gen_random_uuid(), v_tutor, v_inicio_match - interval '1 hour',
        v_fin_match + interval '1 hour', 'disponible'
    );

    INSERT INTO public."SOLICITUDES_INTERCAMBIO" (
        "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio_propuesta", "fecha_fin_propuesta", "creditos_requeridos", "estado"
    ) VALUES (
        gen_random_uuid(), v_solicitante, v_tutor, v_habilidad,
        v_inicio_match, v_fin_match, 10, 'Solicitada'
    );

    SELECT COUNT(*) INTO v_count
    FROM public.fn_obtener_top_tutores(v_habilidad, v_inicio_match, v_fin_match, 'Virtual') t
    WHERE t.id_tutor = v_tutor;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'FALLO match: el tutor disponible no aparecio en el top.';
    END IF;
    INSERT INTO resultados_prueba (prueba, resultado, detalle)
    VALUES ('Match por habilidad, horario e impacto', 'OK', 'El tutor disponible aparece en el top 3.');

    SELECT COUNT(*) INTO v_count
    FROM public.v_knowledge_gap_index g
    WHERE g.id_habilidad = v_habilidad
      AND g.demanda = 1
      AND g.oferta_tutores = 1;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'FALLO Knowledge Gap: no se reflejo la demanda/oferta de prueba.';
    END IF;
    INSERT INTO resultados_prueba (prueba, resultado, detalle)
    VALUES ('Knowledge Gap Index', 'OK', 'Una solicitud y un tutor activo se reflejan en la brecha.');

    SELECT COUNT(*) INTO v_count
    FROM public.v_knowledge_score k
    WHERE k.id_usuario = v_tutor
      AND k.clases_completadas = 1
      AND k.promedio_estrellas = 5;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'FALLO Knowledge Score: no se calcularon clases y reputacion esperadas.';
    END IF;
    INSERT INTO resultados_prueba (prueba, resultado, detalle)
    VALUES ('Knowledge Score', 'OK', 'El tutor refleja una clase completada y promedio 5.0.');

    -- Penalizacion: <5h, importe de 0.5 creditos = 5 unidades internas.
    INSERT INTO public."RESERVAS" (
        "id_reserva", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio", "fecha_fin", "creditos", "modalidad", "lugar", "estado"
    ) VALUES (
        v_reserva_corta, v_solicitante, v_tutor, v_habilidad,
        clock_timestamp() + interval '4 hours',
        clock_timestamp() + interval '5 hours',
        10, 'Virtual', 'Prueba automatizada', 'Confirmada'
    );

    UPDATE public."RESERVAS"
    SET "estado" = 'Cancelada',
        "cancelado_por" = v_tutor,
        "motivo_cancelacion" = 'Prueba: cancelacion tardia'
    WHERE "id_reserva" = v_reserva_corta;

    SELECT u."saldo" INTO v_saldo
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_tutor;
    SELECT r."horas_anticipacion_cancelacion" INTO v_horas
    FROM public."RESERVAS" r WHERE r."id_reserva" = v_reserva_corta;
    SELECT m."tipo", m."cantidad" INTO v_tipo_credito, v_cantidad
    FROM public."MOVIMIENTOS_CREDITO" m
    WHERE m."id_reserva" = v_reserva_corta
    AND m."tipo" IN ('penalizacion', 'penalizacion_sin_saldo')
    ORDER BY m."created_at" DESC LIMIT 1;

    IF v_saldo IS DISTINCT FROM 45 OR v_horas IS NULL OR v_horas >= 5
       OR v_tipo_credito IS DISTINCT FROM 'penalizacion' OR v_cantidad IS DISTINCT FROM -5 THEN
        RAISE EXCEPTION 'FALLO penalizacion: saldo %, horas %, movimiento %, cantidad %.',
            v_saldo, v_horas, v_tipo_credito, v_cantidad;
    END IF;
    INSERT INTO resultados_prueba (prueba, resultado, detalle)
    VALUES ('Penalizacion menor a 5 horas', 'OK',
            'Saldo 50 -> 45 unidades; movimiento -5. La app muestra una baja de 0.5 creditos.');

    SELECT v.saldo_creditos INTO v_saldo_visible
    FROM public.v_cuentas_credito_app v
    WHERE v.id_usuario = v_tutor;
    SELECT v.cantidad_creditos INTO v_movimiento_visible
    FROM public.v_movimientos_credito_app v
    WHERE v.id_reserva = v_reserva_corta AND v.tipo = 'penalizacion';
    IF v_saldo_visible IS DISTINCT FROM 4.5::numeric
       OR v_movimiento_visible IS DISTINCT FROM (-0.5)::numeric THEN
        RAISE EXCEPTION 'FALLO conversion de vistas: saldo visible %, movimiento visible %.',
            v_saldo_visible, v_movimiento_visible;
    END IF;
    INSERT INTO resultados_prueba (prueba, resultado, detalle)
    VALUES ('Vistas para mostrar creditos en la app', 'OK',
            '45 unidades se muestran como 4.5 y -5 unidades como -0.5.');

    -- Repetir la actualizacion no debe cobrar la penalizacion por segunda vez.
    UPDATE public."RESERVAS"
    SET "estado" = 'Cancelada', "motivo_cancelacion" = 'Actualizacion de motivo'
    WHERE "id_reserva" = v_reserva_corta;
    SELECT u."saldo" INTO v_saldo
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_tutor;
    IF v_saldo IS DISTINCT FROM 45 THEN
        RAISE EXCEPTION 'FALLO idempotencia: la penalizacion se cobro mas de una vez.';
    END IF;
    INSERT INTO resultados_prueba (prueba, resultado, detalle)
    VALUES ('No se cobra dos veces', 'OK', 'Una actualizacion posterior no repite el descuento.');

    -- Cancelar con 6 horas de anticipacion no debe penalizar.
    INSERT INTO public."RESERVAS" (
        "id_reserva", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio", "fecha_fin", "creditos", "modalidad", "lugar", "estado"
    ) VALUES (
        v_reserva_larga, v_solicitante, v_tutor, v_habilidad,
        clock_timestamp() + interval '6 hours',
        clock_timestamp() + interval '7 hours',
        10, 'Virtual', 'Prueba automatizada', 'Confirmada'
    );

    UPDATE public."RESERVAS"
    SET "estado" = 'Cancelada',
        "cancelado_por" = v_tutor,
        "motivo_cancelacion" = 'Prueba: cancelacion anticipada'
    WHERE "id_reserva" = v_reserva_larga;

    SELECT u."saldo" INTO v_saldo
    FROM public."USUARIOS" u WHERE u."id_usuario" = v_tutor;
    SELECT COUNT(*) INTO v_count
    FROM public."MOVIMIENTOS_CREDITO" m
    WHERE m."id_reserva" = v_reserva_larga AND m."tipo" IN ('penalizacion', 'penalizacion_sin_saldo');
    IF v_saldo IS DISTINCT FROM 45 OR v_count <> 0 THEN
        RAISE EXCEPTION 'FALLO umbral 5 horas: saldo %, movimientos %.', v_saldo, v_count;
    END IF;
    INSERT INTO resultados_prueba (prueba, resultado, detalle)
    VALUES ('Sin penalizacion con 5 horas o mas', 'OK', 'La cancelacion con 6 horas no genero descuento.');

    -- Los importes configurados reflejan exactamente la escala x10.
    SELECT COUNT(*) INTO v_count
    FROM public.config_economia c
    WHERE (c.clave, c.valor) IN (
        ('costo_base', 10), ('mult_escasez', 15),
        ('mult_demanda', 13), ('mult_impacto', 12),
        ('penalizacion_creditos', 5)
    );
    IF v_count <> 5 THEN
        RAISE EXCEPTION 'FALLO escala de config_economia: faltan valores en decimas.';
    END IF;
    INSERT INTO resultados_prueba (prueba, resultado, detalle)
    VALUES ('Reglas configuradas en decimas', 'OK', '1.0=10; 1.5=15; 1.3=13; 1.2=12; 0.5=5.');

    -- Verifica que los siete campos crediticios prioritarios siguen siendo INTEGER.
    SELECT COUNT(*) INTO v_count
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND (c.table_name, c.column_name) IN (
          ('USUARIOS','saldo'), ('USUARIOS','creditos_retenidos'),
          ('SOLICITUDES_INTERCAMBIO','creditos_requeridos'),
          ('RESERVAS','creditos'), ('MOVIMIENTOS_CREDITO','cantidad'),
          ('MOVIMIENTOS_CREDITO','saldo_anterior'), ('MOVIMIENTOS_CREDITO','saldo_posterior')
      )
      AND c.data_type = 'integer';
    IF v_count <> 7 THEN
        RAISE EXCEPTION 'FALLO tipos de credito: se encontraron % columnas INTEGER de 7.', v_count;
    END IF;
    INSERT INTO resultados_prueba (prueba, resultado, detalle)
    VALUES ('Compatibilidad INTEGER y escala x10', 'OK',
            'Los siete campos son INTEGER y almacenan decimas; la app divide entre 10.');
END;
$$;

SELECT numero, prueba, resultado, detalle
FROM resultados_prueba
ORDER BY numero;

ROLLBACK;
