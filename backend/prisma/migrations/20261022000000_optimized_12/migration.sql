-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "CARRERAS" (
    "id_carrera" UUID NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "facultad" VARCHAR NOT NULL,
    "estado" VARCHAR NOT NULL,

    CONSTRAINT "CARRERAS_pkey" PRIMARY KEY ("id_carrera")
);

-- CreateTable
CREATE TABLE "CATEGORIAS" (
    "id_categoria" UUID NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "estado" VARCHAR NOT NULL,

    CONSTRAINT "CATEGORIAS_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "USUARIOS" (
    "id_usuario" UUID NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "apellido" VARCHAR NOT NULL,
    "correo" VARCHAR NOT NULL,
    "password_hash" VARCHAR NOT NULL,
    "rol" VARCHAR NOT NULL,
    "id_carrera" UUID,
    "semestre" INTEGER,
    "saldo" INTEGER NOT NULL DEFAULT 0,
    "creditos_retenidos" INTEGER NOT NULL DEFAULT 0,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_acceso" TIMESTAMPTZ(6),
    "estado" VARCHAR NOT NULL,

    CONSTRAINT "USUARIOS_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "HABILIDADES" (
    "id_habilidad" UUID NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "id_categoria" UUID NOT NULL,
    "estado" VARCHAR NOT NULL,

    CONSTRAINT "HABILIDADES_pkey" PRIMARY KEY ("id_habilidad")
);

-- CreateTable
CREATE TABLE "USUARIO_HABILIDADES" (
    "id_usuario" UUID NOT NULL,
    "id_habilidad" UUID NOT NULL,
    "nivel" VARCHAR NOT NULL,

    CONSTRAINT "USUARIO_HABILIDADES_pkey" PRIMARY KEY ("id_usuario","id_habilidad")
);

-- CreateTable
CREATE TABLE "DISPONIBILIDADES" (
    "id_disponibilidad" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "fecha_inicio" TIMESTAMPTZ(6) NOT NULL,
    "fecha_fin" TIMESTAMPTZ(6) NOT NULL,
    "estado" VARCHAR NOT NULL,

    CONSTRAINT "DISPONIBILIDADES_pkey" PRIMARY KEY ("id_disponibilidad")
);

-- CreateTable
CREATE TABLE "SOLICITUDES_INTERCAMBIO" (
    "id_solicitud" UUID NOT NULL,
    "id_solicitante" UUID NOT NULL,
    "id_ofertante" UUID NOT NULL,
    "id_habilidad" UUID NOT NULL,
    "fecha_inicio_propuesta" TIMESTAMPTZ(6) NOT NULL,
    "fecha_fin_propuesta" TIMESTAMPTZ(6) NOT NULL,
    "creditos_requeridos" INTEGER NOT NULL,
    "estado" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondida_at" TIMESTAMPTZ(6),

    CONSTRAINT "SOLICITUDES_INTERCAMBIO_pkey" PRIMARY KEY ("id_solicitud")
);

-- CreateTable
CREATE TABLE "RESERVAS" (
    "id_reserva" UUID NOT NULL,
    "id_solicitud" UUID,
    "id_solicitante" UUID NOT NULL,
    "id_ofertante" UUID NOT NULL,
    "id_habilidad" UUID NOT NULL,
    "fecha_inicio" TIMESTAMPTZ(6) NOT NULL,
    "fecha_fin" TIMESTAMPTZ(6) NOT NULL,
    "creditos" INTEGER NOT NULL,
    "modalidad" VARCHAR NOT NULL,
    "lugar" VARCHAR NOT NULL,
    "estado" VARCHAR NOT NULL,
    "confirmacion_solicitante_at" TIMESTAMPTZ(6),
    "confirmacion_ofertante_at" TIMESTAMPTZ(6),
    "cancelado_por" UUID,
    "motivo_cancelacion" VARCHAR,
    "horas_anticipacion_cancelacion" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "RESERVAS_pkey" PRIMARY KEY ("id_reserva")
);

-- CreateTable
CREATE TABLE "MOVIMIENTOS_CREDITO" (
    "id_movimiento" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "id_reserva" UUID,
    "tipo" VARCHAR NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "saldo_anterior" INTEGER NOT NULL,
    "saldo_posterior" INTEGER NOT NULL,
    "retenidos_anterior" INTEGER NOT NULL,
    "retenidos_posterior" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" VARCHAR,

    CONSTRAINT "MOVIMIENTOS_CREDITO_pkey" PRIMARY KEY ("id_movimiento")
);

-- CreateTable
CREATE TABLE "CALIFICACIONES" (
    "id_calificacion" UUID NOT NULL,
    "id_reserva" UUID NOT NULL,
    "id_evaluador" UUID NOT NULL,
    "id_evaluado" UUID NOT NULL,
    "puntuacion" INTEGER NOT NULL,
    "comentario" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CALIFICACIONES_pkey" PRIMARY KEY ("id_calificacion")
);

-- CreateTable
CREATE TABLE "NOTIFICACIONES" (
    "id_notificacion" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "tipo" VARCHAR NOT NULL,
    "titulo" VARCHAR NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NOTIFICACIONES_pkey" PRIMARY KEY ("id_notificacion")
);

-- CreateTable
CREATE TABLE "AUDITORIA" (
    "id_auditoria" UUID NOT NULL,
    "id_usuario" UUID,
    "accion" VARCHAR NOT NULL,
    "entidad" VARCHAR NOT NULL,
    "entidad_id" UUID NOT NULL,
    "datos_anteriores" JSONB,
    "datos_nuevos" JSONB,
    "ip" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AUDITORIA_pkey" PRIMARY KEY ("id_auditoria")
);

-- CreateIndex
CREATE INDEX "CARRERAS_estado_idx" ON "CARRERAS"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "CATEGORIAS_nombre_key" ON "CATEGORIAS"("nombre");

-- CreateIndex
CREATE INDEX "CATEGORIAS_estado_idx" ON "CATEGORIAS"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "USUARIOS_correo_key" ON "USUARIOS"("correo");

-- CreateIndex
CREATE INDEX "USUARIOS_id_carrera_idx" ON "USUARIOS"("id_carrera");

-- CreateIndex
CREATE INDEX "USUARIOS_estado_idx" ON "USUARIOS"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "HABILIDADES_nombre_key" ON "HABILIDADES"("nombre");

-- CreateIndex
CREATE INDEX "HABILIDADES_id_categoria_estado_idx" ON "HABILIDADES"("id_categoria", "estado");

-- CreateIndex
CREATE INDEX "USUARIO_HABILIDADES_id_habilidad_idx" ON "USUARIO_HABILIDADES"("id_habilidad");

-- CreateIndex
CREATE INDEX "DISPONIBILIDADES_id_usuario_estado_fecha_inicio_fecha_fin_idx" ON "DISPONIBILIDADES"("id_usuario", "estado", "fecha_inicio", "fecha_fin");

-- CreateIndex
CREATE INDEX "SOLICITUDES_INTERCAMBIO_id_solicitante_estado_created_at_idx" ON "SOLICITUDES_INTERCAMBIO"("id_solicitante", "estado", "created_at");

-- CreateIndex
CREATE INDEX "SOLICITUDES_INTERCAMBIO_id_ofertante_estado_created_at_idx" ON "SOLICITUDES_INTERCAMBIO"("id_ofertante", "estado", "created_at");

-- CreateIndex
CREATE INDEX "SOLICITUDES_INTERCAMBIO_id_habilidad_idx" ON "SOLICITUDES_INTERCAMBIO"("id_habilidad");

-- CreateIndex
CREATE UNIQUE INDEX "RESERVAS_id_solicitud_key" ON "RESERVAS"("id_solicitud");

-- CreateIndex
CREATE INDEX "RESERVAS_id_solicitante_estado_fecha_inicio_fecha_fin_idx" ON "RESERVAS"("id_solicitante", "estado", "fecha_inicio", "fecha_fin");

-- CreateIndex
CREATE INDEX "RESERVAS_id_ofertante_estado_fecha_inicio_fecha_fin_idx" ON "RESERVAS"("id_ofertante", "estado", "fecha_inicio", "fecha_fin");

-- CreateIndex
CREATE INDEX "RESERVAS_id_habilidad_idx" ON "RESERVAS"("id_habilidad");

-- CreateIndex
CREATE INDEX "RESERVAS_cancelado_por_idx" ON "RESERVAS"("cancelado_por");

-- CreateIndex
CREATE INDEX "MOVIMIENTOS_CREDITO_id_usuario_created_at_idx" ON "MOVIMIENTOS_CREDITO"("id_usuario", "created_at");

-- CreateIndex
CREATE INDEX "MOVIMIENTOS_CREDITO_id_reserva_idx" ON "MOVIMIENTOS_CREDITO"("id_reserva");

-- CreateIndex
CREATE INDEX "CALIFICACIONES_id_evaluado_created_at_idx" ON "CALIFICACIONES"("id_evaluado", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "CALIFICACIONES_id_reserva_id_evaluador_key" ON "CALIFICACIONES"("id_reserva", "id_evaluador");

-- CreateIndex
CREATE INDEX "NOTIFICACIONES_id_usuario_leida_created_at_idx" ON "NOTIFICACIONES"("id_usuario", "leida", "created_at");

-- CreateIndex
CREATE INDEX "AUDITORIA_id_usuario_created_at_idx" ON "AUDITORIA"("id_usuario", "created_at");

-- CreateIndex
CREATE INDEX "AUDITORIA_entidad_entidad_id_idx" ON "AUDITORIA"("entidad", "entidad_id");

-- AddForeignKey
ALTER TABLE "USUARIOS" ADD CONSTRAINT "USUARIOS_id_carrera_fkey" FOREIGN KEY ("id_carrera") REFERENCES "CARRERAS"("id_carrera") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HABILIDADES" ADD CONSTRAINT "HABILIDADES_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "CATEGORIAS"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "USUARIO_HABILIDADES" ADD CONSTRAINT "USUARIO_HABILIDADES_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "USUARIO_HABILIDADES" ADD CONSTRAINT "USUARIO_HABILIDADES_id_habilidad_fkey" FOREIGN KEY ("id_habilidad") REFERENCES "HABILIDADES"("id_habilidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DISPONIBILIDADES" ADD CONSTRAINT "DISPONIBILIDADES_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOLICITUDES_INTERCAMBIO" ADD CONSTRAINT "SOLICITUDES_INTERCAMBIO_id_solicitante_fkey" FOREIGN KEY ("id_solicitante") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOLICITUDES_INTERCAMBIO" ADD CONSTRAINT "SOLICITUDES_INTERCAMBIO_id_ofertante_fkey" FOREIGN KEY ("id_ofertante") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOLICITUDES_INTERCAMBIO" ADD CONSTRAINT "SOLICITUDES_INTERCAMBIO_id_habilidad_fkey" FOREIGN KEY ("id_habilidad") REFERENCES "HABILIDADES"("id_habilidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RESERVAS" ADD CONSTRAINT "RESERVAS_id_solicitud_fkey" FOREIGN KEY ("id_solicitud") REFERENCES "SOLICITUDES_INTERCAMBIO"("id_solicitud") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RESERVAS" ADD CONSTRAINT "RESERVAS_id_solicitante_fkey" FOREIGN KEY ("id_solicitante") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RESERVAS" ADD CONSTRAINT "RESERVAS_id_ofertante_fkey" FOREIGN KEY ("id_ofertante") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RESERVAS" ADD CONSTRAINT "RESERVAS_cancelado_por_fkey" FOREIGN KEY ("cancelado_por") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RESERVAS" ADD CONSTRAINT "RESERVAS_id_habilidad_fkey" FOREIGN KEY ("id_habilidad") REFERENCES "HABILIDADES"("id_habilidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MOVIMIENTOS_CREDITO" ADD CONSTRAINT "MOVIMIENTOS_CREDITO_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MOVIMIENTOS_CREDITO" ADD CONSTRAINT "MOVIMIENTOS_CREDITO_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "RESERVAS"("id_reserva") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CALIFICACIONES" ADD CONSTRAINT "CALIFICACIONES_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "RESERVAS"("id_reserva") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CALIFICACIONES" ADD CONSTRAINT "CALIFICACIONES_id_evaluador_fkey" FOREIGN KEY ("id_evaluador") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CALIFICACIONES" ADD CONSTRAINT "CALIFICACIONES_id_evaluado_fkey" FOREIGN KEY ("id_evaluado") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NOTIFICACIONES" ADD CONSTRAINT "NOTIFICACIONES_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AUDITORIA" ADD CONSTRAINT "AUDITORIA_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
