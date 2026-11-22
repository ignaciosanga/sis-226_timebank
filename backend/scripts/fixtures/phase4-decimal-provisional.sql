-- ENSAYO DE FASE 4, NO ES UNA MIGRACION ACORDADA CON BD.
-- Aplicar solo a timebank_test_<16 hex> o a la copia nexo_u_phase4_ensayo.
-- No incorporar a prisma/migrations ni aplicar a la base habitual de demostracion.
-- Dependencia revisada: equipo/BD 6216e8bc y equipo/base-de-datos 5b7e0f62
-- conservan creditos INT; esta prueba no sustituye su entrega decimal oficial.
-- Debe ejecutarse como propietario de los objetos (o administrador) en una sola conexion.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = pg_catalog, public;
SELECT pg_advisory_xact_lock(22603112);

DO $guard$
BEGIN
  IF current_database() !~ '^timebank_test_[a-f0-9]{16}$'
     AND current_database() <> 'nexo_u_phase4_ensayo' THEN
    RAISE EXCEPTION 'El ensayo decimal solo admite timebank_test_<16 hex> o nexo_u_phase4_ensayo';
  END IF;
  IF to_regclass('public."OFERTAS"') IS NULL
     OR to_regclass('public."VERIFICACIONES_CORREO"') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'USUARIOS'
                      AND column_name = 'cuenta_previa') THEN
    RAISE EXCEPTION 'Faltan las migraciones locales de fases 2 y 3';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns c
      JOIN (VALUES ('USUARIOS','saldo'), ('USUARIOS','creditos_retenidos'),
          ('SOLICITUDES_INTERCAMBIO','creditos_requeridos'), ('RESERVAS','creditos'),
          ('MOVIMIENTOS_CREDITO','cantidad'), ('MOVIMIENTOS_CREDITO','saldo_anterior'),
          ('MOVIMIENTOS_CREDITO','saldo_posterior'), ('MOVIMIENTOS_CREDITO','retenidos_anterior'),
          ('MOVIMIENTOS_CREDITO','retenidos_posterior')) wanted(tab, col)
        ON c.table_name = wanted.tab AND c.column_name = wanted.col
      WHERE c.table_schema = 'public' AND c.data_type = 'integer') <> 9 THEN
    RAISE EXCEPTION 'Se esperan exactamente los nueve creditos INTEGER originales; no repetir sobre un ensayo convertido';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'SOLICITUDES_INTERCAMBIO' AND column_name = 'id_oferta') THEN
    RAISE EXCEPTION 'La referencia a oferta ya existe; revisar el esquema antes del ensayo';
  END IF;
END;
$guard$;

-- Comparacion exacta de todas las columnas/filas historicas, incluidos sus UUID.
CREATE TEMP TABLE p4_history ON COMMIT DROP AS
SELECT 'USUARIOS'::text AS relation_name, to_jsonb(t) AS row_data FROM public."USUARIOS" t
UNION ALL SELECT 'SOLICITUDES_INTERCAMBIO', to_jsonb(t) FROM public."SOLICITUDES_INTERCAMBIO" t
UNION ALL SELECT 'RESERVAS', to_jsonb(t) FROM public."RESERVAS" t
UNION ALL SELECT 'MOVIMIENTOS_CREDITO', to_jsonb(t) FROM public."MOVIMIENTOS_CREDITO" t;

-- Guardar definiciones, propietarios, opciones, comentarios y permisos efectivos.
-- DROP sin CASCADE: una dependencia adicional desconocida aborta todo el ensayo.
CREATE TEMP TABLE p4_views ON COMMIT DROP AS
SELECT c.oid, c.relname, pg_get_viewdef(c.oid, true) AS definition,
       pg_get_userbyid(c.relowner) AS owner_name,
       coalesce(c.relacl, acldefault('r', c.relowner)) AS acl,
       c.reloptions, obj_description(c.oid, 'pg_class') AS object_comment
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v' AND c.relname IN (
  'v_solicitudes_detalle', 'v_solicitudes_pendientes', 'v_reservas_detalle',
  'v_reservas_completadas', 'v_cuentas_credito_usuario', 'v_movimientos_credito_detalle',
  'v_transferencias_detalle', 'v_ranking_creditos', 'v_estadisticas_generales'
);
CREATE TEMP TABLE p4_view_columns ON COMMIT DROP AS
SELECT v.relname, a.attname, a.attacl,
       col_description(a.attrelid, a.attnum) AS object_comment
FROM p4_views v JOIN pg_attribute a ON a.attrelid = v.oid
WHERE a.attnum > 0 AND NOT a.attisdropped;
CREATE TEMP TABLE p4_functions ON COMMIT DROP AS
SELECT p.proname, pg_get_functiondef(p.oid) AS definition,
       pg_get_userbyid(p.proowner) AS owner_name,
       coalesce(p.proacl, acldefault('f', p.proowner)) AS acl,
       obj_description(p.oid, 'pg_proc') AS object_comment
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('fn_solicitudes_recibidas', 'fn_solicitudes_enviadas', 'fn_reservas_usuario')
  AND p.proargtypes = '2950'::oidvector;

DO $drop_dependencies$
DECLARE item record;
BEGIN
  IF (SELECT count(*) FROM p4_views) <> 9 OR (SELECT count(*) FROM p4_functions) <> 3 THEN
    RAISE EXCEPTION 'No coincide el contrato esperado de nueve vistas y tres funciones de credito';
  END IF;
  FOR item IN SELECT * FROM p4_views ORDER BY relname LOOP
    EXECUTE format('DROP VIEW public.%I RESTRICT', item.relname);
  END LOOP;
  FOR item IN SELECT * FROM p4_functions ORDER BY proname LOOP
    EXECUTE format('DROP FUNCTION public.%I(uuid) RESTRICT', item.proname);
  END LOOP;
END;
$drop_dependencies$;

-- Conversion por valor, sin multiplicar: los 10 creditos existentes siguen siendo 10.
-- NUMERIC sin typmod evita redondeo silencioso antes del CHECK de escala.
ALTER TABLE public."USUARIOS"
  ALTER COLUMN saldo TYPE numeric USING saldo::numeric,
  ALTER COLUMN creditos_retenidos TYPE numeric USING creditos_retenidos::numeric,
  ADD CONSTRAINT "USUARIOS_decimas_ensayo" CHECK (
    scale(saldo) <= 1 AND scale(creditos_retenidos) <= 1
    AND saldo <= 2147483647 AND creditos_retenidos <= 2147483647
  );
ALTER TABLE public."SOLICITUDES_INTERCAMBIO"
  ALTER COLUMN creditos_requeridos TYPE numeric USING creditos_requeridos::numeric,
  ADD COLUMN id_oferta uuid REFERENCES public."OFERTAS"(id_oferta) ON DELETE RESTRICT,
  ADD CONSTRAINT "SOLICITUDES_decimas_ensayo" CHECK (
    scale(creditos_requeridos) <= 1 AND creditos_requeridos <= 2147483647
  );
CREATE INDEX "SOLICITUDES_id_oferta_ensayo_idx" ON public."SOLICITUDES_INTERCAMBIO"(id_oferta);
ALTER TABLE public."RESERVAS"
  ALTER COLUMN creditos TYPE numeric USING creditos::numeric,
  ADD CONSTRAINT "RESERVAS_decimas_ensayo" CHECK (
    scale(creditos) <= 1 AND creditos <= 2147483647
  );
ALTER TABLE public."MOVIMIENTOS_CREDITO"
  ALTER COLUMN cantidad TYPE numeric USING cantidad::numeric,
  ALTER COLUMN saldo_anterior TYPE numeric USING saldo_anterior::numeric,
  ALTER COLUMN saldo_posterior TYPE numeric USING saldo_posterior::numeric,
  ALTER COLUMN retenidos_anterior TYPE numeric USING retenidos_anterior::numeric,
  ALTER COLUMN retenidos_posterior TYPE numeric USING retenidos_posterior::numeric,
  ADD CONSTRAINT "MOVIMIENTOS_decimas_ensayo" CHECK (
    scale(cantidad) <= 1 AND abs(cantidad) <= 2147483647
    AND scale(saldo_anterior) <= 1 AND saldo_anterior <= 2147483647
    AND scale(saldo_posterior) <= 1 AND saldo_posterior <= 2147483647
    AND scale(retenidos_anterior) <= 1 AND retenidos_anterior <= 2147483647
    AND scale(retenidos_posterior) <= 1 AND retenidos_posterior <= 2147483647
  );

DO $restore_dependencies$
DECLARE item record; permission record; target text; grantee_name text; rewritten text;
BEGIN
  FOR item IN SELECT * FROM p4_views ORDER BY relname LOOP
    EXECUTE format('CREATE VIEW public.%I %s AS %s', item.relname,
      CASE WHEN item.reloptions IS NULL THEN '' ELSE 'WITH (' || array_to_string(item.reloptions, ', ') || ')' END,
      item.definition);
    target := format('TABLE public.%I', item.relname);
    -- Eliminar ACL nueva (tambien ALTER DEFAULT PRIVILEGES), restaurar exactamente la anterior.
    FOR permission IN SELECT DISTINCT x.grantee FROM pg_class c
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
      WHERE c.oid = format('public.%I', item.relname)::regclass LOOP
      grantee_name := CASE WHEN permission.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(permission.grantee)) END;
      EXECUTE 'REVOKE ALL ON ' || target || ' FROM ' || grantee_name;
    END LOOP;
    FOR permission IN SELECT * FROM aclexplode(item.acl) LOOP
      grantee_name := CASE WHEN permission.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(permission.grantee)) END;
      EXECUTE 'GRANT ' || permission.privilege_type || ' ON ' || target || ' TO ' || grantee_name
        || CASE WHEN permission.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END;
    END LOOP;
    IF item.object_comment IS NOT NULL THEN
      EXECUTE format('COMMENT ON VIEW public.%I IS %L', item.relname, item.object_comment);
    END IF;
    EXECUTE format('ALTER VIEW public.%I OWNER TO %I', item.relname, item.owner_name);
  END LOOP;
  FOR item IN SELECT * FROM p4_view_columns LOOP
    FOR permission IN SELECT * FROM aclexplode(item.attacl) LOOP
      grantee_name := CASE WHEN permission.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(permission.grantee)) END;
      EXECUTE format('GRANT %s (%I) ON TABLE public.%I TO %s%s',
        permission.privilege_type, item.attname, item.relname, grantee_name,
        CASE WHEN permission.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
    END LOOP;
    IF item.object_comment IS NOT NULL THEN
      EXECUTE format('COMMENT ON COLUMN public.%I.%I IS %L', item.relname, item.attname, item.object_comment);
    END IF;
  END LOOP;
  FOR item IN SELECT * FROM p4_functions ORDER BY proname LOOP
    rewritten := replace(replace(item.definition,
      'creditos_requeridos integer', 'creditos_requeridos numeric'), 'creditos integer', 'creditos numeric');
    IF rewritten = item.definition THEN
      RAISE EXCEPTION 'No se encontro el retorno entero esperado en %', item.proname;
    END IF;
    EXECUTE rewritten;
    target := format('FUNCTION public.%I(uuid)', item.proname);
    FOR permission IN SELECT DISTINCT x.grantee FROM pg_proc p
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
      WHERE p.oid = format('public.%I(uuid)', item.proname)::regprocedure LOOP
      grantee_name := CASE WHEN permission.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(permission.grantee)) END;
      EXECUTE 'REVOKE ALL ON ' || target || ' FROM ' || grantee_name;
    END LOOP;
    FOR permission IN SELECT * FROM aclexplode(item.acl) LOOP
      grantee_name := CASE WHEN permission.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(permission.grantee)) END;
      EXECUTE 'GRANT ' || permission.privilege_type || ' ON ' || target || ' TO ' || grantee_name
        || CASE WHEN permission.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END;
    END LOOP;
    IF item.object_comment IS NOT NULL THEN
      EXECUTE format('COMMENT ON FUNCTION public.%I(uuid) IS %L', item.proname, item.object_comment);
    END IF;
    EXECUTE format('ALTER FUNCTION public.%I(uuid) OWNER TO %I', item.proname, item.owner_name);
  END LOOP;
END;
$restore_dependencies$;

DO $verify_history$
BEGIN
  IF EXISTS (
    WITH after_rows AS (
      SELECT 'USUARIOS'::text relation_name, to_jsonb(t) row_data FROM public."USUARIOS" t
      UNION ALL SELECT 'SOLICITUDES_INTERCAMBIO', to_jsonb(t) - 'id_oferta' FROM public."SOLICITUDES_INTERCAMBIO" t
      UNION ALL SELECT 'RESERVAS', to_jsonb(t) FROM public."RESERVAS" t
      UNION ALL SELECT 'MOVIMIENTOS_CREDITO', to_jsonb(t) FROM public."MOVIMIENTOS_CREDITO" t
    ), differences AS (
      (SELECT * FROM p4_history EXCEPT ALL SELECT * FROM after_rows)
      UNION ALL
      (SELECT * FROM after_rows EXCEPT ALL SELECT * FROM p4_history)
    ) SELECT 1 FROM differences
  ) OR EXISTS (SELECT 1 FROM public."SOLICITUDES_INTERCAMBIO" WHERE id_oferta IS NOT NULL) THEN
    RAISE EXCEPTION 'El ensayo modifico datos historicos o invento una referencia a oferta';
  END IF;
END;
$verify_history$;
COMMIT;
