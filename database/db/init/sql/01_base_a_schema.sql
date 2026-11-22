-- ============================================================
-- Setup local completo — SkillSwap / U.C.B.
-- Compatible con PostgreSQL 14, 15 y 16
-- Ejecutar:  psql -U skillswap -d skillswap -v ON_ERROR_STOP=1 -f 00000000000000_local_setup.sql
-- ============================================================

-- Extensión por si el seed usa gen_random_uuid() desde SQL (opcional, idempotente).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1) ESQUEMA BASE  (equivale a 20261022000000_optimized_12)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "CARRERAS" (
    "id_carrera" UUID NOT NULL,
    "nombre"     VARCHAR NOT NULL,
    "facultad"   VARCHAR NOT NULL,
    "estado"     VARCHAR NOT NULL,
    CONSTRAINT "CARRERAS_pkey" PRIMARY KEY ("id_carrera")
);

CREATE TABLE "CATEGORIAS" (
    "id_categoria" UUID NOT NULL,
    "nombre"       VARCHAR NOT NULL,
    "estado"       VARCHAR NOT NULL,
    CONSTRAINT "CATEGORIAS_pkey" PRIMARY KEY ("id_categoria")
);

CREATE TABLE "USUARIOS" (
    "id_usuario"         UUID NOT NULL,
    "nombre"             VARCHAR NOT NULL,
    "apellido"           VARCHAR NOT NULL,
    "correo"             VARCHAR NOT NULL,
    "password_hash"      VARCHAR NOT NULL,
    "rol"                VARCHAR NOT NULL,
    "id_carrera"         UUID,
    "semestre"           INTEGER,
    "saldo"              INTEGER NOT NULL DEFAULT 0,
    "creditos_retenidos" INTEGER NOT NULL DEFAULT 0,
    "fecha_registro"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_acceso"      TIMESTAMPTZ(6),
    "estado"             VARCHAR NOT NULL,
    CONSTRAINT "USUARIOS_pkey" PRIMARY KEY ("id_usuario")
);

CREATE TABLE "HABILIDADES" (
    "id_habilidad" UUID NOT NULL,
    "nombre"       VARCHAR NOT NULL,
    "id_categoria" UUID NOT NULL,
    "estado"       VARCHAR NOT NULL,
    CONSTRAINT "HABILIDADES_pkey" PRIMARY KEY ("id_habilidad")
);

CREATE TABLE "USUARIO_HABILIDADES" (
    "id_usuario"   UUID NOT NULL,
    "id_habilidad" UUID NOT NULL,
    "nivel"        VARCHAR NOT NULL,
    CONSTRAINT "USUARIO_HABILIDADES_pkey" PRIMARY KEY ("id_usuario","id_habilidad")
);

CREATE TABLE "DISPONIBILIDADES" (
    "id_disponibilidad" UUID NOT NULL,
    "id_usuario"        UUID NOT NULL,
    "fecha_inicio"      TIMESTAMPTZ(6) NOT NULL,
    "fecha_fin"         TIMESTAMPTZ(6) NOT NULL,
    "estado"            VARCHAR NOT NULL,
    CONSTRAINT "DISPONIBILIDADES_pkey" PRIMARY KEY ("id_disponibilidad")
);

CREATE TABLE "SOLICITUDES_INTERCAMBIO" (
    "id_solicitud"             UUID NOT NULL,
    "id_solicitante"           UUID NOT NULL,
    "id_ofertante"             UUID NOT NULL,
    "id_habilidad"             UUID NOT NULL,
    "fecha_inicio_propuesta"   TIMESTAMPTZ(6) NOT NULL,
    "fecha_fin_propuesta"      TIMESTAMPTZ(6) NOT NULL,
    "creditos_requeridos"      INTEGER NOT NULL,
    "estado"                   VARCHAR NOT NULL,
    "created_at"               TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondida_at"            TIMESTAMPTZ(6),
    CONSTRAINT "SOLICITUDES_INTERCAMBIO_pkey" PRIMARY KEY ("id_solicitud")
);

CREATE TABLE "RESERVAS" (
    "id_reserva"                     UUID NOT NULL,
    "id_solicitud"                   UUID,
    "id_solicitante"                 UUID NOT NULL,
    "id_ofertante"                   UUID NOT NULL,
    "id_habilidad"                   UUID NOT NULL,
    "fecha_inicio"                   TIMESTAMPTZ(6) NOT NULL,
    "fecha_fin"                      TIMESTAMPTZ(6) NOT NULL,
    "creditos"                       INTEGER NOT NULL,
    "modalidad"                      VARCHAR NOT NULL,
    "lugar"                          VARCHAR NOT NULL,
    "estado"                         VARCHAR NOT NULL,
    "confirmacion_solicitante_at"    TIMESTAMPTZ(6),
    "confirmacion_ofertante_at"      TIMESTAMPTZ(6),
    "cancelado_por"                  UUID,
    "motivo_cancelacion"             VARCHAR,
    "horas_anticipacion_cancelacion" INTEGER,
    "created_at"                     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at"                   TIMESTAMPTZ(6),
    "cancelled_at"                   TIMESTAMPTZ(6),
    CONSTRAINT "RESERVAS_pkey" PRIMARY KEY ("id_reserva")
);

CREATE TABLE "MOVIMIENTOS_CREDITO" (
    "id_movimiento"       UUID NOT NULL,
    "id_usuario"          UUID NOT NULL,
    "id_reserva"          UUID,
    "tipo"                VARCHAR NOT NULL,
    "cantidad"            INTEGER NOT NULL,
    "saldo_anterior"      INTEGER NOT NULL,
    "saldo_posterior"     INTEGER NOT NULL,
    "retenidos_anterior"  INTEGER NOT NULL,
    "retenidos_posterior" INTEGER NOT NULL,
    "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion"         VARCHAR,
    CONSTRAINT "MOVIMIENTOS_CREDITO_pkey" PRIMARY KEY ("id_movimiento")
);

CREATE TABLE "CALIFICACIONES" (
    "id_calificacion" UUID NOT NULL,
    "id_reserva"      UUID NOT NULL,
    "id_evaluador"    UUID NOT NULL,
    "id_evaluado"     UUID NOT NULL,
    "puntuacion"      INTEGER NOT NULL,
    "comentario"      VARCHAR,
    "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CALIFICACIONES_pkey" PRIMARY KEY ("id_calificacion")
);

CREATE TABLE "NOTIFICACIONES" (
    "id_notificacion" UUID NOT NULL,
    "id_usuario"      UUID NOT NULL,
    "tipo"            VARCHAR NOT NULL,
    "titulo"          VARCHAR NOT NULL,
    "mensaje"         TEXT NOT NULL,
    "leida"           BOOLEAN NOT NULL DEFAULT false,
    "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NOTIFICACIONES_pkey" PRIMARY KEY ("id_notificacion")
);

CREATE TABLE "AUDITORIA" (
    "id_auditoria"     UUID NOT NULL,
    "id_usuario"       UUID,
    "accion"           VARCHAR NOT NULL,
    "entidad"          VARCHAR NOT NULL,
    "entidad_id"       UUID NOT NULL,
    "datos_anteriores" JSONB,
    "datos_nuevos"     JSONB,
    "ip"               VARCHAR,
    "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AUDITORIA_pkey" PRIMARY KEY ("id_auditoria")
);

-- ---------- Índices ----------
CREATE INDEX "CARRERAS_estado_idx" ON "CARRERAS"("estado");

CREATE UNIQUE INDEX "CATEGORIAS_nombre_key" ON "CATEGORIAS"("nombre");
CREATE INDEX        "CATEGORIAS_estado_idx" ON "CATEGORIAS"("estado");

CREATE UNIQUE INDEX "USUARIOS_correo_key" ON "USUARIOS"("correo");
CREATE INDEX        "USUARIOS_id_carrera_idx" ON "USUARIOS"("id_carrera");
CREATE INDEX        "USUARIOS_estado_idx"     ON "USUARIOS"("estado");

CREATE UNIQUE INDEX "HABILIDADES_nombre_key" ON "HABILIDADES"("nombre");
CREATE INDEX        "HABILIDADES_id_categoria_estado_idx"
    ON "HABILIDADES"("id_categoria","estado");

CREATE INDEX "USUARIO_HABILIDADES_id_habilidad_idx"
    ON "USUARIO_HABILIDADES"("id_habilidad");

CREATE INDEX "DISPONIBILIDADES_id_usuario_estado_fecha_inicio_fecha_fin_idx"
    ON "DISPONIBILIDADES"("id_usuario","estado","fecha_inicio","fecha_fin");

CREATE INDEX "SOLICITUDES_INTERCAMBIO_id_solicitante_estado_created_at_idx"
    ON "SOLICITUDES_INTERCAMBIO"("id_solicitante","estado","created_at");
CREATE INDEX "SOLICITUDES_INTERCAMBIO_id_ofertante_estado_created_at_idx"
    ON "SOLICITUDES_INTERCAMBIO"("id_ofertante","estado","created_at");
CREATE INDEX "SOLICITUDES_INTERCAMBIO_id_habilidad_idx"
    ON "SOLICITUDES_INTERCAMBIO"("id_habilidad");

CREATE UNIQUE INDEX "RESERVAS_id_solicitud_key" ON "RESERVAS"("id_solicitud");
CREATE INDEX "RESERVAS_id_solicitante_estado_fecha_inicio_fecha_fin_idx"
    ON "RESERVAS"("id_solicitante","estado","fecha_inicio","fecha_fin");
CREATE INDEX "RESERVAS_id_ofertante_estado_fecha_inicio_fecha_fin_idx"
    ON "RESERVAS"("id_ofertante","estado","fecha_inicio","fecha_fin");
CREATE INDEX "RESERVAS_id_habilidad_idx"   ON "RESERVAS"("id_habilidad");
CREATE INDEX "RESERVAS_cancelado_por_idx"  ON "RESERVAS"("cancelado_por");

CREATE INDEX "MOVIMIENTOS_CREDITO_id_usuario_created_at_idx"
    ON "MOVIMIENTOS_CREDITO"("id_usuario","created_at");
CREATE INDEX "MOVIMIENTOS_CREDITO_id_reserva_idx"
    ON "MOVIMIENTOS_CREDITO"("id_reserva");

CREATE INDEX "CALIFICACIONES_id_evaluado_created_at_idx"
    ON "CALIFICACIONES"("id_evaluado","created_at");
CREATE UNIQUE INDEX "CALIFICACIONES_id_reserva_id_evaluador_key"
    ON "CALIFICACIONES"("id_reserva","id_evaluador");

CREATE INDEX "NOTIFICACIONES_id_usuario_leida_created_at_idx"
    ON "NOTIFICACIONES"("id_usuario","leida","created_at");

CREATE INDEX "AUDITORIA_id_usuario_created_at_idx"
    ON "AUDITORIA"("id_usuario","created_at");
CREATE INDEX "AUDITORIA_entidad_entidad_id_idx"
    ON "AUDITORIA"("entidad","entidad_id");

-- ---------- FKs ----------
ALTER TABLE "USUARIOS" ADD CONSTRAINT "USUARIOS_id_carrera_fkey"
  FOREIGN KEY ("id_carrera") REFERENCES "CARRERAS"("id_carrera") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HABILIDADES" ADD CONSTRAINT "HABILIDADES_id_categoria_fkey"
  FOREIGN KEY ("id_categoria") REFERENCES "CATEGORIAS"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "USUARIO_HABILIDADES" ADD CONSTRAINT "USUARIO_HABILIDADES_id_usuario_fkey"
  FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "USUARIO_HABILIDADES" ADD CONSTRAINT "USUARIO_HABILIDADES_id_habilidad_fkey"
  FOREIGN KEY ("id_habilidad") REFERENCES "HABILIDADES"("id_habilidad") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DISPONIBILIDADES" ADD CONSTRAINT "DISPONIBILIDADES_id_usuario_fkey"
  FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SOLICITUDES_INTERCAMBIO" ADD CONSTRAINT "SOLICITUDES_INTERCAMBIO_id_solicitante_fkey"
  FOREIGN KEY ("id_solicitante") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SOLICITUDES_INTERCAMBIO" ADD CONSTRAINT "SOLICITUDES_INTERCAMBIO_id_ofertante_fkey"
  FOREIGN KEY ("id_ofertante") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SOLICITUDES_INTERCAMBIO" ADD CONSTRAINT "SOLICITUDES_INTERCAMBIO_id_habilidad_fkey"
  FOREIGN KEY ("id_habilidad") REFERENCES "HABILIDADES"("id_habilidad") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RESERVAS" ADD CONSTRAINT "RESERVAS_id_solicitud_fkey"
  FOREIGN KEY ("id_solicitud") REFERENCES "SOLICITUDES_INTERCAMBIO"("id_solicitud") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RESERVAS" ADD CONSTRAINT "RESERVAS_id_solicitante_fkey"
  FOREIGN KEY ("id_solicitante") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RESERVAS" ADD CONSTRAINT "RESERVAS_id_ofertante_fkey"
  FOREIGN KEY ("id_ofertante") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RESERVAS" ADD CONSTRAINT "RESERVAS_cancelado_por_fkey"
  FOREIGN KEY ("cancelado_por") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RESERVAS" ADD CONSTRAINT "RESERVAS_id_habilidad_fkey"
  FOREIGN KEY ("id_habilidad") REFERENCES "HABILIDADES"("id_habilidad") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MOVIMIENTOS_CREDITO" ADD CONSTRAINT "MOVIMIENTOS_CREDITO_id_usuario_fkey"
  FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MOVIMIENTOS_CREDITO" ADD CONSTRAINT "MOVIMIENTOS_CREDITO_id_reserva_fkey"
  FOREIGN KEY ("id_reserva") REFERENCES "RESERVAS"("id_reserva") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CALIFICACIONES" ADD CONSTRAINT "CALIFICACIONES_id_reserva_fkey"
  FOREIGN KEY ("id_reserva") REFERENCES "RESERVAS"("id_reserva") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CALIFICACIONES" ADD CONSTRAINT "CALIFICACIONES_id_evaluador_fkey"
  FOREIGN KEY ("id_evaluador") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CALIFICACIONES" ADD CONSTRAINT "CALIFICACIONES_id_evaluado_fkey"
  FOREIGN KEY ("id_evaluado") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NOTIFICACIONES" ADD CONSTRAINT "NOTIFICACIONES_id_usuario_fkey"
  FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AUDITORIA" ADD CONSTRAINT "AUDITORIA_id_usuario_fkey"
  FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 2) INTEGRITY CHECKS  (equivale a 20261022000100_integrity_checks)
-- ============================================================
ALTER TABLE "USUARIOS"
  ADD CONSTRAINT "USUARIOS_creditos_validos"
    CHECK (saldo >= 0 AND creditos_retenidos >= 0 AND creditos_retenidos <= saldo),
  ADD CONSTRAINT "USUARIOS_semestre_valido"
    CHECK (semestre IS NULL OR semestre BETWEEN 1 AND 12);

ALTER TABLE "DISPONIBILIDADES"
  ADD CONSTRAINT "DISPONIBILIDADES_intervalo_valido"
    CHECK (fecha_fin > fecha_inicio);

ALTER TABLE "SOLICITUDES_INTERCAMBIO"
  ADD CONSTRAINT "SOLICITUDES_intervalo_valido"
    CHECK (fecha_fin_propuesta > fecha_inicio_propuesta),
  ADD CONSTRAINT "SOLICITUDES_creditos_positivos"
    CHECK (creditos_requeridos > 0),
  ADD CONSTRAINT "SOLICITUDES_participantes_distintos"
    CHECK (id_solicitante <> id_ofertante);

ALTER TABLE "RESERVAS"
  ADD CONSTRAINT "RESERVAS_intervalo_valido"
    CHECK (fecha_fin > fecha_inicio),
  ADD CONSTRAINT "RESERVAS_creditos_positivos"
    CHECK (creditos > 0),
  ADD CONSTRAINT "RESERVAS_participantes_distintos"
    CHECK (id_solicitante <> id_ofertante);

ALTER TABLE "CALIFICACIONES"
  ADD CONSTRAINT "CALIFICACIONES_puntuacion_valida"
    CHECK (puntuacion BETWEEN 1 AND 5),
  ADD CONSTRAINT "CALIFICACIONES_participantes_distintos"
    CHECK (id_evaluador <> id_evaluado);

ALTER TABLE "MOVIMIENTOS_CREDITO"
  ADD CONSTRAINT "MOVIMIENTOS_saldos_validos"
    CHECK (
      saldo_anterior >= 0 AND saldo_posterior >= 0 AND
      retenidos_anterior >= 0 AND retenidos_posterior >= 0 AND
      retenidos_anterior <= saldo_anterior AND retenidos_posterior <= saldo_posterior
    );

-- ============================================================
-- 3) VISTAS Y FUNCIONES  (equivale a 20261025000000_vistas_reporte)
--    Se usa CREATE OR REPLACE para que el script sea re-ejecutable.
-- ============================================================
CREATE OR REPLACE VIEW v_usuarios_completo AS
SELECT u.id_usuario, u.nombre, u.apellido, u.correo,
       u.id_carrera, c.nombre AS nombre_carrera, c.facultad,
       u.semestre, u.fecha_registro, u.ultimo_acceso, u.estado
FROM "USUARIOS" u
LEFT JOIN "CARRERAS" c ON u.id_carrera = c.id_carrera;

CREATE OR REPLACE VIEW v_usuarios_roles AS
SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.estado, u.rol
FROM "USUARIOS" u;

CREATE OR REPLACE VIEW v_usuarios_activos AS
SELECT u.id_usuario, u.nombre, u.apellido, u.correo,
       c.nombre AS carrera, c.facultad, u.semestre,
       u.fecha_registro, u.ultimo_acceso
FROM "USUARIOS" u
LEFT JOIN "CARRERAS" c ON u.id_carrera = c.id_carrera
WHERE u.estado = 'Activo';

CREATE OR REPLACE VIEW v_usuarios_por_facultad AS
SELECT c.facultad, c.nombre AS carrera,
       COUNT(u.id_usuario) AS total_usuarios,
       COUNT(u.id_usuario) FILTER (WHERE u.estado = 'Activo') AS usuarios_activos
FROM "CARRERAS" c
LEFT JOIN "USUARIOS" u ON c.id_carrera = u.id_carrera
GROUP BY c.facultad, c.nombre;

CREATE OR REPLACE VIEW v_habilidades_categoria AS
SELECT h.id_habilidad, h.nombre AS nombre_habilidad, cat.nombre AS categoria, h.estado
FROM "HABILIDADES" h
JOIN "CATEGORIAS" cat ON h.id_categoria = cat.id_categoria;

CREATE OR REPLACE VIEW v_usuario_habilidades_detalle AS
SELECT u.id_usuario, u.nombre, u.apellido, h.id_habilidad,
       h.nombre AS nombre_habilidad, cat.nombre AS categoria,
       uh.nivel, h.estado AS estado_habilidad
FROM "USUARIOS" u
JOIN "USUARIO_HABILIDADES" uh ON u.id_usuario = uh.id_usuario
JOIN "HABILIDADES" h ON uh.id_habilidad = h.id_habilidad
JOIN "CATEGORIAS" cat ON h.id_categoria = cat.id_categoria
WHERE h.estado = 'activo';

CREATE OR REPLACE VIEW v_ofertantes_por_habilidad AS
SELECT h.id_habilidad, h.nombre AS nombre_habilidad, cat.nombre AS categoria,
       COUNT(*) AS total_ofertantes,
       COUNT(*) FILTER (WHERE u.estado = 'Activo') AS ofertantes_activos
FROM "HABILIDADES" h
JOIN "USUARIO_HABILIDADES" uh ON h.id_habilidad = uh.id_habilidad
JOIN "USUARIOS" u ON uh.id_usuario = u.id_usuario
JOIN "CATEGORIAS" cat ON h.id_categoria = cat.id_categoria
WHERE h.estado = 'activo'
GROUP BY h.id_habilidad, h.nombre, cat.nombre;

CREATE OR REPLACE VIEW v_habilidades_populares AS
SELECT * FROM v_ofertantes_por_habilidad
ORDER BY total_ofertantes DESC
LIMIT 20;

CREATE OR REPLACE VIEW v_disponibilidades_usuario AS
SELECT d.id_disponibilidad, u.id_usuario, u.nombre, u.apellido,
       d.fecha_inicio, d.fecha_fin, d.estado
FROM "DISPONIBILIDADES" d
JOIN "USUARIOS" u ON d.id_usuario = u.id_usuario
WHERE d.estado = 'disponible' AND d.fecha_inicio > now();

CREATE OR REPLACE VIEW v_disponibilidades_futuras AS
SELECT d.id_disponibilidad, u.id_usuario, u.nombre, u.apellido,
       d.fecha_inicio, d.fecha_fin,
       EXTRACT(EPOCH FROM (d.fecha_fin - d.fecha_inicio)) / 3600 AS horas_disponibles,
       d.estado
FROM "DISPONIBILIDADES" d
JOIN "USUARIOS" u ON d.id_usuario = u.id_usuario
WHERE d.fecha_inicio > now() AND d.estado = 'disponible';

CREATE OR REPLACE VIEW v_solicitudes_detalle AS
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

CREATE OR REPLACE VIEW v_solicitudes_pendientes AS
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

CREATE OR REPLACE FUNCTION fn_solicitudes_recibidas(p_usuario uuid)
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

CREATE OR REPLACE FUNCTION fn_solicitudes_enviadas(p_usuario uuid)
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

CREATE OR REPLACE VIEW v_reservas_detalle AS
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

CREATE OR REPLACE VIEW v_reservas_activas AS
SELECT r.id_reserva, r.id_solicitante, us.nombre AS nombre_solicitante,
       r.id_ofertante, uo.nombre AS nombre_ofertante, h.nombre AS nombre_habilidad,
       r.fecha_inicio, r.fecha_fin, r.modalidad, r.lugar, r.estado
FROM "RESERVAS" r
JOIN "USUARIOS" us ON r.id_solicitante = us.id_usuario
JOIN "USUARIOS" uo ON r.id_ofertante = uo.id_usuario
JOIN "HABILIDADES" h ON r.id_habilidad = h.id_habilidad
WHERE r.estado = 'Confirmada' AND r.fecha_inicio > now();

CREATE OR REPLACE FUNCTION fn_reservas_usuario(p_usuario uuid)
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

CREATE OR REPLACE VIEW v_reservas_completadas AS
SELECT r.id_reserva, r.id_solicitante, us.nombre AS nombre_solicitante,
       r.id_ofertante, uo.nombre AS nombre_ofertante, h.nombre AS nombre_habilidad,
       r.fecha_inicio, r.fecha_fin, r.creditos, r.modalidad, r.completed_at
FROM "RESERVAS" r
JOIN "USUARIOS" us ON r.id_solicitante = us.id_usuario
JOIN "USUARIOS" uo ON r.id_ofertante = uo.id_usuario
JOIN "HABILIDADES" h ON r.id_habilidad = h.id_habilidad
WHERE r.estado = 'Completada';

CREATE OR REPLACE VIEW v_cuentas_credito_usuario AS
SELECT u.id_usuario, u.nombre, u.apellido, u.correo,
       u.saldo, u.creditos_retenidos,
       u.saldo - u.creditos_retenidos AS creditos_disponibles
FROM "USUARIOS" u;

CREATE OR REPLACE VIEW v_movimientos_credito_detalle AS
SELECT mc.id_movimiento, mc.id_usuario, u.nombre, u.apellido, mc.id_reserva,
       mc.tipo, mc.cantidad, mc.saldo_anterior, mc.saldo_posterior,
       mc.retenidos_anterior, mc.retenidos_posterior,
       mc.descripcion, mc.created_at
FROM "MOVIMIENTOS_CREDITO" mc
JOIN "USUARIOS" u ON mc.id_usuario = u.id_usuario;

CREATE OR REPLACE VIEW v_transferencias_detalle AS
SELECT r.id_reserva AS id_transferencia, r.id_reserva,
       r.id_solicitante AS id_emisor, ue.nombre AS nombre_emisor, ue.apellido AS apellido_emisor,
       r.id_ofertante AS id_receptor, ur.nombre AS nombre_receptor, ur.apellido AS apellido_receptor,
       r.creditos AS cantidad, r.estado, r.completed_at AS fecha_transferencia,
       'Clase completada'::text AS motivo
FROM "RESERVAS" r
JOIN "USUARIOS" ue ON r.id_solicitante = ue.id_usuario
JOIN "USUARIOS" ur ON r.id_ofertante = ur.id_usuario
WHERE r.estado = 'Completada';

CREATE OR REPLACE VIEW v_ranking_creditos AS
SELECT u.id_usuario, u.nombre, u.apellido, c.nombre AS carrera,
       u.saldo, u.creditos_retenidos,
       u.saldo - u.creditos_retenidos AS creditos_disponibles,
       RANK() OVER (ORDER BY u.saldo DESC) AS posicion_ranking
FROM "USUARIOS" u
LEFT JOIN "CARRERAS" c ON u.id_carrera = c.id_carrera
WHERE u.estado = 'Activo' AND u.rol = 'Estudiante';

CREATE OR REPLACE VIEW v_calificaciones_detalle AS
SELECT c.id_calificacion, c.id_reserva,
       c.id_evaluador, ue.nombre AS nombre_evaluador, ue.apellido AS apellido_evaluador,
       c.id_evaluado, uo.nombre AS nombre_evaluado, uo.apellido AS apellido_evaluado,
       c.puntuacion, c.comentario, c.created_at
FROM "CALIFICACIONES" c
JOIN "USUARIOS" ue ON c.id_evaluador = ue.id_usuario
JOIN "USUARIOS" uo ON c.id_evaluado = uo.id_usuario;

CREATE OR REPLACE VIEW v_reputacion_usuarios AS
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
LEFT JOIN dadas    d ON d.id_usuario = u.id_usuario
WHERE u.estado = 'Activo';

CREATE OR REPLACE FUNCTION fn_calificaciones_recibidas(p_usuario uuid)
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
  JOIN "USUARIOS" uo ON c.id_evaluado  = uo.id_usuario
  WHERE c.id_evaluado = p_usuario
  ORDER BY c.created_at DESC;
$$;

CREATE OR REPLACE VIEW v_notificaciones_usuario AS
SELECT n.id_notificacion, n.id_usuario, u.nombre, u.apellido,
       n.tipo, n.titulo, n.mensaje, n.leida, n.created_at
FROM "NOTIFICACIONES" n
JOIN "USUARIOS" u ON n.id_usuario = u.id_usuario;

CREATE OR REPLACE VIEW v_notificaciones_no_leidas AS
SELECT n.id_notificacion, n.id_usuario, u.nombre, u.apellido,
       n.tipo, n.titulo, n.mensaje, n.created_at
FROM "NOTIFICACIONES" n
JOIN "USUARIOS" u ON n.id_usuario = u.id_usuario
WHERE n.leida = false;

CREATE OR REPLACE VIEW v_notificaciones_por_tipo AS
SELECT n.tipo,
       COUNT(*) AS total_notificaciones,
       COUNT(*) FILTER (WHERE n.leida = false) AS no_leidas,
       COUNT(*) FILTER (WHERE n.leida = true)  AS leidas
FROM "NOTIFICACIONES" n
GROUP BY n.tipo;

CREATE OR REPLACE VIEW v_auditoria_detalle AS
SELECT a.id_auditoria, a.id_usuario, u.nombre, u.apellido,
       a.accion, a.entidad, a.entidad_id,
       a.datos_anteriores, a.datos_nuevos, a.ip, a.created_at
FROM "AUDITORIA" a
LEFT JOIN "USUARIOS" u ON a.id_usuario = u.id_usuario;

CREATE OR REPLACE VIEW v_auditoria_por_accion AS
SELECT a.accion, COUNT(*) AS total_eventos,
       COUNT(*) FILTER (WHERE a.created_at > now() - INTERVAL '7 days')  AS eventos_ultima_semana,
       COUNT(*) FILTER (WHERE a.created_at > now() - INTERVAL '30 days') AS eventos_ultimo_mes
FROM "AUDITORIA" a
GROUP BY a.accion;

CREATE OR REPLACE VIEW v_auditoria_por_usuario AS
SELECT a.id_usuario, u.nombre, u.apellido,
       COUNT(*) AS total_acciones, MAX(a.created_at) AS ultima_accion
FROM "AUDITORIA" a
JOIN "USUARIOS" u ON a.id_usuario = u.id_usuario
GROUP BY a.id_usuario, u.nombre, u.apellido;

CREATE OR REPLACE VIEW v_estadisticas_generales AS
SELECT
  (SELECT COUNT(*) FROM "USUARIOS" WHERE estado = 'Activo')                            AS total_usuarios_activos,
  (SELECT COUNT(*) FROM "HABILIDADES" WHERE estado = 'activo')                         AS total_habilidades_activas,
  (SELECT COUNT(*) FROM "SOLICITUDES_INTERCAMBIO" WHERE estado = 'Solicitada')         AS solicitudes_pendientes,
  (SELECT COUNT(*) FROM "RESERVAS" WHERE estado = 'Confirmada')                        AS reservas_activas,
  (SELECT COUNT(*) FROM "RESERVAS" WHERE estado = 'Completada')                        AS reservas_completadas,
  (SELECT COUNT(*) FROM "RESERVAS" WHERE created_at > now() - INTERVAL '7 days')       AS reservas_ultima_semana,
  (SELECT COALESCE(SUM(saldo), 0) FROM "USUARIOS")                                     AS total_creditos_en_sistema;

CREATE OR REPLACE VIEW v_actividad_mensual AS
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
       SUM(reserva)   AS nuevas_reservas,
       SUM(usuario)   AS nuevos_usuarios
FROM eventos
WHERE mes > now() - INTERVAL '12 months'
GROUP BY mes;

CREATE OR REPLACE VIEW v_habilidades_mas_solicitadas AS
SELECT h.id_habilidad, h.nombre AS nombre_habilidad, cat.nombre AS categoria,
       COUNT(DISTINCT s.id_solicitud) AS total_solicitudes,
       COUNT(DISTINCT s.id_solicitud) FILTER (WHERE s.estado = 'Aceptada') AS solicitudes_aceptadas
FROM "HABILIDADES" h
LEFT JOIN "SOLICITUDES_INTERCAMBIO" s ON h.id_habilidad = s.id_habilidad
JOIN "CATEGORIAS" cat ON h.id_categoria = cat.id_categoria
GROUP BY h.id_habilidad, h.nombre, cat.nombre
HAVING COUNT(DISTINCT s.id_solicitud) > 0;

CREATE OR REPLACE VIEW v_usuarios_mas_activos AS
SELECT u.id_usuario, u.nombre, u.apellido, c.nombre AS carrera,
       COUNT(DISTINCT r.id_reserva) AS total_reservas,
       COUNT(DISTINCT r.id_reserva) FILTER (WHERE r.id_solicitante = u.id_usuario) AS como_solicitante,
       COUNT(DISTINCT r.id_reserva) FILTER (WHERE r.id_ofertante  = u.id_usuario) AS como_ofertante
FROM "USUARIOS" u
LEFT JOIN "RESERVAS" r ON u.id_usuario = r.id_solicitante OR u.id_usuario = r.id_ofertante
LEFT JOIN "CARRERAS" c ON u.id_carrera  = c.id_carrera
WHERE u.estado = 'Activo'
GROUP BY u.id_usuario, u.nombre, u.apellido, c.nombre
HAVING COUNT(DISTINCT r.id_reserva) > 0;

CREATE OR REPLACE VIEW v_reservas_por_categoria AS
SELECT cat.nombre AS categoria,
       COUNT(DISTINCT r.id_reserva) AS total_reservas,
       COUNT(DISTINCT r.id_reserva) FILTER (WHERE r.estado = 'Completada') AS reservas_completadas,
       ROUND(100.0 * COUNT(DISTINCT r.id_reserva) FILTER (WHERE r.estado = 'Completada')
             / NULLIF(COUNT(DISTINCT r.id_reserva), 0), 2) AS tasa_completacion
FROM "CATEGORIAS" cat
LEFT JOIN "HABILIDADES" h ON cat.id_categoria = h.id_categoria
LEFT JOIN "RESERVAS" r    ON h.id_habilidad   = r.id_habilidad
GROUP BY cat.nombre;

-- ============================================================
-- 4) CATÁLOGO DE CARRERAS U.C.B.  (equivale a 20261026000000_carreras_ucb)
--    Unificado como upsert para no depender de datos previos.
-- ============================================================
INSERT INTO "CARRERAS" (id_carrera, nombre, facultad, estado) VALUES
('30000000-0000-4000-8000-000000000001', 'Ingeniería de Sistemas', 'Facultad de Ingeniería', 'activo'),
('30000000-0000-4000-8000-000000000002', 'Administración de Empresas', 'Facultad de Ciencias Económicas y Financieras', 'activo'),
('30000000-0000-4000-8000-000000000003', 'Contaduría Pública', 'Facultad de Ciencias Económicas y Financieras', 'activo'),
('30000000-0000-4000-8000-000000000004', 'Economía', 'Facultad de Ciencias Económicas y Financieras', 'activo'),
('30000000-0000-4000-8000-000000000005', 'Economía e Inteligencia de Negocios', 'Facultad de Ciencias Económicas y Financieras', 'activo'),
('30000000-0000-4000-8000-000000000006', 'Ingeniería Comercial', 'Facultad de Ciencias Económicas y Financieras', 'activo'),
('30000000-0000-4000-8000-000000000007', 'Ingeniería en Innovación Empresarial', 'Facultad de Ciencias Económicas y Financieras', 'activo'),
('30000000-0000-4000-8000-000000000008', 'Marketing y Medios Digitales', 'Facultad de Ciencias Económicas y Financieras', 'activo'),
('30000000-0000-4000-8000-000000000009', 'Ingeniería Ambiental', 'Facultad de Ingeniería', 'activo'),
('30000000-0000-4000-8000-000000000010', 'Ingeniería Biomédica', 'Facultad de Ingeniería', 'activo'),
('30000000-0000-4000-8000-000000000011', 'Ingeniería Bioquímica y de Bioprocesos', 'Facultad de Ingeniería', 'activo'),
('30000000-0000-4000-8000-000000000012', 'Ingeniería Civil', 'Facultad de Ingeniería', 'activo'),
('30000000-0000-4000-8000-000000000013', 'Ingeniería en Multimedia e Interactividad Digital', 'Facultad de Ingeniería', 'activo'),
('30000000-0000-4000-8000-000000000014', 'Ingeniería Industrial', 'Facultad de Ingeniería', 'activo'),
('30000000-0000-4000-8000-000000000015', 'Ingeniería Química', 'Facultad de Ingeniería', 'activo'),
('30000000-0000-4000-8000-000000000016', 'Ingeniería Mecatrónica', 'Facultad de Ingeniería', 'activo'),
('30000000-0000-4000-8000-000000000017', 'Ingeniería en Telecomunicaciones', 'Facultad de Ingeniería', 'activo'),
('30000000-0000-4000-8000-000000000018', 'Comunicación Social', 'Facultad de Ciencias Sociales y Humanas', 'activo'),
('30000000-0000-4000-8000-000000000019', 'Comunicación Digital Multimedia', 'Facultad de Ciencias Sociales y Humanas', 'activo'),
('30000000-0000-4000-8000-000000000020', 'Psicología', 'Facultad de Ciencias Sociales y Humanas', 'activo'),
('30000000-0000-4000-8000-000000000021', 'Psicopedagogía', 'Facultad de Ciencias Sociales y Humanas', 'activo'),
('30000000-0000-4000-8000-000000000022', 'Ciencias Políticas y Relaciones Internacionales', 'Facultad de Derecho y Ciencias Políticas', 'activo'),
('30000000-0000-4000-8000-000000000023', 'Derecho', 'Facultad de Derecho y Ciencias Políticas', 'activo'),
('30000000-0000-4000-8000-000000000024', 'Arquitectura', 'Departamento de Arquitectura y Diseño', 'activo'),
('30000000-0000-4000-8000-000000000025', 'Diseño Digital', 'Departamento de Arquitectura y Diseño', 'activo'),
('30000000-0000-4000-8000-000000000026', 'Diseño Gráfico y Comunicación Visual', 'Departamento de Arquitectura y Diseño', 'activo'),
('30000000-0000-4000-8000-000000000027', 'Medicina', 'Salud', 'activo'),
('30000000-0000-4000-8000-000000000028', 'Nutrición Clínica y Dietética', 'Salud', 'activo'),
('30000000-0000-4000-8000-000000000029', 'Antropología', 'Carreras Virtuales U.C.B. Nacional', 'activo'),
('30000000-0000-4000-8000-000000000030', 'Filosofía y Letras', 'Carreras Virtuales U.C.B. Nacional', 'activo'),
('30000000-0000-4000-8000-000000000031', 'Programa Complementario de Filosofía y Letras', 'Carreras Virtuales U.C.B. Nacional', 'activo')
ON CONFLICT (id_carrera) DO UPDATE
  SET nombre   = EXCLUDED.nombre,
      facultad = EXCLUDED.facultad,
      estado   = EXCLUDED.estado;
	  
	  
-- DEFAULT gen_random_uuid() para las PKs que Prisma generaba en el cliente.
-- No cambia los datos existentes; sólo afecta a INSERT sin id explícito.
ALTER TABLE "CARRERAS"                ALTER COLUMN "id_carrera"        SET DEFAULT gen_random_uuid();
ALTER TABLE "CATEGORIAS"              ALTER COLUMN "id_categoria"      SET DEFAULT gen_random_uuid();
ALTER TABLE "USUARIOS"                ALTER COLUMN "id_usuario"        SET DEFAULT gen_random_uuid();
ALTER TABLE "HABILIDADES"             ALTER COLUMN "id_habilidad"      SET DEFAULT gen_random_uuid();
ALTER TABLE "DISPONIBILIDADES"        ALTER COLUMN "id_disponibilidad" SET DEFAULT gen_random_uuid();
ALTER TABLE "SOLICITUDES_INTERCAMBIO" ALTER COLUMN "id_solicitud"      SET DEFAULT gen_random_uuid();
ALTER TABLE "RESERVAS"                ALTER COLUMN "id_reserva"        SET DEFAULT gen_random_uuid();
ALTER TABLE "MOVIMIENTOS_CREDITO"     ALTER COLUMN "id_movimiento"     SET DEFAULT gen_random_uuid();
ALTER TABLE "CALIFICACIONES"          ALTER COLUMN "id_calificacion"   SET DEFAULT gen_random_uuid();
ALTER TABLE "NOTIFICACIONES"          ALTER COLUMN "id_notificacion"   SET DEFAULT gen_random_uuid();
ALTER TABLE "AUDITORIA"               ALTER COLUMN "id_auditoria"      SET DEFAULT gen_random_uuid();