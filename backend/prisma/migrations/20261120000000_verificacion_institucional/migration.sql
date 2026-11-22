-- Fase 2 exclusivamente autenticación. Los nueve importes conservan INTEGER.
BEGIN;
-- No se atribuye verificación histórica sin evidencia. Tampoco se recalculan bonos.
ALTER TABLE "USUARIOS"
  ADD COLUMN cuenta_previa boolean NOT NULL DEFAULT true,
  ADD COLUMN email_verificado_at timestamptz,
  ADD COLUMN metodo_verificacion varchar,
  ADD COLUMN bono_decidido_at timestamptz,
  ADD COLUMN google_sub varchar(255);
ALTER TABLE "USUARIOS" ALTER COLUMN cuenta_previa SET DEFAULT false;
CREATE UNIQUE INDEX "USUARIOS_google_sub_key" ON "USUARIOS"(google_sub);
CREATE TABLE "VERIFICACIONES_CORREO" (
  id_verificacion uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario uuid NOT NULL REFERENCES "USUARIOS"(id_usuario) ON DELETE RESTRICT,
  token_hash varchar(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT "VERIFICACIONES_intervalo_valido" CHECK (expires_at > created_at),
  CONSTRAINT "VERIFICACIONES_hash_valido" CHECK (token_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX "VERIFICACIONES_CORREO_id_usuario_created_at_idx"
  ON "VERIFICACIONES_CORREO"(id_usuario, created_at);
-- Una fila por usuario incluso ante escritores concurrentes ajenos al backend.
-- Si una copia histórica tiene bonos duplicados, revisar con BD sin borrar historia.
CREATE UNIQUE INDEX "MOVIMIENTOS_bono_inicial_unico"
  ON "MOVIMIENTOS_CREDITO"(id_usuario) WHERE tipo = 'BonoInicial';
COMMIT;
