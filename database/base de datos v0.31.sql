CREATE TABLE "CARRERAS" (
  "id_carrera" uuid PRIMARY KEY,
  "nombre" varchar,
  "facultad" varchar,
  "estado" varchar
);

CREATE TABLE "CATEGORIAS" (
  "id_categoria" uuid PRIMARY KEY,
  "nombre" varchar UNIQUE,
  "estado" varchar
);

CREATE TABLE "USUARIOS" (
  "id_usuario" uuid PRIMARY KEY,
  "nombre" varchar,
  "apellido" varchar,
  "correo" varchar UNIQUE,
  "password_hash" varchar,
  "id_carrera" uuid,
  "semestre" int,
  "fecha_registro" timestamptz DEFAULT (now()),
  "ultimo_acceso" timestamptz,
  "estado" varchar
);

CREATE TABLE "ROLES" (
  "id_rol" uuid PRIMARY KEY,
  "nombre" varchar UNIQUE
);

CREATE TABLE "USUARIO_ROLES" (
  "id_usuario" uuid,
  "id_rol" uuid,
  PRIMARY KEY ("id_usuario", "id_rol")
);

CREATE TABLE "HABILIDADES" (
  "id_habilidad" uuid PRIMARY KEY,
  "nombre" varchar UNIQUE,
  "id_categoria" uuid,
  "estado" varchar
);

CREATE TABLE "USUARIO_HABILIDADES" (
  "id_usuario" uuid,
  "id_habilidad" uuid,
  "nivel" varchar,
  PRIMARY KEY ("id_usuario", "id_habilidad")
);

CREATE TABLE "DISPONIBILIDADES" (
  "id_disponibilidad" uuid PRIMARY KEY,
  "id_usuario" uuid,
  "fecha_inicio" timestamptz,
  "fecha_fin" timestamptz,
  "estado" varchar
);

CREATE TABLE "SOLICITUDES_INTERCAMBIO" (
  "id_solicitud" uuid PRIMARY KEY,
  "id_solicitante" uuid,
  "id_ofertante" uuid,
  "id_habilidad" uuid,
  "fecha_inicio_propuesta" timestamptz,
  "fecha_fin_propuesta" timestamptz,
  "creditos_requeridos" int,
  "estado" varchar,
  "created_at" timestamptz DEFAULT (now()),
  "respondida_at" timestamptz
);

CREATE TABLE "RESERVAS" (
  "id_reserva" uuid PRIMARY KEY,
  "id_solicitud" uuid UNIQUE,
  "id_solicitante" uuid,
  "id_ofertante" uuid,
  "id_habilidad" uuid,
  "fecha_inicio" timestamptz,
  "fecha_fin" timestamptz,
  "creditos" int,
  "modalidad" varchar,
  "lugar" varchar,
  "estado" varchar,
  "created_at" timestamptz DEFAULT (now()),
  "completed_at" timestamptz,
  "cancelled_at" timestamptz
);

CREATE TABLE "CONFIRMACIONES" (
  "id_confirmacion" uuid PRIMARY KEY,
  "id_reserva" uuid,
  "id_usuario" uuid,
  "fecha_confirmacion" timestamptz DEFAULT (now())
);

CREATE TABLE "CANCELACIONES" (
  "id_cancelacion" uuid PRIMARY KEY,
  "id_reserva" uuid UNIQUE,
  "id_usuario" uuid,
  "motivo" varchar,
  "horas_anticipacion" int,
  "fecha_cancelacion" timestamptz DEFAULT (now())
);

CREATE TABLE "CUENTAS_CREDITO" (
  "id_cuenta" uuid PRIMARY KEY,
  "id_usuario" uuid UNIQUE,
  "saldo" int,
  "creditos_retenidos" int DEFAULT 0
);

CREATE TABLE "MOVIMIENTOS_CREDITO" (
  "id_movimiento" uuid PRIMARY KEY,
  "id_cuenta" uuid,
  "id_reserva" uuid,
  "tipo" varchar,
  "cantidad" int,
  "saldo_anterior" int,
  "saldo_posterior" int,
  "retenidos_anterior" int,
  "retenidos_posterior" int,
  "created_at" timestamptz DEFAULT (now()),
  "descripcion" varchar
);

CREATE TABLE "TRANSFERENCIAS_CREDITO" (
  "id_transferencia" uuid PRIMARY KEY,
  "id_reserva" uuid UNIQUE,
  "id_emisor" uuid,
  "id_receptor" uuid,
  "cantidad" int,
  "estado" varchar,
  "fecha_transferencia" timestamptz DEFAULT (now()),
  "motivo" varchar
);

CREATE TABLE "CALIFICACIONES" (
  "id_calificacion" uuid PRIMARY KEY,
  "id_reserva" uuid,
  "id_evaluador" uuid,
  "id_evaluado" uuid,
  "puntuacion" int,
  "comentario" varchar,
  "created_at" timestamptz DEFAULT (now())
);

CREATE TABLE "NOTIFICACIONES" (
  "id_notificacion" uuid PRIMARY KEY,
  "id_usuario" uuid,
  "tipo" varchar,
  "titulo" varchar,
  "mensaje" text,
  "leida" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT (now())
);

CREATE TABLE "AUDITORIA" (
  "id_auditoria" uuid PRIMARY KEY,
  "id_usuario" uuid,
  "accion" varchar,
  "entidad" varchar,
  "entidad_id" uuid,
  "datos_anteriores" jsonb,
  "datos_nuevos" jsonb,
  "ip" varchar,
  "created_at" timestamptz DEFAULT (now())
);

CREATE UNIQUE INDEX ON "CONFIRMACIONES" ("id_reserva", "id_usuario");

CREATE UNIQUE INDEX ON "CALIFICACIONES" ("id_reserva", "id_evaluador");

COMMENT ON COLUMN "SOLICITUDES_INTERCAMBIO"."estado" IS 'solicitada | aceptada | rechazada | cancelada';

COMMENT ON COLUMN "RESERVAS"."estado" IS 'confirmada | completada | cancelada';

COMMENT ON COLUMN "CUENTAS_CREDITO"."saldo" IS 'CHECK (saldo >= 0)';

COMMENT ON COLUMN "CUENTAS_CREDITO"."creditos_retenidos" IS 'CHECK (creditos_retenidos >= 0 AND creditos_retenidos <= saldo)';

COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."tipo" IS 'bono_inicial | recompensa | penalizacion | transferencia | ajuste | retencion | liberacion | consumo';

COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."retenidos_anterior" IS 'snapshot de creditos_retenidos antes del movimiento';

COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."retenidos_posterior" IS 'snapshot de creditos_retenidos después del movimiento';

COMMENT ON COLUMN "CALIFICACIONES"."puntuacion" IS 'CHECK (puntuacion BETWEEN 1 AND 5)';

COMMENT ON COLUMN "NOTIFICACIONES"."tipo" IS 'solicitud | reserva | cancelacion | calificacion | sistema';

COMMENT ON COLUMN "AUDITORIA"."accion" IS 'INSERT | UPDATE | DELETE | LOGIN | ...';

ALTER TABLE "USUARIOS" ADD FOREIGN KEY ("id_carrera") REFERENCES "CARRERAS" ("id_carrera") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "HABILIDADES" ADD FOREIGN KEY ("id_categoria") REFERENCES "CATEGORIAS" ("id_categoria") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "USUARIO_ROLES" ADD FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "USUARIO_ROLES" ADD FOREIGN KEY ("id_rol") REFERENCES "ROLES" ("id_rol") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "USUARIO_HABILIDADES" ADD FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "USUARIO_HABILIDADES" ADD FOREIGN KEY ("id_habilidad") REFERENCES "HABILIDADES" ("id_habilidad") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "DISPONIBILIDADES" ADD FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "SOLICITUDES_INTERCAMBIO" ADD FOREIGN KEY ("id_solicitante") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "SOLICITUDES_INTERCAMBIO" ADD FOREIGN KEY ("id_ofertante") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "SOLICITUDES_INTERCAMBIO" ADD FOREIGN KEY ("id_habilidad") REFERENCES "HABILIDADES" ("id_habilidad") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "RESERVAS" ADD FOREIGN KEY ("id_solicitud") REFERENCES "SOLICITUDES_INTERCAMBIO" ("id_solicitud") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "RESERVAS" ADD FOREIGN KEY ("id_solicitante") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "RESERVAS" ADD FOREIGN KEY ("id_ofertante") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "RESERVAS" ADD FOREIGN KEY ("id_habilidad") REFERENCES "HABILIDADES" ("id_habilidad") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CONFIRMACIONES" ADD FOREIGN KEY ("id_reserva") REFERENCES "RESERVAS" ("id_reserva") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CONFIRMACIONES" ADD FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CANCELACIONES" ADD FOREIGN KEY ("id_reserva") REFERENCES "RESERVAS" ("id_reserva") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CANCELACIONES" ADD FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CUENTAS_CREDITO" ADD FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "MOVIMIENTOS_CREDITO" ADD FOREIGN KEY ("id_cuenta") REFERENCES "CUENTAS_CREDITO" ("id_cuenta") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "MOVIMIENTOS_CREDITO" ADD FOREIGN KEY ("id_reserva") REFERENCES "RESERVAS" ("id_reserva") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "TRANSFERENCIAS_CREDITO" ADD FOREIGN KEY ("id_reserva") REFERENCES "RESERVAS" ("id_reserva") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "TRANSFERENCIAS_CREDITO" ADD FOREIGN KEY ("id_emisor") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "TRANSFERENCIAS_CREDITO" ADD FOREIGN KEY ("id_receptor") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CALIFICACIONES" ADD FOREIGN KEY ("id_reserva") REFERENCES "RESERVAS" ("id_reserva") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CALIFICACIONES" ADD FOREIGN KEY ("id_evaluador") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CALIFICACIONES" ADD FOREIGN KEY ("id_evaluado") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "NOTIFICACIONES" ADD FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "AUDITORIA" ADD FOREIGN KEY ("id_usuario") REFERENCES "USUARIOS" ("id_usuario") DEFERRABLE INITIALLY IMMEDIATE;
