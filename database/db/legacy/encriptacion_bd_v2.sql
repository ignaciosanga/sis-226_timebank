-- ============================================================
-- ENCRIPTACIÓN v2 — Sistema de Intercambio de Habilidades (v0.31+)
-- Adaptada al esquema v0.31+ (12 tablas). Cambios respecto al
-- original marcados con [ADAPTADO] y explicados en docs/ADAPTACION.md.
--
-- Requiere en la sesión:  SET app.encryption_key = '<32+ caracteres>';
-- En Docker la inyecta db/init/03_encriptacion.sh desde el .env.
-- ============================================================
BEGIN;

-- 0) RESET idempotente de artefactos v1
--    [ADAPTADO] Sin la tabla "cancelaciones" (no existe en v0.31+: la
--    cancelación vive en reservas). Se agrega el trigger de reservas.
--    OJO fase 2: este bloque borra las columnas *_enc y las recalcula desde
--    las columnas planas. Cuando las planas ya no existan, NO re-ejecutar.
DROP TRIGGER  IF EXISTS trg_encrypt_usuario       ON usuarios;
DROP TRIGGER  IF EXISTS trg_encrypt_calificacion  ON calificaciones;
DROP TRIGGER  IF EXISTS trg_encrypt_reserva       ON reservas;
DROP TRIGGER  IF EXISTS trg_encrypt_notificacion  ON notificaciones;
DROP TRIGGER  IF EXISTS trg_encrypt_auditoria     ON auditoria;

DROP FUNCTION IF EXISTS trf_encrypt_usuario();
DROP FUNCTION IF EXISTS trf_encrypt_calificacion();
DROP FUNCTION IF EXISTS trf_encrypt_cancelacion();
DROP FUNCTION IF EXISTS trf_encrypt_reserva();
DROP FUNCTION IF EXISTS trf_encrypt_notificacion();
DROP FUNCTION IF EXISTS trf_encrypt_auditoria();
DROP FUNCTION IF EXISTS buscar_usuario_por_correo(text);
DROP FUNCTION IF EXISTS get_encryption_key();

-- Las vistas de vistas_bd_v2.sql dependen de estas; se recrean después
DROP VIEW IF EXISTS v_usuarios_desencriptados CASCADE;
DROP VIEW IF EXISTS v_calificaciones_desencriptadas CASCADE;
DROP VIEW IF EXISTS v_cancelaciones_desencriptadas CASCADE;
DROP VIEW IF EXISTS v_notificaciones_desencriptadas CASCADE;
DROP VIEW IF EXISTS v_auditoria_desencriptada CASCADE;

DROP FUNCTION IF EXISTS get_app_key();
DROP FUNCTION IF EXISTS encrypt_text(text);
DROP FUNCTION IF EXISTS decrypt_text(bytea);
DROP FUNCTION IF EXISTS hash_lookup(text);

ALTER TABLE usuarios        DROP COLUMN IF EXISTS nombre_enc,    DROP COLUMN IF EXISTS apellido_enc,
                            DROP COLUMN IF EXISTS correo_enc,     DROP COLUMN IF EXISTS correo_hash;
ALTER TABLE calificaciones  DROP COLUMN IF EXISTS comentario_enc;
ALTER TABLE reservas        DROP COLUMN IF EXISTS motivo_cancelacion_enc;   -- [ADAPTADO]
ALTER TABLE notificaciones  DROP COLUMN IF EXISTS mensaje_enc;
ALTER TABLE auditoria       DROP COLUMN IF EXISTS datos_anteriores_enc,
                            DROP COLUMN IF EXISTS datos_nuevos_enc;

-- 1) Extensión
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Clave maestra — SOLO desde current_setting
CREATE OR REPLACE FUNCTION get_app_key()
RETURNS text AS $$
DECLARE v_key text;
BEGIN
  v_key := current_setting('app.encryption_key', true);
  IF v_key IS NULL OR length(v_key) < 32 THEN
    RAISE EXCEPTION 'app.encryption_key no configurada o demasiado corta (>=32 chars)';
  END IF;
  RETURN v_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- 3) Cifrado / descifrado / hash
CREATE OR REPLACE FUNCTION encrypt_text(plain_text text)
RETURNS bytea AS $$
BEGIN
  IF plain_text IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_encrypt(plain_text, get_app_key());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION decrypt_text(encrypted_data bytea)
RETURNS text AS $$
BEGIN
  IF encrypted_data IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(encrypted_data, get_app_key());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION hash_lookup(value text)
RETURNS bytea AS $$
BEGIN
  IF value IS NULL THEN RETURN NULL; END IF;
  RETURN digest(lower(trim(value)) || get_app_key(), 'sha256');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- 4) Columnas cifradas + backfill
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS nombre_enc   bytea,
  ADD COLUMN IF NOT EXISTS apellido_enc bytea,
  ADD COLUMN IF NOT EXISTS correo_enc   bytea,
  ADD COLUMN IF NOT EXISTS correo_hash  bytea;

UPDATE usuarios
SET nombre_enc   = encrypt_text(nombre),
    apellido_enc = encrypt_text(apellido),
    correo_enc   = encrypt_text(correo),
    correo_hash  = hash_lookup(correo)
WHERE nombre_enc IS NULL AND (nombre IS NOT NULL OR correo IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_correo_hash
  ON usuarios(correo_hash);

ALTER TABLE calificaciones  ADD COLUMN IF NOT EXISTS comentario_enc bytea;
UPDATE calificaciones SET comentario_enc = encrypt_text(comentario)
  WHERE comentario_enc IS NULL AND comentario IS NOT NULL;

-- [ADAPTADO] El motivo de cancelación está en reservas.motivo_cancelacion
ALTER TABLE reservas        ADD COLUMN IF NOT EXISTS motivo_cancelacion_enc bytea;
UPDATE reservas SET motivo_cancelacion_enc = encrypt_text(motivo_cancelacion)
  WHERE motivo_cancelacion_enc IS NULL AND motivo_cancelacion IS NOT NULL;

ALTER TABLE notificaciones  ADD COLUMN IF NOT EXISTS mensaje_enc bytea;
UPDATE notificaciones SET mensaje_enc = encrypt_text(mensaje)
  WHERE mensaje_enc IS NULL AND mensaje IS NOT NULL;

ALTER TABLE auditoria
  ADD COLUMN IF NOT EXISTS datos_anteriores_enc bytea,
  ADD COLUMN IF NOT EXISTS datos_nuevos_enc     bytea;
UPDATE auditoria
SET datos_anteriores_enc = encrypt_text(datos_anteriores::text),
    datos_nuevos_enc     = encrypt_text(datos_nuevos::text)
WHERE datos_anteriores_enc IS NULL
  AND (datos_anteriores IS NOT NULL OR datos_nuevos IS NOT NULL);

-- 5) Triggers dual-write
--    [ADAPTADO] En UPDATE se vuelve a cifrar si cambió el dato plano.
--    El original solo cifraba si la columna *_enc estaba vacía, así que al
--    cambiar un nombre o un correo la copia cifrada (y correo_hash) quedaba
--    con el valor viejo: las vistas mostraban datos viejos y el login con el
--    correo nuevo no encontraba al usuario.
CREATE OR REPLACE FUNCTION trf_encrypt_usuario() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.nombre_enc   IS NULL AND NEW.nombre   IS NOT NULL THEN NEW.nombre_enc   := encrypt_text(NEW.nombre);   END IF;
    IF NEW.apellido_enc IS NULL AND NEW.apellido IS NOT NULL THEN NEW.apellido_enc := encrypt_text(NEW.apellido); END IF;
    IF NEW.correo_enc   IS NULL AND NEW.correo   IS NOT NULL THEN NEW.correo_enc   := encrypt_text(NEW.correo);   END IF;
    IF NEW.correo_hash  IS NULL AND NEW.correo   IS NOT NULL THEN NEW.correo_hash  := hash_lookup(NEW.correo);    END IF;
  ELSE
    IF NEW.nombre   IS DISTINCT FROM OLD.nombre   THEN NEW.nombre_enc   := encrypt_text(NEW.nombre);   END IF;
    IF NEW.apellido IS DISTINCT FROM OLD.apellido THEN NEW.apellido_enc := encrypt_text(NEW.apellido); END IF;
    IF NEW.correo   IS DISTINCT FROM OLD.correo   THEN
      NEW.correo_enc  := encrypt_text(NEW.correo);
      NEW.correo_hash := hash_lookup(NEW.correo);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

CREATE TRIGGER trg_encrypt_usuario
  BEFORE INSERT OR UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION trf_encrypt_usuario();

CREATE OR REPLACE FUNCTION trf_encrypt_calificacion() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.comentario_enc IS NULL AND NEW.comentario IS NOT NULL THEN
      NEW.comentario_enc := encrypt_text(NEW.comentario);
    END IF;
  ELSIF NEW.comentario IS DISTINCT FROM OLD.comentario THEN
    NEW.comentario_enc := encrypt_text(NEW.comentario);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

CREATE TRIGGER trg_encrypt_calificacion
  BEFORE INSERT OR UPDATE ON calificaciones
  FOR EACH ROW EXECUTE FUNCTION trf_encrypt_calificacion();

-- [ADAPTADO] Reemplaza a trf_encrypt_cancelacion (tabla inexistente)
CREATE OR REPLACE FUNCTION trf_encrypt_reserva() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.motivo_cancelacion_enc IS NULL AND NEW.motivo_cancelacion IS NOT NULL THEN
      NEW.motivo_cancelacion_enc := encrypt_text(NEW.motivo_cancelacion);
    END IF;
  ELSIF NEW.motivo_cancelacion IS DISTINCT FROM OLD.motivo_cancelacion THEN
    NEW.motivo_cancelacion_enc := encrypt_text(NEW.motivo_cancelacion);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

CREATE TRIGGER trg_encrypt_reserva
  BEFORE INSERT OR UPDATE ON reservas
  FOR EACH ROW EXECUTE FUNCTION trf_encrypt_reserva();

CREATE OR REPLACE FUNCTION trf_encrypt_notificacion() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.mensaje_enc IS NULL AND NEW.mensaje IS NOT NULL THEN
      NEW.mensaje_enc := encrypt_text(NEW.mensaje);
    END IF;
  ELSIF NEW.mensaje IS DISTINCT FROM OLD.mensaje THEN
    NEW.mensaje_enc := encrypt_text(NEW.mensaje);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

CREATE TRIGGER trg_encrypt_notificacion
  BEFORE INSERT OR UPDATE ON notificaciones
  FOR EACH ROW EXECUTE FUNCTION trf_encrypt_notificacion();

CREATE OR REPLACE FUNCTION trf_encrypt_auditoria() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.datos_anteriores_enc IS NULL AND NEW.datos_anteriores IS NOT NULL THEN
      NEW.datos_anteriores_enc := encrypt_text(NEW.datos_anteriores::text);
    END IF;
    IF NEW.datos_nuevos_enc IS NULL AND NEW.datos_nuevos IS NOT NULL THEN
      NEW.datos_nuevos_enc := encrypt_text(NEW.datos_nuevos::text);
    END IF;
  ELSE
    IF NEW.datos_anteriores IS DISTINCT FROM OLD.datos_anteriores THEN
      NEW.datos_anteriores_enc := encrypt_text(NEW.datos_anteriores::text);
    END IF;
    IF NEW.datos_nuevos IS DISTINCT FROM OLD.datos_nuevos THEN
      NEW.datos_nuevos_enc := encrypt_text(NEW.datos_nuevos::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

CREATE TRIGGER trg_encrypt_auditoria
  BEFORE INSERT OR UPDATE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION trf_encrypt_auditoria();

-- 6) Vistas desencriptadas
--    [ADAPTADO] v_usuarios_desencriptados agrega al final rol, saldo y
--    creditos_retenidos, que en v0.31+ están en usuarios (antes estaban en
--    usuario_roles y cuentas_credito). Las columnas originales no cambian.
CREATE OR REPLACE VIEW v_usuarios_desencriptados AS
SELECT u.id_usuario,
       decrypt_text(u.nombre_enc)   AS nombre,
       decrypt_text(u.apellido_enc) AS apellido,
       decrypt_text(u.correo_enc)   AS correo,
       u.password_hash, u.id_carrera, u.semestre,
       u.fecha_registro, u.ultimo_acceso, u.estado,
       u.rol, u.saldo, u.creditos_retenidos
FROM usuarios u;

CREATE OR REPLACE VIEW v_calificaciones_desencriptadas AS
SELECT c.id_calificacion, c.id_reserva, c.id_evaluador, c.id_evaluado,
       c.puntuacion, decrypt_text(c.comentario_enc) AS comentario, c.created_at
FROM calificaciones c;

-- [ADAPTADO] Ahora sale de reservas canceladas. Se conservan los nombres de
-- columna del original salvo id_cancelacion, que no existe en v0.31+
-- (cada reserva se cancela una sola vez: id_reserva identifica la cancelación).
CREATE OR REPLACE VIEW v_cancelaciones_desencriptadas AS
SELECT r.id_reserva,
       r.cancelado_por                         AS id_usuario,
       decrypt_text(r.motivo_cancelacion_enc)  AS motivo,
       r.horas_anticipacion_cancelacion        AS horas_anticipacion,
       r.cancelled_at                          AS fecha_cancelacion
FROM reservas r
WHERE r.cancelled_at IS NOT NULL OR r.cancelado_por IS NOT NULL;

CREATE OR REPLACE VIEW v_notificaciones_desencriptadas AS
SELECT n.id_notificacion, n.id_usuario, n.tipo, n.titulo,
       decrypt_text(n.mensaje_enc) AS mensaje, n.leida, n.created_at
FROM notificaciones n;

CREATE OR REPLACE VIEW v_auditoria_desencriptada AS
SELECT a.id_auditoria, a.id_usuario, a.accion, a.entidad, a.entidad_id,
       decrypt_text(a.datos_anteriores_enc)::jsonb AS datos_anteriores,
       decrypt_text(a.datos_nuevos_enc)::jsonb     AS datos_nuevos,
       a.ip, a.created_at
FROM auditoria a;

-- 7) Búsqueda por correo (O(1))
--    [ADAPTADO] password_hash::text: la columna es varchar(255) y RETURN QUERY
--    exige el tipo exacto; el original fallaba SIEMPRE con
--    "Returned type character varying(255) does not match expected type text".
CREATE OR REPLACE FUNCTION buscar_usuario_por_correo(p_correo text)
RETURNS TABLE (
  id_usuario uuid, nombre text, apellido text, correo text, password_hash text
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.password_hash::text
  FROM v_usuarios_desencriptados u
  JOIN usuarios u2 ON u2.id_usuario = u.id_usuario
  WHERE u2.correo_hash = hash_lookup(p_correo)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- 8) Comentarios
COMMENT ON FUNCTION get_app_key()             IS 'Lee app.encryption_key (Vault/ENV). Falla si no está.';
COMMENT ON FUNCTION encrypt_text(text)        IS 'pgp_sym_encrypt AES-256 con IV+salt aleatorios.';
COMMENT ON FUNCTION decrypt_text(bytea)       IS 'pgp_sym_decrypt AES-256.';
COMMENT ON FUNCTION hash_lookup(text)         IS 'SHA-256 con pepper (para UNIQUE/búsqueda por igualdad).';
COMMENT ON FUNCTION buscar_usuario_por_correo IS 'Login: búsqueda por correo_hash (index scan).';
COMMENT ON COLUMN usuarios.correo_hash            IS 'SHA-256(correo || pepper). UNIQUE.';
COMMENT ON COLUMN usuarios.nombre_enc             IS 'nombre cifrado (pgp_sym).';
COMMENT ON COLUMN usuarios.apellido_enc           IS 'apellido cifrado (pgp_sym).';
COMMENT ON COLUMN usuarios.correo_enc             IS 'correo cifrado (pgp_sym).';
COMMENT ON COLUMN calificaciones.comentario_enc   IS 'comentario cifrado.';
COMMENT ON COLUMN reservas.motivo_cancelacion_enc IS 'motivo de cancelación cifrado.';
COMMENT ON COLUMN notificaciones.mensaje_enc      IS 'mensaje cifrado.';
COMMENT ON COLUMN auditoria.datos_anteriores_enc  IS 'snapshot JSON cifrado.';
COMMENT ON COLUMN auditoria.datos_nuevos_enc      IS 'snapshot JSON cifrado.';

COMMIT;
