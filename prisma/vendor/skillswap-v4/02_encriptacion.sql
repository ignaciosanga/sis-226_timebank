-- =====================================================================
-- Columnas cifradas, backfill e instalación de triggers de cifrado.
-- Requiere app.encryption_key y app.hash_pepper configuradas en la sesión.
-- Nota: para compatibilidad con el esquema/API actual se conservan los
-- campos originales en claro; las columnas *_enc son copias cifradas.
-- No afirmar cifrado completo en reposo mientras esos campos sigan en claro.
-- =====================================================================

ALTER TABLE public."USUARIOS"
  ADD COLUMN IF NOT EXISTS "nombre_enc"   bytea,
  ADD COLUMN IF NOT EXISTS "apellido_enc" bytea,
  ADD COLUMN IF NOT EXISTS "correo_enc"   bytea,
  ADD COLUMN IF NOT EXISTS "correo_hash"  bytea;

ALTER TABLE public."CALIFICACIONES"
  ADD COLUMN IF NOT EXISTS "comentario_enc" bytea;

ALTER TABLE public."RESERVAS"
  ADD COLUMN IF NOT EXISTS "motivo_cancelacion_enc" bytea;

ALTER TABLE public."NOTIFICACIONES"
  ADD COLUMN IF NOT EXISTS "mensaje_enc" bytea;

ALTER TABLE public."AUDITORIA"
  ADD COLUMN IF NOT EXISTS "datos_anteriores_enc" bytea,
  ADD COLUMN IF NOT EXISTS "datos_nuevos_enc"     bytea;

-- Backfill reejecutable: sólo completa columnas cifradas faltantes.
UPDATE public."USUARIOS"
SET "nombre_enc"   = COALESCE("nombre_enc",   public.encrypt_text("nombre")),
    "apellido_enc" = COALESCE("apellido_enc", public.encrypt_text("apellido")),
    "correo_enc"   = COALESCE("correo_enc",   public.encrypt_text("correo")),
    "correo_hash"  = COALESCE("correo_hash",  public.hash_lookup("correo"))
WHERE "nombre_enc" IS NULL
   OR "apellido_enc" IS NULL
   OR "correo_enc" IS NULL
   OR "correo_hash" IS NULL;

UPDATE public."CALIFICACIONES"
SET "comentario_enc" = public.encrypt_text("comentario")
WHERE "comentario_enc" IS NULL AND "comentario" IS NOT NULL;

UPDATE public."RESERVAS"
SET "motivo_cancelacion_enc" = public.encrypt_text("motivo_cancelacion")
WHERE "motivo_cancelacion_enc" IS NULL AND "motivo_cancelacion" IS NOT NULL;

UPDATE public."NOTIFICACIONES"
SET "mensaje_enc" = public.encrypt_text("mensaje")
WHERE "mensaje_enc" IS NULL AND "mensaje" IS NOT NULL;

UPDATE public."AUDITORIA"
SET "datos_anteriores_enc" = COALESCE(
      "datos_anteriores_enc", public.encrypt_text("datos_anteriores"::text)),
    "datos_nuevos_enc" = COALESCE(
      "datos_nuevos_enc", public.encrypt_text("datos_nuevos"::text)),
    "datos_anteriores" = NULL,
    "datos_nuevos" = NULL
WHERE "datos_anteriores" IS NOT NULL
   OR "datos_nuevos" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_correo_hash
  ON public."USUARIOS"("correo_hash");

-- Un trigger por tabla sensible, antes de INSERT/UPDATE.
DROP TRIGGER IF EXISTS trg_encrypt_usuarios ON public."USUARIOS";
CREATE TRIGGER trg_encrypt_usuarios
BEFORE INSERT OR UPDATE ON public."USUARIOS"
FOR EACH ROW EXECUTE FUNCTION public.fn_encrypt_sensitive();

DROP TRIGGER IF EXISTS trg_encrypt_calificaciones ON public."CALIFICACIONES";
CREATE TRIGGER trg_encrypt_calificaciones
BEFORE INSERT OR UPDATE ON public."CALIFICACIONES"
FOR EACH ROW EXECUTE FUNCTION public.fn_encrypt_sensitive();

DROP TRIGGER IF EXISTS trg_encrypt_reservas ON public."RESERVAS";
CREATE TRIGGER trg_encrypt_reservas
BEFORE INSERT OR UPDATE ON public."RESERVAS"
FOR EACH ROW EXECUTE FUNCTION public.fn_encrypt_sensitive();

DROP TRIGGER IF EXISTS trg_encrypt_notificaciones ON public."NOTIFICACIONES";
CREATE TRIGGER trg_encrypt_notificaciones
BEFORE INSERT OR UPDATE ON public."NOTIFICACIONES"
FOR EACH ROW EXECUTE FUNCTION public.fn_encrypt_sensitive();

DROP TRIGGER IF EXISTS trg_encrypt_auditoria ON public."AUDITORIA";
CREATE TRIGGER trg_encrypt_auditoria
BEFORE INSERT OR UPDATE ON public."AUDITORIA"
FOR EACH ROW EXECUTE FUNCTION public.fn_encrypt_sensitive();
