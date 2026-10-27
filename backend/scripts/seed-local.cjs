require('dotenv/config');
const { Client } = require('pg');

async function seedLocal(client) {
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(22603112)');
    await client.query(`
      INSERT INTO "CARRERAS" (id_carrera, nombre, facultad, estado)
      VALUES ('30000000-0000-4000-8000-000000000001', 'Ingeniería de Sistemas', 'Ciencias y Tecnología', 'activo')
      ON CONFLICT DO NOTHING;
      INSERT INTO "CATEGORIAS" (id_categoria, nombre, estado) VALUES
      ('10000000-0000-4000-8000-000000000001', 'Tecnología', 'activo'),
      ('10000000-0000-4000-8000-000000000002', 'Idiomas', 'activo'),
      ('10000000-0000-4000-8000-000000000003', 'Matemáticas', 'activo'),
      ('10000000-0000-4000-8000-000000000004', 'Diseño', 'activo')
      ON CONFLICT DO NOTHING;
      INSERT INTO "HABILIDADES" (id_habilidad, nombre, id_categoria, estado) VALUES
      ('20000000-0000-4000-8000-000000000001', 'Programación Java', '10000000-0000-4000-8000-000000000001', 'activo'),
      ('20000000-0000-4000-8000-000000000002', 'Python', '10000000-0000-4000-8000-000000000001', 'activo'),
      ('20000000-0000-4000-8000-000000000003', 'Inglés', '10000000-0000-4000-8000-000000000002', 'activo'),
      ('20000000-0000-4000-8000-000000000004', 'Excel', '10000000-0000-4000-8000-000000000001', 'activo'),
      ('20000000-0000-4000-8000-000000000005', 'Diseño gráfico', '10000000-0000-4000-8000-000000000004', 'activo')
      ON CONFLICT DO NOTHING;
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.LOCAL_DEVELOPMENT_SEED !== 'true'
  )
    throw new Error(
      'Semilla exclusiva de desarrollo: requiere LOCAL_DEVELOPMENT_SEED=true y NODE_ENV distinto de production.',
    );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await seedLocal(client);
    console.log(
      'Catalogos locales preparados: carrera, categorias y habilidades. Sin usuarios ni saldos de prueba.',
    );
  } finally {
    await client.end();
  }
}
module.exports = { seedLocal };
if (require.main === module)
  void main().catch(() => {
    console.error(
      'No se pudo preparar la semilla local; verificar conexion, migraciones y LOCAL_DEVELOPMENT_SEED.',
    );
    process.exitCode = 1;
  });
