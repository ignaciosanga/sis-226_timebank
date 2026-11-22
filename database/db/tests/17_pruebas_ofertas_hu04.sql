\set ON_ERROR_STOP on
SET client_min_messages = warning;

-- HU-04: prueba de ofertas de tutoria y precio elegido por el tutor.
-- Ejecutar como administrador en la base V4 inicializada.
-- Las filas de prueba, incluidos sus eventos de auditoria, se revierten.
BEGIN;
SET LOCAL TIME ZONE 'America/La_Paz';
SELECT set_config('app.encryption_key',
    'test-encryption-key-only-for-transaction-32-characters', true);
SELECT set_config('app.hash_pepper',
    'test-hash-pepper-only-for-transaction-32-characters', true);
SELECT set_config('app.usuario_actual', '', true);

DO $hu04$
DECLARE
    v_carrera uuid;
    v_categoria uuid := gen_random_uuid();
    v_habilidad uuid := gen_random_uuid();
    v_tutor uuid := gen_random_uuid();
    v_estudiante uuid := gen_random_uuid();
    v_oferta uuid := gen_random_uuid();
    v_solicitud uuid := gen_random_uuid();
    v_fecha_inicio timestamptz := ((CURRENT_DATE + 2) + TIME '10:00') AT TIME ZONE 'America/La_Paz';
    v_fecha_fin timestamptz := (((CURRENT_DATE + 2) + TIME '10:00') AT TIME ZONE 'America/La_Paz') + interval '1 hour';
    v_precio integer;
    v_precio_sugerido integer;
    v_vista_precio numeric;
    v_snapshot integer;
    v_count integer;
    v_rechazado boolean := false;
BEGIN
    SELECT c."id_carrera" INTO v_carrera
    FROM public."CARRERAS" c
    ORDER BY c."nombre"
    LIMIT 1;

    IF v_carrera IS NULL THEN
        RAISE EXCEPTION 'HU04: no existe una carrera para crear usuarios de prueba.';
    END IF;

    IF to_regclass('public."OFERTAS_TUTORIA"') IS NULL
       OR to_regclass('public.v_ofertas_tutoria_app') IS NULL THEN
        RAISE EXCEPTION 'HU04 pendiente: falta instalar OFERTAS_TUTORIA y v_ofertas_tutoria_app.';
    END IF;

    INSERT INTO public."CATEGORIAS" ("id_categoria", "nombre", "estado")
    VALUES (v_categoria, 'ZZ_HU04_CAT_' || left(v_categoria::text, 8), 'activo');

    INSERT INTO public."HABILIDADES" ("id_habilidad", "nombre", "id_categoria", "estado")
    VALUES (v_habilidad, 'ZZ_HU04_HAB_' || left(v_habilidad::text, 8), v_categoria, 'activo');

    INSERT INTO public."USUARIOS" (
        "id_usuario", "nombre", "apellido", "correo", "password_hash", "rol",
        "id_carrera", "semestre", "saldo", "creditos_retenidos", "estado"
    ) VALUES
      (v_tutor, 'Tutor HU04', 'Prueba', 'hu04-tutor-' || v_tutor::text || '@test.invalid',
       'hash-no-login', 'Estudiante', v_carrera, 4, 0, 0, 'Activo'),
      (v_estudiante, 'Estudiante HU04', 'Prueba',
       'hu04-estudiante-' || v_estudiante::text || '@test.invalid',
       'hash-no-login', 'Estudiante', v_carrera, 4, 100, 0, 'Activo');

    INSERT INTO public."USUARIO_HABILIDADES" ("id_usuario", "id_habilidad", "nivel")
    VALUES (v_tutor, v_habilidad, 'avanzado');

    -- La oferta almacena su propia franja horaria.
    INSERT INTO public."DISPONIBILIDADES" (
        "id_disponibilidad", "id_usuario", "fecha_inicio", "fecha_fin", "estado"
    ) VALUES (
        gen_random_uuid(), v_tutor, v_fecha_inicio - interval '1 hour',
        v_fecha_fin + interval '1 hour', 'disponible'
    );

    -- Precios con una cifra decimal: 3.0, 3.5 y 3.7 se aceptan.
    IF public.fn_creditos_a_decimas(3.0::numeric) <> 30
       OR public.fn_creditos_a_decimas(3.5::numeric) <> 35
       OR public.fn_creditos_a_decimas(3.7::numeric) <> 37 THEN
        RAISE EXCEPTION 'HU04: la conversion a decimas no produjo 30, 35 y 37.';
    END IF;

    -- Precio con dos decimales: 3.75 debe ser rechazado.
    BEGIN
        PERFORM public.fn_creditos_a_decimas(3.75::numeric);
        RAISE EXCEPTION 'HU04 FALLA: 3.75 fue aceptado, pero solo se admite una cifra decimal.';
    EXCEPTION
        WHEN SQLSTATE '22023' THEN
            v_rechazado := true;
    END;
    IF NOT v_rechazado THEN
        RAISE EXCEPTION 'HU04 FALLA: no se rechazo 3.75.';
    END IF;

    v_precio := public.fn_creditos_a_decimas(3.7::numeric);

    -- El motor dinamico puede sugerir otro importe (aqui 2.5 por escasez),
    -- pero no reemplaza el precio elegido por el tutor (3.7 = 37 decimas).
    v_precio_sugerido := public.fn_sugerir_precio_clase(
        v_habilidad, v_tutor, v_fecha_inicio
    );
    IF v_precio_sugerido IS NULL OR v_precio_sugerido = v_precio THEN
        RAISE EXCEPTION
          'HU04: la prueba necesita una sugerencia dinamica distinta al precio del tutor. Sugerido %, tutor %.',
          v_precio_sugerido, v_precio;
    END IF;

    -- Ideal: publicar una oferta con titulo, materia, horario y costo.
    INSERT INTO public."OFERTAS_TUTORIA" (
        "id_oferta", "id_usuario", "id_habilidad", "titulo", "descripcion",
        "fecha_inicio", "fecha_fin", "costo_decimas", "estado"
    ) VALUES (
        v_oferta, v_tutor, v_habilidad, 'Tutoria de prueba HU04',
        'Oferta creada por una prueba automatizada.',
        v_fecha_inicio, v_fecha_fin, v_precio, 'Activa'
    );

    -- Simula que Frontend vuelve a consultar despues de recargar.
    SELECT o."costo_creditos" INTO v_vista_precio
    FROM public.v_ofertas_tutoria_app o
    WHERE o."id_oferta" = v_oferta;

    IF NOT FOUND OR v_vista_precio IS DISTINCT FROM 3.7::numeric THEN
        RAISE EXCEPTION 'HU04 FALLA: la oferta no persistio o el precio visible no es 3.7 (obtenido %).',
            v_vista_precio;
    END IF;
    IF (SELECT o."costo_decimas" FROM public."OFERTAS_TUTORIA" o
        WHERE o."id_oferta" = v_oferta) <> 37 THEN
        RAISE EXCEPTION 'HU04 FALLA: la sugerencia dinamica sustituyo el precio publicado por el tutor.';
    END IF;

    -- Alternativo: guardar la cotizacion en la solicitud. Si luego cambia
    -- el precio de la oferta, la solicitud conserva la cotizacion original.
    INSERT INTO public."SOLICITUDES_INTERCAMBIO" (
        "id_solicitud", "id_solicitante", "id_ofertante", "id_habilidad",
        "fecha_inicio_propuesta", "fecha_fin_propuesta",
        "creditos_requeridos", "estado"
    ) VALUES (
        v_solicitud, v_estudiante, v_tutor, v_habilidad,
        v_fecha_inicio, v_fecha_fin, v_precio, 'Solicitada'
    );

    UPDATE public."OFERTAS_TUTORIA"
    SET "costo_decimas" = public.fn_creditos_a_decimas(4.2::numeric)
    WHERE "id_oferta" = v_oferta;

    SELECT s."creditos_requeridos" INTO v_snapshot
    FROM public."SOLICITUDES_INTERCAMBIO" s
    WHERE s."id_solicitud" = v_solicitud;

    IF v_snapshot IS DISTINCT FROM 37 THEN
        RAISE EXCEPTION 'HU04 FALLA: la solicitud no conservo la cotizacion original de 37 decimas.';
    END IF;

    -- Error: costo cero debe ser rechazado.
    v_rechazado := false;
    BEGIN
        INSERT INTO public."OFERTAS_TUTORIA" (
            "id_usuario", "id_habilidad", "titulo", "fecha_inicio",
            "fecha_fin", "costo_decimas", "estado"
        ) VALUES (
            v_tutor, v_habilidad, 'Oferta con costo cero',
            v_fecha_inicio, v_fecha_fin, 0, 'Activa'
        );
        RAISE EXCEPTION 'HU04 FALLA: se permitio una oferta con costo cero.';
    EXCEPTION
        WHEN check_violation THEN
            v_rechazado := true;
    END;
    IF NOT v_rechazado THEN
        RAISE EXCEPTION 'HU04 FALLA: no se rechazo el costo cero.';
    END IF;

    -- Error: intervalo invertido debe ser rechazado.
    v_rechazado := false;
    BEGIN
        INSERT INTO public."OFERTAS_TUTORIA" (
            "id_usuario", "id_habilidad", "titulo", "fecha_inicio",
            "fecha_fin", "costo_decimas", "estado"
        ) VALUES (
            v_tutor, v_habilidad, 'Oferta con horario invalido',
            v_fecha_fin, v_fecha_inicio, 37, 'Activa'
        );
        RAISE EXCEPTION 'HU04 FALLA: se permitio fecha_fin anterior a fecha_inicio.';
    EXCEPTION
        WHEN check_violation THEN
            v_rechazado := true;
    END;
    IF NOT v_rechazado THEN
        RAISE EXCEPTION 'HU04 FALLA: no se rechazo el intervalo invalido.';
    END IF;

    -- La oferta tambien debe quedar registrada en auditoria.
    SELECT COUNT(*) INTO v_count
    FROM public."AUDITORIA" a
    WHERE a."entidad" = 'OFERTAS_TUTORIA'
      AND a."entidad_id" = v_oferta
      AND a."accion" = 'INSERT'
      AND a."datos_nuevos_enc" IS NOT NULL
      AND a."datos_nuevos" IS NULL;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'HU04: la creacion de la oferta no genero el evento de auditoria cifrado.';
    END IF;

    RAISE NOTICE 'OK HU04-01: oferta guardada y recuperable desde v_ofertas_tutoria_app.';
    RAISE NOTICE 'OK HU04-PRECIO: la sugerencia dinamica (%) no reemplazo el precio elegido por el tutor (37 decimas).', v_precio_sugerido;
    RAISE NOTICE 'OK HU04-02: precio de 3.7 guardado como 37; la solicitud conserva la cotizacion aunque cambie la oferta.';
    RAISE NOTICE 'OK HU04-03: 3.75, costo cero e intervalo invalido fueron rechazados.';
    RAISE NOTICE 'OK HU04-AUDIT: el alta de la oferta quedo auditada y cifrada.';
END;
$hu04$;

ROLLBACK;
\echo 'HU-04: pruebas finalizadas. Todas las filas de prueba fueron revertidas.'
