-- =====================================================================
--  Pruebas de encriptación y vistas · BD v0.31+
--
--  Ejecutar (la clave sale del .env del contenedor):
--    docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v k="$APP_ENCRYPTION_KEY" -f /tests/pruebas.sql'
--
--  Todo termina en ROLLBACK: no deja cambios y se puede repetir.
-- =====================================================================
\set ON_ERROR_STOP 1
\if :{?k}
\else
  \echo 'Falta la clave: agrega -v k="$APP_ENCRYPTION_KEY"'
  \quit
\endif
SET client_min_messages = warning;
BEGIN;
SELECT set_config('app.encryption_key', :'k', true) IS NOT NULL AS clave \gset

CREATE TEMP TABLE resultados (n serial, prueba text, resultado text, detalle text);

-- comprobar(nombre, condición SQL que debe ser verdadera)
CREATE FUNCTION pg_temp.comprobar(p_nombre text, p_condicion text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v boolean; v_msg text;
BEGIN
  BEGIN
    EXECUTE 'SELECT (' || p_condicion || ')' INTO v;
    INSERT INTO resultados (prueba, resultado, detalle)
    VALUES (p_nombre, CASE WHEN v THEN 'OK' ELSE 'FALLA' END, CASE WHEN v THEN '' ELSE 'La condición dio falso' END);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    INSERT INTO resultados (prueba, resultado, detalle) VALUES (p_nombre, 'FALLA', left(v_msg, 120));
  END;
END $$;

-- debe_fallar(nombre, sql, texto que debe aparecer en el error)
CREATE FUNCTION pg_temp.debe_fallar(p_nombre text, p_sql text, p_error text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_msg text;
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION '__acepto__';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    INSERT INTO resultados (prueba, resultado, detalle)
    VALUES (p_nombre,
            CASE WHEN v_msg <> '__acepto__' AND v_msg ILIKE '%' || p_error || '%' THEN 'OK' ELSE 'FALLA' END,
            CASE WHEN v_msg = '__acepto__' THEN 'La BD lo aceptó' ELSE left(v_msg, 120) END);
  END;
END $$;

-- ---------------------------------------------------------------------
-- A. Datos cifrados (backfill de los datos de demo)
-- ---------------------------------------------------------------------
SELECT pg_temp.comprobar('01 Todos los usuarios tienen nombre, apellido y correo cifrados y correo_hash',
  $q$NOT EXISTS (SELECT 1 FROM usuarios WHERE nombre_enc IS NULL OR apellido_enc IS NULL OR correo_enc IS NULL OR correo_hash IS NULL)$q$);
SELECT pg_temp.comprobar('02 Lo cifrado se descifra igual al dato original',
  $q$NOT EXISTS (SELECT 1 FROM usuarios WHERE decrypt_text(nombre_enc) <> nombre OR decrypt_text(correo_enc) <> correo)$q$);
SELECT pg_temp.comprobar('03 Lo guardado es ilegible (no contiene el texto plano)',
  $q$NOT EXISTS (SELECT 1 FROM usuarios WHERE position(convert_to(correo, 'UTF8') IN correo_enc) > 0)$q$);
SELECT pg_temp.comprobar('04 Cifrado no determinista: el mismo texto da resultados distintos',
  $q$encrypt_text('ana@ucb.edu.bo') <> encrypt_text('ana@ucb.edu.bo')$q$);
SELECT pg_temp.comprobar('05 Comentarios, mensajes, motivos y auditoría cifrados',
  $q$NOT EXISTS (SELECT 1 FROM calificaciones WHERE comentario IS NOT NULL AND comentario_enc IS NULL)
     AND NOT EXISTS (SELECT 1 FROM notificaciones WHERE mensaje_enc IS NULL)
     AND NOT EXISTS (SELECT 1 FROM reservas WHERE motivo_cancelacion IS NOT NULL AND motivo_cancelacion_enc IS NULL)
     AND NOT EXISTS (SELECT 1 FROM auditoria WHERE datos_nuevos IS NOT NULL AND datos_nuevos_enc IS NULL)$q$);

-- ---------------------------------------------------------------------
-- B. Login por correo (correo_hash)
-- ---------------------------------------------------------------------
SELECT pg_temp.comprobar('06 buscar_usuario_por_correo encuentra a Ana',
  $q$(SELECT nombre FROM buscar_usuario_por_correo('ana.mamani@ucb.edu.bo')) = 'Ana'$q$);
SELECT pg_temp.comprobar('07 ... sin importar mayúsculas ni espacios',
  $q$(SELECT nombre FROM buscar_usuario_por_correo('  ANA.Mamani@UCB.edu.bo ')) = 'Ana'$q$);
SELECT pg_temp.comprobar('08 ... y devuelve el password_hash para verificarlo',
  $q$(SELECT password_hash FROM buscar_usuario_por_correo('ana.mamani@ucb.edu.bo')) LIKE '$argon2id$%'$q$);
SELECT pg_temp.debe_fallar('09 Correo repetido con otras mayúsculas es rechazado (correo_hash único)',
  $q$INSERT INTO usuarios (nombre, apellido, correo, password_hash) VALUES ('X','Y','ANA.MAMANI@ucb.edu.bo','h')$q$,
  'ux_usuarios_correo_hash');

SELECT pg_temp.comprobar('09b Las vistas por estado no salen vacías (pendiente / disponible)',
  $q$(SELECT count(*) FROM v_solicitudes_pendientes) > 0 AND (SELECT count(*) FROM v_disponibilidades_futuras) > 0
     AND (SELECT count(*) FROM v_reservas_activas) > 0$q$);

-- ---------------------------------------------------------------------
-- C. Triggers: al insertar y al ACTUALIZAR se cifra el valor nuevo
-- ---------------------------------------------------------------------
INSERT INTO usuarios (id_usuario, nombre, apellido, correo, password_hash)
VALUES ('d0000000-0000-4000-8000-0000000000aa', 'Sofía', 'Gutiérrez', 'sofia.g@ucb.edu.bo', '$2b$12$x');
SELECT pg_temp.comprobar('10 Usuario nuevo: el trigger lo cifra al insertar',
  $q$(SELECT decrypt_text(nombre_enc) || ' ' || decrypt_text(apellido_enc) FROM usuarios WHERE id_usuario = 'd0000000-0000-4000-8000-0000000000aa') = 'Sofía Gutiérrez'$q$);

UPDATE usuarios SET correo = 'sofia.nueva@ucb.edu.bo', nombre = 'Sofía María'
 WHERE id_usuario = 'd0000000-0000-4000-8000-0000000000aa';
SELECT pg_temp.comprobar('11 Al cambiar el nombre, la vista muestra el nombre NUEVO',
  $q$(SELECT nombre FROM v_usuarios_desencriptados WHERE id_usuario = 'd0000000-0000-4000-8000-0000000000aa') = 'Sofía María'$q$);
SELECT pg_temp.comprobar('12 Al cambiar el correo, el login funciona con el correo NUEVO',
  $q$(SELECT count(*) FROM buscar_usuario_por_correo('sofia.nueva@ucb.edu.bo')) = 1$q$);
SELECT pg_temp.comprobar('13 ... y ya no con el correo viejo',
  $q$(SELECT count(*) FROM buscar_usuario_por_correo('sofia.g@ucb.edu.bo')) = 0$q$);

UPDATE calificaciones SET comentario = 'Comentario editado'
 WHERE id_reserva = 'f0000000-0000-4000-8000-000000000001' AND puntuacion = 5;
SELECT pg_temp.comprobar('14 Editar un comentario actualiza su versión cifrada',
  $q$EXISTS (SELECT 1 FROM v_calificaciones_desencriptadas WHERE comentario = 'Comentario editado')$q$);

UPDATE reservas SET estado = 'cancelada', cancelado_por = id_solicitante, cancelled_at = now(),
       motivo_cancelacion = 'Me enfermé', horas_anticipacion_cancelacion = 40
 WHERE id_reserva = 'f0000000-0000-4000-8000-000000000002';
SELECT pg_temp.comprobar('15 Cancelar una reserva cifra el motivo (v_cancelaciones_desencriptadas)',
  $q$(SELECT motivo FROM v_cancelaciones_desencriptadas WHERE id_reserva = 'f0000000-0000-4000-8000-000000000002') = 'Me enfermé'$q$);

-- ---------------------------------------------------------------------
-- D. Sin la clave correcta no se puede leer nada
-- ---------------------------------------------------------------------
SELECT pg_temp.debe_fallar('16 Con una clave corta, descifrar falla',
  $q$SELECT set_config('app.encryption_key', 'corta', true), decrypt_text(correo_enc) FROM usuarios LIMIT 1$q$,
  'demasiado corta');
SELECT pg_temp.debe_fallar('17 Con una clave equivocada, descifrar falla',
  $q$SELECT set_config('app.encryption_key', repeat('x', 40), true), decrypt_text(correo_enc) FROM usuarios LIMIT 1$q$,
  'Wrong key');

-- ---------------------------------------------------------------------
-- E. Todas las vistas y funciones responden sin error
-- ---------------------------------------------------------------------
DO $$
DECLARE v record; n bigint; v_msg text;
BEGIN
  FOR v IN SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM %I', v.viewname) INTO n;
      INSERT INTO resultados (prueba, resultado, detalle) VALUES ('Vista ' || v.viewname, 'OK', n || ' filas');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      INSERT INTO resultados (prueba, resultado, detalle) VALUES ('Vista ' || v.viewname, 'FALLA', left(v_msg, 120));
    END;
  END LOOP;
END $$;

SELECT pg_temp.comprobar('fn_solicitudes_recibidas(Ana) devuelve la solicitud pendiente',
  $q$(SELECT count(*) FROM fn_solicitudes_recibidas('d0000000-0000-4000-8000-000000000001')) = 1$q$);
SELECT pg_temp.comprobar('fn_solicitudes_enviadas(María) devuelve sus 2 solicitudes',
  $q$(SELECT count(*) FROM fn_solicitudes_enviadas('d0000000-0000-4000-8000-000000000004')) = 2$q$);
SELECT pg_temp.comprobar('fn_reservas_usuario(Ana) devuelve 2 reservas con su rol',
  $q$(SELECT count(*) FROM fn_reservas_usuario('d0000000-0000-4000-8000-000000000001') WHERE rol_usuario IS NOT NULL) = 2$q$);
SELECT pg_temp.comprobar('fn_calificaciones_recibidas(Luis) devuelve su calificación',
  $q$(SELECT count(*) FROM fn_calificaciones_recibidas('d0000000-0000-4000-8000-000000000002')) = 1$q$);

-- ---------------------------------------------------------------------
\echo
\echo '================ RESULTADOS ================'
SELECT n AS "#", prueba, resultado, detalle FROM resultados ORDER BY n;
SELECT count(*) FILTER (WHERE resultado = 'OK') AS ok,
       count(*) FILTER (WHERE resultado <> 'OK') AS fallas,
       count(*) AS total
  FROM resultados;
ROLLBACK;
