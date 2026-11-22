-- Fase 3 local: ofertas y cargas de banner. Revisar con BD antes de otro destino.
-- No modifica autenticación ni los nueve importes históricos INTEGER.
BEGIN;
CREATE TABLE "BANNERS_TUTORIA" (
  id_banner uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_tutor uuid NOT NULL REFERENCES "USUARIOS"(id_usuario) ON DELETE RESTRICT,
  storage_name varchar NOT NULL UNIQUE,
  mime_type varchar NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 3145728),
  sha256 varchar(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  attached_offer_id uuid,
  deleted_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp'))
);
CREATE INDEX "BANNERS_TUTORIA_expires_at_idx" ON "BANNERS_TUTORIA"(expires_at);
CREATE TABLE "OFERTAS" (
  id_oferta uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_tutor uuid NOT NULL REFERENCES "USUARIOS"(id_usuario) ON DELETE RESTRICT,
  id_habilidad uuid NOT NULL REFERENCES "HABILIDADES"(id_habilidad) ON DELETE RESTRICT,
  id_disponibilidad uuid NOT NULL UNIQUE REFERENCES "DISPONIBILIDADES"(id_disponibilidad) ON DELETE RESTRICT,
  id_banner uuid UNIQUE REFERENCES "BANNERS_TUTORIA"(id_banner) ON DELETE RESTRICT,
  nivel varchar NOT NULL CHECK (nivel IN ('Basico', 'Intermedio', 'Avanzado', 'Experto')),
  titulo varchar(100) NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 100),
  descripcion varchar(1500) NOT NULL CHECK (length(btrim(descripcion)) BETWEEN 1 AND 1500),
  costo_creditos numeric NOT NULL,
  estado varchar NOT NULL DEFAULT 'Activa' CHECK (estado IN ('Activa', 'Finalizada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- La escala se valida sobre NUMERIC sin coerción previa: 3.75 NO se vuelve 3.8.
  -- Capacidad técnica provisional; no representa un máximo comercial aprobado.
  CONSTRAINT "OFERTAS_precio_exacto" CHECK (
    costo_creditos > 0 AND costo_creditos <= 9999999999.9 AND scale(costo_creditos) <= 1
  )
);
CREATE UNIQUE INDEX "OFERTAS_tutor_materia_activa_unica"
  ON "OFERTAS"(id_tutor, id_habilidad) WHERE estado = 'Activa';
CREATE INDEX "OFERTAS_estado_created_at_idx" ON "OFERTAS"(estado, created_at);
COMMIT;
