-- ============================================================================
-- SKILLSWAP V4 | HARDENING CONTRA SQL INJECTION Y ESCALADA DE PRIVILEGIOS
-- Versión objetivo: skillswap-docker-v4-roles-equipos-pendiente.zip
-- Directorio interno: skillswap-docker-v4-penalizaciones/skillswap-docker-corregido
-- PostgreSQL: 16
-- Fecha: 2026-11-22
-- ============================================================================
-- ALCANCE DE ESTA MIGRACION (FASE 1, COMPATIBLE):
--   1. Evitar CREATE de objetos en public por cuentas de aplicación.
--   2. Retirar EXECUTE de PUBLIC en las funciones ya instaladas.
--   3. Corregir los PRIVILEGIOS PREDETERMINADOS GLOBALES de funciones.
--   4. Asegurar search_path de TODAS las funciones SECURITY DEFINER en public.
--   5. Restringir llamadas directas a helpers de claves y a ETL privilegiado.
--   6. Añadir un ejemplo REAL de búsqueda estática y parametrizada.
--   7. Verificar los controles sin tocar datos ni saldos.
--
-- IMPORTANTE:
--   * Esta migración NO arregla consultas concatenadas en el backend. Usar SIEMPRE
--     parámetros del driver ($1, $2, etc.) para entradas de usuarios.
--   * No cambia el esquema de las tablas ni los algoritmos de penalizaciones.
--   * NO retira todavía el amplio DML de rol_app ni sus vistas descifradas;
--     es una SEGUNDA FASE que requiere adaptar y probar el backend (ver final).
--   * Las claves app.encryption_key / app.hash_pepper via current_setting()
--     siguen siendo visibles para cualquier SQL arbitrario ejecutado EN UNA
--     SESION que las tenga configuradas. Eso exige rediseño fuera de este SQL.
--   * Ejecutar con un ADMINISTRADOR SUPERUSUARIO, tras copia y en staging primero.
--   * Script idempotente: se puede reejecutar.
--
-- (Version para initdb: sin BEGIN/COMMIT porque 00_init.sh usa --single-transaction.)
-- Ejemplo de ejecución desde el host que dispone de Docker:
--   docker exec -i skillswap-db psql -X -v ON_ERROR_STOP=1 \
--      -U skillswap_admin -d skillswap \
--      < skillswap_v4_hardening_sql_injection.sql
--   Ajustar usuario y base a los valores de POSTGRES_USER y POSTGRES_DB.
-- ============================================================================

SET LOCAL search_path = pg_catalog, public, pg_temp;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- 0. Abortamos en otra versión/instalación y si no hay permisos suficientes.
DO $precheck$
BEGIN
    IF current_setting('server_version_num')::integer < 160000
       OR current_setting('server_version_num')::integer >= 170000 THEN
        RAISE EXCEPTION 'Esta migración está dirigida a PostgreSQL 16.';
    END IF;

    IF NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user) THEN
        RAISE EXCEPTION 'Ejecutar como superusuario administrador de SkillSwap.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'rol_app')
       OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'rol_lectura')
       OR pg_catalog.to_regclass('public."USUARIOS"') IS NULL
       OR pg_catalog.to_regclass('public."MOVIMIENTOS_CREDITO"') IS NULL
       OR pg_catalog.to_regclass('public."PENALIZACIONES_PENDIENTES"') IS NULL
       OR pg_catalog.to_regprocedure('public.fn_cobrar_penalizaciones_pendientes(uuid)') IS NULL
       OR pg_catalog.to_regprocedure('public.fn_etl_penalizaciones_pendientes()') IS NULL THEN
        RAISE EXCEPTION 'No se detectó la instalación completa de SkillSwap v4 penalizaciones.';
    END IF;
END
$precheck$;

-- 1. Impedir que una inyección, ejecutada con roles ordinarios,
--    cree funciones o tablas falsas en un esquema confiable.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
DO $schema_privs$
DECLARE
    r record;
BEGIN
    EXECUTE format('REVOKE CREATE ON DATABASE %I FROM PUBLIC', current_database());

    FOR r IN
        SELECT rolname
        FROM pg_catalog.pg_roles
        WHERE rolname IN (
            'rol_app', 'rol_lectura',
            'perm_backend', 'perm_api', 'perm_bi', 'perm_frontend',
            'usr_backend', 'usr_api', 'usr_bi', 'usr_frontend'
        )
    LOOP
        EXECUTE format('REVOKE CREATE ON SCHEMA public FROM %I', r.rolname);
        EXECUTE format('REVOKE CREATE ON DATABASE %I FROM %I',
                       current_database(), r.rolname);
    END LOOP;
END
$schema_privs$;

-- 2. Retirar EXECUTE público sobre funciones existentes en public.
--    Los GRANT particulares a rol_app/rol_lectura se conservan.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- 3. Reparar permiso por defecto: el REVOKE ... IN SCHEMA public del ZIP
--    no elimina el EXECUTE que PostgreSQL concede globalmente a PUBLIC.
--    Aplicar a propietarios reales de funciones + cuentas que podrían crear
--    funciones en futuras migraciones. No afecta funciones ya existentes.
DO $default_privs$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT DISTINCT role_name
        FROM (
            SELECT pg_catalog.pg_get_userbyid(p.proowner) AS role_name
            FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
            UNION
            SELECT rolname AS role_name
            FROM pg_catalog.pg_roles
            WHERE rolname IN (
                'rol_app', 'rol_lectura',
                'perm_backend', 'perm_api', 'perm_bi', 'perm_frontend',
                'usr_backend', 'usr_api', 'usr_bi', 'usr_frontend'
            )
        ) AS owners
    LOOP
        EXECUTE format(
            'ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
            r.role_name
        );
        -- Eliminar también cualquier concesión previa específica de public.
        EXECUTE format(
            'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
            r.role_name
        );
    END LOOP;
END
$default_privs$;

-- 4. Proteger TODAS las funciones con SECURITY DEFINER del esquema public.
--    pg_temp queda al final para evitar el enmascaramiento de objetos.
--    public debe permanecer sin CREATE para los roles no confiables.
DO $definer_path$
DECLARE
    f record;
BEGIN
    FOR f IN
        SELECT n.nspname, p.proname,
               pg_catalog.pg_get_function_identity_arguments(p.oid) AS argumentos
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef
          AND p.prokind = 'f'
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public, pg_temp',
            f.nspname, f.proname, f.argumentos
        );
    END LOOP;
END
$definer_path$;

-- 5. Evitar invocación directa de helpers de secretos y de operaciones
--    internas (ETL y triggers) desde los roles de aplicación/equipo.
--    Las funciones SECURITY DEFINER siguen pudiendo llamar a sus helpers
--    como propietario; los triggers existentes continúan funcionando.
DO $sensitive_functions$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT rolname
        FROM pg_catalog.pg_roles
        WHERE rolname IN (
            'rol_app', 'rol_lectura',
            'perm_backend', 'perm_api', 'perm_bi', 'perm_frontend',
            'usr_backend', 'usr_api', 'usr_bi', 'usr_frontend'
        )
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION '
            || 'public.get_app_key(), '
            || 'public.get_hash_pepper(), '
            || 'public.fn_etl_penalizaciones_pendientes(), '
            || 'public.fn_auditar(), '
            || 'public.fn_encrypt_sensitive(), '
            || 'public.fn_trg_cobrar_pendientes(), '
            || 'public.fn_aplicar_penalizacion_cancelacion() '
            || 'FROM %I',
            r.rolname
        );
    END LOOP;
END
$sensitive_functions$;

-- 6. Ejemplo de entrada segura: SIN concatenación de texto para formar SQL.
--    El valor del usuario es un dato, no una parte del comando SQL.
--    El backend puede adoptar esta función en sus búsquedas de habilidades.
CREATE OR REPLACE FUNCTION public.fn_buscar_habilidades_seguro(
    p_busqueda text DEFAULT NULL,
    p_limite integer DEFAULT 20
)
RETURNS TABLE (
    id_habilidad uuid,
    nombre varchar,
    id_categoria uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
    SELECT h."id_habilidad", h."nombre", h."id_categoria"
    FROM public."HABILIDADES" AS h
    WHERE h."estado" = 'activo'
      AND (
           nullif(pg_catalog.btrim(p_busqueda), '') IS NULL
           OR h."nombre" ILIKE
              ('%' ||
                 replace(
                   replace(
                     replace(pg_catalog.left(pg_catalog.btrim(p_busqueda), 80),
                             E'\\', E'\\\\'),
                     '%', E'\\%'),
                   '_', E'\\_')
               || '%') ESCAPE E'\\'
      )
    ORDER BY h."nombre" ASC, h."id_habilidad" ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limite, 20), 1), 100)
$function$;

REVOKE ALL ON FUNCTION public.fn_buscar_habilidades_seguro(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_buscar_habilidades_seguro(text, integer) TO rol_app;
GRANT EXECUTE ON FUNCTION public.fn_buscar_habilidades_seguro(text, integer) TO rol_lectura;
COMMENT ON FUNCTION public.fn_buscar_habilidades_seguro(text, integer) IS
  'Búsqueda parametrizada de habilidades (entrada tratada como dato, límites de longitud y filas).';

-- 7. Pruebas de control que abortan (ROLLBACK) si falla algún requisito.
DO $asserts$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT rolname
        FROM pg_catalog.pg_roles
        WHERE rolname IN (
            'rol_app', 'rol_lectura',
            'usr_backend', 'usr_api', 'usr_bi', 'usr_frontend'
        )
    LOOP
        IF pg_catalog.has_schema_privilege(r.rolname, 'public', 'CREATE') THEN
            RAISE EXCEPTION 'Peligro: % todavía puede CREATE en public', r.rolname;
        END IF;
        IF pg_catalog.has_function_privilege(
               r.rolname, 'public.get_app_key()', 'EXECUTE') THEN
            RAISE EXCEPTION 'Peligro: % puede invocar get_app_key()', r.rolname;
        END IF;
        IF pg_catalog.has_function_privilege(
               r.rolname, 'public.get_hash_pepper()', 'EXECUTE') THEN
            RAISE EXCEPTION 'Peligro: % puede invocar get_hash_pepper()', r.rolname;
        END IF;
        IF pg_catalog.has_function_privilege(
               r.rolname, 'public.fn_etl_penalizaciones_pendientes()', 'EXECUTE') THEN
            RAISE EXCEPTION 'Peligro: % puede ejecutar el ETL de penalizaciones', r.rolname;
        END IF;
    END LOOP;
END
$asserts$;


-- ============================================================================
-- FASE 2 - REQUIERE ADAPTAR EL BACKEND Y VERIFICAR EN STAGING (NO SE EJECUTA)
-- ============================================================================
-- A) Cerrar modificaciones arbitrarias de saldos y libro mayor:
--      REVOKE INSERT ON public."MOVIMIENTOS_CREDITO" FROM rol_app;
--      REVOKE UPDATE ON public."USUARIOS" FROM rol_app;
--      -- Posteriormente GRANT UPDATE (columnas no económicas) de forma
--      -- explícita; verificar también INSERT y privilegios heredados.
-- B) Eliminar lectura general de password_hash, PII y auditoría descifrada:
--      REVOKE SELECT ON public.v_usuarios_desencriptados FROM rol_app;
--      REVOKE SELECT ON public.v_auditoria_desencriptada FROM rol_app;
--      REVOKE EXECUTE ON FUNCTION public.decrypt_text(bytea) FROM rol_app;
--      -- Sustituir por contratos de autenticación y lectura acotados.
-- C) En 05_seguridad_roles.sql.tpl, reemplazar el bucle que concede TODAS
--    las vistas a rol_app por una LISTA BLANCA de vistas aprobadas.
-- D) En 11_roles_equipos_final.sql.tpl, separar permisos reales de API y
--    Backend: ahora ambos heredan el MISMO rol_app.
-- E) Rediseñar app.encryption_key/app.hash_pepper para que una consulta SQL
--    inyectada no pueda leer secretos de la sesión vía current_setting().
-- F) En 00_init.sh/00_bootstrap.sql, dejar de pasar/imprimir secretos en
--    argumentos de procesos y resultados del bootstrap.
-- G) Revisar red/TLS/pg_hba.conf y limitar publicación del puerto 5432.
-- H) Obligatorio en backend: parámetros del driver; listas blancas para
--    nombres de columnas/ORDER BY y pruebas de entradas hostiles.
--
-- La función de búsqueda segura NO sustituye el endurecimiento del backend.
-- ============================================================================
