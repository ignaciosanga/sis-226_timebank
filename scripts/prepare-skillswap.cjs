require('dotenv/config');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');
const { seedAcademic } = require('./seed-academic.cjs');

const root = join(__dirname, '..');
async function prepareSkillswap(
  db,
  { fresh = false, encryptionKey, hashPepper },
) {
  if (!encryptionKey || !hashPepper)
    throw new Error('Claves criptográficas requeridas');
  await db.query(
    "SELECT set_config('app.encryption_key',$1,false),set_config('app.hash_pepper',$2,false)",
    [encryptionKey, hashPepper],
  );
  const exists = async (name) =>
    (await db.query('SELECT to_regclass($1) IS NOT NULL AS yes', [name]))
      .rows[0].yes;
  if (fresh && (await exists('public."USUARIOS"')))
    throw new Error(
      'Fresh exige base vacía; nunca sobrescribe una base poblada',
    );
  if (fresh) {
    await db.query('BEGIN');
    try {
      for (const file of [
        '01_base_a_schema.sql',
        '00_funciones_criptografia.sql',
        '02_encriptacion.sql',
        '03_vistas_desencriptadas.sql',
        '04_auditoria_automatica.sql',
        '07_economia_dinamica.sql',
        '08_impacto_match_brechas.sql',
        '09_vistas_bi_hu07.sql',
        '10_penalizaciones_pendientes.sql',
      ])
        await db.query(
          readFileSync(join(root, 'prisma/vendor/skillswap-v4', file), 'utf8'),
        );
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
  if (
    !(await exists('public."PENALIZACIONES_PENDIENTES"')) ||
    !(await exists('public.v_auditoria_desencriptada'))
  )
    throw new Error('Se requiere entrega BD v4 completa');
  if (!(await exists('public."VERIFICACIONES_CORREO"')))
    await db.query(
      readFileSync(
        join(
          root,
          'prisma/migrations/20261120000000_verificacion_institucional/migration.sql',
        ),
        'utf8',
      ),
    );
  if (!(await exists('public."OFERTAS"')))
    await db.query(
      readFileSync(
        join(
          root,
          'prisma/migrations/20261120010000_ofertas_tutoria/migration.sql',
        ),
        'utf8',
      ),
    );
  await db.query(
    `ALTER TABLE "SOLICITUDES_INTERCAMBIO" ADD COLUMN IF NOT EXISTS id_oferta uuid REFERENCES "OFERTAS"(id_oferta)`,
  );
  if (!(await exists('public."PROGRESO_ACADEMICO"'))) {
    await db.query('BEGIN');
    try {
      await db.query(
        readFileSync(
          join(root, 'prisma/proposals/academic-reputation.sql'),
          'utf8',
        ),
      );
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
  await seedAcademic(db);
  await db.query(
    readFileSync(
      join(root, 'prisma/proposals/skillswap-backend-bridge.sql'),
      'utf8',
    ),
  );
}
module.exports = { prepareSkillswap };
async function main() {
  if (process.env.SKILLSWAP_PREPARE_APPROVED !== 'true')
    throw new Error(
      'Preparación requiere SKILLSWAP_PREPARE_APPROVED=true y revisión del destino',
    );
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await db.connect();
    await prepareSkillswap(db, {
      fresh: process.env.SKILLSWAP_FRESH === 'true',
      encryptionKey: process.env.APP_ENCRYPTION_KEY,
      hashPepper: process.env.APP_HASH_PEPPER,
    });
    console.log(
      'Puente SkillSwap v4 y catálogo preparados; sin usuarios ni saldos demo.',
    );
  } finally {
    await db.end();
  }
}
if (require.main === module)
  void main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
