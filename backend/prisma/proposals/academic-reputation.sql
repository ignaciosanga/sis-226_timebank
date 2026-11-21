-- Propuesta incremental posterior a 20261120010000. NO aplicada.
-- Tras aprobación BD, incorporar a una migración nueva; no modificar las seis anteriores.
CREATE TABLE "CURRICULOS" (
  codigo VARCHAR(32) PRIMARY KEY, nombre VARCHAR(120) NOT NULL,
  id_carrera UUID NOT NULL REFERENCES "CARRERAS"(id_carrera) ON DELETE RESTRICT
);
CREATE TABLE "AREAS_ACADEMICAS" (codigo VARCHAR(32) PRIMARY KEY, nombre VARCHAR(120) NOT NULL);
CREATE TABLE "MATERIAS_ACADEMICAS" (
  curriculum VARCHAR(32) NOT NULL REFERENCES "CURRICULOS"(codigo) ON DELETE RESTRICT,
  codigo VARCHAR(16) NOT NULL, nombre VARCHAR(160) NOT NULL,
  semestre INTEGER NOT NULL CHECK (semestre BETWEEN 0 AND 9),
  area VARCHAR(32) NOT NULL REFERENCES "AREAS_ACADEMICAS"(codigo) ON DELETE RESTRICT,
  externo BOOLEAN NOT NULL DEFAULT false,
  id_habilidad UUID REFERENCES "HABILIDADES"(id_habilidad) ON DELETE RESTRICT,
  PRIMARY KEY(curriculum, codigo),
  CHECK ((externo AND semestre = 0 AND id_habilidad IS NULL) OR (NOT externo AND semestre > 0 AND id_habilidad IS NOT NULL))
);
CREATE UNIQUE INDEX "MATERIAS_ACADEMICAS_id_habilidad_key" ON "MATERIAS_ACADEMICAS"(id_habilidad);
CREATE INDEX "MATERIAS_ACADEMICAS_curriculum_semestre_area_idx" ON "MATERIAS_ACADEMICAS"(curriculum,semestre,area);
CREATE TABLE "PRERREQUISITOS_ACADEMICOS" (
  curriculum VARCHAR(32) NOT NULL, codigo VARCHAR(16) NOT NULL, requisito VARCHAR(16) NOT NULL,
  PRIMARY KEY(curriculum,codigo,requisito), CHECK(codigo <> requisito),
  FOREIGN KEY(curriculum,codigo) REFERENCES "MATERIAS_ACADEMICAS"(curriculum,codigo) ON DELETE RESTRICT,
  FOREIGN KEY(curriculum,requisito) REFERENCES "MATERIAS_ACADEMICAS"(curriculum,codigo) ON DELETE RESTRICT
);
CREATE TABLE "PROGRESO_ACADEMICO" (
  id_usuario UUID NOT NULL REFERENCES "USUARIOS"(id_usuario) ON DELETE RESTRICT,
  curriculum VARCHAR(32) NOT NULL, codigo VARCHAR(16) NOT NULL,
  estado VARCHAR(16) NOT NULL CHECK(estado IN ('approved','current')),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  PRIMARY KEY(id_usuario,curriculum,codigo),
  FOREIGN KEY(curriculum,codigo) REFERENCES "MATERIAS_ACADEMICAS"(curriculum,codigo) ON DELETE RESTRICT,
  CHECK(codigo <> 'MAT-030' OR estado = 'approved')
);
CREATE INDEX "PROGRESO_ACADEMICO_curriculum_codigo_estado_idx" ON "PROGRESO_ACADEMICO"(curriculum,codigo,estado);
-- No se destruyen calificaciones históricas. Si hay duplicados, BD debe revisarlos antes.
CREATE UNIQUE INDEX "CALIFICACIONES_reserva_unica" ON "CALIFICACIONES"(id_reserva);
