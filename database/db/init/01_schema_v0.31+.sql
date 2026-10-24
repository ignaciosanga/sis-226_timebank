
-- =====================================================
-- BASE DE DATOS: SISTEMA DE INTERCAMBIO DE HABILIDADES
-- MOTOR: PostgreSQL
-- =====================================================

-- =====================================================
-- 1. TABLA: CARRERAS
-- =====================================================

CREATE TABLE carreras (
    id_carrera UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    facultad VARCHAR(150) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'activo'
);

-- =====================================================
-- 2. TABLA: CATEGORIAS
-- =====================================================

CREATE TABLE categorias (
    id_categoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    estado VARCHAR(30) NOT NULL DEFAULT 'activo'
);

-- =====================================================
-- 3. TABLA: USUARIOS
-- =====================================================

CREATE TABLE usuarios (
    id_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    correo VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'usuario',
    id_carrera UUID REFERENCES carreras(id_carrera),
    semestre INT,
    saldo INT NOT NULL DEFAULT 0,
    creditos_retenidos INT NOT NULL DEFAULT 0,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso TIMESTAMPTZ,
    estado VARCHAR(30) NOT NULL DEFAULT 'activo',

    CONSTRAINT chk_usuarios_semestre
        CHECK (semestre IS NULL OR semestre > 0),

    CONSTRAINT chk_usuarios_saldo
        CHECK (saldo >= 0),

    CONSTRAINT chk_usuarios_creditos_retenidos
        CHECK (creditos_retenidos >= 0)
);

-- =====================================================
-- 4. TABLA: HABILIDADES
-- =====================================================

CREATE TABLE habilidades (
    id_habilidad UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    id_categoria UUID NOT NULL
        REFERENCES categorias(id_categoria),
    estado VARCHAR(30) NOT NULL DEFAULT 'activo',

    CONSTRAINT uq_habilidad_categoria
        UNIQUE (nombre, id_categoria)
);

-- =====================================================
-- 5. TABLA: USUARIO_HABILIDADES
-- Relación muchos a muchos entre usuarios y habilidades
-- =====================================================

CREATE TABLE usuario_habilidades (
    id_usuario UUID NOT NULL
        REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_habilidad UUID NOT NULL
        REFERENCES habilidades(id_habilidad) ON DELETE CASCADE,
    nivel VARCHAR(30) NOT NULL,

    PRIMARY KEY (id_usuario, id_habilidad)
);

-- =====================================================
-- 6. TABLA: DISPONIBILIDADES
-- =====================================================

CREATE TABLE disponibilidades (
    id_disponibilidad UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL
        REFERENCES usuarios(id_usuario),
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'disponible',

    CONSTRAINT chk_disponibilidad_fechas
        CHECK (fecha_fin > fecha_inicio)
);

-- =====================================================
-- 7. TABLA: SOLICITUDES_INTERCAMBIO
-- =====================================================

CREATE TABLE solicitudes_intercambio (
    id_solicitud UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_solicitante UUID NOT NULL
        REFERENCES usuarios(id_usuario),
    id_ofertante UUID NOT NULL
        REFERENCES usuarios(id_usuario),
    id_habilidad UUID NOT NULL
        REFERENCES habilidades(id_habilidad),
    fecha_inicio_propuesta TIMESTAMPTZ NOT NULL,
    fecha_fin_propuesta TIMESTAMPTZ NOT NULL,
    creditos_requeridos INT NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    respondida_at TIMESTAMPTZ,

    CONSTRAINT chk_solicitud_usuarios
        CHECK (id_solicitante <> id_ofertante),

    CONSTRAINT chk_solicitud_fechas
        CHECK (fecha_fin_propuesta > fecha_inicio_propuesta),

    CONSTRAINT chk_solicitud_creditos
        CHECK (creditos_requeridos > 0)
);

-- =====================================================
-- 8. TABLA: RESERVAS
-- =====================================================

CREATE TABLE reservas (
    id_reserva UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_solicitud UUID NOT NULL UNIQUE
        REFERENCES solicitudes_intercambio(id_solicitud),
    id_solicitante UUID NOT NULL
        REFERENCES usuarios(id_usuario),
    id_ofertante UUID NOT NULL
        REFERENCES usuarios(id_usuario),
    id_habilidad UUID NOT NULL
        REFERENCES habilidades(id_habilidad),
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    creditos INT NOT NULL,
    modalidad VARCHAR(30) NOT NULL,
    lugar VARCHAR(255),
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    confirmacion_solicitante_at TIMESTAMPTZ,
    confirmacion_ofertante_at TIMESTAMPTZ,
    cancelado_por UUID
        REFERENCES usuarios(id_usuario),
    motivo_cancelacion VARCHAR(500),
    horas_anticipacion_cancelacion INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    CONSTRAINT chk_reserva_usuarios
        CHECK (id_solicitante <> id_ofertante),

    CONSTRAINT chk_reserva_fechas
        CHECK (fecha_fin > fecha_inicio),

    CONSTRAINT chk_reserva_creditos
        CHECK (creditos > 0),

    CONSTRAINT chk_reserva_horas_cancelacion
        CHECK (
            horas_anticipacion_cancelacion IS NULL
            OR horas_anticipacion_cancelacion >= 0
        )
);

-- =====================================================
-- 9. TABLA: MOVIMIENTOS_CREDITO
-- =====================================================

CREATE TABLE movimientos_credito (
    id_movimiento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL
        REFERENCES usuarios(id_usuario),
    id_reserva UUID
        REFERENCES reservas(id_reserva),
    tipo VARCHAR(50) NOT NULL,
    cantidad INT NOT NULL,
    saldo_anterior INT NOT NULL,
    saldo_posterior INT NOT NULL,
    retenidos_anterior INT NOT NULL,
    retenidos_posterior INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    descripcion VARCHAR(500),

    CONSTRAINT chk_movimiento_saldos
        CHECK (
            saldo_anterior >= 0
            AND saldo_posterior >= 0
            AND retenidos_anterior >= 0
            AND retenidos_posterior >= 0
        )
);

-- =====================================================
-- 10. TABLA: CALIFICACIONES
-- =====================================================

CREATE TABLE calificaciones (
    id_calificacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_reserva UUID NOT NULL
        REFERENCES reservas(id_reserva),
    id_evaluador UUID NOT NULL
        REFERENCES usuarios(id_usuario),
    id_evaluado UUID NOT NULL
        REFERENCES usuarios(id_usuario),
    puntuacion INT NOT NULL,
    comentario VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_calificacion_puntuacion
        CHECK (puntuacion BETWEEN 1 AND 5),

    CONSTRAINT chk_calificacion_usuarios
        CHECK (id_evaluador <> id_evaluado),

    CONSTRAINT uq_calificacion_evaluador_reserva
        UNIQUE (id_reserva, id_evaluador)
);

-- =====================================================
-- 11. TABLA: NOTIFICACIONES
-- =====================================================

CREATE TABLE notificaciones (
    id_notificacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL
        REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 12. TABLA: AUDITORIA
-- =====================================================

CREATE TABLE auditoria (
    id_auditoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID
        REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(100) NOT NULL,
    entidad_id UUID,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 13. ÍNDICES PARA OPTIMIZAR CONSULTAS FRECUENTES
-- =====================================================

CREATE INDEX idx_usuarios_carrera
    ON usuarios(id_carrera);

CREATE INDEX idx_habilidades_categoria
    ON habilidades(id_categoria);

CREATE INDEX idx_disponibilidades_usuario_fechas
    ON disponibilidades(id_usuario, fecha_inicio, fecha_fin);

CREATE INDEX idx_solicitudes_solicitante
    ON solicitudes_intercambio(id_solicitante);

CREATE INDEX idx_solicitudes_ofertante
    ON solicitudes_intercambio(id_ofertante);

CREATE INDEX idx_solicitudes_estado
    ON solicitudes_intercambio(estado);

CREATE INDEX idx_reservas_solicitante
    ON reservas(id_solicitante);

CREATE INDEX idx_reservas_ofertante
    ON reservas(id_ofertante);

CREATE INDEX idx_reservas_estado
    ON reservas(estado);

CREATE INDEX idx_movimientos_usuario_fecha
    ON movimientos_credito(id_usuario, created_at DESC);

CREATE INDEX idx_calificaciones_evaluado
    ON calificaciones(id_evaluado);

CREATE INDEX idx_notificaciones_usuario_leida
    ON notificaciones(id_usuario, leida);

CREATE INDEX idx_auditoria_usuario_fecha
    ON auditoria(id_usuario, created_at DESC);
