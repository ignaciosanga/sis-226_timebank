ALTER TABLE "USUARIOS"
ADD COLUMN "correo_verificado" BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN "token_verificacion_hash" VARCHAR(64),
ADD COLUMN "token_verificacion_expira_at" TIMESTAMPTZ(6);

ALTER TABLE "USUARIOS"
ALTER COLUMN "correo_verificado" SET DEFAULT FALSE;

CREATE UNIQUE INDEX "USUARIOS_token_verificacion_hash_key"
ON "USUARIOS"("token_verificacion_hash");
