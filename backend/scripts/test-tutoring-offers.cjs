// Invocado por test:postgres. Solo usa la BD temporal creada por ese script.
// HTTP, dos instancias y PostgreSQL reales; transporte de correo simulado.
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { Client } = require('pg');
const request = require('supertest');

async function verifyTutoringOffers({ open, mailbox, connectionString }) {
  // No reutilizar first: el helper de activacion anterior puede haberlo cerrado.
  const target = new URL(connectionString);
  assert.match(target.pathname, /^\/timebank_test_[a-f0-9]{16}$/);
  const db = new Client({ connectionString });
  await db.connect();
  assert.equal(
    (await db.query('SELECT current_database() AS name')).rows[0].name,
    target.pathname.slice(1),
  );
  const {
    REGISTRATION_POLICY,
  } = require('../dist/modules/auth/registration-policy');
  const {
    EXCHANGE_REPOSITORY,
  } = require('../dist/modules/exchanges/exchange.repository');
  const {
    PrismaService,
  } = require('../dist/infrastructure/prisma/prisma.service');
  const { JwtService } = require('@nestjs/jwt');
  let current;
  let other;
  let api;
  const results = [];
  const password = randomBytes(24).toString('base64url');
  const skillId = '20000000-0000-4000-8000-000000000002';
  const fechaInicio = new Date(
    Date.now() + 2 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const fechaFin = new Date(
    new Date(fechaInicio).getTime() + 45 * 60 * 1000,
  ).toISOString();
  const input = (patch = {}) => ({
    skillId,
    nivel: 'Intermedio',
    titulo: 'Clase de 45 minutos con precio publicado',
    descripcion:
      'Una oferta de prueba aislada; su precio total es independiente de la duracion.',
    costoCreditos: '3.7',
    fechaInicio,
    fechaFin,
    ...patch,
  });
  const publish = (client, actor, body, key = randomUUID()) =>
    client
      .post('/tutoring/offers')
      .auth(actor.token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);
  const register = async (verify = true) => {
    const correo = `ofertas-pg-${randomUUID()}@ucb.edu.bo`;
    const user = (
      await api
        .post('/auth/register')
        .send({
          nombre: 'Prueba',
          apellido: 'Ofertas',
          correo,
          password,
          idCarrera: '30000000-0000-4000-8000-000000000001',
          semestre: 2,
        })
        .expect(201)
    ).body;
    if (!verify)
      return {
        ...user,
        token: await current
          .get(JwtService)
          .signAsync({ sub: user.id, purpose: 'session' }),
      };
    const message = mailbox.findLast((entry) => entry.correo === correo);
    assert.ok(message);
    await api
      .post('/auth/verify-email')
      .send({ token: message.token })
      .expect(200);
    const token = (
      await api.post('/auth/login').send({ correo, password }).expect(200)
    ).body.access_token;
    await api
      .post('/users/me/skills')
      .auth(token, { type: 'bearer' })
      .send({ skillId, nivel: 'Intermedio' })
      .expect(201);
    return { ...user, token };
  };
  const financialState = async () => ({
    balances: (
      await db.query(
        'SELECT id_usuario,saldo::text,creditos_retenidos::text,bono_decidido_at FROM "USUARIOS" ORDER BY id_usuario',
      )
    ).rows,
    movements: (
      await db.query(
        'SELECT * FROM "MOVIMIENTOS_CREDITO" ORDER BY id_movimiento',
      )
    ).rows,
  });
  const userCounts = async (actor) =>
    (
      await db.query(
        'SELECT (SELECT count(*)::int FROM "OFERTAS" WHERE id_tutor=$1) AS offers, (SELECT count(*)::int FROM "DISPONIBILIDADES" WHERE id_usuario=$1) AS slots',
        [actor.id],
      )
    ).rows[0];
  const transactionCounts = async () =>
    (
      await db.query(
        'SELECT (SELECT count(*)::int FROM "SOLICITUDES_INTERCAMBIO") AS requests, (SELECT count(*)::int FROM "RESERVAS") AS reservations, (SELECT count(*)::int FROM "MOVIMIENTOS_CREDITO") AS movements',
      )
    ).rows[0];
  const priceRow = async (id) =>
    (
      await db.query(
        'SELECT id_oferta,costo_creditos::text AS price,scale(costo_creditos) AS scale,id_disponibilidad FROM "OFERTAS" WHERE id_oferta=$1',
        [id],
      )
    ).rows[0];
  try {
    current = await open();
    other = await open();
    api = request(current.getHttpServer());
    const otherApi = request(other.getHttpServer());
    current.get(REGISTRATION_POLICY).initialCredits = '0';
    other.get(REGISTRATION_POLICY).initialCredits = '0';
    const tutor = await register();
    const secondTutor = await register();
    const concurrentTutor = await register();
    const failedTutor = await register();
    const pending = await register(false);
    const balancesBefore = await financialState();
    assert.equal(
      balancesBefore.balances.find((row) => row.id_usuario === tutor.id).saldo,
      '0',
    );

    const key = randomUUID();
    const simultaneous = await Promise.all([
      publish(api, tutor, input(), key),
      publish(otherApi, tutor, input(), key),
    ]);
    assert.deepEqual(
      simultaneous.map((r) => r.status),
      [201, 201],
    );
    assert.deepEqual(simultaneous[0].body, simultaneous[1].body);
    const offer = simultaneous[0].body;
    assert.equal(offer.costo_creditos, '3.7');
    assert.deepEqual(await userCounts(tutor), { offers: 1, slots: 1 });
    const stored = await priceRow(offer.id_oferta);
    assert.equal(stored.price, '3.7');
    assert.equal(stored.scale, 1);
    const cloned = await current
      .get(EXCHANGE_REPOSITORY)
      .read((state) => state.offers.get(offer.id_oferta));
    assert.equal(cloned.costo_creditos, '3.7');
    assert.equal(typeof cloned.costo_creditos, 'string');
    assert.equal(structuredClone(cloned).costo_creditos, '3.7');
    const catalogue = (
      await api.get('/tutoring/offers?page=1&limit=100').expect(200)
    ).body;
    assert.ok(Number.isInteger(catalogue.meta.totalPages));
    assert.ok(
      catalogue.data.some(
        (row) =>
          row.id_oferta === offer.id_oferta && row.costo_creditos === '3.7',
      ),
    );
    results.push({
      caso: '45 minutos, dos instancias y misma clave',
      precio: stored.price,
      ofertas: 1,
      horarios: 1,
      saldoTutor: '0',
    });

    await publish(
      api,
      tutor,
      input({ titulo: 'Contenido distinto' }),
      key,
    ).expect(409);
    const beforeRequest = await transactionCounts();
    const requested = await api
      .post('/exchanges')
      .auth(secondTutor.token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({
        providerId: tutor.id,
        skillId,
        availabilityId: offer.id_disponibilidad,
        fechaInicio,
        fechaFin,
      })
      .expect(201);
    assert.equal(requested.body.id_oferta, offer.id_oferta);
    assert.equal(requested.body.creditos_requeridos, '3.7');
    assert.deepEqual(await transactionCounts(), {
      ...beforeRequest,
      requests: beforeRequest.requests + 1,
    });
    assert.deepEqual(await financialState(), balancesBefore);
    results.push({
      caso: 'availabilityId resuelve oferta y precio pactado sin retener',
      estadoHTTP: 201,
      precio: requested.body.creditos_requeridos,
      reservasNuevas: 0,
      movimientosNuevos: 0,
    });

    for (const value of [
      '0',
      '0.0',
      '-3.7',
      '3.75',
      '3.70',
      '3e1',
      '10000000000',
      3.7,
    ]) {
      await publish(api, secondTutor, input({ costoCreditos: value })).expect(
        400,
      );
      assert.deepEqual(await userCounts(secondTutor), { offers: 0, slots: 0 });
    }
    await publish(api, pending, input()).expect(401);
    await publish(
      api,
      secondTutor,
      input({ skillId: '20000000-0000-4000-8000-000000000001' }),
    ).expect(403);
    await publish(api, secondTutor, input({ nivel: 'Avanzado' })).expect(409);
    await publish(api, secondTutor, input({ fechaFin: fechaInicio })).expect(
      400,
    );
    assert.deepEqual(await userCounts(secondTutor), { offers: 0, slots: 0 });
    const secondOffer = (
      await publish(api, secondTutor, input({ costoCreditos: '3.5' })).expect(
        201,
      )
    ).body;
    assert.equal(secondOffer.costo_creditos, '3.5');
    assert.equal((await priceRow(secondOffer.id_oferta)).price, '3.5');
    assert.equal(secondOffer.bannerUrl, null);
    results.push({
      caso: '3.5 sin banner y validaciones negativas',
      precio: '3.5',
      erroresSinPersistenciaParcial: true,
    });

    for (const invalid of ['3.75', '3.70']) {
      await assert.rejects(
        db.query(
          'UPDATE "OFERTAS" SET costo_creditos=$2::numeric WHERE id_oferta=$1',
          [offer.id_oferta, invalid],
        ),
        (error) => error.code === '23514',
      );
      assert.equal((await priceRow(offer.id_oferta)).price, '3.7');
    }
    results.push({
      caso: 'CHECK SQL sin redondeo',
      rechazados: ['3.75', '3.70'],
      precioConservado: '3.7',
    });

    const races = await Promise.all([
      publish(api, concurrentTutor, input()),
      publish(otherApi, concurrentTutor, input()),
    ]);
    assert.deepEqual(races.map((r) => r.status).sort(), [201, 409]);
    assert.deepEqual(await userCounts(concurrentTutor), {
      offers: 1,
      slots: 1,
    });
    // El indice SQL tambien protege frente a un escritor sin el bloqueo de API.
    await db.query('BEGIN');
    try {
      const extraSlot = randomUUID();
      await db.query(
        'INSERT INTO "DISPONIBILIDADES" (id_disponibilidad,id_usuario,fecha_inicio,fecha_fin,estado) VALUES ($1,$2,$3,$4,\'Disponible\')',
        [extraSlot, concurrentTutor.id, fechaInicio, fechaFin],
      );
      await assert.rejects(
        db.query(
          "INSERT INTO \"OFERTAS\" (id_oferta,id_tutor,id_habilidad,id_disponibilidad,nivel,titulo,descripcion,costo_creditos,estado) VALUES ($1,$2,$3,$4,'Intermedio','Duplicada','No debe persistir',3.7,'Activa')",
          [randomUUID(), concurrentTutor.id, skillId, extraSlot],
        ),
        (error) => error.code === '23505',
      );
    } finally {
      await db.query('ROLLBACK');
    }
    assert.deepEqual(await userCounts(concurrentTutor), {
      offers: 1,
      slots: 1,
    });
    results.push({
      caso: 'dos claves concurrentes e indice unico SQL',
      ofertas: 1,
      horarios: 1,
    });

    // La disponibilidad se escribe primero. Una FK de OFERTAS falla realmente
    // dentro de PostgreSQL y debe revertir tambien ese horario y la idempotencia.
    const prisma = await current.get(PrismaService).connect();
    const originalTransaction = prisma.$transaction.bind(prisma);
    let writtenSlots = 0;
    let failedInSql = 0;
    prisma.$transaction = async (work, options) =>
      originalTransaction(async (tx) => {
        const slotUpsert = tx.disponibilidad.upsert.bind(tx.disponibilidad);
        const offerUpsert = tx.ofertaTutoria.upsert.bind(tx.ofertaTutoria);
        tx.disponibilidad.upsert = async (args) => {
          const result = await slotUpsert(args);
          if (args.create.id_usuario === failedTutor.id) writtenSlots++;
          return result;
        };
        tx.ofertaTutoria.upsert = async (args) => {
          if (args.create.id_tutor !== failedTutor.id) return offerUpsert(args);
          failedInSql++;
          return offerUpsert({
            ...args,
            create: { ...args.create, id_tutor: randomUUID() },
          });
        };
        return work(tx);
      }, options);
    const failedKey = randomUUID();
    try {
      await publish(api, failedTutor, input(), failedKey).expect(409);
    } finally {
      prisma.$transaction = originalTransaction;
    }
    assert.equal(writtenSlots, 1);
    assert.equal(failedInSql, 1);
    assert.deepEqual(await userCounts(failedTutor), { offers: 0, slots: 0 });
    assert.deepEqual(await financialState(), balancesBefore);
    await publish(api, failedTutor, input(), failedKey).expect(201);
    assert.deepEqual(await userCounts(failedTutor), { offers: 1, slots: 1 });
    results.push({
      caso: 'FK fallida despues de insertar horario y reintento',
      rollbackCompleto: true,
      ofertasTrasReintento: 1,
      horariosTrasReintento: 1,
    });

    await current.close();
    current = await open();
    api = request(current.getHttpServer());
    const replay = await publish(api, tutor, input(), key).expect(201);
    assert.deepEqual(replay.body, offer);
    assert.equal((await priceRow(offer.id_oferta)).price, '3.7');
    const afterReopen = (
      await api.get('/tutoring/offers?page=1&limit=100').expect(200)
    ).body;
    assert.equal(
      afterReopen.data.find((row) => row.id_oferta === offer.id_oferta)
        .costo_creditos,
      '3.7',
    );
    assert.deepEqual(await userCounts(tutor), { offers: 1, slots: 1 });
    assert.deepEqual(await financialState(), balancesBefore);
    results.push({
      caso: 'reapertura y replay persistentes',
      precioSQL: '3.7',
      precioHTTP: '3.7',
      ofertas: 1,
      horarios: 1,
      saldosYMovimientosIntactos: true,
    });
    console.log('Ofertas PostgreSQL OK:', JSON.stringify(results));
  } finally {
    if (current) await current.close();
    if (other) await other.close();
    await db.end();
  }
}

module.exports = { verifyTutoringOffers };
