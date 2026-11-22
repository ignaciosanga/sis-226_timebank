-- =====================================================================
-- Politica de precio acordado con Backend/Frontend.
-- Ejecutar una sola vez sobre una instalacion V4 ya inicializada.
-- El precio del tutor es el precio de cobro; la formula dinamica es sugerencia.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_sugerir_precio_clase(
    p_id_habilidad uuid,
    p_id_ofertante uuid,
    p_fecha_inicio timestamptz
) RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT public.fn_calcular_costo_clase(
        p_id_habilidad, p_id_ofertante, p_fecha_inicio
    );
$$;

COMMENT ON FUNCTION public.fn_sugerir_precio_clase(uuid, uuid, timestamptz) IS
  'Sugerencia economica en decimas; no reemplaza el precio elegido por el tutor ni el snapshot aceptado.';
COMMENT ON FUNCTION public.fn_calcular_costo_clase(uuid, uuid, timestamptz) IS
  'Nombre legado. Solo devuelve una sugerencia dinamica; no debe usarse como importe de cobro.';
COMMENT ON COLUMN public."OFERTAS_TUTORIA"."costo_decimas" IS
  'Precio definitivo elegido por el tutor. INTEGER en decimas: 37 = 3.7 creditos. La sugerencia dinamica no lo sobreescribe.';

REVOKE ALL ON FUNCTION public.fn_sugerir_precio_clase(uuid, uuid, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_calcular_costo_clase(uuid, uuid, timestamptz) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.fn_calcular_costo_clase(uuid, uuid, timestamptz) FROM rol_app;
GRANT EXECUTE ON FUNCTION public.fn_sugerir_precio_clase(uuid, uuid, timestamptz) TO rol_app;

COMMIT;
