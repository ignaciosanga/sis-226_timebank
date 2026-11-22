// HU-08: HTTP y PostgreSQL real, exclusivamente en la BD desechable del runner.
const assert = require('node:assert/strict');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { Client } = require('pg');
const request = require('supertest');
const { seedAcademic } = require('./seed-academic.cjs');

async function verifyCancellations({ open, mailbox, connectionString }) {
  const target = new URL(connectionString);
  assert.match(target.pathname, /^\/timebank_test_[a-f0-9]{16}$/);
  const db = new Client({ connectionString });
  await db.connect();
  assert.equal(
    (await db.query('SELECT current_database() name')).rows[0].name,
    target.pathname.slice(1),
  );
  const {
    REGISTRATION_POLICY,
  } = require('../dist/modules/auth/registration-policy');
  const {
    USERS_REPOSITORY,
  } = require('../dist/modules/users/users.repository');
  const { formatCredits } = require('../dist/modules/exchanges/credits');
  const originalNow = Date.now;
  const epoch = originalNow();
  const password = randomBytes(24).toString('base64url');
  const cases = [];
  let current, other, api, otherApi, skillId, administrator;
  let stage = 'triggers activos';
  const post = (client, actor, path, body = {}, key = randomUUID()) =>
    client
      .post(path)
      .auth(actor.token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);
  const cancel = (fixture, actor, key = randomUUID(), client = api) =>
    post(
      client,
      actor,
      `/reservations/${fixture.reservation.id_reserva}/cancel`,
      { motivo: 'Motivo HU-08 verificable' },
      key,
    );
  async function reopen() {
    if (current) await current.close();
    if (other) await other.close();
    current = await open();
    other = await open();
    current.get(REGISTRATION_POLICY).initialCredits = '0';
    other.get(REGISTRATION_POLICY).initialCredits = '0';
    api = request(current.getHttpServer());
    otherApi = request(other.getHttpServer());
  }
  async function register(balance = '0') {
    Date.now = originalNow;
    const correo = `hu08-${randomUUID()}@ucb.edu.bo`;
    const user = (
      await api
        .post('/auth/register')
        .send({
          nombre: 'Prueba',
          apellido: 'HU08',
          correo,
          password,
          idCarrera: '30000000-0000-4000-8000-000000000001',
          semestre: 2,
        })
        .expect(201)
    ).body;
    const message = mailbox.findLast((item) => item.correo === correo);
    assert.ok(message);
    await api
      .post('/auth/verify-email')
      .send({ token: message.token })
      .expect(200);
    const token = (
      await api.post('/auth/login').send({ correo, password }).expect(200)
    ).body.access_token;
    // Saldo de fixture antes de su primer movimiento; nunca modifica ledger previo.
    await db.query(
      'UPDATE "USUARIOS" SET saldo=$2::numeric WHERE id_usuario=$1',
      [user.id, balance],
    );
    return { ...user, token };
  }
  async function book({
    studentBalance = '10',
    tutorBalance = '2',
    amount = '3.7',
  } = {}) {
    const student = await register(studentBalance),
      tutor = await register(tutorBalance);
    await api
      .post('/users/me/skills')
      .auth(tutor.token, { type: 'bearer' })
      .send({ skillId, nivel: 'Intermedio' })
      .expect(201);
    const start = new Date(epoch + 10 * 3600000);
    const times = {
      fechaInicio: start.toISOString(),
      fechaFin: new Date(start.getTime() + 45 * 60000).toISOString(),
    };
    const offer = (
      await post(api, tutor, '/tutoring/offers', {
        skillId,
        nivel: 'Intermedio',
        titulo: 'Cancelacion HU08',
        descripcion: 'Fixture aislado para politica de cancelacion.',
        costoCreditos: amount,
        ...times,
      }).expect(201)
    ).body;
    const created = (
      await post(api, student, '/exchanges', {
        providerId: tutor.id,
        skillId,
        availabilityId: offer.id_disponibilidad,
        offerId: offer.id_oferta,
        ...times,
      }).expect(201)
    ).body;
    const reservation = (
      await post(
        api,
        tutor,
        `/exchanges/${created.id_solicitud}/accept`,
      ).expect(200)
    ).body;
    assert.equal(reservation.creditos, amount);
    return { student, tutor, offer, reservation, start, amount };
  }
  const clock = (fixture, minutes) => {
    Date.now = () => fixture.start.getTime() - minutes * 60000;
  };
  const ledger = async (fixture) =>
    (
      await db.query(
        'SELECT id_movimiento,id_usuario,tipo,cantidad::text,saldo_anterior::text,saldo_posterior::text,retenidos_anterior::text,retenidos_posterior::text FROM "MOVIMIENTOS_CREDITO" WHERE id_reserva=$1 ORDER BY tipo,id_movimiento',
        [fixture.reservation.id_reserva],
      )
    ).rows;
  const account = async (actor) => {
    const sql = (
      await db.query(
        'SELECT saldo::text,creditos_retenidos::text retenido,(saldo-creditos_retenidos)::text disponible FROM "USUARIOS" WHERE id_usuario=$1',
        [actor.id],
      )
    ).rows[0];
    // La resta NUMERIC de 3.7 - 3.7 devuelve texto 0.0; normalizar sin Number.
    return [sql.saldo, sql.retenido, formatCredits(sql.disponible)];
  };
  async function snapshot() {
    const result = {};
    for (const { tablename } of (
      await db.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows) {
      const quoted = `"${tablename.replaceAll('"', '""')}"`;
      const rows = (
        await db.query(
          `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text data FROM ${quoted} t`,
        )
      ).rows[0].data;
      result[tablename] = createHash('sha256').update(rows).digest('hex');
    }
    return result;
  }
  async function assertCancelled(
    fixture,
    actor,
    classification,
    penalty,
    expectedStudent,
    expectedTutor,
  ) {
    const id = fixture.reservation.id_reserva;
    const row = (
      await db.query(
        'SELECT *,creditos::text creditos FROM "RESERVAS" WHERE id_reserva=$1',
        [id],
      )
    ).rows[0];
    assert.equal(row.estado, 'Cancelada');
    assert.equal(row.cancelado_por, actor.id);
    assert.equal(row.motivo_cancelacion, 'Motivo HU-08 verificable');
    assert.equal(row.cancelled_at.getTime(), Date.now());
    assert.equal(row.creditos, fixture.amount);
    const metadata = (
      await db.query(
        "SELECT datos_nuevos FROM \"AUDITORIA\" WHERE accion='BACKEND_METADATA' AND entidad='RESERVAS' AND entidad_id=$1",
        [id],
      )
    ).rows;
    assert.equal(metadata.length, 1);
    assert.equal(
      metadata[0].datos_nuevos.clasificacionCancelacion,
      classification,
    );
    assert.equal(
      metadata[0].datos_nuevos.administrativa,
      classification === 'administrativa',
    );
    const response = (
      await api
        .get(`/reservations/${id}`)
        .auth(fixture.student.token, { type: 'bearer' })
        .expect(200)
    ).body;
    assert.equal(response.cancelacion.clasificacion, classification);
    assert.equal(response.cancelacion.id_usuario, actor.id);
    const events = await ledger(fixture);
    assert.equal(events.length, penalty ? 3 : 2);
    assert.equal(
      events.filter(
        (m) =>
          m.tipo === 'Retencion' &&
          m.id_usuario === fixture.student.id &&
          m.cantidad === fixture.amount,
      ).length,
      1,
    );
    assert.equal(
      events.filter(
        (m) =>
          m.tipo === 'Liberacion' &&
          m.id_usuario === fixture.student.id &&
          m.cantidad === fixture.amount &&
          m.retenidos_posterior === '0',
      ).length,
      1,
    );
    const penalties = events.filter((m) =>
      ['Penalizacion', 'penalizacion_sin_saldo'].includes(m.tipo),
    );
    assert.deepEqual(
      penalties.map((m) => [m.tipo, m.cantidad, m.id_usuario]),
      penalty
        ? [[penalty, penalty === 'Penalizacion' ? '-0.5' : '0', actor.id]]
        : [],
    );
    assert.deepEqual(await account(fixture.student), expectedStudent);
    assert.deepEqual(await account(fixture.tutor), expectedTutor);
    const slot = (
      await db.query(
        'SELECT estado FROM "DISPONIBILIDADES" WHERE id_disponibilidad=$1',
        [fixture.offer.id_disponibilidad],
      )
    ).rows[0];
    assert.equal(slot.estado, 'disponible');
    assert.equal(
      (
        await db.query(
          'SELECT costo_creditos::text precio FROM "OFERTAS" WHERE id_oferta=$1',
          [fixture.offer.id_oferta],
        )
      ).rows[0].precio,
      fixture.amount,
    );
    return {
      caso: stage,
      actor:
        actor.id === fixture.student.id
          ? 'solicitante'
          : actor.id === fixture.tutor.id
            ? 'ofertante'
            : 'ADMIN',
      clasificacion: classification,
      estudiante: expectedStudent,
      tutor: expectedTutor,
      movimientos: events.map((m) => [m.tipo, m.cantidad]),
      horario: slot.estado,
    };
  }
  try {
    const triggers = (
      await db.query(
        "SELECT c.relname tabla,t.tgname,t.tgenabled,p.proname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY 1,2",
      )
    ).rows;
    assert.deepEqual(triggers, []); // El cobro probado corresponde exclusivamente al Backend.
    await seedAcademic(db);
    skillId = (
      await db.query(
        'SELECT id_habilidad FROM "MATERIAS_ACADEMICAS" WHERE curriculum=\'systems\' AND NOT externo ORDER BY codigo LIMIT 1',
      )
    ).rows[0].id_habilidad;
    await reopen();
    administrator = await register();
    await current.get(USERS_REPOSITORY).grantDevelopmentAdmin(administrator.id);

    for (const role of ['student', 'tutor']) {
      stage = `5h exactas: ${role}`;
      const fixture = await book();
      clock(fixture, 300);
      await cancel(fixture, fixture[role]).expect(200);
      cases.push(
        await assertCancelled(
          fixture,
          fixture[role],
          'sin_multa',
          null,
          ['10', '0', '10'],
          ['2', '0', '2'],
        ),
      );
    }
    stage = '4h59 solicitante: disponible exacto 0.5';
    const requester = await book({ studentBalance: '4.2' });
    clock(requester, 299);
    await cancel(requester, requester.student).expect(200);
    cases.push(
      await assertCancelled(
        requester,
        requester.student,
        'injustificada',
        'Penalizacion',
        ['3.7', '0', '3.7'],
        ['2', '0', '2'],
      ),
    );

    stage =
      '4h59 tutor: disponible 0.5, concurrencia misma clave y replay tras reinicio';
    const tutor = await book({ tutorBalance: '0.5' });
    clock(tutor, 299);
    const key = randomUUID();
    const results = await Promise.all([
      cancel(tutor, tutor.tutor, key),
      cancel(tutor, tutor.tutor, key, otherApi),
    ]);
    assert.deepEqual(
      results.map((r) => r.status),
      [200, 200],
    );
    assert.deepEqual(results[0].body, results[1].body);
    const beforeReplay = await snapshot();
    await reopen();
    assert.deepEqual(
      (await cancel(tutor, tutor.tutor, key).expect(200)).body,
      results[0].body,
    );
    await cancel(tutor, tutor.tutor).expect(409);
    assert.deepEqual(await snapshot(), beforeReplay);
    cases.push(
      await assertCancelled(
        tutor,
        tutor.tutor,
        'injustificada',
        'Penalizacion',
        ['10', '0', '10'],
        ['0', '0', '0'],
      ),
    );

    stage = '4h59 tutor: disponible insuficiente 0.4';
    const poorTutor = await book({ tutorBalance: '0.4' });
    clock(poorTutor, 299);
    await cancel(poorTutor, poorTutor.tutor).expect(200);
    cases.push(
      await assertCancelled(
        poorTutor,
        poorTutor.tutor,
        'injustificada',
        'penalizacion_sin_saldo',
        ['10', '0', '10'],
        ['0.4', '0', '0.4'],
      ),
    );
    stage = '4h59 solicitante: insuficiente antes y despues de liberar';
    const poorStudent = await book({ studentBalance: '0.4', amount: '0.1' });
    clock(poorStudent, 299);
    await cancel(poorStudent, poorStudent.student).expect(200);
    cases.push(
      await assertCancelled(
        poorStudent,
        poorStudent.student,
        'injustificada',
        'penalizacion_sin_saldo',
        ['0.4', '0', '0.4'],
        ['2', '0', '2'],
      ),
    );

    for (const role of ['administrator', 'student', 'tutor']) {
      stage = `ADMIN ${role}: despues del inicio sin multa`;
      const fixture = await book({ studentBalance: '3.7' });
      const actor = role === 'administrator' ? administrator : fixture[role];
      if (role !== 'administrator')
        await current.get(USERS_REPOSITORY).grantDevelopmentAdmin(actor.id);
      clock(fixture, -60);
      await cancel(fixture, actor).expect(200);
      cases.push(
        await assertCancelled(
          fixture,
          actor,
          'administrativa',
          null,
          ['3.7', '0', '3.7'],
          ['2', '0', '2'],
        ),
      );
    }

    stage =
      'saldo 3.7 totalmente retenido: decision BD pendiente, rollback completo';
    const pending = await book({ studentBalance: '3.7' });
    clock(pending, 299);
    const beforePending = await snapshot();
    const rejected = await cancel(pending, pending.student).expect(409);
    assert.equal(rejected.body.code, 'CANCELLATION_BALANCE_POLICY_PENDING');
    assert.deepEqual(await snapshot(), beforePending);
    assert.deepEqual(await account(pending.student), ['3.7', '3.7', '0']);
    cases.push({
      caso: stage,
      http: 409,
      sinEfectos: true,
      estudiante: ['3.7', '3.7', '0'],
      movimientos: (await ledger(pending)).map((m) => [m.tipo, m.cantidad]),
    });
    stage = 'participantes desde el inicio: permisos anteriores conservados';
    clock(pending, 0);
    for (const actor of [pending.student, pending.tutor])
      await cancel(pending, actor).expect(409);
    assert.deepEqual(await snapshot(), beforePending);
    cases.push({ caso: stage, http: [409, 409], sinEfectos: true });

    stage =
      'dos actores concurrentes con claves distintas: un solo ganador y una multa';
    const competing = await book();
    clock(competing, 299);
    const competitors = [competing.student, competing.tutor];
    const outcomes = await Promise.all([
      cancel(competing, competitors[0]),
      cancel(competing, competitors[1], randomUUID(), otherApi),
    ]);
    assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
    const winner = competitors[outcomes.findIndex((r) => r.status === 200)];
    cases.push(
      await assertCancelled(
        competing,
        winner,
        'injustificada',
        'Penalizacion',
        [
          winner.id === competing.student.id ? '9.5' : '10',
          '0',
          winner.id === competing.student.id ? '9.5' : '10',
        ],
        [
          winner.id === competing.tutor.id ? '1.5' : '2',
          '0',
          winner.id === competing.tutor.id ? '1.5' : '2',
        ],
      ),
    );

    stage =
      'fallo SQL en multa: rollback de liberacion, estado, clasificacion e idempotencia';
    const fault = await book();
    clock(fault, 299);
    const faultKey = randomUUID();
    const beforeFault = await snapshot();
    await db.query(
      `CREATE FUNCTION public.hu08_fault() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN IF NEW.tipo='Penalizacion' AND NEW.id_reserva='${fault.reservation.id_reserva}'::uuid THEN NEW.id_usuario='${randomUUID()}'::uuid; END IF; RETURN NEW; END; $fn$`,
    );
    await db.query(
      'CREATE TRIGGER hu08_fault BEFORE INSERT ON "MOVIMIENTOS_CREDITO" FOR EACH ROW EXECUTE FUNCTION public.hu08_fault()',
    );
    try {
      await cancel(fault, fault.tutor, faultKey).expect(409);
    } finally {
      await db.query('DROP TRIGGER hu08_fault ON "MOVIMIENTOS_CREDITO"');
      await db.query('DROP FUNCTION public.hu08_fault()');
    }
    assert.deepEqual(await snapshot(), beforeFault);
    await reopen();
    await cancel(fault, fault.tutor, faultKey).expect(200);
    cases.push(
      await assertCancelled(
        fault,
        fault.tutor,
        'injustificada',
        'Penalizacion',
        ['10', '0', '10'],
        ['1.5', '0', '1.5'],
      ),
    );

    stage =
      'Analytics: clasificacion persistida, administrativas e historial sin clasificar excluidos';
    const expected = (
      await db.query(
        `SELECT count(*)::int n FROM "RESERVAS" r JOIN "AUDITORIA" a ON a.entidad_id=r.id_reserva AND a.entidad='RESERVAS' AND a.accion='BACKEND_METADATA' JOIN "MATERIAS_ACADEMICAS" m ON m.id_habilidad=r.id_habilidad WHERE r.estado='Cancelada' AND a.datos_nuevos->>'clasificacionCancelacion'='injustificada' AND a.datos_nuevos->>'administrativa'='false'`,
      )
    ).rows[0].n;
    assert.equal(expected, 6);
    const period = {
      from: new Date(epoch - 86400000).toISOString(),
      to: new Date(epoch + 86400000).toISOString(),
    };
    for (const path of ['/analytics/economy', '/analytics/reputation']) {
      const response = (
        await api
          .get(path)
          .query(period)
          .auth(administrator.token, { type: 'bearer' })
          .expect(200)
      ).body;
      assert.equal(response.cancelaciones_injustificadas, expected);
    }
    const integrity = (
      await api
        .get('/exchanges/integrity')
        .auth(administrator.token, { type: 'bearer' })
        .expect(200)
    ).body;
    assert.equal(integrity.status, 'ok');
    assert.deepEqual(integrity.issues, []);
    cases.push({
      caso: stage,
      injustificadas: expected,
      triggersIniciales: triggers,
      responsable: 'Backend',
      integridad: [],
    });
    console.log('Cancelaciones HU-08 PostgreSQL OK:', JSON.stringify(cases));
    return cases;
  } catch (error) {
    console.error(
      'Cancelaciones HU-08: fallo de comprobacion',
      JSON.stringify({
        etapa: stage,
        tipo: error?.constructor?.name,
        detalle:
          error instanceof assert.AssertionError
            ? error.message
            : /^expected \d{3}/.test(error?.message ?? '')
              ? error.message
              : undefined,
      }),
    );
    throw error;
  } finally {
    Date.now = originalNow;
    if (current) await current.close();
    if (other) await other.close();
    await db.end();
  }
}
module.exports = { verifyCancellations };
