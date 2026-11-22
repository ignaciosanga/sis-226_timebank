-- Para una base YA creada (el initdb solo corre con volumen vacio).
-- Ejecutar como administrador (el script 10 se lee desde el volumen montado en el contenedor):
--   docker compose exec -T db psql -U skillswap_admin -d skillswap < migrations/02_penalizaciones_pendientes.sql
\set ON_ERROR_STOP on
BEGIN;
\i /docker-entrypoint-initdb.d/sql/10_penalizaciones_pendientes.sql
GRANT SELECT ON public."PENALIZACIONES_PENDIENTES" TO rol_app;
GRANT SELECT ON public.v_penalizaciones_pendientes_app TO rol_app;
GRANT EXECUTE ON FUNCTION public.fn_cobrar_penalizaciones_pendientes(uuid) TO rol_app;
GRANT SELECT ON public.v_bi_penalizaciones_resumen TO rol_lectura;
COMMIT;
