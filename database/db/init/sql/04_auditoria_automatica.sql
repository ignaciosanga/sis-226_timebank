-- =====================================================================
-- Auditoría automática de tablas de negocio.
-- La auditoría se inserta en AUDITORIA y su trigger BEFORE cifra los JSON
-- y elimina los campos JSON en claro.
-- Para USUARIO_HABILIDADES (PK compuesta) entidad_id es un UUID sintético
-- determinista derivado de ambos componentes; ambos valores quedan en JSON.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_auditar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_quitar text[] := ARRAY[
    'password_hash', 'nombre_enc', 'apellido_enc', 'correo_enc', 'correo_hash',
    'comentario', 'comentario_enc',
    'motivo_cancelacion', 'motivo_cancelacion_enc',
    'mensaje', 'mensaje_enc'
  ];
  v_antes jsonb;
  v_despues jsonb;
  v_fila jsonb;
  v_id_text text;
  v_id uuid;
  v_usuario uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_antes := to_jsonb(OLD) - v_quitar;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_despues := to_jsonb(NEW) - v_quitar;
  END IF;

  -- Los campos identificativos del usuario nunca se copian al JSON auditor.
  IF TG_TABLE_NAME = 'USUARIOS' THEN
    v_antes := CASE WHEN v_antes IS NULL THEN NULL ELSE v_antes - ARRAY['nombre','apellido','correo'] END;
    v_despues := CASE WHEN v_despues IS NULL THEN NULL ELSE v_despues - ARRAY['nombre','apellido','correo'] END;
  END IF;

  v_fila := COALESCE(v_despues, v_antes);

  IF TG_TABLE_NAME = 'USUARIO_HABILIDADES' THEN
    v_id_text := COALESCE(v_fila ->> 'id_usuario', '') || ':' ||
                 COALESCE(v_fila ->> 'id_habilidad', '');
    v_id := md5(v_id_text)::uuid;
  ELSE
    v_id_text := v_fila ->> TG_ARGV[0];
    IF v_id_text IS NULL OR btrim(v_id_text) = '' THEN
      RETURN NULL;
    END IF;
    BEGIN
      v_id := v_id_text::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      -- No se aborta la operación de negocio por una fila sin UUID auditable.
      RETURN NULL;
    END;
  END IF;

  BEGIN
    v_usuario := NULLIF(current_setting('app.usuario_actual', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_usuario := NULL;
  END;

  INSERT INTO public."AUDITORIA"
    ("id_usuario", "accion", "entidad", "entidad_id",
     "datos_anteriores", "datos_nuevos", "ip")
  VALUES
    (v_usuario, TG_OP, TG_TABLE_NAME, v_id,
     v_antes, v_despues, host(inet_client_addr()));

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_auditar() FROM PUBLIC;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('CARRERAS',                'id_carrera'),
      ('CATEGORIAS',              'id_categoria'),
      ('USUARIOS',                'id_usuario'),
      ('HABILIDADES',             'id_habilidad'),
      ('USUARIO_HABILIDADES',     'id_usuario'),
      ('DISPONIBILIDADES',        'id_disponibilidad'),
      ('SOLICITUDES_INTERCAMBIO', 'id_solicitud'),
      ('RESERVAS',                'id_reserva'),
      ('MOVIMIENTOS_CREDITO',     'id_movimiento'),
      ('CALIFICACIONES',          'id_calificacion'),
      ('NOTIFICACIONES',          'id_notificacion')
    ) AS t(tabla, pk)
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I',
      'trg_auditar_' || lower(r.tabla), r.tabla
    );
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.fn_auditar(%L)',
      'trg_auditar_' || lower(r.tabla), r.tabla, r.pk
    );
  END LOOP;
END;
$$;
