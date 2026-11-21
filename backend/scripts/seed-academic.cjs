require('dotenv/config');
const { Client } = require('pg');
const { randomUUID } = require('node:crypto');
const data = require('../src/modules/academic/curriculum.json');
const normalize = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

async function seedAcademic(db) {
  await db.query('BEGIN');
  try {
    await db.query('SELECT pg_advisory_xact_lock(22603112)');
    const careers = (
      await db.query(
        'SELECT id_carrera,nombre FROM "CARRERAS" WHERE estado = $1',
        ['activo'],
      )
    ).rows.filter((r) => normalize(r.nombre) === normalize(data.carrera));
    if (careers.length !== 1)
      throw new Error(
        'Se necesita exactamente una carrera activa Ingeniería de Sistemas; resolver con BD.',
      );
    await db.query(
      'INSERT INTO "CURRICULOS"(codigo,nombre,id_carrera) VALUES($1,$2,$3) ON CONFLICT(codigo) DO NOTHING',
      [data.curriculum, data.carrera, careers[0].id_carrera],
    );
    const plan = (
      await db.query('SELECT id_carrera FROM "CURRICULOS" WHERE codigo=$1', [
        data.curriculum,
      ])
    ).rows[0];
    if (plan.id_carrera !== careers[0].id_carrera)
      throw new Error('El currículo existente pertenece a otra carrera');
    for (const area of data.areas)
      await db.query(
        'INSERT INTO "AREAS_ACADEMICAS"(codigo,nombre) VALUES($1,$2) ON CONFLICT(codigo) DO UPDATE SET nombre=EXCLUDED.nombre',
        [area.id, area.nombre],
      );
    const skills = (
      await db.query(
        'SELECT h.id_habilidad,h.nombre,m.codigo FROM "HABILIDADES" h LEFT JOIN "MATERIAS_ACADEMICAS" m ON m.id_habilidad=h.id_habilidad',
      )
    ).rows;
    const report = [];
    for (const course of data.courses) {
      let id = null;
      let action = 'externo';
      if (!course.externo) {
        const candidates = skills.filter(
          (s) =>
            s.codigo === course.codigo ||
            normalize(s.nombre) === normalize(course.nombre),
        );
        if (candidates.length > 1)
          throw new Error(
            `Equivalencia ambigua ${course.codigo}: ${candidates.map((s) => s.id_habilidad).join(', ')}; no se fusionaron UUID.`,
          );
        const existing = candidates[0];
        if (existing?.codigo && existing.codigo !== course.codigo)
          throw new Error(`Código incompatible: ${course.codigo}`);
        id = existing?.id_habilidad ?? randomUUID();
        action = existing ? 'UUID conservado' : 'creada';
        if (!existing) {
          const area = data.areas.find((a) => a.id === course.area);
          const category = (
            await db.query(
              'INSERT INTO "CATEGORIAS"(id_categoria,nombre,estado) VALUES($1,$2,$3) ON CONFLICT(nombre) DO UPDATE SET nombre=EXCLUDED.nombre RETURNING id_categoria',
              [randomUUID(), area.nombre, 'activo'],
            )
          ).rows[0];
          await db.query(
            'INSERT INTO "HABILIDADES"(id_habilidad,nombre,id_categoria,estado) VALUES($1,$2,$3,$4)',
            [id, course.nombre, category.id_categoria, 'activo'],
          );
          skills.push({
            id_habilidad: id,
            nombre: course.nombre,
            codigo: course.codigo,
          });
        }
      }
      await db.query(
        `INSERT INTO "MATERIAS_ACADEMICAS"(curriculum,codigo,nombre,semestre,area,externo,id_habilidad)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(curriculum,codigo) DO UPDATE SET
        nombre=EXCLUDED.nombre,semestre=EXCLUDED.semestre,area=EXCLUDED.area
        WHERE "MATERIAS_ACADEMICAS".id_habilidad IS NOT DISTINCT FROM EXCLUDED.id_habilidad`,
        [
          data.curriculum,
          course.codigo,
          course.nombre,
          course.semestre,
          course.area,
          course.externo,
          id,
        ],
      );
      const mapped = (
        await db.query(
          'SELECT id_habilidad FROM "MATERIAS_ACADEMICAS" WHERE curriculum=$1 AND codigo=$2',
          [data.curriculum, course.codigo],
        )
      ).rows[0];
      if (mapped.id_habilidad !== id)
        throw new Error(`Mapeo previo incompatible: ${course.codigo}`);
      report.push({
        codigo: course.codigo,
        nombre: course.nombre,
        id_habilidad: id,
        action,
      });
    }
    for (const course of data.courses)
      for (const prerequisite of course.requisitos)
        await db.query(
          'INSERT INTO "PRERREQUISITOS_ACADEMICOS"(curriculum,codigo,requisito) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [data.curriculum, course.codigo, prerequisite],
        );
    await db.query('COMMIT');
    return report;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.LOCAL_DEVELOPMENT_SEED !== 'true'
  )
    throw new Error(
      'Requiere LOCAL_DEVELOPMENT_SEED=true y entorno no productivo, después de aprobar y aplicar el esquema.',
    );
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await db.connect();
    console.table(await seedAcademic(db));
  } finally {
    await db.end();
  }
}
module.exports = { seedAcademic };
if (require.main === module)
  void main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
