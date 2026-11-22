CREATE VIEW v_usuarios_completo AS
SELECT u.id_usuario, u.nombre, u.apellido, u.correo,
       u.id_carrera, c.nombre AS nombre_carrera, c.facultad,
       u.semestre, u.fecha_registro, u.ultimo_acceso, u.estado
FROM "USUARIOS" u
LEFT JOIN "CARRERAS" c ON u.id_carrera = c.id_carrera;

CREATE VIEW v_usuarios_roles AS
SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.estado, u.rol
FROM "USUARIOS" u;

CREATE VIEW v_usuarios_activos AS
SELECT u.id_usuario, u.nombre, u.apellido, u.correo,
       c.nombre AS carrera, c.facultad, u.semestre,
       u.fecha_registro, u.ultimo_acceso
FROM "USUARIOS" u
LEFT JOIN "CARRERAS" c ON u.id_carrera = c.id_carrera
WHERE u.estado = 'Activo';

CREATE VIEW v_usuarios_por_facultad AS
SELECT c.facultad, c.nombre AS carrera,
       COUNT(u.id_usuario) AS total_usuarios,
       COUNT(u.id_usuario) FILTER (WHERE u.estado = 'Activo') AS usuarios_activos
FROM "CARRERAS" c
LEFT JOIN "USUARIOS" u ON c.id_carrera = u.id_carrera
GROUP BY c.facultad, c.nombre;

CREATE VIEW v_habilidades_categoria AS
SELECT h.id_habilidad, h.nombre AS nombre_habilidad, cat.nombre AS categoria, h.estado
FROM "HABILIDADES" h
JOIN "CATEGORIAS" cat ON h.id_categoria = cat.id_categoria;

CREATE VIEW v_usuario_habilidades_detalle AS
SELECT u.id_usuario, u.nombre, u.apellido, h.id_habilidad,
       h.nombre AS nombre_habilidad, cat.nombre AS categoria,
       uh.nivel, h.estado AS estado_habilidad
FROM "USUARIOS" u
JOIN "USUARIO_HABILIDADES" uh ON u.id_usuario = uh.id_usuario
JOIN "HABILIDADES" h ON uh.id_habilidad = h.id_habilidad
JOIN "CATEGORIAS" cat ON h.id_categoria = cat.id_categoria
WHERE h.estado = 'activo';

CREATE VIEW v_ofertantes_por_habilidad AS
SELECT h.id_habilidad, h.nombre AS nombre_habilidad, cat.nombre AS categoria,
       COUNT(*) AS total_ofertantes,
       COUNT(*) FILTER (WHERE u.estado = 'Activo') AS ofertantes_activos
FROM "HABILIDADES" h
JOIN "USUARIO_HABILIDADES" uh ON h.id_habilidad = uh.id_habilidad
JOIN "USUARIOS" u ON uh.id_usuario = u.id_usuario
JOIN "CATEGORIAS" cat ON h.id_categoria = cat.id_categoria
WHERE h.estado = 'activo'
GROUP BY h.id_habilidad, h.nombre, cat.nombre;

CREATE VIEW v_habilidades_populares AS
SELECT * FROM v_ofertantes_por_habilidad
ORDER BY total_ofertantes DESC
LIMIT 20;

CREATE VIEW v_disponibilidades_usuario AS
SELECT d.id_disponibilidad, u.id_usuario, u.nombre, u.apellido,
       d.fecha_inicio, d.fecha_fin, d.estado
FROM "DISPONIBILIDADES" d
JOIN "USUARIOS" u ON d.id_usuario = u.id_usuario
WHERE d.estado = 'disponible' AND d.fecha_inicio > now();

CREATE VIEW v_disponibilidades_futuras AS
SELECT d.id_disponibilidad, u.id_usuario, u.nombre, u.apellido,
       d.fecha_inicio, d.fecha_fin,
       EXTRACT(EPOCH FROM (d.fecha_fin - d.fecha_inicio)) / 3600 AS horas_disponibles,
       d.estado
FROM "DISPONIBILIDADES" d
JOIN "USUARIOS" u ON d.id_usuario = u.id_usuario
WHERE d.fecha_inicio > now() AND d.estado = 'disponible';

CREATE VIEW v_solicitudes_detalle AS
SELECT s.id_solicitud, s.id_solicitante,
       us.nombre AS nombre_solicitante, us.apellido AS apellido_solicitante,
       s.id_ofertante,
       uo.nombre AS nombre_ofertante, uo.apellido AS apellido_ofertante,
       s.id_habilidad, h.nombre AS nombre_habilidad, cat.nombre AS categoria,
       s.fecha_inicio_propuesta, s.fecha_fin_propuesta,
       s.creditos_requeridos, s.estado, s.created_at, s.respondida_at
FROM "SOLICITUDES_INTERCAMBIO" s
JOIN "USUARIOS" us ON s.id_solicitante = us.id_usuario
JOIN "USUARIOS" uo ON s.id_ofertante = uo.id_usuario
JOIN "HABILIDADES" h ON s.id_habilidad = h.id_habilidad
JOIN "CATEGORIAS" cat ON h.id_categoria = cat.id_categoria;

CREATE VIEW v_solicitudes_pendientes AS
SELECT s.id_solicitud, s.id_solicitante,
       us.nombre AS nombre_solicitante,
       s.id_ofertante, uo.nombre AS nombre_ofertante,
       h.nombre AS nombre_habilidad,
       s.fecha_inicio_propuesta, s.fecha_fin_propuesta,
       s.creditos_requeridos, s.created_at
FROM "SOLICITUDES_INTERCAMBIO" s
JOIN "USUARIOS" us ON s.id_solicitante = us.id_usuario
JOIN "USUARIOS" uo ON s.id_ofertante = uo.id_usuario
JOIN "HABILIDADES" h ON s.id_habilidad = h.id_habilidad
WHERE s.estado = 'Solicitada';

CREATE FUNCTION fn_solicitudes_recibidas(p_usuario uuid)
RETURNS TABLE (
  id_solicitud uuid, id_solicitante uuid,
  nombre_solicitante text, apellido_solicitante text, id_ofertante uuid,
  nombre_habilidad text, fecha_inicio_propuesta timestamptz,
  fecha_fin_propuesta timestamptz, creditos_requeridos int,
  estado varchar, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT s.id_solicitud, s.id_solicitante,
         us.nombre::text, us.apellido::text, s.id_ofertante, h.nombre::text,
         s.fecha_inicio_propuesta, s.fecha_fin_propuesta,
         s.creditos_requeridos, s.estado, s.created_at
  FROM "SOLICITUDES_INTERCAMBIO" s
  JOIN "USUARIOS" us ON s.id_solicitante = us.id_usuario
  JOIN "HABILIDADES" h ON s.id_habilidad = h.id_habilidad
  WHERE s.id_ofertante = p_usuario AND s.estado = 'Solicitada'
  ORDER BY s.created_at DESC;
$$;

CREATE FUNCTION fn_solicitudes_enviadas(p_usuario uuid)
RETURNS TABLE (
  id_solicitud uuid, id_solicitante uuid, id_ofertante uuid,
  nombre_ofertante text, apellido_ofertante text, nombre_habilidad text,
  fecha_inicio_propuesta timestamptz, fecha_fin_propuesta timestamptz,
  creditos_requeridos int, estado varchar, created_at timestamptz,
  respondida_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT s.id_solicitud, s.id_solicitante, s.id_ofertante,
         uo.nombre::text, uo.apellido::text, h.nombre::text,
         s.fecha_inicio_propuesta, s.fecha_fin_propuesta,
         s.creditos_requeridos, s.estado, s.created_at, s.respondida_at
  FROM "SOLICITUDES_INTERCAMBIO" s
  JOIN "USUARIOS" uo ON s.id_ofertante = uo.id_usuario
  JOIN "HABILIDADES" h ON s.id_habilidad = h.id_habilidad
  WHERE s.id_solicitante = p_usuario
  ORDER BY s.created_at DESC;
$$;

CREATE VIEW v_reservas_detalle AS
SELECT r.id_reserva, r.id_solicitud,
       r.id_solicitante, us.nombre AS nombre_solicitante, us.apellido AS apellido_solicitante,
       r.id_ofertante, uo.nombre AS nombre_ofertante, uo.apellido AS apellido_ofertante,
       r.id_habilidad, h.nombre AS nombre_habilidad, cat.nombre AS categoria,
       r.fecha_inicio, r.fecha_fin, r.creditos, r.modalidad, r.lugar, r.estado,
       r.created_at, r.completed_at, r.cancelled_at
FROM "RESERVAS" r
JOIN "USUARIOS" us ON r.id_solicitante = us.id_usuario
JOIN "USUARIOS" uo ON r.id_ofertante = uo.id_usuario
JOIN "HABILIDADES" h ON r.id_habilidad = h.id_habilidad
JOIN "CATEGORIAS" cat ON h.id_categoria = cat.id_categoria;

CREATE VIEW v_reservas_activas AS
SELECT r.id_reserva, r.id_solicitante, us.nombre AS nombre_solicitante,
       r.id_ofertante, uo.nombre AS nombre_ofertante, h.nombre AS nombre_habilidad,
       r.fecha_inicio, r.fecha_fin, r.modalidad, r.lugar, r.estado
FROM "RESERVAS" r
JOIN "USUARIOS" us ON r.id_solicitante = us.id_usuario
JOIN "USUARIOS" uo ON r.id_ofertante = uo.id_usuario
JOIN "HABILIDADES" h ON r.id_habilidad = h.id_habilidad
WHERE r.estado = 'Confirmada' AND r.fecha_inicio > now();

CREATE FUNCTION fn_reservas_usuario(p_usuario uuid)
RETURNS TABLE (
  id_reserva uuid, rol_usuario text,
  id_solicitante uuid, nombre_solicitante text,
  id_ofertante uuid, nombre_ofertante text,
  nombre_habilidad text, fecha_inicio timestamptz, fecha_fin timestamptz,
  creditos int, modalidad varchar, lugar varchar,
  estado varchar, created_at timestamptz, completed_at timestamptz, cancelled_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT r.id_reserva,
         CASE WHEN r.id_solicitante = p_usuario THEN 'solicitante' ELSE 'ofertante' END,
         r.id_solicitante, us.nombre::text,
         r.id_ofertante, uo.nombre::text,
         h.nombre::text, r.fecha_inicio, r.fecha_fin, r.creditos,
         r.modalidad, r.lugar, r.estado,
         r.created_at, r.completed_at, r.cancelled_at
  FROM "RESERVAS" r
  JOIN "USUARIOS" us ON r.id_solicitante = us.id_usuario
  JOIN "USUARIOS" uo ON r.id_ofertante = uo.id_usuario
  JOIN "HABILIDADES" h ON r.id_habilidad = h.id_habilidad
  WHERE r.id_solicitante = p_usuario OR r.id_ofertante = p_usuario
  ORDER BY r.fecha_inicio DESC;
$$;

CREATE VIEW v_reservas_completadas AS
SELECT r.id_reserva, r.id_solicitante, us.nombre AS nombre_solicitante,
       r.id_ofertante, uo.nombre AS nombre_ofertante, h.nombre AS nombre_habilidad,
       r.fecha_inicio, r.fecha_fin, r.creditos, r.modalidad, r.completed_at
FROM "RESERVAS" r
JOIN "USUARIOS" us ON r.id_solicitante = us.id_usuario
JOIN "USUARIOS" uo ON r.id_ofertante = uo.id_usuario
JOIN "HABILIDADES" h ON r.id_habilidad = h.id_habilidad
WHERE r.estado = 'Completada';

CREATE VIEW v_cuentas_credito_usuario AS
SELECT u.id_usuario, u.nombre, u.apellido, u.correo,
       u.saldo, u.creditos_retenidos,
       u.saldo - u.creditos_retenidos AS creditos_disponibles
FROM "USUARIOS" u;

CREATE VIEW v_movimientos_credito_detalle AS
SELECT mc.id_movimiento, mc.id_usuario, u.nombre, u.apellido, mc.id_reserva,
       mc.tipo, mc.cantidad, mc.saldo_anterior, mc.saldo_posterior,
       mc.retenidos_anterior, mc.retenidos_posterior,
       mc.descripcion, mc.created_at
FROM "MOVIMIENTOS_CREDITO" mc
JOIN "USUARIOS" u ON mc.id_usuario = u.id_usuario;

CREATE VIEW v_transferencias_detalle AS
SELECT r.id_reserva AS id_transferencia, r.id_reserva,
       r.id_solicitante AS id_emisor, ue.nombre AS nombre_emisor, ue.apellido AS apellido_emisor,
       r.id_ofertante AS id_receptor, ur.nombre AS nombre_receptor, ur.apellido AS apellido_receptor,
       r.creditos AS cantidad, r.estado, r.completed_at AS fecha_transferencia,
       'Clase completada'::text AS motivo
FROM "RESERVAS" r
JOIN "USUARIOS" ue ON r.id_solicitante = ue.id_usuario
JOIN "USUARIOS" ur ON r.id_ofertante = ur.id_usuario
WHERE r.estado = 'Completada';

CREATE VIEW v_ranking_creditos AS
SELECT u.id_usuario, u.nombre, u.apellido, c.nombre AS carrera,
       u.saldo, u.creditos_retenidos,
       u.saldo - u.creditos_retenidos AS creditos_disponibles,
       RANK() OVER (ORDER BY u.saldo DESC) AS posicion_ranking
FROM "USUARIOS" u
LEFT JOIN "CARRERAS" c ON u.id_carrera = c.id_carrera
WHERE u.estado = 'Activo' AND u.rol = 'Estudiante';

CREATE VIEW v_calificaciones_detalle AS
SELECT c.id_calificacion, c.id_reserva,
       c.id_evaluador, ue.nombre AS nombre_evaluador, ue.apellido AS apellido_evaluador,
       c.id_evaluado, uo.nombre AS nombre_evaluado, uo.apellido AS apellido_evaluado,
       c.puntuacion, c.comentario, c.created_at
FROM "CALIFICACIONES" c
JOIN "USUARIOS" ue ON c.id_evaluador = ue.id_usuario
JOIN "USUARIOS" uo ON c.id_evaluado = uo.id_usuario;

CREATE VIEW v_reputacion_usuarios AS
WITH recibidas AS (
  SELECT id_evaluado AS id_usuario, AVG(puntuacion) AS promedio, COUNT(*) AS total
  FROM "CALIFICACIONES" GROUP BY id_evaluado
), dadas AS (
  SELECT id_evaluador AS id_usuario, COUNT(*) AS total
  FROM "CALIFICACIONES" GROUP BY id_evaluador
)
SELECT u.id_usuario, u.nombre, u.apellido,
       COALESCE(r.promedio, 0) AS promedio_puntuacion,
       COALESCE(r.total, 0) AS total_calificaciones_recibidas,
       COALESCE(d.total, 0) AS total_calificaciones_dadas,
       COALESCE(r.total, 0) + COALESCE(d.total, 0) AS total_interacciones
FROM "USUARIOS" u
LEFT JOIN recibidas r ON r.id_usuario = u.id_usuario
LEFT JOIN dadas d ON d.id_usuario = u.id_usuario
WHERE u.estado = 'Activo';

CREATE FUNCTION fn_calificaciones_recibidas(p_usuario uuid)
RETURNS TABLE (
  id_calificacion uuid, id_reserva uuid, id_evaluador uuid,
  nombre_evaluador text, apellido_evaluador text,
  id_evaluado uuid, nombre_evaluado text, apellido_evaluado text,
  puntuacion int, comentario text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT c.id_calificacion, c.id_reserva, c.id_evaluador,
         ue.nombre::text, ue.apellido::text, c.id_evaluado, uo.nombre::text, uo.apellido::text,
         c.puntuacion, c.comentario::text, c.created_at
  FROM "CALIFICACIONES" c
  JOIN "USUARIOS" ue ON c.id_evaluador = ue.id_usuario
  JOIN "USUARIOS" uo ON c.id_evaluado = uo.id_usuario
  WHERE c.id_evaluado = p_usuario
  ORDER BY c.created_at DESC;
$$;

CREATE VIEW v_notificaciones_usuario AS
SELECT n.id_notificacion, n.id_usuario, u.nombre, u.apellido,
       n.tipo, n.titulo, n.mensaje, n.leida, n.created_at
FROM "NOTIFICACIONES" n
JOIN "USUARIOS" u ON n.id_usuario = u.id_usuario;

CREATE VIEW v_notificaciones_no_leidas AS
SELECT n.id_notificacion, n.id_usuario, u.nombre, u.apellido,
       n.tipo, n.titulo, n.mensaje, n.created_at
FROM "NOTIFICACIONES" n
JOIN "USUARIOS" u ON n.id_usuario = u.id_usuario
WHERE n.leida = false;

CREATE VIEW v_notificaciones_por_tipo AS
SELECT n.tipo,
       COUNT(*) AS total_notificaciones,
       COUNT(*) FILTER (WHERE n.leida = false) AS no_leidas,
       COUNT(*) FILTER (WHERE n.leida = true) AS leidas
FROM "NOTIFICACIONES" n
GROUP BY n.tipo;

CREATE VIEW v_auditoria_detalle AS
SELECT a.id_auditoria, a.id_usuario, u.nombre, u.apellido,
       a.accion, a.entidad, a.entidad_id,
       a.datos_anteriores, a.datos_nuevos, a.ip, a.created_at
FROM "AUDITORIA" a
LEFT JOIN "USUARIOS" u ON a.id_usuario = u.id_usuario;

CREATE VIEW v_auditoria_por_accion AS
SELECT a.accion, COUNT(*) AS total_eventos,
       COUNT(*) FILTER (WHERE a.created_at > now() - INTERVAL '7 days') AS eventos_ultima_semana,
       COUNT(*) FILTER (WHERE a.created_at > now() - INTERVAL '30 days') AS eventos_ultimo_mes
FROM "AUDITORIA" a
GROUP BY a.accion;

CREATE VIEW v_auditoria_por_usuario AS
SELECT a.id_usuario, u.nombre, u.apellido,
       COUNT(*) AS total_acciones, MAX(a.created_at) AS ultima_accion
FROM "AUDITORIA" a
JOIN "USUARIOS" u ON a.id_usuario = u.id_usuario
GROUP BY a.id_usuario, u.nombre, u.apellido;

CREATE VIEW v_estadisticas_generales AS
SELECT
  (SELECT COUNT(*) FROM "USUARIOS" WHERE estado = 'Activo') AS total_usuarios_activos,
  (SELECT COUNT(*) FROM "HABILIDADES" WHERE estado = 'activo') AS total_habilidades_activas,
  (SELECT COUNT(*) FROM "SOLICITUDES_INTERCAMBIO" WHERE estado = 'Solicitada') AS solicitudes_pendientes,
  (SELECT COUNT(*) FROM "RESERVAS" WHERE estado = 'Confirmada') AS reservas_activas,
  (SELECT COUNT(*) FROM "RESERVAS" WHERE estado = 'Completada') AS reservas_completadas,
  (SELECT COUNT(*) FROM "RESERVAS" WHERE created_at > now() - INTERVAL '7 days') AS reservas_ultima_semana,
  (SELECT COALESCE(SUM(saldo), 0) FROM "USUARIOS") AS total_creditos_en_sistema;

CREATE VIEW v_actividad_mensual AS
WITH eventos AS (
  SELECT DATE_TRUNC('month', created_at) AS mes, 1 AS solicitud, 0 AS reserva, 0 AS usuario
  FROM "SOLICITUDES_INTERCAMBIO"
  UNION ALL
  SELECT DATE_TRUNC('month', created_at), 0, 1, 0 FROM "RESERVAS"
  UNION ALL
  SELECT DATE_TRUNC('month', fecha_registro), 0, 0, 1 FROM "USUARIOS"
)
SELECT mes,
       SUM(solicitud) AS nuevas_solicitudes,
       SUM(reserva) AS nuevas_reservas,
       SUM(usuario) AS nuevos_usuarios
FROM eventos
WHERE mes > now() - INTERVAL '12 months'
GROUP BY mes;

CREATE VIEW v_habilidades_mas_solicitadas AS
SELECT h.id_habilidad, h.nombre AS nombre_habilidad, cat.nombre AS categoria,
       COUNT(DISTINCT s.id_solicitud) AS total_solicitudes,
       COUNT(DISTINCT s.id_solicitud) FILTER (WHERE s.estado = 'Aceptada') AS solicitudes_aceptadas
FROM "HABILIDADES" h
LEFT JOIN "SOLICITUDES_INTERCAMBIO" s ON h.id_habilidad = s.id_habilidad
JOIN "CATEGORIAS" cat ON h.id_categoria = cat.id_categoria
GROUP BY h.id_habilidad, h.nombre, cat.nombre
HAVING COUNT(DISTINCT s.id_solicitud) > 0;

CREATE VIEW v_usuarios_mas_activos AS
SELECT u.id_usuario, u.nombre, u.apellido, c.nombre AS carrera,
       COUNT(DISTINCT r.id_reserva) AS total_reservas,
       COUNT(DISTINCT r.id_reserva) FILTER (WHERE r.id_solicitante = u.id_usuario) AS como_solicitante,
       COUNT(DISTINCT r.id_reserva) FILTER (WHERE r.id_ofertante = u.id_usuario) AS como_ofertante
FROM "USUARIOS" u
LEFT JOIN "RESERVAS" r ON u.id_usuario = r.id_solicitante OR u.id_usuario = r.id_ofertante
LEFT JOIN "CARRERAS" c ON u.id_carrera = c.id_carrera
WHERE u.estado = 'Activo'
GROUP BY u.id_usuario, u.nombre, u.apellido, c.nombre
HAVING COUNT(DISTINCT r.id_reserva) > 0;

CREATE VIEW v_reservas_por_categoria AS
SELECT cat.nombre AS categoria,
       COUNT(DISTINCT r.id_reserva) AS total_reservas,
       COUNT(DISTINCT r.id_reserva) FILTER (WHERE r.estado = 'Completada') AS reservas_completadas,
       ROUND(100.0 * COUNT(DISTINCT r.id_reserva) FILTER (WHERE r.estado = 'Completada')
             / NULLIF(COUNT(DISTINCT r.id_reserva), 0), 2) AS tasa_completacion
FROM "CATEGORIAS" cat
LEFT JOIN "HABILIDADES" h ON cat.id_categoria = h.id_categoria
LEFT JOIN "RESERVAS" r ON h.id_habilidad = r.id_habilidad
GROUP BY cat.nombre;
