\set ON_ERROR_STOP on
-- Ejecutar como administrador. Solo lectura + una prueba de rol: todo termina con ROLLBACK.
-- Verifica el hardening de initdb/sql/13_hardening_search_path.sql y que NO se
-- haya quitado ningun permiso funcional que otros equipos necesitan.
BEGIN;

DO $$
DECLARE
    v_mal text[];
    v_bloqueado boolean := false;
BEGIN
    -- 1) Ninguna funcion SECURITY DEFINER de public queda sin pg_temp al final del search_path.
    SELECT array_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' ORDER BY p.proname)
      INTO v_mal
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
      AND NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) s
          WHERE replace(s, ' ', '') = 'search_path=pg_catalog,public,pg_temp'
      );
    IF v_mal IS NOT NULL THEN
        RAISE EXCEPTION 'FALLO: SECURITY DEFINER sin search_path seguro: %', v_mal;
    END IF;

    -- 2) Roles de aplicacion: sin CREATE en public ni acceso a claves / ETL.
    IF has_schema_privilege('rol_app', 'public', 'CREATE')
       OR has_schema_privilege('rol_lectura', 'public', 'CREATE') THEN
        RAISE EXCEPTION 'FALLO: un rol de aplicacion puede CREATE en public.';
    END IF;
    IF has_function_privilege('rol_app', 'public.get_app_key()', 'EXECUTE')
       OR has_function_privilege('rol_app', 'public.get_hash_pepper()', 'EXECUTE')
       OR has_function_privilege('rol_lectura', 'public.get_app_key()', 'EXECUTE')
       OR has_function_privilege('rol_lectura', 'public.get_hash_pepper()', 'EXECUTE') THEN
        RAISE EXCEPTION 'FALLO: un rol de aplicacion puede leer las claves.';
    END IF;
    IF has_function_privilege('rol_app', 'public.fn_etl_penalizaciones_pendientes()', 'EXECUTE') THEN
        RAISE EXCEPTION 'FALLO: rol_app puede ejecutar el ETL.';
    END IF;

    -- 3) Politica de precio: la app solo ve la sugerencia, no la formula interna.
    IF has_function_privilege('rol_app', 'public.fn_calcular_costo_clase(uuid,uuid,timestamptz)', 'EXECUTE')
       OR NOT has_function_privilege('rol_app', 'public.fn_sugerir_precio_clase(uuid,uuid,timestamptz)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FALLO: permisos de fn_calcular_costo_clase / fn_sugerir_precio_clase.';
    END IF;

    -- 4) Permisos funcionales que NO deben haberse tocado.
    IF NOT has_function_privilege('rol_app', 'public.fn_confirmar_reserva(uuid)', 'EXECUTE')
       OR NOT has_function_privilege('rol_app', 'public.fn_cobrar_penalizaciones_pendientes(uuid)', 'EXECUTE')
       OR NOT has_function_privilege('rol_app', 'public.buscar_usuario_por_correo(text)', 'EXECUTE')
       OR NOT has_table_privilege('rol_app', 'public."USUARIOS"', 'UPDATE')
       OR NOT has_table_privilege('rol_app', 'public."MOVIMIENTOS_CREDITO"', 'INSERT')
       OR NOT has_table_privilege('rol_lectura', 'public.v_bi_knowledge_score', 'SELECT') THEN
        RAISE EXCEPTION 'FALLO: se perdio un permiso funcional existente.';
    END IF;

    -- 5) Como rol_app: no puede crear objetos en public.
    EXECUTE 'SET LOCAL ROLE rol_app';
    BEGIN
        EXECUTE 'CREATE TABLE public.zz_intento_hack (x int)';
    EXCEPTION WHEN insufficient_privilege THEN
        v_bloqueado := true;
    END;
    EXECUTE 'RESET ROLE';
    IF NOT v_bloqueado THEN
        RAISE EXCEPTION 'FALLO: rol_app pudo crear una tabla en public.';
    END IF;

    RAISE NOTICE 'OK: hardening (search_path, CREATE, claves/ETL, politica de precio, permisos conservados).';
END;
$$;

ROLLBACK;
