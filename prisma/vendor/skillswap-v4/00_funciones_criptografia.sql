-- =====================================================================
-- Funciones criptográficas SkillSwap (PostgreSQL 14/15/16 + pgcrypto)
-- Las claves NO se persisten en ALTER ROLE ni en tablas: se suministran
-- como parámetros de sesión por el backend y por el script de bootstrap.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.get_app_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := NULLIF(current_setting('app.encryption_key', true), '');
  IF v_key IS NULL OR length(v_key) < 32 THEN
    RAISE EXCEPTION 'Falta app.encryption_key o tiene menos de 32 caracteres'
      USING ERRCODE = '22023';
  END IF;
  RETURN v_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_hash_pepper()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pepper text;
BEGIN
  v_pepper := NULLIF(current_setting('app.hash_pepper', true), '');
  IF v_pepper IS NULL OR length(v_pepper) < 32 THEN
    RAISE EXCEPTION 'Falta app.hash_pepper o tiene menos de 32 caracteres'
      USING ERRCODE = '22023';
  END IF;
  RETURN v_pepper;
END;
$$;

CREATE OR REPLACE FUNCTION public.encrypt_text(p_plaintext text)
RETURNS bytea
LANGUAGE sql
STABLE
STRICT
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.pgp_sym_encrypt(
    p_plaintext,
    public.get_app_key(),
    'cipher-algo=aes256, compress-algo=0'
  );
$$;

CREATE OR REPLACE FUNCTION public.decrypt_text(p_ciphertext bytea)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.pgp_sym_decrypt(p_ciphertext, public.get_app_key());
$$;

-- HMAC-SHA-256 determinístico para localizar correos sin indexar el texto.
-- Se utiliza un pepper distinto de la clave de cifrado.
CREATE OR REPLACE FUNCTION public.hash_lookup(p_value text)
RETURNS bytea
LANGUAGE sql
STABLE
STRICT
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.hmac(
    convert_to(lower(btrim(p_value)), 'UTF8'),
    convert_to(public.get_hash_pepper(), 'UTF8'),
    'sha256'
  );
$$;

-- Un único trigger BEFORE para las columnas cifradas. Los valores cifrados
-- se recalculan cuando cambia el dato original; si no cambia, se conserva el
-- ciphertext anterior y se impide que la aplicación lo manipule directamente.
CREATE OR REPLACE FUNCTION public.fn_encrypt_sensitive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'USUARIOS' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.nombre_enc   := public.encrypt_text(NEW.nombre);
      NEW.apellido_enc := public.encrypt_text(NEW.apellido);
      NEW.correo_enc   := public.encrypt_text(NEW.correo);
      NEW.correo_hash  := public.hash_lookup(NEW.correo);
    ELSE
      IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
        NEW.nombre_enc := public.encrypt_text(NEW.nombre);
      ELSE
        NEW.nombre_enc := OLD.nombre_enc;
      END IF;
      IF NEW.apellido IS DISTINCT FROM OLD.apellido THEN
        NEW.apellido_enc := public.encrypt_text(NEW.apellido);
      ELSE
        NEW.apellido_enc := OLD.apellido_enc;
      END IF;
      IF NEW.correo IS DISTINCT FROM OLD.correo THEN
        NEW.correo_enc  := public.encrypt_text(NEW.correo);
        NEW.correo_hash := public.hash_lookup(NEW.correo);
      ELSE
        NEW.correo_enc  := OLD.correo_enc;
        NEW.correo_hash := OLD.correo_hash;
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'CALIFICACIONES' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.comentario_enc := public.encrypt_text(NEW.comentario);
    ELSIF NEW.comentario IS DISTINCT FROM OLD.comentario THEN
      NEW.comentario_enc := public.encrypt_text(NEW.comentario);
    ELSE
      NEW.comentario_enc := OLD.comentario_enc;
    END IF;

  ELSIF TG_TABLE_NAME = 'RESERVAS' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.motivo_cancelacion_enc := public.encrypt_text(NEW.motivo_cancelacion);
    ELSIF NEW.motivo_cancelacion IS DISTINCT FROM OLD.motivo_cancelacion THEN
      NEW.motivo_cancelacion_enc := public.encrypt_text(NEW.motivo_cancelacion);
    ELSE
      NEW.motivo_cancelacion_enc := OLD.motivo_cancelacion_enc;
    END IF;

  ELSIF TG_TABLE_NAME = 'NOTIFICACIONES' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.mensaje_enc := public.encrypt_text(NEW.mensaje);
    ELSIF NEW.mensaje IS DISTINCT FROM OLD.mensaje THEN
      NEW.mensaje_enc := public.encrypt_text(NEW.mensaje);
    ELSE
      NEW.mensaje_enc := OLD.mensaje_enc;
    END IF;

  ELSIF TG_TABLE_NAME = 'AUDITORIA' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.datos_anteriores_enc := public.encrypt_text(NEW.datos_anteriores::text);
      NEW.datos_nuevos_enc := public.encrypt_text(NEW.datos_nuevos::text);
    ELSE
      IF NEW.datos_anteriores IS DISTINCT FROM OLD.datos_anteriores THEN
        NEW.datos_anteriores_enc := public.encrypt_text(NEW.datos_anteriores::text);
      ELSE
        NEW.datos_anteriores_enc := OLD.datos_anteriores_enc;
      END IF;
      IF NEW.datos_nuevos IS DISTINCT FROM OLD.datos_nuevos THEN
        NEW.datos_nuevos_enc := public.encrypt_text(NEW.datos_nuevos::text);
      ELSE
        NEW.datos_nuevos_enc := OLD.datos_nuevos_enc;
      END IF;
    END IF;

    -- La auditoría conserva los JSON sólo cifrados, no en claro.
    NEW.datos_anteriores := NULL;
    NEW.datos_nuevos := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- No permitir invocación directa de los helpers ni del trigger desde clientes.
REVOKE ALL ON FUNCTION public.get_app_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_hash_pepper() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.encrypt_text(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrypt_text(bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hash_lookup(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_encrypt_sensitive() FROM PUBLIC;
