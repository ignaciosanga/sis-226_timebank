-- ============================================================
-- VISTAS v2 — Sistema de Intercambio de Habilidades (v0.31+)
-- Requiere: encriptacion_bd_v2.sql aplicado.
-- Adaptadas al esquema v0.31+ (12 tablas). Cambios marcados con
-- [ADAPTADO] y explicados en docs/ADAPTACION.md.
-- ============================================================
BEGIN;

-- 0) [ADAPTADO] Reinicio idempotente: CREATE OR REPLACE no puede cambiar las
--    columnas de una vista ni el tipo de retorno de una función.
DROP FUNCTION IF EXISTS fn_solicitudes_recibidas(uuid);
DROP FUNCTION IF EXISTS fn_solicitudes_enviadas(uuid);
DROP FUNCTION IF EXISTS fn_reservas_usuario(uuid);
DROP FUNCTION IF EXISTS fn_calificaciones_recibidas(uuid);
DROP VIEW IF EXISTS
  v_usuarios_completo, v_usuarios_roles, v_usuarios_activos, v_usuarios_por_facultad,
  v_habilidades_populares, v_habilidades_categoria, v_usuario_habilidades_detalle,
  v_ofertantes_por_habilidad, v_disponibilidades_usuario, v_disponibilidades_futuras,
  v_solicitudes_detalle, v_solicitudes_pendientes, v_reservas_detalle, v_reservas_activas,
  v_reservas_completadas, v_cuentas_credito_usuario, v_movimientos_credito_detalle,
  v_transferencias_detalle, v_ranking_creditos, v_calificaciones_detalle,
  v_reputacion_usuarios, v_notificaciones_usuario, v_notificaciones_no_leidas,
  v_notificaciones_por_tipo, v_auditoria_detalle, v_auditoria_por_accion,
  v_auditoria_por_usuario, v_estadisticas_generales, v_actividad_mensual,
  v_habilidades_mas_solicitadas, v_usuarios_mas_activos, v_reservas_por_categoria
  CASCADE;

-- 1) USUARIOS
CREATE OR REPLACE VIEW v_usuarios_completo AS
SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.password_hash,
       u.id_carrera, c.nombre AS nombre_carrera, c.facultad,
       u.semestre, u.fecha_registro, u.ultimo_acceso, u.estado
FROM v_usuarios_desencriptados u
LEFT JOIN carreras c ON u.id_carrera = c.id_carrera;

-- [ADAPTADO] En v0.31+ no hay roles/usuario_roles: el rol es usuarios.rol
CREATE OR REPLACE VIEW v_usuarios_roles AS
SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.estado, u.rol
FROM v_usuarios_desencriptados u;

CREATE OR REPLACE VIEW v_usuarios_activos AS
SELECT u.id_usuario, u.nombre, u.apellido, u.correo,
       c.nombre AS carrera, c.facultad, u.semestre,
       u.fecha_registro, u.ultimo_acceso
FROM v_usuarios_desencriptados u
LEFT JOIN carreras c ON u.id_carrera = c.id_carrera
WHERE u.estado = 'activo';

CREATE OR REPLACE VIEW v_usuarios_por_facultad AS
SELECT c.facultad, c.nombre AS carrera,
       COUNT(u.id_usuario) AS total_usuarios,
       COUNT(*) FILTER (WHERE u.estado = 'activo') AS usuarios_activos
FROM carreras c
LEFT JOIN usuarios u ON c.id_carrera = u.id_carrera
GROUP BY c.facultad, c.nombre;

-- 2) HABILIDADES
CREATE OR REPLACE VIEW v_habilidades_categoria AS
SELECT h.id_habilidad, h.nombre AS nombre_habilidad, cat.nombre AS categoria, h.estado
FROM habilidades h
JOIN categorias cat ON h.id_categoria = cat.id_categoria;

CREATE OR REPLACE VIEW v_usuario_habilidades_detalle AS
SELECT u.id_usuario, u.nombre, u.apellido, h.id_habilidad,
       h.nombre AS nombre_habilidad, cat.nombre AS categoria,
       uh.nivel, h.estado AS estado_habilidad
FROM v_usuarios_desencriptados u
JOIN usuario_habilidades uh ON u.id_usuario   = uh.id_usuario
JOIN habilidades h         ON uh.id_habilidad = h.id_habilidad
JOIN categorias cat        ON h.id_categoria  = cat.id_categoria
WHERE h.estado = 'activo';

CREATE OR REPLACE VIEW v_ofertantes_por_habilidad AS
SELECT h.id_habilidad, h.nombre AS nombre_habilidad, cat.nombre AS categoria,
       COUNT(*) AS total_ofertantes,
       COUNT(*) FILTER (WHERE u.estado = 'activo') AS ofertantes_activos
FROM habilidades h
JOIN usuario_habilidades uh ON h.id_habilidad = uh.id_habilidad
JOIN usuarios u            ON uh.id_usuario   = u.id_usuario
JOIN categorias cat        ON h.id_categoria  = cat.id_categoria
WHERE h.estado = 'activo'
GROUP BY h.id_habilidad, h.nombre, cat.nombre;

CREATE OR REPLACE VIEW v_habilidades_populares AS
SELECT * FROM v_ofertantes_por_habilidad
ORDER BY total_ofertantes DESC
LIMIT 20;

-- 3) DISPONIBILIDADES
CREATE OR REPLACE VIEW v_disponibilidades_usuario AS
SELECT d.id_disponibilidad, u.id_usuario, u.nombre, u.apellido,
       d.fecha_inicio, d.fecha_fin, d.estado
FROM disponibilidades d
JOIN v_usuarios_desencriptados u ON d.id_usuario = u.id_usuario
WHERE d.estado IN ('disponible', 'activo') AND d.fecha_inicio > now();  -- [ADAPTADO] el DDL usa 'disponible'

CREATE OR REPLACE VIEW v_disponibilidades_futuras AS
SELECT d.id_disponibilidad, u.id_usuario, u.nombre, u.apellido,
       d.fecha_inicio, d.fecha_fin,
       EXTRACT(EPOCH FROM (d.fecha_fin - d.fecha_inicio))/3600 AS horas_disponibles,
       d.estado
FROM disponibilidades d
JOIN v_usuarios_desencriptados u ON d.id_usuario = u.id_usuario
WHERE d.fecha_inicio > now() AND d.estado IN ('disponible', 'activo');  -- [ADAPTADO]

-- 4) SOLICITUDES
CREATE OR REPLACE VIEW v_solicitudes_detalle AS
SELECT s.id_solicitud, s.id_solicitante,
       us.nombre AS nombre_solicitante, us.apellido AS apellido_solicitante,
       s.id_ofertante,
       uo.nombre AS nombre_ofertante,   uo.apellido AS apellido_ofertante,
       s.id_habilidad, h.nombre AS nombre_habilidad, cat.nombre AS categoria,
       s.fecha_inicio_propuesta, s.fecha_fin_propuesta,
       s.creditos_requeridos, s.estado, s.created_at, s.respondida_at
FROM solicitudes_intercambio s
JOIN v_usuarios_desencriptados us ON s.id_solicitante = us.id_usuario
JOIN v_usuarios_desencriptados uo ON s.id_ofertante   = uo.id_usuario
JOIN habilidades h   ON s.id_habilidad = h.id_habilidad
JOIN categorias cat  ON h.id_categoria = cat.id_categoria;

CREATE OR REPLACE VIEW v_solicitudes_pendientes AS
SELECT s.id_solicitud, s.id_solicitante,
       us.nombre AS nombre_solicitante,
       s.id_ofertante, uo.nombre AS nombre_ofertante,
       h.nombre AS nombre_habilidad,
       s.fecha_inicio_propuesta, s.fecha_fin_propuesta,
       s.creditos_requeridos, s.created_at
FROM solicitudes_intercambio s
JOIN v_usuarios_desencriptados us ON s.id_solicitante = us.id_usuario
JOIN v_usuarios_desencriptados uo ON s.id_ofertante   = uo.id_usuario
JOIN habilidades h ON s.id_habilidad = h.id_habilidad
WHERE s.estado IN ('pendiente', 'solicitada');  -- [ADAPTADO] el DDL usa 'pendiente'

CREATE OR REPLACE FUNCTION fn_solicitudes_recibidas(p_usuario uuid)
RETURNS TABLE (
  id_solicitud uuid, id_solicitante uuid,
  nombre_solicitante text, apellido_solicitante text, id_ofertante uuid,
  nombre_habilidad text, fecha_inicio_propuesta timestamptz,
  fecha_fin_propuesta timestamptz, creditos_requeridos int,
  estado varchar, created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id_solicitud, s.id_solicitante,
         us.nombre, us.apellido, s.id_ofertante, h.nombre::text,  -- [ADAPTADO] varchar -> text
         s.fecha_inicio_propuesta, s.fecha_fin_propuesta,
         s.creditos_requeridos, s.estado, s.created_at
  FROM solicitudes_intercambio s
  JOIN v_usuarios_desencriptados us ON s.id_solicitante = us.id_usuario
  JOIN habilidades h ON s.id_habilidad = h.id_habilidad
  WHERE s.id_ofertante = p_usuario AND s.estado IN ('pendiente', 'solicitada')  -- [ADAPTADO]
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION fn_solicitudes_enviadas(p_usuario uuid)
RETURNS TABLE (
  id_solicitud uuid, id_solicitante uuid, id_ofertante uuid,
  nombre_ofertante text, apellido_ofertante text, nombre_habilidad text,
  fecha_inicio_propuesta timestamptz, fecha_fin_propuesta timestamptz,
  creditos_requeridos int, estado varchar, created_at timestamptz,
  respondida_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id_solicitud, s.id_solicitante, s.id_ofertante,
         uo.nombre, uo.apellido, h.nombre::text,  -- [ADAPTADO] varchar -> text
         s.fecha_inicio_propuesta, s.fecha_fin_propuesta,
         s.creditos_requeridos, s.estado, s.created_at, s.respondida_at
  FROM solicitudes_intercambio s
  JOIN v_usuarios_desencriptados uo ON s.id_ofertante = uo.id_usuario
  JOIN habilidades h ON s.id_habilidad = h.id_habilidad
  WHERE s.id_solicitante = p_usuario
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- 5) RESERVAS
CREATE OR REPLACE VIEW v_reservas_detalle AS
SELECT r.id_reserva, r.id_solicitud,
       r.id_solicitante, us.nombre AS nombre_solicitante, us.apellido AS apellido_solicitante,
       r.id_ofertante,   uo.nombre AS nombre_ofertante,   uo.apellido AS apellido_ofertante,
       r.id_habilidad, h.nombre AS nombre_habilidad, cat.nombre AS categoria,
       r.fecha_inicio, r.fecha_fin, r.creditos, r.modalidad, r.lugar, r.estado,
       r.created_at, r.completed_at, r.cancelled_at
FROM reservas r
JOIN v_usuarios_desencriptados us ON r.id_solicitante = us.id_usuario
JOIN v_usuarios_desencriptados uo ON r.id_ofertante   = uo.id_usuario
JOIN habilidades h  ON r.id_habilidad = h.id_habilidad
JOIN categorias cat ON h.id_categoria = cat.id_categoria;

CREATE OR REPLACE VIEW v_reservas_activas AS
SELECT r.id_reserva, r.id_solicitante, us.nombre AS nombre_solicitante,
       r.id_ofertante, uo.nombre AS nombre_ofertante, h.nombre AS nombre_habilidad,
       r.fecha_inicio, r.fecha_fin, r.modalidad, r.lugar, r.estado
FROM reservas r
JOIN v_usuarios_desencriptados us ON r.id_solicitante = us.id_usuario
JOIN v_usuarios_desencriptados uo ON r.id_ofertante   = uo.id_usuario
JOIN habilidades h ON r.id_habilidad = h.id_habilidad
WHERE r.estado IN ('pendiente', 'confirmada') AND r.fecha_inicio > now();  -- [ADAPTADO] el DDL usa 'pendiente'

CREATE OR REPLACE FUNCTION fn_reservas_usuario(p_usuario uuid)
RETURNS TABLE (
  id_reserva uuid, rol_usuario text,
  id_solicitante uuid, nombre_solicitante text,
  id_ofertante uuid, nombre_ofertante text,
  nombre_habilidad text, fecha_inicio timestamptz, fecha_fin timestamptz,
  creditos int, modalidad varchar, lugar varchar,
  estado varchar, created_at timestamptz, completed_at timestamptz, cancelled_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id_reserva,
         CASE WHEN r.id_solicitante = p_usuario THEN 'solicitante'
              WHEN r.id_ofertante   = p_usuario THEN 'ofertante' END::text,
         r.id_solicitante, us.nombre,
         r.id_ofertante,   uo.nombre,
         h.nombre::text, r.fecha_inicio, r.fecha_fin, r.creditos,  -- [ADAPTADO] varchar -> text
         r.modalidad, r.lugar, r.estado,
         r.created_at, r.completed_at, r.cancelled_at
  FROM reservas r
  JOIN v_usuarios_desencriptados us ON r.id_solicitante = us.id_usuario
  JOIN v_usuarios_desencriptados uo ON r.id_ofertante   = uo.id_usuario
  JOIN habilidades h ON r.id_habilidad = h.id_habilidad
  WHERE r.id_solicitante = p_usuario OR r.id_ofertante = p_usuario
  ORDER BY r.fecha_inicio DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

CREATE OR REPLACE VIEW v_reservas_completadas AS
SELECT r.id_reserva, r.id_solicitante, us.nombre AS nombre_solicitante,
       r.id_ofertante, uo.nombre AS nombre_ofertante, h.nombre AS nombre_habilidad,
       r.fecha_inicio, r.fecha_fin, r.creditos, r.modalidad, r.completed_at
FROM reservas r
JOIN v_usuarios_desencriptados us ON r.id_solicitante = us.id_usuario
JOIN v_usuarios_desencriptados uo ON r.id_ofertante   = uo.id_usuario
JOIN habilidades h ON r.id_habilidad = h.id_habilidad
WHERE r.estado = 'completada';

-- 6) CRÉDITOS
-- [ADAPTADO] En v0.31+ el saldo vive en usuarios (no hay cuentas_credito ni id_cuenta)
CREATE OR REPLACE VIEW v_cuentas_credito_usuario AS
SELECT u.id_usuario, u.nombre, u.apellido, u.correo,
       u.saldo, u.creditos_retenidos,
       u.saldo - u.creditos_retenidos AS creditos_disponibles
FROM v_usuarios_desencriptados u;

-- [ADAPTADO] movimientos_credito se relaciona con usuarios por id_usuario
CREATE OR REPLACE VIEW v_movimientos_credito_detalle AS
SELECT mc.id_movimiento, mc.id_usuario, u.nombre, u.apellido, mc.id_reserva,
       mc.tipo, mc.cantidad, mc.saldo_anterior, mc.saldo_posterior,
       mc.retenidos_anterior, mc.retenidos_posterior,
       mc.descripcion, mc.created_at
FROM movimientos_credito mc
JOIN v_usuarios_desencriptados u ON mc.id_usuario = u.id_usuario;

-- [ADAPTADO] En v0.31+ no hay transferencias_credito: una reserva completada
-- ES la transferencia (el alumno paga, el tutor cobra). Se conservan los
-- nombres de columna; id_transferencia = id_reserva.
CREATE OR REPLACE VIEW v_transferencias_detalle AS
SELECT r.id_reserva AS id_transferencia, r.id_reserva,
       r.id_solicitante AS id_emisor,  ue.nombre AS nombre_emisor,   ue.apellido AS apellido_emisor,
       r.id_ofertante   AS id_receptor, ur.nombre AS nombre_receptor, ur.apellido AS apellido_receptor,
       r.creditos AS cantidad, r.estado, r.completed_at AS fecha_transferencia,
       'Clase completada'::text AS motivo
FROM reservas r
JOIN v_usuarios_desencriptados ue ON r.id_solicitante = ue.id_usuario
JOIN v_usuarios_desencriptados ur ON r.id_ofertante   = ur.id_usuario
WHERE r.estado = 'completada';

-- [ADAPTADO] saldo desde usuarios
CREATE OR REPLACE VIEW v_ranking_creditos AS
SELECT u.id_usuario, u.nombre, u.apellido, c.nombre AS carrera,
       u.saldo, u.creditos_retenidos,
       u.saldo - u.creditos_retenidos AS creditos_disponibles,
       RANK() OVER (ORDER BY u.saldo DESC) AS posicion_ranking
FROM v_usuarios_desencriptados u
LEFT JOIN carreras c ON u.id_carrera = c.id_carrera
WHERE u.estado = 'activo';

-- 7) CALIFICACIONES
CREATE OR REPLACE VIEW v_calificaciones_detalle AS
SELECT c.id_calificacion, c.id_reserva,
       c.id_evaluador, ue.nombre AS nombre_evaluador, ue.apellido AS apellido_evaluador,
       c.id_evaluado,  uo.nombre AS nombre_evaluado,  uo.apellido AS apellido_evaluado,
       c.puntuacion, c.comentario, c.created_at
FROM v_calificaciones_desencriptadas c
JOIN v_usuarios_desencriptados ue ON c.id_evaluador = ue.id_usuario
JOIN v_usuarios_desencriptados uo ON c.id_evaluado  = uo.id_usuario;

CREATE OR REPLACE VIEW v_reputacion_usuarios AS
WITH recibidas AS (
  SELECT id_evaluado AS id_usuario, AVG(puntuacion) AS promedio, COUNT(*) AS total
  FROM calificaciones GROUP BY id_evaluado
), dadas AS (
  SELECT id_evaluador AS id_usuario, COUNT(*) AS total
  FROM calificaciones GROUP BY id_evaluador
)
SELECT u.id_usuario, u.nombre, u.apellido,
       COALESCE(r.promedio, 0) AS promedio_puntuacion,
       COALESCE(r.total, 0)    AS total_calificaciones_recibidas,
       COALESCE(d.total, 0)    AS total_calificaciones_dadas,
       COALESCE(r.total, 0) + COALESCE(d.total, 0) AS total_interacciones
FROM v_usuarios_desencriptados u
LEFT JOIN recibidas r ON r.id_usuario = u.id_usuario
LEFT JOIN dadas     d ON d.id_usuario = u.id_usuario
WHERE u.estado = 'activo';

CREATE OR REPLACE FUNCTION fn_calificaciones_recibidas(p_usuario uuid)
RETURNS TABLE (
  id_calificacion uuid, id_reserva uuid, id_evaluador uuid,
  nombre_evaluador text, apellido_evaluador text,
  id_evaluado uuid, nombre_evaluado text, apellido_evaluado text,
  puntuacion int, comentario text, created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id_calificacion, c.id_reserva, c.id_evaluador,
         ue.nombre, ue.apellido, c.id_evaluado, uo.nombre, uo.apellido,
         c.puntuacion, c.comentario, c.created_at
  FROM v_calificaciones_desencriptadas c
  JOIN v_usuarios_desencriptados ue ON c.id_evaluador = ue.id_usuario
  JOIN v_usuarios_desencriptados uo ON c.id_evaluado  = uo.id_usuario
  WHERE c.id_evaluado = p_usuario
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- 8) NOTIFICACIONES
CREATE OR REPLACE VIEW v_notificaciones_usuario AS
SELECT n.id_notificacion, n.id_usuario, u.nombre, u.apellido,
       n.tipo, n.titulo, n.mensaje, n.leida, n.created_at
FROM v_notificaciones_desencriptadas n
JOIN v_usuarios_desencriptados u ON n.id_usuario = u.id_usuario;

CREATE OR REPLACE VIEW v_notificaciones_no_leidas AS
SELECT n.id_notificacion, n.id_usuario, u.nombre, u.apellido,
       n.tipo, n.titulo, n.mensaje, n.created_at
FROM v_notificaciones_desencriptadas n
JOIN v_usuarios_desencriptados u ON n.id_usuario = u.id_usuario
WHERE n.leida = false;

CREATE OR REPLACE VIEW v_notificaciones_por_tipo AS
SELECT n.tipo,
       COUNT(*) AS total_notificaciones,
       COUNT(*) FILTER (WHERE n.leida = false) AS no_leidas,
       COUNT(*) FILTER (WHERE n.leida = true)  AS leidas
FROM notificaciones n
GROUP BY n.tipo;

-- 9) AUDITORÍA
CREATE OR REPLACE VIEW v_auditoria_detalle AS
SELECT a.id_auditoria, a.id_usuario, u.nombre, u.apellido,
       a.accion, a.entidad, a.entidad_id,
       a.datos_anteriores, a.datos_nuevos, a.ip, a.created_at
FROM v_auditoria_desencriptada a
LEFT JOIN v_usuarios_desencriptados u ON a.id_usuario = u.id_usuario;

CREATE OR REPLACE VIEW v_auditoria_por_accion AS
SELECT a.accion, COUNT(*) AS total_eventos,
       COUNT(*) FILTER (WHERE a.created_at > now() - INTERVAL '7 days')  AS eventos_ultima_semana,
       COUNT(*) FILTER (WHERE a.created_at > now() - INTERVAL '30 days') AS eventos_ultimo_mes
FROM auditoria a
GROUP BY a.accion;

CREATE OR REPLACE VIEW v_auditoria_por_usuario AS
SELECT a.id_usuario, u.nombre, u.apellido,
       COUNT(*) AS total_acciones, MAX(a.created_at) AS ultima_accion
FROM auditoria a
JOIN v_usuarios_desencriptados u ON a.id_usuario = u.id_usuario
GROUP BY a.id_usuario, u.nombre, u.apellido;

-- 10) DASHBOARD
CREATE OR REPLACE VIEW v_estadisticas_generales AS
SELECT
  (SELECT COUNT(*) FROM usuarios WHERE estado = 'activo')                      AS total_usuarios_activos,
  (SELECT COUNT(*) FROM habilidades WHERE estado = 'activo')                   AS total_habilidades_activas,
  (SELECT COUNT(*) FROM solicitudes_intercambio WHERE estado IN ('pendiente', 'solicitada')) AS solicitudes_pendientes,  -- [ADAPTADO]
  (SELECT COUNT(*) FROM reservas WHERE estado IN ('pendiente', 'confirmada'))   AS reservas_activas,  -- [ADAPTADO]
  (SELECT COUNT(*) FROM reservas WHERE estado = 'completada')                  AS reservas_completadas,
  (SELECT COUNT(*) FROM reservas WHERE created_at > now() - INTERVAL '7 days') AS reservas_ultima_semana,
  (SELECT SUM(saldo) FROM usuarios)                                            AS total_creditos_en_sistema;  -- [ADAPTADO]

CREATE OR REPLACE VIEW v_actividad_mensual AS
SELECT DATE_TRUNC('month', a.created_at) AS mes,
       COUNT(*) FILTER (WHERE lower(a.entidad) = 'solicitudes_intercambio') AS nuevas_solicitudes,
       COUNT(*) FILTER (WHERE lower(a.entidad) = 'reservas')                AS nuevas_reservas,
       COUNT(*) FILTER (WHERE lower(a.entidad) = 'usuarios'
                          AND upper(a.accion) = 'INSERT')                   AS nuevos_usuarios
FROM auditoria a
WHERE a.created_at > now() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', a.created_at);

CREATE OR REPLACE VIEW v_habilidades_mas_solicitadas AS
SELECT h.id_habilidad, h.nombre AS nombre_habilidad, cat.nombre AS categoria,
       COUNT(DISTINCT s.id_solicitud) AS total_solicitudes,
       COUNT(DISTINCT s.id_solicitud) FILTER (WHERE s.estado = 'aceptada') AS solicitudes_aceptadas
FROM habilidades h
LEFT JOIN solicitudes_intercambio s ON h.id_habilidad = s.id_habilidad
JOIN categorias cat ON h.id_categoria = cat.id_categoria
GROUP BY h.id_habilidad, h.nombre, cat.nombre
HAVING COUNT(DISTINCT s.id_solicitud) > 0;

CREATE OR REPLACE VIEW v_usuarios_mas_activos AS
SELECT u.id_usuario, u.nombre, u.apellido, c.nombre AS carrera,
       COUNT(DISTINCT r.id_reserva) AS total_reservas,
       COUNT(DISTINCT r.id_reserva) FILTER (WHERE r.id_solicitante = u.id_usuario) AS como_solicitante,
       COUNT(DISTINCT r.id_reserva) FILTER (WHERE r.id_ofertante   = u.id_usuario) AS como_ofertante
FROM v_usuarios_desencriptados u
LEFT JOIN reservas r ON u.id_usuario = r.id_solicitante OR u.id_usuario = r.id_ofertante
LEFT JOIN carreras c ON u.id_carrera = c.id_carrera
WHERE u.estado = 'activo'
GROUP BY u.id_usuario, u.nombre, u.apellido, c.nombre
HAVING COUNT(DISTINCT r.id_reserva) > 0;

CREATE OR REPLACE VIEW v_reservas_por_categoria AS
SELECT cat.nombre AS categoria,
       COUNT(DISTINCT r.id_reserva) AS total_reservas,
       COUNT(DISTINCT r.id_reserva) FILTER (WHERE r.estado = 'completada') AS reservas_completadas,
       ROUND(100.0 * COUNT(DISTINCT r.id_reserva) FILTER (WHERE r.estado = 'completada')
             / NULLIF(COUNT(DISTINCT r.id_reserva), 0), 2) AS tasa_completacion
FROM categorias cat
LEFT JOIN habilidades h ON cat.id_categoria = h.id_categoria
LEFT JOIN reservas r    ON h.id_habilidad   = r.id_habilidad
GROUP BY cat.nombre;

COMMIT;