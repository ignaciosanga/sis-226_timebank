\set ON_ERROR_STOP on
-- Ejecutar como administrador. Todo se revierte al final.
BEGIN;
SET LOCAL TIME ZONE 'America/La_Paz';
SELECT set_config('app.encryption_key', 'test-encryption-key-only-for-transaction-32-characters', true);
SELECT set_config('app.hash_pepper', 'test-hash-pepper-only-for-transaction-32-characters', true);

DO $$
DECLARE
    v_cat uuid := gen_random_uuid();
    v_h1  uuid := gen_random_uuid();
    v_h2  uuid := gen_random_uuid();
    v_n integer;
    v_bloqueado boolean := false;
BEGIN
    -- 1) Permisos de los roles de aplicacion
    IF has_schema_privilege('rol_app', 'public', 'CREATE') THEN
        RAISE EXCEPTION 'FALLO: rol_app puede CREATE en public.';
    END IF;
    IF has_function_privilege('rol_app', 'public.get_app_key()', 'EXECUTE')
       OR has_function_privilege('rol_lectura', 'public.get_hash_pepper()', 'EXECUTE') THEN
        RAISE EXCEPTION 'FALLO: un rol de aplicacion puede leer las claves.';
    END IF;
    IF has_function_privilege('rol_app', 'public.fn_etl_penalizaciones_pendientes()', 'EXECUTE') THEN
        RAISE EXCEPTION 'FALLO: rol_app puede ejecutar el ETL.';
    END IF;

    -- 2) Politica de precio: la app solo ve la sugerencia, no la formula legada
    IF has_function_privilege('rol_app', 'public.fn_calcular_costo_clase(uuid,uuid,timestamptz)', 'EXECUTE')
       OR NOT has_function_privilege('rol_app', 'public.fn_sugerir_precio_clase(uuid,uuid,timestamptz)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FALLO: permisos de fn_calcular_costo_clase / fn_sugerir_precio_clase.';
    END IF;

    -- 3) Busqueda segura: datos de prueba
    INSERT INTO public."CATEGORIAS" ("id_categoria","nombre","estado")
    VALUES (v_cat, 'ZZ_TEST_HARD_'||left(v_cat::text,8), 'activo');
    INSERT INTO public."HABILIDADES" ("id_habilidad","nombre","id_categoria","estado") VALUES
      (v_h1, 'ZZ_HARD_100%_'||left(v_h1::text,6), v_cat, 'activo'),
      (v_h2, 'ZZ_HARD_100x_'||left(v_h2::text,6), v_cat, 'activo');

    -- El % buscado es literal: solo coincide la que lo contiene.
    SELECT count(*) INTO v_n FROM public.fn_buscar_habilidades_seguro('100%', 50)
    WHERE nombre LIKE 'ZZ_HARD%';
    IF v_n <> 1 THEN RAISE EXCEPTION 'FALLO: el comodin %% no se trato como literal (%).', v_n; END IF;

    SELECT count(*) INTO v_n FROM public.fn_buscar_habilidades_seguro('ZZ_HARD', 50);
    IF v_n <> 2 THEN RAISE EXCEPTION 'FALLO: busqueda normal (%).', v_n; END IF;

    -- Entrada hostil: devuelve 0 filas, no ejecuta nada y la tabla sigue ahi.
    SELECT count(*) INTO v_n
    FROM public.fn_buscar_habilidades_seguro('x''; DROP TABLE "USUARIOS"; --', 50);
    IF v_n <> 0 OR to_regclass('public."USUARIOS"') IS NULL THEN
        RAISE EXCEPTION 'FALLO: entrada hostil.';
    END IF;

    -- Limite acotado: 0 se corrige a 1.
    SELECT count(*) INTO v_n FROM public.fn_buscar_habilidades_seguro('ZZ_HARD', 0);
    IF v_n <> 1 THEN RAISE EXCEPTION 'FALLO: limite minimo (%).', v_n; END IF;

    -- 4) Como rol_app: puede buscar, no puede crear objetos
    EXECUTE 'SET LOCAL ROLE rol_app';
    SELECT count(*) INTO v_n FROM public.fn_buscar_habilidades_seguro('ZZ_HARD', 50);
    IF v_n <> 2 THEN RAISE EXCEPTION 'FALLO: rol_app no puede usar la busqueda (%).', v_n; END IF;
    BEGIN
        EXECUTE 'CREATE TABLE public.zz_intento_hack (x int)';
    EXCEPTION WHEN insufficient_privilege THEN
        v_bloqueado := true;
    END;
    EXECUTE 'RESET ROLE';
    IF NOT v_bloqueado THEN RAISE EXCEPTION 'FALLO: rol_app pudo crear una tabla en public.'; END IF;

    RAISE NOTICE 'OK: hardening (permisos, politica de precio, busqueda segura, entrada hostil).';
END;
$$;

ROLLBACK;
