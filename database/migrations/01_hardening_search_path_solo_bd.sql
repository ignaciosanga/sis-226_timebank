-- ============================================================================
-- SkillSwap V6 | Hardening SOLO BD / SIN COORDINAR BACKEND  (MIGRACION MANUAL)
-- Para una base YA inicializada con V4/V6. En una base nueva ya se aplica solo
-- desde initdb/sql/13_hardening_search_path.sql: no hace falta ejecutarla.
-- PostgreSQL 16. Requiere superusuario. Idempotente. Probar primero en una COPIA.
-- Ejemplo:
--   docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U skillswap_admin \
--     -d skillswap < migrations/01_hardening_search_path_solo_bd.sql
-- ============================================================================
-- ALCANCE: igual que initdb/sql/13_hardening_search_path.sql (solo search_path;
-- no toca permisos, tablas, datos, vistas, creditos ni penalizaciones).
-- Es transaccional; ante una comprobacion fallida hace ROLLBACK.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;
SET LOCAL search_path = pg_catalog, public, pg_temp;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- 1. Comprobar compatibilidad antes de modificar nada.
DO $preflight$
DECLARE
    v_rol text;
BEGIN
    IF current_setting('server_version_num')::integer < 160000
       OR current_setting('server_version_num')::integer >= 170000 THEN
        RAISE EXCEPTION 'Script validado solo para el esquema objetivo PostgreSQL 16.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles
        WHERE rolname = current_user AND rolsuper
    ) THEN
        RAISE EXCEPTION 'Ejecutar con el superusuario de la instalacion SkillSwap.';
    END IF;

    IF pg_catalog.to_regclass('public."USUARIOS"') IS NULL
       OR pg_catalog.to_regclass('public."PENALIZACIONES_PENDIENTES"') IS NULL
       OR pg_catalog.to_regprocedure('public.fn_cobrar_penalizaciones_pendientes(uuid)') IS NULL
       OR pg_catalog.to_regprocedure('public.fn_etl_penalizaciones_pendientes()') IS NULL
       OR pg_catalog.to_regprocedure('public.fn_confirmar_reserva(uuid)') IS NULL
       OR pg_catalog.to_regprocedure('public.fn_sugerir_precio_clase(uuid,uuid,timestamptz)') IS NULL THEN
        RAISE EXCEPTION 'La base no parece tener instalada la version V6 (penalizaciones, ciclo de pago y precio sugerido).';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='rol_app')
       OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='rol_lectura') THEN
        RAISE EXCEPTION 'Faltan los roles base de SkillSwap.';
    END IF;

    -- Si en esta instalacion un equipo ya tiene capacidades inusuales,
    -- NO las revocamos: solo alertamos y cancelamos para revisar el entorno.
    FOR v_rol IN
        SELECT rolname
        FROM pg_catalog.pg_roles
        WHERE rolname IN (
            'rol_app','rol_lectura',
            'perm_backend','perm_api','perm_bi','perm_frontend',
            'usr_backend','usr_api','usr_bi','usr_frontend'
        )
    LOOP
        IF pg_catalog.has_schema_privilege(v_rol, 'public', 'CREATE') THEN
            RAISE EXCEPTION
              'El rol % puede CREATE en public; requiere revision de la instalacion antes de continuar.',
              v_rol;
        END IF;
    END LOOP;

    -- La base ya retira EXECUTE publico a los helpers de secretos y ETL.
    -- Si esto cambio en una instalacion real, NO retirar el permiso a ciegas.
    IF pg_catalog.has_function_privilege('rol_app','public.get_app_key()','EXECUTE')
       OR pg_catalog.has_function_privilege('rol_app','public.get_hash_pepper()','EXECUTE')
       OR pg_catalog.has_function_privilege('rol_app','public.fn_etl_penalizaciones_pendientes()','EXECUTE')
       OR pg_catalog.has_function_privilege('rol_lectura','public.get_app_key()','EXECUTE')
       OR pg_catalog.has_function_privilege('rol_lectura','public.get_hash_pepper()','EXECUTE') THEN
        RAISE EXCEPTION
          'Hay funciones internas accesibles a roles operativos. No se tocan sin verificar consumidores.';
    END IF;
END;
$preflight$;

-- 2. Ajustar SOLO las funciones SECURITY DEFINER conocidas del paquete.
--    Todas ya usan: SET search_path = pg_catalog, public
--    Se conserva el mismo orden y se coloca pg_temp explicitamente al final.
--    No se altera el cuerpo SQL ni se cambia a SECURITY INVOKER.
DO $secure_path$
DECLARE
    v_func record;
    v_cfg text;
    v_missing text[];
    v_allowed text[] := ARRAY[
        -- criptografia y consulta de usuarios
        'get_app_key',
        'get_hash_pepper',
        'encrypt_text',
        'decrypt_text',
        'hash_lookup',
        'fn_encrypt_sensitive',
        'buscar_usuario_por_correo',
        'fn_auditar',
        -- consultas de la aplicacion
        'fn_solicitudes_recibidas',
        'fn_solicitudes_enviadas',
        'fn_reservas_usuario',
        'fn_calificaciones_recibidas',
        'fn_obtener_top_tutores',
        -- economia y precio
        'fn_calcular_costo_clase',
        'fn_sugerir_precio_clase',
        -- penalizaciones
        'fn_cobrar_penalizaciones_pendientes',
        'fn_trg_cobrar_pendientes',
        'fn_aplicar_penalizacion_cancelacion',
        'fn_etl_penalizaciones_pendientes',
        -- ciclo de pago de reservas (HU-10)
        'fn_retener_creditos_reserva',
        'fn_transferir_creditos_reserva',
        'fn_liberar_retencion_reserva',
        'fn_confirmar_reserva'
    ];
BEGIN
    -- Comprobar TODAS las funciones esperadas antes de ejecutar cualquier ALTER.
    SELECT pg_catalog.array_agg(a.nombre ORDER BY a.nombre) INTO v_missing
    FROM pg_catalog.unnest(v_allowed) AS a(nombre)
    WHERE NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
          AND p.proname = a.nombre
    );

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION
          'Faltan funciones SECURITY DEFINER esperadas en public: %. Revisar version.',
          pg_catalog.array_to_string(v_missing, ', ');
    END IF;

    FOR v_func IN
        SELECT p.proname, p.proconfig
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef
          AND p.prokind = 'f'
          AND p.proname = ANY(v_allowed)
    LOOP
        SELECT c INTO v_cfg
        FROM pg_catalog.unnest(v_func.proconfig) AS c
        WHERE c LIKE 'search_path=%'
        LIMIT 1;

        IF v_cfg IS NULL
           OR pg_catalog.replace(v_cfg, ' ', '') NOT IN (
                'search_path=pg_catalog,public',
                'search_path=pg_catalog,public,pg_temp'
           ) THEN
            RAISE EXCEPTION
              'La funcion % tiene search_path no esperado (%). No se cambia automaticamente.',
              v_func.proname, coalesce(v_cfg,'NULL');
        END IF;
    END LOOP;

    FOR v_func IN
        SELECT n.nspname, p.proname,
               pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
               p.proconfig
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef
          AND p.prokind = 'f'
          AND p.proname = ANY(v_allowed)
    LOOP
        -- Si ya tiene el valor seguro, no se modifica.
        IF EXISTS (
            SELECT 1 FROM pg_catalog.unnest(v_func.proconfig) AS setting
            WHERE pg_catalog.replace(setting, ' ', '') =
                  'search_path=pg_catalog,public,pg_temp'
        ) THEN
            CONTINUE;
        END IF;

        EXECUTE pg_catalog.format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public, pg_temp',
            v_func.nspname, v_func.proname, v_func.args
        );
        RAISE NOTICE 'search_path actualizado: %.%(%)',
            v_func.nspname, v_func.proname, v_func.args;
    END LOOP;

    -- Verificacion final: ninguna funcion SECURITY DEFINER de public queda sin pg_temp.
    SELECT pg_catalog.array_agg(p.proname ORDER BY p.proname) INTO v_missing
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
      AND NOT EXISTS (
          SELECT 1 FROM pg_catalog.unnest(p.proconfig) AS s
          WHERE pg_catalog.replace(s, ' ', '') = 'search_path=pg_catalog,public,pg_temp'
      );
    IF v_missing IS NOT NULL THEN
        RAISE WARNING
          'Funciones SECURITY DEFINER nuevas fuera de la lista (revisar y agregarlas): %',
          pg_catalog.array_to_string(v_missing, ', ');
    END IF;
END;
$secure_path$;

COMMIT;

-- 3. INFORME SOLO LECTURA (NO REVOCA NI OTORGA PERMISOS).
SELECT
    'rol_app' AS rol,
    pg_catalog.has_table_privilege('rol_app', 'public."USUARIOS"', 'UPDATE') AS puede_actualizar_usuarios,
    pg_catalog.has_table_privilege('rol_app', 'public."MOVIMIENTOS_CREDITO"', 'INSERT') AS puede_insertar_movimientos,
    pg_catalog.has_table_privilege('rol_app', 'public.v_usuarios_desencriptados', 'SELECT') AS puede_leer_vista_descifrada,
    pg_catalog.has_function_privilege('rol_app', 'public.fn_cobrar_penalizaciones_pendientes(uuid)', 'EXECUTE') AS puede_cobrar_penalizaciones;

SELECT
    p.proname AS funcion_privilegiada,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS argumentos,
    (SELECT c FROM pg_catalog.unnest(p.proconfig) AS c
     WHERE c LIKE 'search_path=%' LIMIT 1) AS search_path
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
ORDER BY p.proname, argumentos;
