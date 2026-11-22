// Regresion #47: procesos HTTP independientes, PostgreSQL real y discos separados.
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} = require('node:fs/promises');
const { createServer } = require('node:net');
const { tmpdir } = require('node:os');
const { basename, dirname, join, resolve } = require('node:path');
const { Client } = require('pg');
const request = require('supertest');
const sharp = require('sharp');
const argon2 = require('argon2');
const { recoverBanners } = require('./recover-banners.cjs');
const { seedLocal } = require('./seed-local.cjs');

const migration = '20261122020000_banner_bytes_postgres';
const skillId = '20000000-0000-4000-8000-000000000001';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function tutor(db, password) {
  const id = randomUUID();
  const correo = `banner-${id}@ucb.edu.bo`;
  await db.query(
    `INSERT INTO "USUARIOS" (id_usuario,nombre,apellido,correo,password_hash,rol,estado,email_verificado_at,bono_decidido_at,cuenta_previa)
     VALUES ($1,'Prueba','Banners',$2,$3,'Estudiante','Activo',now(),now(),true)`,
    [id, correo, await argon2.hash(password)],
  );
  await db.query(
    `INSERT INTO "USUARIO_HABILIDADES" (id_usuario,id_habilidad,nivel) VALUES ($1,$2,'Avanzado')`,
    [id, skillId],
  );
  return { id, correo };
}

async function legacyOffer(db, actor, bytes) {
  const id = randomUUID();
  const offerId = randomUUID();
  const slotId = randomUUID();
  const name = `${id}.png`;
  await db.query(
    `INSERT INTO "BANNERS_TUTORIA" (id_banner,id_tutor,storage_name,mime_type,byte_size,sha256,expires_at,attached_offer_id)
     VALUES ($1,$2,$3,'image/png',$4,$5,now()+interval '24 hours',$6)`,
    [id, actor.id, name, bytes.length, hash(bytes), offerId],
  );
  await db.query(
    `INSERT INTO "DISPONIBILIDADES" (id_disponibilidad,id_usuario,fecha_inicio,fecha_fin,estado)
     VALUES ($1,$2,now()+interval '3 days',now()+interval '3 days 1 hour','disponible')`,
    [slotId, actor.id],
  );
  await db.query(
    `INSERT INTO "OFERTAS" (id_oferta,id_tutor,id_habilidad,id_disponibilidad,id_banner,nivel,titulo,descripcion,costo_creditos)
     VALUES ($1,$2,$3,$4,$5,'Avanzado','Banner anterior','Oferta que debe conservarse',3.7)`,
    [offerId, actor.id, skillId, slotId, id],
  );
  return { id, offerId, name, sha256: hash(bytes) };
}

async function verifyPopulatedMigration(connectionString, bytes) {
  // Segunda BD propia: aplica los SQL oficiales anteriores, inserta una oferta,
  // aplica solo la nueva migracion y compara todas sus columnas anteriores.
  const admin = new Client({ connectionString });
  const database = `timebank_banner_migration_${randomBytes(8).toString('hex')}`;
  assert.match(database, /^timebank_banner_migration_[a-f0-9]{16}$/);
  let db;
  let created = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    const target = new URL(connectionString);
    target.pathname = `/${database}`;
    db = new Client({ connectionString: target.href });
    await db.connect();
    const migrations = resolve(__dirname, '../prisma/migrations');
    for (const entry of (
      await readdir(migrations, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && entry.name < migration)
        await db.query(
          await readFile(join(migrations, entry.name, 'migration.sql'), 'utf8'),
        );
    }
    await seedLocal(db);
    const actor = await tutor(db, randomBytes(24).toString('base64url'));
    const fixture = await legacyOffer(db, actor, bytes);
    const snapshot = async () => ({
      banner: (
        await db.query(
          'SELECT to_jsonb(b) - \'content_bytes\' AS row FROM "BANNERS_TUTORIA" b WHERE id_banner=$1',
          [fixture.id],
        )
      ).rows[0].row,
      offer: (
        await db.query('SELECT * FROM "OFERTAS" WHERE id_oferta=$1', [
          fixture.offerId,
        ])
      ).rows[0],
    });
    const before = await snapshot();
    await db.query(
      await readFile(join(migrations, migration, 'migration.sql'), 'utf8'),
    );
    assert.deepEqual(await snapshot(), before);
    assert.equal(
      (
        await db.query(
          'SELECT content_bytes FROM "BANNERS_TUTORIA" WHERE id_banner=$1',
          [fixture.id],
        )
      ).rows[0].content_bytes,
      null,
    );
    console.log(
      'Banners migracion poblada OK: oferta, ID, URL derivada y metadata intactos; bytes anteriores NULL.',
    );
  } finally {
    await db?.end();
    if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end();
  }
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

async function launch(env) {
  const child = fork(__filename, ['--instance'], {
    env,
    cwd: resolve(__dirname, '..'),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  // Consumir salida sin publicar configuracion, tokens ni logs temporales.
  child.stdout.resume();
  child.stderr.resume();
  try {
    await new Promise((done, fail) => {
      const timeout = setTimeout(
        () => fail(new Error('La instancia no inicio en 30s')),
        30000,
      );
      const failed = () => {
        clearTimeout(timeout);
        fail(new Error('La instancia termino antes de estar lista'));
      };
      child.once('error', failed);
      child.once('exit', failed);
      child.once('message', (message) => {
        clearTimeout(timeout);
        child.removeListener('exit', failed);
        child.removeListener('error', failed);
        if (message !== 'ready') fail(new Error('La instancia no esta lista'));
        else done();
      });
    });
    return child;
  } catch (error) {
    if (child.exitCode === null) child.kill();
    throw error;
  }
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  const timeout = setTimeout(() => child.kill(), 10000);
  child.send('stop');
  try {
    await exited;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyBannerPersistence({ connectionString }) {
  assert.match(
    new URL(connectionString).pathname,
    /^\/timebank_test_[a-f0-9]{16}$/,
  );
  const bytes = await sharp({
    create: { width: 8, height: 5, channels: 3, background: '#156369' },
  })
    .png()
    .toBuffer();
  await verifyPopulatedMigration(connectionString, bytes);
  const root = await mkdtemp(join(tmpdir(), 'nexou-issue47-ab-'));
  assert.equal(dirname(root), resolve(tmpdir()));
  assert.ok(basename(root).startsWith('nexou-issue47-ab-'));
  const diskA = join(root, 'A');
  const diskB = join(root, 'B');
  await mkdir(diskA);
  await mkdir(diskB);
  const db = new Client({ connectionString });
  let instance;
  try {
    await db.connect();
    const password = randomBytes(24).toString('base64url');
    const actor = await tutor(db, password);
    const recoverable = await legacyOffer(db, await tutor(db, password), bytes);
    const missing = await legacyOffer(db, await tutor(db, password), bytes);
    const invalid = await legacyOffer(db, await tutor(db, password), bytes);
    await writeFile(join(diskA, recoverable.name), bytes);
    const corrupted = Buffer.from(bytes);
    corrupted[corrupted.length - 1] ^= 1;
    await writeFile(join(diskA, invalid.name), corrupted);
    const port = await freePort();
    const origin = `http://127.0.0.1:${port}`;
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: connectionString,
      DATABASE_ENABLED: 'true',
      PERSISTENCE_MODE: 'prisma',
      PORT: String(port),
      PUBLIC_API_URL: origin,
      JWT_SECRET: randomBytes(48).toString('hex'),
      RATE_LIMIT_MAX: '10000',
      MAIL_TRANSPORT: 'disabled',
      GOOGLE_CALENDAR_ENABLED: 'false',
      BANNER_STORAGE_DIR: diskA,
    };
    instance = await launch(env);
    let api = request(origin);
    assert.equal(
      (await api.get('/health/ready').expect(200)).body.persistence,
      'postgresql',
    );
    const token = (
      await api
        .post('/auth/login')
        .send({ correo: actor.correo, password })
        .expect(200)
    ).body.access_token;
    const uploadKey = randomUUID();
    const upload = async (key = uploadKey, content = bytes) =>
      api
        .post('/tutoring/banners')
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', key)
        .attach('banner', content, {
          filename: 'publica.png',
          contentType: 'image/png',
        });
    const uploaded = await upload();
    assert.equal(uploaded.status, 201);
    const url = uploaded.body.url;
    const path = new URL(url).pathname;
    const id = path.split('/').at(-1);
    const stored = (
      await db.query(
        'SELECT content_bytes,byte_size,sha256,mime_type FROM "BANNERS_TUTORIA" WHERE id_banner=$1',
        [id],
      )
    ).rows[0];
    assert.ok(Buffer.isBuffer(stored.content_bytes));
    assert.equal(stored.content_bytes.length, stored.byte_size);
    assert.equal(hash(stored.content_bytes), stored.sha256);
    await api.get(path).expect(404); // sigue siendo privada antes de publicar
    const start = new Date(Date.now() + 4 * 86400000);
    const offer = (
      await api
        .post('/tutoring/offers')
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({
          skillId,
          nivel: 'Avanzado',
          titulo: 'Persistencia entre instancias',
          descripcion: 'Banner del issue 47',
          costoCreditos: '3.7',
          fechaInicio: start.toISOString(),
          fechaFin: new Date(start.getTime() + 3600000).toISOString(),
          bannerUrl: url,
        })
        .expect(201)
    ).body;
    const download = async (reference) => {
      const response = await api.get(new URL(reference).pathname).expect(200);
      assert.ok(Buffer.isBuffer(response.body));
      return {
        url: reference,
        path: new URL(reference).pathname,
        http: response.status,
        content_type: response.headers['content-type'],
        sha256: hash(response.body),
      };
    };
    const a = await download(url);
    assert.equal(a.sha256, stored.sha256);
    assert.equal(a.content_type, stored.mime_type);
    assert.equal(
      (await api.get(`/tutoring/offers/${offer.id_oferta}`).expect(200)).body
        .bannerUrl,
      url,
    );
    // El fallback legado todavia funciona mientras el archivo esta disponible.
    await download(`${origin}/tutoring/banners/${recoverable.id}`);
    const recovery = { client: db, directory: diskA, publicOrigin: origin };
    const dry = await recoverBanners({ ...recovery, dryRun: true });
    assert.ok(dry.recovered.some((row) => row.id_banner === recoverable.id));
    assert.equal(
      (
        await db.query(
          'SELECT content_bytes FROM "BANNERS_TUTORIA" WHERE id_banner=$1',
          [recoverable.id],
        )
      ).rows[0].content_bytes,
      null,
    );
    const report = await recoverBanners(recovery);
    assert.deepEqual(
      report.recovered.map((row) => row.id_banner),
      [recoverable.id],
    );
    assert.ok(
      report.missing.some(
        (row) =>
          row.id_banner === missing.id &&
          row.offer_ids.includes(missing.offerId),
      ),
    );
    assert.ok(
      report.invalid.some(
        (row) => row.id_banner === invalid.id && row.reason === 'sha256',
      ),
    );
    assert.equal((await recoverBanners(recovery)).recovered.length, 0);
    // PostgreSQL tambien protege tamano y SHA ante escritores SQL externos.
    await assert.rejects(
      db.query(
        'UPDATE "BANNERS_TUTORIA" SET content_bytes=$2 WHERE id_banner=$1',
        [id, corrupted],
      ),
      (error) => error.code === '23514',
    );
    await assert.rejects(
      db.query(
        'UPDATE "BANNERS_TUTORIA" SET byte_size=byte_size+1 WHERE id_banner=$1',
        [id],
      ),
      (error) => error.code === '23514',
    );
    // Un error SQL real durante la carga no confirma metadata ni idempotencia.
    const before = Number(
      (await db.query('SELECT count(*) FROM "BANNERS_TUTORIA"')).rows[0].count,
    );
    const failedKey = randomUUID();
    await db.query(
      'ALTER TABLE "BANNERS_TUTORIA" ADD CONSTRAINT issue47_upload_failure CHECK (false) NOT VALID',
    );
    try {
      assert.ok((await upload(failedKey)).status >= 500);
    } finally {
      await db.query(
        'ALTER TABLE "BANNERS_TUTORIA" DROP CONSTRAINT issue47_upload_failure',
      );
    }
    assert.equal(
      Number(
        (await db.query('SELECT count(*) FROM "BANNERS_TUTORIA"')).rows[0]
          .count,
      ),
      before,
    );
    assert.equal((await upload(failedKey)).status, 201);
    await stop(instance);
    instance = undefined;
    // Destruye el disco A antes de iniciar B: B no puede recuperar por accidente
    // desde la carpeta de A ni desde un singleton en memoria del primer proceso.
    await rm(diskA, { recursive: true, force: true });
    assert.deepEqual(await readdir(diskB), []);
    instance = await launch({ ...env, BANNER_STORAGE_DIR: diskB });
    api = request(origin);
    const fromB = (
      await api.get(`/tutoring/offers/${offer.id_oferta}`).expect(200)
    ).body;
    assert.equal(fromB.bannerUrl, url);
    const b = await download(fromB.bannerUrl);
    assert.deepEqual(b, a);
    assert.equal((await upload()).body.url, url); // replay tras reinicio
    const recoveredB = await download(
      `${origin}/tutoring/banners/${recoverable.id}`,
    );
    assert.equal(recoveredB.sha256, recoverable.sha256);
    for (const legacy of [missing, invalid]) {
      const detail = (
        await api.get(`/tutoring/offers/${legacy.offerId}`).expect(200)
      ).body;
      assert.equal(detail.bannerUrl, `${origin}/tutoring/banners/${legacy.id}`);
      await api.get(`/tutoring/banners/${legacy.id}`).expect(503);
      assert.equal(
        (
          await db.query('SELECT id_banner FROM "OFERTAS" WHERE id_oferta=$1', [
            legacy.offerId,
          ])
        ).rows[0].id_banner,
        legacy.id,
      );
    }
    assert.deepEqual(await readdir(diskB), []);
    console.log(
      'Banners PostgreSQL A/B OK:',
      JSON.stringify({
        A: a,
        B: b,
        diskA_removed_before_B: true,
        diskB_empty: true,
        recovered: {
          id: recoverable.id,
          http: recoveredB.http,
          sha256: recoveredB.sha256,
        },
        missing: {
          id: missing.id,
          offer_id: missing.offerId,
          offer_http: 200,
          image_http: 503,
          reference_preserved: true,
        },
        invalid: { id: invalid.id, reason: 'sha256' },
        recovery_repeat_writes: 0,
        sql_rollback: true,
      }),
    );
  } finally {
    await stop(instance);
    await db.end();
    // root fue verificado contra tmpdir y el prefijo exclusivo antes de usarlo.
    await rm(root, { recursive: true, force: true });
  }
}

async function instanceMain() {
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const { configureApp } = require('../dist/config/configure-app');
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configureApp(app);
  await app.listen(Number(process.env.PORT), '127.0.0.1');
  process.on('message', async (message) => {
    if (message === 'stop') {
      await app.close();
      process.exit(0);
    }
  });
  process.send('ready');
}

if (process.argv.includes('--instance')) {
  instanceMain().catch(() => process.exit(1));
}
module.exports = { verifyBannerPersistence };
