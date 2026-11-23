// Recuperacion incremental: nunca elimina ofertas, referencias ni archivos.
const { createHash } = require('node:crypto');
const { lstat, readFile } = require('node:fs/promises');
const { dirname, resolve } = require('node:path');

const storageName =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

async function recoverBanners({
  client,
  directory,
  publicOrigin,
  dryRun = false,
}) {
  const root = resolve(directory);
  const origin = publicOrigin.replace(/\/$/, '');
  const report = {
    recovered: [],
    missing: [],
    invalid: [],
    persisted: [],
    skipped: [],
  };
  // No cargar todos los BYTEA en memoria. Cada imagen se verifica por separado.
  const { rows } = await client.query(
    `SELECT b.id_banner, b.storage_name, b.mime_type, b.byte_size, b.sha256,
      b.deleted_at, b.expires_at, b.attached_offer_id,
      b.content_bytes IS NOT NULL AS has_content,
      ARRAY(SELECT o.id_oferta::text FROM "OFERTAS" o WHERE o.id_banner=b.id_banner ORDER BY o.id_oferta) AS offer_ids
     FROM "BANNERS_TUTORIA" b ORDER BY b.id_banner`,
  );
  for (const row of rows) {
    const entry = {
      id_banner: row.id_banner,
      url: `${origin}/tutoring/banners/${row.id_banner}`,
      offer_ids: row.offer_ids,
    };
    if (row.has_content) {
      report.persisted.push(entry);
      continue;
    }
    if (
      row.deleted_at ||
      (!row.attached_offer_id && row.expires_at <= new Date())
    ) {
      report.skipped.push(entry);
      continue;
    }
    let bytes;
    try {
      const path = resolve(root, row.storage_name);
      const expectedMime = {
        jpg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      }[row.storage_name.split('.').at(-1)];
      if (
        !storageName.test(row.storage_name) ||
        dirname(path) !== root ||
        expectedMime !== row.mime_type
      )
        throw new Error('metadata');
      const folder = await lstat(root);
      const file = await lstat(path);
      if (
        !folder.isDirectory() ||
        folder.isSymbolicLink() ||
        !file.isFile() ||
        file.isSymbolicLink()
      )
        throw new Error('archivo_no_regular');
      if (file.size !== row.byte_size || file.size <= 0 || file.size > 3145728)
        throw new Error('tamano');
      bytes = await readFile(path);
      if (
        bytes.length !== row.byte_size ||
        createHash('sha256').update(bytes).digest('hex') !== row.sha256
      )
        throw new Error('sha256');
    } catch (error) {
      if (error.code === 'ENOENT') report.missing.push(entry);
      else
        report.invalid.push({
          ...entry,
          reason: [
            'metadata',
            'archivo_no_regular',
            'tamano',
            'sha256',
          ].includes(error.message)
            ? error.message
            : 'lectura',
        });
      continue;
    }
    if (dryRun) {
      report.recovered.push({ ...entry, dry_run: true });
      continue;
    }
    await client.query('BEGIN');
    try {
      // Mismo bloqueo que las escrituras de API: no resucitar una carga eliminada
      // ni sobrescribir metadata que cambio mientras se leia el archivo.
      await client.query('SELECT pg_advisory_xact_lock(22603112)');
      const result = await client.query(
        `UPDATE "BANNERS_TUTORIA" SET content_bytes=$2
         WHERE id_banner=$1 AND content_bytes IS NULL AND deleted_at IS NULL
           AND (attached_offer_id IS NOT NULL OR expires_at > now())
           AND storage_name=$3 AND byte_size=$4 AND sha256=$5 AND mime_type=$6
         RETURNING id_banner`,
        [
          row.id_banner,
          bytes,
          row.storage_name,
          row.byte_size,
          row.sha256,
          row.mime_type,
        ],
      );
      await client.query('COMMIT');
      (result.rowCount ? report.recovered : report.skipped).push(entry);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  return report;
}

async function main() {
  require('dotenv/config');
  const { Client } = require('pg');
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--dry-run'))
    throw new Error('Usar solo --dry-run opcional');
  if (
    !process.env.DATABASE_URL ||
    !process.env.BANNER_STORAGE_DIR ||
    !process.env.PUBLIC_API_URL
  )
    throw new Error(
      'Configurar DATABASE_URL, BANNER_STORAGE_DIR y PUBLIC_API_URL',
    );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const report = await recoverBanners({
      client,
      directory: process.env.BANNER_STORAGE_DIR,
      publicOrigin: process.env.PUBLIC_API_URL,
      dryRun: args.includes('--dry-run'),
    });
    console.log(JSON.stringify(report, null, 2));
    // Un reporte incompleto se debe atender; los otros banners ya recuperados
    // quedan confirmados y una segunda ejecucion puede continuar sin duplicar.
    if (report.missing.length || report.invalid.length) process.exitCode = 2;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error(
      'Recuperacion fallida; comprobar conexion, migracion y permisos. No se muestran credenciales.',
    );
    process.exitCode = 1;
  });
}
module.exports = { recoverBanners };
