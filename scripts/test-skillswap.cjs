// Prueba real sobre una base aleatoria propia. Nunca modifica la base de la URL.
require('reflect-metadata');
require('dotenv/config');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { Client } = require('pg');
const request = require('supertest');
const { prepareSkillswap } = require('./prepare-skillswap.cjs');

async function main() {
  if (!process.env.TEST_DATABASE_URL)
    throw new Error(
      'TEST_DATABASE_URL explícita requerida (servidor de pruebas con CREATE DATABASE)',
    );
  const url = new URL(process.env.TEST_DATABASE_URL);
  const admin = new Client({ connectionString: url.href });
  const name = `nexo_v4_test_${randomBytes(8).toString('hex')}`;
  const apps = [];
  let db,
    created = false,
    roleCreated = false;
  const appRole = `nexo_app_${randomBytes(8).toString('hex')}`;
  const originalNow = Date.now;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    url.pathname = `/${name}`;
    Object.assign(process.env, {
      DATABASE_URL: url.href,
      DATABASE_ENABLED: 'true',
      PERSISTENCE_MODE: 'prisma',
      NODE_ENV: 'development',
      JWT_SECRET: randomBytes(48).toString('hex'),
      JWT_EXPIRES_IN_SECONDS: '86400',
      RATE_LIMIT_MAX: '10000',
      REGISTRATION_INITIAL_CREDITS: '0',
      APP_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
      APP_HASH_PEPPER: randomBytes(32).toString('hex'),
    });
    db = new Client({ connectionString: url.href });
    await db.connect();
    const options = {
      encryptionKey: process.env.APP_ENCRYPTION_KEY,
      hashPepper: process.env.APP_HASH_PEPPER,
    };
    await prepareSkillswap(db, { ...options, fresh: true });
    await admin.query(
      "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='rol_app') THEN CREATE ROLE rol_app NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='rol_lectura') THEN CREATE ROLE rol_lectura NOLOGIN; END IF; END $$",
    );
    const permissions = readFileSync(
      join(
        __dirname,
        '../prisma/vendor/skillswap-v4/05_seguridad_roles.sql.tpl',
      ),
      'utf8',
    ).split('COMMENT ON ROLE rol_app')[1];
    await db.query(
      ('COMMENT ON ROLE rol_app' + permissions)
        .split('\n')
        .filter((line) => !line.includes(':"db"'))
        .join('\n'),
    );
    await prepareSkillswap(db, options);
    for (const file of [
      '12_pruebas_economia_match.sql',
      '13_pruebas_bi_hu07.sql',
      '14_pruebas_penalizaciones_pendientes.sql',
    ]) {
      const sql = readFileSync(
        join(__dirname, '../prisma/vendor/skillswap-v4', file),
        'utf8',
      )
        .split('\n')
        .filter((line) => !line.startsWith('\\'))
        .join('\n');
      await db.query(sql);
    }
    const appPassword = randomBytes(32).toString('hex');
    await admin.query(
      `CREATE ROLE "${appRole}" LOGIN PASSWORD '${appPassword}' IN ROLE rol_app`,
    );
    roleCreated = true;
    await admin.query(`GRANT CONNECT ON DATABASE "${name}" TO "${appRole}"`);
    const appUrl = new URL(url);
    appUrl.username = appRole;
    appUrl.password = appPassword;
    process.env.DATABASE_URL = appUrl.href;
    const { Test } = require('@nestjs/testing');
    const { AppModule } = require('../dist/app.module');
    const { configureApp } = require('../dist/config/configure-app');
    const {
      VerificationMailer,
    } = require('../dist/modules/auth/verification-mailer');
    const {
      USERS_REPOSITORY,
    } = require('../dist/modules/users/users.repository');
    const mailbox = [];
    const open = async () => {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(VerificationMailer)
        .useValue({
          assertConfigured() {},
          async send(correo, token) {
            mailbox.push({ correo, token });
          },
        })
        .compile();
      const app = module.createNestApplication({
        logger: ['error'],
        abortOnError: false,
      });
      apps.push(app);
      configureApp(app);
      await app.init();
      return app;
    };
    const app = await open();
    let api = request(app.getHttpServer());
    await api.get('/health/ready').expect(200);
    const password = randomBytes(24).toString('base64url');
    async function register(label) {
      const correo = `${label}@ucb.edu.bo`;
      const user = (
        await api
          .post('/auth/register')
          .send({
            nombre: label,
            apellido: 'Test',
            correo,
            password,
            idCarrera: '30000000-0000-4000-8000-000000000001',
            semestre: 1,
          })
          .expect(201)
      ).body;
      await api
        .post('/auth/verify-email')
        .send({ token: mailbox.findLast((m) => m.correo === correo).token })
        .expect(200);
      return user;
    }
    const tutor = await register('tutor'),
      student = await register('student'),
      adminUser = await register('admin'),
      emptyTutor = await register('empty');
    await app.get(USERS_REPOSITORY).grantDevelopmentAdmin(adminUser.id);
    const login = async (u) =>
      (
        await api
          .post('/auth/login')
          .send({ correo: u.correo, password })
          .expect(200)
      ).body.access_token;
    const tt = await login(tutor),
      st = await login(student),
      at = await login(adminUser),
      et = await login(emptyTutor);
    const post = (path, token, body = {}, key = randomUUID()) =>
      api
        .post(path)
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', key)
        .send(body)
        .expect((res) => {
          if (res.status >= 500) throw new Error(JSON.stringify(res.body));
        });
    const get = (path, token) => api.get(path).auth(token, { type: 'bearer' });
    const curriculum = (await api.get('/curricula/systems').expect(200)).body
      .courses;
    assert.equal(curriculum.length, 50);
    assert.equal(curriculum.filter((c) => !c.externo).length, 49);
    const course = curriculum.find((c) => !c.externo),
      next = curriculum.find((c) => !c.externo && c.codigo !== course.codigo),
      skillId = course.id_habilidad;
    for (const token of [tt, et])
      await api
        .post('/users/me/skills')
        .auth(token, { type: 'bearer' })
        .send({ skillId, nivel: 'Avanzado' })
        .expect(201);
    await api.get('/roadmap/me').expect(401);
    await get('/analytics/academic', st).expect(403);
    const putRoadmap = (code, estado) =>
      api
        .put(`/roadmap/me/courses/${code}`)
        .auth(st, { type: 'bearer' })
        .send({ estado });
    await Promise.all([
      putRoadmap(course.codigo, 'approved').expect(200),
      putRoadmap(next.codigo, 'current').expect(200),
    ]);
    assert.deepEqual((await get('/roadmap/me', st).expect(200)).body.courses, {
      [course.codigo]: 'approved',
      [next.codigo]: 'current',
    });
    assert.deepEqual(
      (await get('/roadmap/me', tt).expect(200)).body.courses,
      {},
    );
    await putRoadmap('MAT-030', 'current').expect(400);
    await putRoadmap('MAT-030', 'approved').expect(200);
    await putRoadmap('MAT-030', 'pending').expect(200);
    await putRoadmap('XXX-999', 'approved').expect(400);
    const grantKey = randomUUID(),
      grantBody = {
        userId: student.id,
        amount: '30.5',
        reason: 'Verificación aislada',
      };
    const granted = await post(
      '/credits/grants',
      at,
      grantBody,
      grantKey,
    ).expect(201);
    assert.deepEqual(
      (await post('/credits/grants', at, grantBody, grantKey).expect(201)).body,
      granted.body,
    );
    assert.equal((await get('/credits/me', st).expect(200)).body.saldo, '30.5');
    assert.equal(
      (
        await db.query('SELECT saldo FROM "USUARIOS" WHERE id_usuario=$1', [
          student.id,
        ])
      ).rows[0].saldo,
      305,
    );
    async function book(token, user, offset, withOffer = true) {
      const start = new Date(originalNow() + offset),
        end = new Date(start.getTime() + 3600000);
      const offer = withOffer
        ? (
            await post('/tutoring/offers', token, {
              skillId,
              nivel: 'Avanzado',
              titulo: 'Integración real',
              descripcion: 'Clase de prueba',
              costoCreditos: '99',
              fechaInicio: start.toISOString(),
              fechaFin: end.toISOString(),
            }).expect(201)
          ).body
        : (
            await api
              .post('/availability')
              .auth(token, { type: 'bearer' })
              .send({
                fechaInicio: start.toISOString(),
                fechaFin: end.toISOString(),
              })
              .expect(201)
          ).body;
      const expected = (
        await db.query(
          'SELECT fn_calcular_costo_clase($1::uuid,$2::uuid,$3::timestamptz) AS price',
          [skillId, user.id, start],
        )
      ).rows[0].price;
      if (withOffer) assert.equal(Number(offer.costo_creditos), expected / 10);
      const exchange = (
        await post('/exchanges', st, {
          providerId: user.id,
          skillId,
          availabilityId: offer.id_disponibilidad,
          offerId: offer.id_oferta,
          fechaInicio: start.toISOString(),
          fechaFin: end.toISOString(),
        }).expect(201)
      ).body;
      assert.equal(Number(exchange.creditos_requeridos), expected / 10);
      await db.query(
        "UPDATE config_economia SET valor=valor+10 WHERE clave='costo_base'",
      );
      const key = randomUUID();
      const reservation = (
        await post(
          `/exchanges/${exchange.id_solicitud}/accept`,
          token,
          {},
          key,
        ).expect(200)
      ).body;
      assert.equal(Number(reservation.creditos), expected / 10);
      await db.query(
        "UPDATE config_economia SET valor=valor-10 WHERE clave='costo_base'",
      );
      assert.deepEqual(
        (
          await post(
            `/exchanges/${exchange.id_solicitud}/accept`,
            token,
            {},
            key,
          ).expect(200)
        ).body,
        reservation,
      );
      return { reservation, end, expected, offer };
    }
    const matchPath = `/tutoring/recommendations?skillId=${skillId}`;
    await api.get(matchPath).expect(401);
    const initialMatches = (await get(matchPath, st).expect(200)).body.data;
    assert.equal(initialMatches.length, 2);
    assert.ok(initialMatches.every((r) => r.afinidad === 47.5));
    assert.equal((await get(matchPath, tt).expect(200)).body.data.length, 1);
    await get(matchPath + '&fechaInicio=invalid', st).expect(400);
    await get(`/tutoring/recommendations?skillId=${randomUUID()}`, st).expect(
      400,
    );
    const slotStart = new Date(originalNow() + 86400000),
      slotEnd = new Date(+slotStart + 3600000);
    await api
      .post('/availability')
      .auth(et, { type: 'bearer' })
      .send({
        fechaInicio: slotStart.toISOString(),
        fechaFin: slotEnd.toISOString(),
      })
      .expect(201);
    const timedPath =
      matchPath +
      `&fechaInicio=${encodeURIComponent(slotStart.toISOString())}&fechaFin=${encodeURIComponent(slotEnd.toISOString())}`;
    const timedMatches = (await get(timedPath, st).expect(200)).body.data;
    assert.equal(timedMatches.length, 1);
    assert.equal(timedMatches[0].tutor_id, emptyTutor.id);
    assert.equal(timedMatches[0].afinidad, 72.5);
    await get(
      matchPath + `&fechaInicio=${encodeURIComponent(slotStart.toISOString())}`,
      st,
    ).expect(400);
    const completed = await book(tt, tutor, 3600000);
    const occupiedPath =
      matchPath +
      `&fechaInicio=${encodeURIComponent(new Date(+completed.end - 3600000).toISOString())}&fechaFin=${encodeURIComponent(completed.end.toISOString())}`;
    assert.deepEqual((await get(occupiedPath, st).expect(200)).body.data, []);
    Date.now = () => completed.end.getTime() + 1000;
    await post(
      `/reservations/${completed.reservation.id_reserva}/confirm`,
      st,
    ).expect(200);
    await post(
      `/reservations/${completed.reservation.id_reserva}/confirm`,
      tt,
    ).expect(200);
    const reviewKey = randomUUID(),
      reviewBody = { calificacion: 5, comentario: 'Clase completada' };
    const review = (
      await post(
        `/tutoring/reservations/${completed.reservation.id_reserva}/review`,
        st,
        reviewBody,
        reviewKey,
      ).expect(201)
    ).body;
    assert.deepEqual(
      (
        await post(
          `/tutoring/reservations/${completed.reservation.id_reserva}/review`,
          st,
          reviewBody,
          reviewKey,
        ).expect(201)
      ).body,
      review,
    );
    await post(
      `/tutoring/reservations/${completed.reservation.id_reserva}/review`,
      st,
      reviewBody,
    ).expect(409);
    Date.now = originalNow;
    const late = await book(et, emptyTutor, 7200000);
    const cancelKey = randomUUID();
    const cancelled = (
      await post(
        `/reservations/${late.reservation.id_reserva}/cancel`,
        et,
        { motivo: 'Prueba tardía' },
        cancelKey,
      ).expect(200)
    ).body;
    assert.deepEqual(
      (
        await post(
          `/reservations/${late.reservation.id_reserva}/cancel`,
          et,
          { motivo: 'Prueba tardía' },
          cancelKey,
        ).expect(200)
      ).body,
      cancelled,
    );
    await post(`/reservations/${late.reservation.id_reserva}/cancel`, et, {
      motivo: 'Duplicada',
    }).expect(409);
    let debt = (await get('/credits/penalties/me', et).expect(200)).body;
    assert.ok(JSON.stringify(debt).includes('pendiente'));
    await post('/credits/grants', at, {
      userId: emptyTutor.id,
      amount: '0.3',
      reason: 'No cobro parcial',
    }).expect(201);
    assert.equal((await get('/credits/me', et).expect(200)).body.saldo, '0.3');
    const collection = await post('/credits/grants', at, {
      userId: emptyTutor.id,
      amount: '0.7',
      reason: 'Cobro pendiente',
    }).expect(201);
    assert.equal((await get('/credits/me', et).expect(200)).body.saldo, '0.5');
    if (collection.body.cuenta)
      assert.equal(collection.body.cuenta.saldo, '0.5');
    debt = (await get('/credits/penalties/me', et).expect(200)).body;
    assert.ok(JSON.stringify(debt).includes('cobrada'));
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int n FROM "MOVIMIENTOS_CREDITO" WHERE id_reserva=$1 AND tipo=\'cobro_penalizacion_pendiente\'',
          [late.reservation.id_reserva],
        )
      ).rows[0].n,
      1,
    );
    const debtIntegrity = (await get('/exchanges/integrity', at).expect(200))
      .body;
    assert.equal(debtIntegrity.status, 'ok', JSON.stringify(debtIntegrity));
    const charged = await book(tt, tutor, 10800000, false);
    const beforePenalty = Number(
      (await get('/credits/me', tt).expect(200)).body.saldo,
    );
    await post(`/reservations/${charged.reservation.id_reserva}/cancel`, tt, {
      motivo: 'Penalización inmediata',
    }).expect(200);
    assert.equal(
      Number((await get('/credits/me', tt).expect(200)).body.saldo),
      beforePenalty - 0.5,
    );
    const timely = await book(tt, tutor, 21600000, false);
    await post(`/reservations/${timely.reservation.id_reserva}/cancel`, tt, {
      motivo: 'Más de cinco horas',
    }).expect(200);
    assert.equal(
      Number((await get('/credits/me', tt).expect(200)).body.saldo),
      beforePenalty - 0.5,
    );
    const integrity = (await get('/exchanges/integrity', at).expect(200)).body;
    assert.equal(integrity.status, 'ok', JSON.stringify(integrity));
    for (const path of [
      '/analytics/academic',
      '/analytics/reputation',
      '/analytics/economy',
      '/analytics/credits',
      '/analytics/overview',
    ])
      await get(path, at).expect(200);
    await app.close();
    const reopened = await open();
    api = request(reopened.getHttpServer());
    assert.equal((await get('/credits/me', et).expect(200)).body.saldo, '0.5');
    assert.deepEqual(
      (await post('/credits/grants', at, grantBody, grantKey).expect(201)).body,
      granted.body,
    );
    assert.equal(
      (await get('/roadmap/me', st).expect(200)).body.courses[course.codigo],
      'approved',
    );
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int n FROM "AUDITORIA" WHERE datos_nuevos IS NOT NULL',
        )
      ).rows[0].n,
      0,
    );
    // Consultas SQL usan reloj real: mover solo las fechas de la reserva ya completada del fixture.
    const began = new Date(originalNow() - 7200000),
      ended = new Date(originalNow() - 3600000);
    await db.query(
      'UPDATE "RESERVAS" SET fecha_inicio=$2,fecha_fin=$3,completed_at=now()-interval \'1 minute\' WHERE id_reserva=$1',
      [completed.reservation.id_reserva, began, ended],
    );
    await db.query(
      'UPDATE "SOLICITUDES_INTERCAMBIO" SET fecha_inicio_propuesta=$2,fecha_fin_propuesta=$3 WHERE id_solicitud=(SELECT id_solicitud FROM "RESERVAS" WHERE id_reserva=$1)',
      [completed.reservation.id_reserva, began, ended],
    );
    await db.query(
      'UPDATE "DISPONIBILIDADES" SET fecha_inicio=$2,fecha_fin=$3 WHERE id_disponibilidad=$1',
      [completed.offer.id_disponibilidad, began, ended],
    );
    const rep = (
      await api
        .get(`/tutoring/reputation?tutorId=${tutor.id}&skillId=${skillId}`)
        .expect(200)
    ).body;
    assert.equal(rep.knowledge_score, 8);
    assert.equal(rep.promedio, 5);
    const classes = (await get('/intercambios/mis-clases', st).expect(200))
      .body;
    assert.equal(classes.resumen.aprendi.clases, 1);
    assert.equal(
      Number(classes.resumen.aprendi.creditos),
      completed.expected / 10,
    );
    console.log(
      'OK SkillSwap v4: bootstrap repetible, registro/login, 49 materias, ruta aislada/concurrente, costo SQL/API, décimas, snapshot, aceptación/replay, liquidación, opinión/reputación, penalización sin saldo, cobro total automático, indicadores y persistencia/replay tras reconexión.',
    );
  } finally {
    Date.now = originalNow;
    for (const app of apps) await app.close();
    await db?.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    if (roleCreated) await admin.query(`DROP ROLE "${appRole}"`);
    await admin.end();
  }
}
main().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
