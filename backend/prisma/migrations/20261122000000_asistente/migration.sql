BEGIN;
CREATE TABLE "ASISTENTE_PERFILES" (
  id_usuario uuid PRIMARY KEY REFERENCES "USUARIOS"(id_usuario) ON DELETE RESTRICT,
  avatar_estilo varchar(16) NOT NULL DEFAULT 'bolita',
  avatar_color varchar(16) NOT NULL DEFAULT 'azul',
  avatar_accesorio varchar(16) NOT NULL DEFAULT 'chispa',
  avatar_nombre varchar(24) NOT NULL DEFAULT 'Nexo',
  groq_key_cifrada text,
  groq_key_pista varchar(16),
  mensajes_dia date,
  mensajes_usados integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ASISTENTE_estilo_valido" CHECK (avatar_estilo IN ('bolita', 'cuadradito', 'burbuja', 'gota')),
  CONSTRAINT "ASISTENTE_color_valido" CHECK (avatar_color IN ('azul', 'amarillo', 'verde', 'coral', 'lila', 'nube')),
  CONSTRAINT "ASISTENTE_accesorio_valido" CHECK (avatar_accesorio IN ('ninguno', 'chispa', 'birrete', 'audifonos')),
  CONSTRAINT "ASISTENTE_mensajes_validos" CHECK (mensajes_usados >= 0),
  CONSTRAINT "ASISTENTE_llave_completa" CHECK ((groq_key_cifrada IS NULL) = (groq_key_pista IS NULL))
);
DO $revoke$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboards_lectura') THEN
    REVOKE ALL ON "ASISTENTE_PERFILES" FROM dashboards_lectura;
  END IF;
END;
$revoke$;
COMMIT;
