// Integracion real: crea y elimina SOLO una BD temporal propia, nunca trunca tablas.
require('reflect-metadata');
require('dotenv/config');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { Client } = require('pg');
const request = require('supertest');
const { seedLocal } = require('./seed-local.cjs');

async function main() {
  const url = new URL(
    process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  );
  if (
    !process.env.TEST_DATABASE_URL &&
    (!['127.0.0.1', 'localhost', 'postgres'].includes(url.hostname) ||
      url.pathname !== '/timebank_local')
  )
    throw new Error(
      'Usar Compose local o TEST_DATABASE_URL explicita de un servidor de pruebas con permiso CREATE DATABASE.',
    );
  const database = `timebank_test_${randomBytes(8).toString('hex')}`;
  const admin = new Client({ connectionString: url.href });
  let created = false;
  const apps = [];
  const originalNow = Date.now;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    url.pathname = `/${database}`;
    Object.assign(process.env, {
      DATABASE_URL: url.href,
      DATABASE_ENABLED: 'true',
      PERSISTENCE_MODE: 'prisma',
      NODE_ENV: 'development',
      JWT_SECRET: randomBytes(48).toString('hex'),
      RATE_LIMIT_MAX: '10000',
      JWT_EXPIRES_IN_SECONDS: '86400',
    });
    const migrate = () =>
      execFileSync(
        process.execPath,
        [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
        { cwd: resolve(__dirname, '..'), env: process.env, stdio: 'pipe' },
      );
    migrate();
    migrate(); // Repetir el arranque no debe recrear tablas ni datos.
    const db = new Client({ connectionString: url.href });
    await db.connect();
    try {
      await seedLocal(db);
      await seedLocal(db);
      const counts = await db.query(
        'SELECT (SELECT count(*) FROM "CARRERAS")::int AS careers, (SELECT count(*) FROM "CATEGORIAS")::int AS categories, (SELECT count(*) FROM "HABILIDADES")::int AS skills',
      );
      assert.deepEqual(counts.rows[0], {
        careers: 1,
        categories: 4,
        skills: 5,
      });
    } finally {
      await db.end();
    }

    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('../dist/app.module');
    const { configureApp } = require('../dist/config/configure-app');
    const {
      USERS_REPOSITORY,
    } = require('../dist/modules/users/users.repository');
    const {
      EXCHANGE_REPOSITORY,
    } = require('../dist/modules/exchanges/exchange.repository');
    const open = async () => {
      const app = await NestFactory.create(AppModule, {
        logger: false,
        abortOnError: false,
      });
      apps.push(app);
      configureApp(app);
      await app.init();
      return app;
    };
    const first = await open();
    const second = await open();
    let api = request(first.getHttpServer());
    const otherApi = request(second.getHttpServer());
    const ready = await api.get('/health/ready').expect(200);
    assert.equal(ready.body.persistence, 'postgresql');
    const careerId = '30000000-0000-4000-8000-000000000001';
    const skillId = '20000000-0000-4000-8000-000000000001';
    const password = randomBytes(24).toString('base64url');
    const register = async (correo) =>
      (
        await api
          .post('/auth/register')
          .send({
            nombre: 'Prueba',
            apellido: 'PostgreSQL',
            correo,
            password,
            idCarrera: careerId,
            semestre: 1,
          })
          .expect(201)
      ).body;
    const provider = await register('provider@example.test');
    const consumer = await register('consumer@example.test');
    const administrator = await register('admin@example.test');
    await first.get(USERS_REPOSITORY).grantDevelopmentAdmin(administrator.id);
    const login = async (correo) =>
      (await api.post('/auth/login').send({ correo, password }).expect(200))
        .body.access_token;
    const providerToken = await login(provider.correo);
    const consumerToken = await login(consumer.correo);
    const adminToken = await login(administrator.correo);
    const post = (client, path, token, body, key = randomUUID()) =>
      client
        .post(path)
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', key)
        .send(body);
    await api
      .post('/users/me/skills')
      .auth(providerToken, { type: 'bearer' })
      .send({ skillId, nivel: 'Avanzado' })
      .expect(201);
    const start = new Date(Date.now() + 3600000);
    const end = new Date(start.getTime() + 3600000);
    const slot = (
      await api
        .post('/availability')
        .auth(providerToken, { type: 'bearer' })
        .send({ fechaInicio: start.toISOString(), fechaFin: end.toISOString() })
        .expect(201)
    ).body;
    const grantKey = randomUUID();
    const grantBody = {
      userId: consumer.id,
      amount: '8',
      reason: 'Prueba aislada PostgreSQL',
    };
    const grants = await Promise.all([
      post(api, '/credits/grants', adminToken, grantBody, grantKey),
      post(otherApi, '/credits/grants', adminToken, grantBody, grantKey),
    ]);
    assert.deepEqual(
      grants.map((r) => r.status),
      [201, 201],
    );
    assert.deepEqual(grants[0].body, grants[1].body);
    await post(
      api,
      '/credits/grants',
      adminToken,
      { ...grantBody, amount: '9' },
      grantKey,
    ).expect(409);
    const exchangeBody = {
      providerId: provider.id,
      skillId,
      availabilityId: slot.id_disponibilidad,
      fechaInicio: start.toISOString(),
      fechaFin: end.toISOString(),
    };
    const a = (
      await post(api, '/exchanges', consumerToken, exchangeBody).expect(201)
    ).body;
    const b = (
      await post(api, '/exchanges', consumerToken, exchangeBody).expect(201)
    ).body;
    const accepts = await Promise.all([
      post(api, `/exchanges/${a.id_solicitud}/accept`, providerToken, {}),
      post(otherApi, `/exchanges/${b.id_solicitud}/accept`, providerToken, {}),
    ]);
    assert.deepEqual(accepts.map((r) => r.status).sort(), [200, 409]);
    const reservation = accepts.find((r) => r.status === 200).body;
    const account = async (token) =>
      (await api.get('/credits/me').auth(token, { type: 'bearer' }).expect(200))
        .body;
    assert.equal((await account(consumerToken)).saldo, '8');
    assert.equal((await account(consumerToken)).creditos_retenidos, '4');

    // Excepcion despues de modificar un borrador: no debe llegar a PostgreSQL.
    await assert.rejects(
      first.get(EXCHANGE_REPOSITORY).transaction((state) => {
        state.users.get(consumer.id).saldo = 999;
        throw new Error('rollback deliberado');
      }),
      /rollback deliberado/,
    );
    assert.equal((await account(consumerToken)).saldo, '8');

    Date.now = () => end.getTime() + 1000;
    await post(
      api,
      `/reservations/${reservation.id_reserva}/confirm`,
      consumerToken,
      {},
    ).expect(200);
    const confirmKey = randomUUID();
    const confirms = await Promise.all([
      post(
        api,
        `/reservations/${reservation.id_reserva}/confirm`,
        providerToken,
        {},
        confirmKey,
      ),
      post(
        otherApi,
        `/reservations/${reservation.id_reserva}/confirm`,
        providerToken,
        {},
        confirmKey,
      ),
    ]);
    assert.deepEqual(
      confirms.map((r) => r.status),
      [200, 200],
    );
    assert.deepEqual(confirms[0].body, confirms[1].body);
    assert.equal(confirms[0].body.estado, 'Completada');
    assert.equal((await account(consumerToken)).saldo, '4');
    assert.equal((await account(providerToken)).saldo, '4');
    assert.equal((await account(consumerToken)).creditos_retenidos, '0');
    Date.now = originalNow;

    await first.close();
    await second.close();
    const restarted = await open();
    api = request(restarted.getHttpServer());
    assert.equal((await account(consumerToken)).saldo, '4');
    const replay = await post(
      api,
      '/credits/grants',
      adminToken,
      grantBody,
      grantKey,
    ).expect(201);
    assert.deepEqual(replay.body, grants[0].body);
    assert.equal((await account(consumerToken)).saldo, '4');
    const integrity = (
      await api
        .get('/exchanges/integrity')
        .auth(adminToken, { type: 'bearer' })
        .expect(200)
    ).body;
    assert.equal(integrity.status, 'ok');
    assert.equal(integrity.scope, 'postgresql-transaction');
    console.log(
      'PostgreSQL OK: migracion/semilla repetibles, HTTP/JWT, 2 instancias, reserva unica, cobro unico, idempotencia persistente, rollback y reinicio.',
    );
  } finally {
    Date.now = originalNow;
    await Promise.all(apps.map((app) => app.close().catch(() => undefined)));
    if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end();
  }
}
void main().catch((error) => {
  // Las excepciones SQL/CLI pueden incluir la URL: informar solo el resultado.
  console.error(
    'Prueba PostgreSQL fallida:',
    error instanceof assert.AssertionError
      ? error.message
      : error?.constructor?.name,
  );
  process.exitCode = 1;
});
