-- =====================================================================
-- Vistas desencriptadas y búsqueda de usuario por hash de correo.
-- Sólo deben concederse a roles de aplicación confiables.
-- =====================================================================

CREATE OR REPLACE VIEW public.v_usuarios_desencriptados AS
SELECT u."id_usuario",
       public.decrypt_text(u."nombre_enc")   AS "nombre",
       public.decrypt_text(u."apellido_enc") AS "apellido",
       public.decrypt_text(u."correo_enc")   AS "correo",
       u."password_hash", u."id_carrera", u."semestre",
       u."fecha_registro", u."ultimo_acceso", u."estado",
       u."rol", u."saldo", u."creditos_retenidos"
FROM public."USUARIOS" u;

CREATE OR REPLACE VIEW public.v_calificaciones_desencriptadas AS
SELECT c."id_calificacion", c."id_reserva", c."id_evaluador", c."id_evaluado",
       c."puntuacion", public.decrypt_text(c."comentario_enc") AS "comentario", c."created_at"
FROM public."CALIFICACIONES" c;

CREATE OR REPLACE VIEW public.v_cancelaciones_desencriptadas AS
SELECT r."id_reserva",
       r."cancelado_por" AS "id_usuario",
       public.decrypt_text(r."motivo_cancelacion_enc") AS "motivo",
       r."horas_anticipacion_cancelacion" AS "horas_anticipacion",
       r."cancelled_at" AS "fecha_cancelacion"
FROM public."RESERVAS" r
WHERE r."cancelled_at" IS NOT NULL OR r."cancelado_por" IS NOT NULL;

CREATE OR REPLACE VIEW public.v_notificaciones_desencriptadas AS
SELECT n."id_notificacion", n."id_usuario", n."tipo", n."titulo",
       public.decrypt_text(n."mensaje_enc") AS "mensaje", n."leida", n."created_at"
FROM public."NOTIFICACIONES" n;

CREATE OR REPLACE VIEW public.v_auditoria_desencriptada AS
SELECT a."id_auditoria", a."id_usuario", a."accion", a."entidad", a."entidad_id",
       public.decrypt_text(a."datos_anteriores_enc")::jsonb AS "datos_anteriores",
       public.decrypt_text(a."datos_nuevos_enc")::jsonb AS "datos_nuevos",
       a."ip", a."created_at"
FROM public."AUDITORIA" a;

-- La consulta compara directamente la columna indexada correo_hash; no
-- descifra todos los usuarios antes de aplicar el filtro.
CREATE OR REPLACE FUNCTION public.buscar_usuario_por_correo(p_correo text)
RETURNS TABLE (
  id_usuario uuid,
  nombre text,
  apellido text,
  correo text,
  password_hash text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u."id_usuario",
         public.decrypt_text(u."nombre_enc"),
         public.decrypt_text(u."apellido_enc"),
         public.decrypt_text(u."correo_enc"),
         u."password_hash"::text
  FROM public."USUARIOS" u
  WHERE u."correo_hash" = public.hash_lookup(p_correo)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.buscar_usuario_por_correo(text) FROM PUBLIC;
