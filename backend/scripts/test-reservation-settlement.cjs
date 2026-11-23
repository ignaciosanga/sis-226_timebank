// Fase 5: solamente sobre la base desechable decimal del script oficial.
const assert = require('node:assert/strict');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { Client } = require('pg');
const request = require('supertest');

async function verifyReservationSettlement({
  open,
  mailbox,
  connectionString,
}) {
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
    USERS_REPOSITORY,
  } = require('../dist/modules/users/users.repository');
  const originalNow = Date.now;
  const epoch = originalNow();
  const password = randomBytes(24).toString('base64url');
  const skillId = '20000000-0000-4000-8000-000000000002';
  const skilled = new Set();
  let current;
  let other;
  let api;
  let otherApi;
  let stage = 'deteccion del esquema decimal aislado';
  const cases = [];
  const post = (client, actor, path, body = {}, key = randomUUID()) =>
    client
      .post(path)
      .auth(actor.token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);
  const confirm = (actor, reservation, key = randomUUID(), client = api) =>
    post(
      client,
      actor,
      `/reservations/${reservation.id_reserva}/confirm`,
      {},
      key,
    );
  const movements = async (id) =>
    (
      await db.query(
        'SELECT id_movimiento,id_usuario,id_reserva,tipo,cantidad::text,saldo_anterior::text,saldo_posterior::text,retenidos_anterior::text,retenidos_posterior::text,created_at FROM "MOVIMIENTOS_CREDITO" WHERE id_reserva=$1 ORDER BY tipo,id_movimiento',
        [id],
      )
    ).rows;
  const reservationRow = async (id) =>
    (
      await db.query(
        'SELECT *,creditos::text AS creditos FROM "RESERVAS" WHERE id_reserva=$1',
        [id],
      )
    ).rows[0];
  const account = async (actor, expected) => {
    const value = (
      await api
        .get('/credits/me')
        .auth(actor.token, { type: 'bearer' })
        .expect(200)
    ).body;
    if (expected)
      assert.deepEqual(
        [value.saldo, value.creditos_retenidos, value.disponibles],
        expected,
      );
    const sql = (
      await db.query(
        'SELECT saldo::text,creditos_retenidos::text,(saldo-creditos_retenidos)::text AS disponibles FROM "USUARIOS" WHERE id_usuario=$1',
        [actor.id],
      )
    ).rows[0];
    assert.deepEqual(
      [sql.saldo, sql.creditos_retenidos, sql.disponibles],
      [value.saldo, value.creditos_retenidos, value.disponibles],
    );
    return {
      saldo: value.saldo,
      retenido: value.creditos_retenidos,
      disponible: value.disponibles,
    };
  };
  // Incluye usuarios, ledger, marcas, metadata/idempotencia y todas las demas tablas.
  const snapshot = async () => {
    const tables = (
      await db.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
      )
    ).rows;
    const saved = {};
    for (const { table_name: name } of tables) {
      const quoted = `"${name.replaceAll('"', '""')}"`;
      const table = (
        await db.query(
          `SELECT count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(row) ORDER BY to_jsonb(row)::text),'[]'::jsonb)::text AS rows FROM ${quoted} row`,
        )
      ).rows[0].rows;
      saved[name] = createHash('sha256').update(table).digest('hex');
    }
    return saved;
  };
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
    const correo = `fase5-pg-${randomUUID()}@ucb.edu.bo`;
    const user = (
      await api
        .post('/auth/register')
        .send({
          nombre: 'Prueba',
          apellido: 'Fase5',
          correo,
          password,
          idCarrera: '30000000-0000-4000-8000-000000000001',
          semestre: 2,
        })
        .expect(201)
    ).body;
    assert.equal(user.estado, 'Pendiente');
    const message = mailbox.findLast((item) => item.correo === correo);
    assert.ok(message);
    await api
      .post('/auth/verify-email')
      .send({ token: message.token })
      .expect(200);
    await api
      .post('/auth/verify-email')
      .send({ token: message.token })
      .expect(200);
    const token = (
      await api.post('/auth/login').send({ correo, password }).expect(200)
    ).body.access_token;
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM "MOVIMIENTOS_CREDITO" WHERE id_usuario=$1 AND tipo=\'BonoInicial\'',
          [user.id],
        )
      ).rows[0].n,
      0,
    );
    // Saldo inicial del fixture antes de cualquier movimiento; no altera historia.
    if (balance !== '0')
      await db.query(
        'UPDATE "USUARIOS" SET saldo=$2::numeric WHERE id_usuario=$1',
        [user.id, balance],
      );
    return { ...user, token };
  }
  async function teach(tutor) {
    if (skilled.has(tutor.id)) return;
    await api
      .post('/users/me/skills')
      .auth(tutor.token, { type: 'bearer' })
      .send({ skillId, nivel: 'Intermedio' })
      .expect(201);
    skilled.add(tutor.id);
  }
  async function book(
    student,
    tutor,
    { hour = 2, amount = '3.7', legacy = false } = {},
  ) {
    Date.now = originalNow;
    await teach(tutor);
    const start = new Date(epoch + hour * 3600000);
    const end = new Date(start.getTime() + 45 * 60000);
    const times = {
      fechaInicio: start.toISOString(),
      fechaFin: end.toISOString(),
    };
    let offer;
    let slot;
    if (legacy) {
      slot = (
        await api
          .post('/availability')
          .auth(tutor.token, { type: 'bearer' })
          .send(times)
          .expect(201)
      ).body;
    } else {
      offer = (
        await post(api, tutor, '/tutoring/offers', {
          skillId,
          nivel: 'Intermedio',
          titulo: `Liquidacion pactada ${amount}`,
          descripcion:
            'Fixture aislado de doble confirmacion y liquidacion exacta.',
          costoCreditos: amount,
          ...times,
        }).expect(201)
      ).body;
    }
    const created = (
      await post(api, student, '/exchanges', {
        providerId: tutor.id,
        skillId,
        availabilityId: offer?.id_disponibilidad ?? slot.id_disponibilidad,
        ...(offer ? { offerId: offer.id_oferta } : {}),
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
    assert.equal(reservation.creditos, legacy ? '3' : amount);
    assert.equal((await movements(reservation.id_reserva)).length, 1);
    return { student, tutor, offer, created, reservation, end };
  }
  const ended = (fixture) => {
    Date.now = () => fixture.end.getTime() + 1000;
  };
  const assertFirst = async (fixture, actor) => {
    const before = await movements(fixture.reservation.id_reserva);
    const key = randomUUID();
    const first = (await confirm(actor, fixture.reservation, key).expect(200))
      .body;
    assert.equal(first.estado, 'Confirmada');
    const row = await reservationRow(fixture.reservation.id_reserva);
    const own =
      actor.id === fixture.student.id
        ? 'confirmacion_solicitante_at'
        : 'confirmacion_ofertante_at';
    const counterpart =
      actor.id === fixture.student.id
        ? 'confirmacion_ofertante_at'
        : 'confirmacion_solicitante_at';
    assert.ok(row[own]);
    assert.equal(row[counterpart], null);
    assert.equal(row.completed_at, null);
    assert.deepEqual(await movements(fixture.reservation.id_reserva), before);
    assert.deepEqual(
      (await confirm(actor, fixture.reservation, key, otherApi).expect(200))
        .body,
      first,
    );
    assert.deepEqual(
      (
        await confirm(
          actor,
          fixture.reservation,
          randomUUID(),
          otherApi,
        ).expect(200)
      ).body,
      first,
    );
    assert.deepEqual(await reservationRow(fixture.reservation.id_reserva), row);
    assert.deepEqual(await movements(fixture.reservation.id_reserva), before);
    return row;
  };
  const assertCompleted = async (fixture, amount = '3.7') => {
    const response = (
      await api
        .get(`/reservations/${fixture.reservation.id_reserva}`)
        .auth(fixture.student.token, { type: 'bearer' })
        .expect(200)
    ).body;
    assert.equal(response.estado, 'Completada');
    assert.equal(response.creditos, amount);
    const row = await reservationRow(fixture.reservation.id_reserva);
    assert.equal(row.estado, 'Completada');
    assert.ok(
      row.confirmacion_solicitante_at &&
        row.confirmacion_ofertante_at &&
        row.completed_at,
    );
    assert.ok(row.confirmacion_solicitante_at >= row.fecha_fin);
    assert.ok(row.confirmacion_ofertante_at >= row.fecha_fin);
    const saved = await movements(fixture.reservation.id_reserva);
    assert.equal(saved.length, 3);
    for (const [type, user, quantity] of [
      ['Retencion', fixture.student.id, amount],
      ['Consumo', fixture.student.id, `-${amount}`],
      ['Transferencia', fixture.tutor.id, amount],
    ])
      assert.equal(
        saved.filter(
          (m) =>
            m.tipo === type && m.id_usuario === user && m.cantidad === quantity,
        ).length,
        1,
      );
    assert.equal(saved.filter((m) => m.tipo === 'Liberacion').length, 0);
    return saved;
  };
  try {
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND data_type='numeric' AND ((table_name='USUARIOS' AND column_name IN ('saldo','creditos_retenidos')) OR (table_name='SOLICITUDES_INTERCAMBIO' AND column_name='creditos_requeridos') OR (table_name='RESERVAS' AND column_name='creditos') OR (table_name='MOVIMIENTOS_CREDITO' AND column_name IN ('cantidad','saldo_anterior','saldo_posterior','retenidos_anterior','retenidos_posterior')))",
        )
      ).rows[0].n,
      9,
    );
    await reopen();
    const administrator = await register();
    await current.get(USERS_REPOSITORY).grantDevelopmentAdmin(administrator.id);

    stage =
      'A/C: 45min3.7, anticipada, ajeno, primera marca y misma persona repetida';
    const student = await register('10');
    const tutor = await register();
    const outsider = await register();
    const a = await book(student, tutor);
    const initial = await account(student, ['10', '3.7', '6.3']);
    const beforePremature = await snapshot();
    await confirm(student, a.reservation).expect(409);
    assert.deepEqual(await snapshot(), beforePremature);
    ended(a);
    const beforeForeign = await snapshot();
    await confirm(outsider, a.reservation).expect(403);
    assert.deepEqual(await snapshot(), beforeForeign);
    await assertFirst(a, student);
    const afterFirst = await account(student, ['10', '3.7', '6.3']);
    await account(tutor, ['0', '0', '0']);
    const finalKey = randomUUID();
    const paid = (await confirm(tutor, a.reservation, finalKey).expect(200))
      .body;
    assert.equal(paid.estado, 'Completada');
    const paidMovements = await assertCompleted(a);
    const consumption = paidMovements.find((m) => m.tipo === 'Consumo');
    const transfer = paidMovements.find((m) => m.tipo === 'Transferencia');
    assert.deepEqual(
      [
        consumption.saldo_anterior,
        consumption.saldo_posterior,
        consumption.retenidos_anterior,
        consumption.retenidos_posterior,
      ],
      ['10', '6.3', '3.7', '0'],
    );
    assert.deepEqual(
      [
        transfer.saldo_anterior,
        transfer.saldo_posterior,
        transfer.retenidos_anterior,
        transfer.retenidos_posterior,
      ],
      ['0', '3.7', '0', '0'],
    );
    const final = await account(student, ['6.3', '0', '6.3']);
    await account(tutor, ['3.7', '0', '3.7']);
    const finalRow = await reservationRow(a.reservation.id_reserva);
    for (const key of [finalKey, randomUUID()])
      assert.deepEqual(
        (await confirm(tutor, a.reservation, key, otherApi).expect(200)).body,
        paid,
      );
    const beforeIncompatible = await snapshot();
    await confirm(tutor, { id_reserva: randomUUID() }, finalKey).expect(409);
    assert.deepEqual(await snapshot(), beforeIncompatible);
    await reopen();
    assert.deepEqual(
      (await confirm(tutor, a.reservation, finalKey).expect(200)).body,
      paid,
    );
    assert.deepEqual(
      (await confirm(student, a.reservation).expect(200)).body,
      paid,
    );
    assert.deepEqual(await reservationRow(a.reservation.id_reserva), finalRow);
    assert.deepEqual(await movements(a.reservation.id_reserva), paidMovements);
    await account(student, ['6.3', '0', '6.3']);
    await account(tutor, ['3.7', '0', '3.7']);
    // Periodo exclusivo de esta liquidacion: Analytics no suma ambas patas del pago.
    const from = new Date(a.end.getTime() + 1000).toISOString();
    const to = new Date(a.end.getTime() + 1001).toISOString();
    const analytics = (
      await api
        .get('/analytics/credits')
        .query({ from, to })
        .auth(administrator.token, { type: 'bearer' })
        .expect(200)
    ).body;
    assert.equal(analytics.transferidos, '3.7');
    assert.deepEqual(analytics.movimientosPorTipo.Transferencia, {
      cantidad: 1,
      creditos: '3.7',
    });
    assert.equal(analytics.transferidosPorPeriodo.length, 1);
    assert.equal(analytics.transferidosPorPeriodo[0].cantidad, 1);
    assert.equal(analytics.transferidosPorPeriodo[0].creditos, '3.7');
    assert.deepEqual(
      (
        await db.query(
          'SELECT count(*)::int AS cantidad,SUM(cantidad)::text AS creditos FROM "MOVIMIENTOS_CREDITO" WHERE tipo=\'Transferencia\' AND created_at >= $1::timestamptz AND created_at < $2::timestamptz',
          [from, to],
        )
      ).rows[0],
      { cantidad: 1, creditos: '3.7' },
    );
    const analyticsExchanges = (
      await api
        .get('/analytics/exchanges')
        .query({ from, to })
        .auth(administrator.token, { type: 'bearer' })
        .expect(200)
    ).body;
    assert.equal(analyticsExchanges.reservas.completadasEnPeriodo, 1);
    assert.equal(analyticsExchanges.reservas.creditosCompletadas, '3.7');
    cases.push({
      caso: 'A/C: estudiante primero, controles, replays y reapertura',
      reserva: a.reservation.id_reserva,
      aceptada: initial,
      primera: afterFirst,
      completada: final,
      tutor: '3.7',
      movimientos: 3,
      mismosIdsTrasReinicio: true,
      analyticsTransferencias: 1,
      analyticsCreditos: '3.7',
    });

    stage = 'B: tutor primero en reserva independiente';
    const b = await book(await register('10'), await register(), { hour: 3 });
    ended(b);
    await assertFirst(b, b.tutor);
    await account(b.student, ['10', '3.7', '6.3']);
    await account(b.tutor, ['0', '0', '0']);
    await confirm(b.student, b.reservation).expect(200);
    await assertCompleted(b);
    await account(b.student, ['6.3', '0', '6.3']);
    await account(b.tutor, ['3.7', '0', '3.7']);
    cases.push({
      caso: 'B: tutor primero',
      reserva: b.reservation.id_reserva,
      movimientos: 3,
      pago: '3.7',
    });

    stage = 'D1: confirmaciones simultaneas desde dos instancias';
    const concurrent = await book(await register('10'), await register(), {
      hour: 4,
    });
    ended(concurrent);
    const confirmations = await Promise.all([
      confirm(concurrent.student, concurrent.reservation),
      confirm(concurrent.tutor, concurrent.reservation, randomUUID(), otherApi),
    ]);
    assert.deepEqual(
      confirmations.map((result) => result.status),
      [200, 200],
    );
    assert.deepEqual(confirmations.map((result) => result.body.estado).sort(), [
      'Completada',
      'Confirmada',
    ]);
    await assertCompleted(concurrent);
    await account(concurrent.student, ['6.3', '0', '6.3']);
    await account(concurrent.tutor, ['3.7', '0', '3.7']);
    cases.push({
      caso: 'D1: dos instancias confirman simultaneamente',
      http: [200, 200],
      pagos: 1,
    });

    // Ambos contendientes son solicitudes activas de distintas instancias.
    // La barrera de BD fija el orden de la cola del mismo bloqueo productivo,
    // de forma que se verifican los dos desenlaces sin depender del scheduler.
    for (const winner of ['cancelacion', 'liquidacion']) {
      stage = `D2: carrera real con ADMIN, gana ${winner}`;
      const race = await book(await register('10'), await register(), {
        hour: winner === 'cancelacion' ? 5 : 6,
      });
      ended(race);
      await assertFirst(race, race.student);
      const cancel = () =>
        post(
          otherApi,
          administrator,
          `/reservations/${race.reservation.id_reserva}/cancel`,
          { motivo: 'Carrera autorizada despues del fin' },
        );
      const settle = () => confirm(race.tutor, race.reservation);
      let first;
      let second;
      await db.query('BEGIN');
      try {
        await db.query('SELECT pg_advisory_xact_lock(22603112)');
        const waiters = async (minimum) => {
          const deadline = originalNow() + 5000;
          while (originalNow() < deadline) {
            const waiting = (
              await db.query(
                "SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND objid=22603112 AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())",
              )
            ).rows[0].n;
            if (waiting >= minimum) return;
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          throw new Error(
            'Los dos contendientes no alcanzaron la barrera PostgreSQL',
          );
        };
        first = (winner === 'cancelacion' ? cancel() : settle()).then(
          (response) => response,
        );
        await waiters(1);
        second = (winner === 'cancelacion' ? settle() : cancel()).then(
          (response) => response,
        );
        await waiters(2);
        await db.query('COMMIT');
      } catch (error) {
        await db.query('ROLLBACK');
        await Promise.allSettled([first, second].filter(Boolean));
        throw error;
      }
      const results = await Promise.all([first, second]);
      assert.deepEqual(
        results.map((response) => response.status),
        [200, 409],
      );
      const saved = await movements(race.reservation.id_reserva);
      const row = await reservationRow(race.reservation.id_reserva);
      if (winner === 'cancelacion') {
        assert.equal(row.estado, 'Cancelada');
        assert.equal(row.cancelado_por, administrator.id);
        assert.equal(
          results[0].body.cancelacion.clasificacion,
          'administrativa',
        );
        assert.equal(results[0].body.cancelacion.administrativa, true);
        assert.equal(row.confirmacion_ofertante_at, null);
        assert.equal(row.completed_at, null);
        assert.equal(saved.length, 2);
        assert.equal(
          saved.filter((m) => m.tipo === 'Liberacion' && m.cantidad === '3.7')
            .length,
          1,
        );
        assert.equal(
          saved.filter((m) => ['Consumo', 'Transferencia'].includes(m.tipo))
            .length,
          0,
        );
        await account(race.student, ['10', '0', '10']);
        await account(race.tutor, ['0', '0', '0']);
      } else {
        await assertCompleted(race);
        await account(race.student, ['6.3', '0', '6.3']);
        await account(race.tutor, ['3.7', '0', '3.7']);
      }
      cases.push({
        caso: `D2: gana ${winner}`,
        reserva: race.reservation.id_reserva,
        http: [200, 409],
        estado: row.estado,
        liberaciones: saved.filter((m) => m.tipo === 'Liberacion').length,
        consumos: saved.filter((m) => m.tipo === 'Consumo').length,
        pagos: saved.filter((m) => m.tipo === 'Transferencia').length,
      });
    }

    stage =
      'D3: FK real en Transferencia, rollback de todas las tablas y reintento tras reapertura';
    const fault = await book(await register('10'), await register(), {
      hour: 7,
    });
    ended(fault);
    const firstMark = await assertFirst(fault, fault.student);
    const beforeFault = await snapshot();
    const faultName = `phase5_fault_${randomBytes(6).toString('hex')}`;
    const absentReservation = randomUUID();
    const faultKey = randomUUID();
    assert.equal(
      (
        await db.query(
          'SELECT EXISTS(SELECT 1 FROM "RESERVAS" WHERE id_reserva=$1) AS found',
          [absentReservation],
        )
      ).rows[0].found,
      false,
    );
    try {
      await db.query(
        `CREATE FUNCTION ${faultName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.id_reserva='${absentReservation}'::uuid; RETURN NEW; END $$`,
      );
      await db.query(
        `CREATE TRIGGER ${faultName} BEFORE INSERT ON "MOVIMIENTOS_CREDITO" FOR EACH ROW WHEN (NEW.id_reserva='${fault.reservation.id_reserva}'::uuid AND NEW.tipo='Transferencia') EXECUTE FUNCTION ${faultName}()`,
      );
      await confirm(fault.tutor, fault.reservation, faultKey).expect(409);
    } finally {
      await db.query(
        `DROP TRIGGER IF EXISTS ${faultName} ON "MOVIMIENTOS_CREDITO"`,
      );
      await db.query(`DROP FUNCTION IF EXISTS ${faultName}()`);
    }
    assert.deepEqual(await snapshot(), beforeFault);
    assert.deepEqual(
      await reservationRow(fault.reservation.id_reserva),
      firstMark,
    );
    await account(fault.student, ['10', '3.7', '6.3']);
    await account(fault.tutor, ['0', '0', '0']);
    await reopen();
    await confirm(fault.tutor, fault.reservation, faultKey).expect(200);
    await assertCompleted(fault);
    await account(fault.student, ['6.3', '0', '6.3']);
    await account(fault.tutor, ['3.7', '0', '3.7']);
    cases.push({
      caso: 'D3: FK al insertar Transferencia',
      rollbackTodasLasTablas: true,
      primeraMarcaConservada: true,
      reintentoTrasReapertura: true,
      pagos: 1,
    });

    stage =
      'capacidad del tutor: rollback completo y reintento con la misma clave';
    const overflow = await book(
      await register('10'),
      await register('2147483646'),
      { hour: 8 },
    );
    ended(overflow);
    await assertFirst(overflow, overflow.student);
    const beforeOverflow = await snapshot();
    const overflowKey = randomUUID();
    await confirm(overflow.tutor, overflow.reservation, overflowKey).expect(
      409,
    );
    assert.deepEqual(await snapshot(), beforeOverflow);
    await account(overflow.student, ['10', '3.7', '6.3']);
    await account(overflow.tutor, ['2147483646', '0', '2147483646']);
    // Este tutor aun no tiene movimientos; resolver solo su saldo de fixture.
    await db.query('UPDATE "USUARIOS" SET saldo=0 WHERE id_usuario=$1', [
      overflow.tutor.id,
    ]);
    await confirm(overflow.tutor, overflow.reservation, overflowKey).expect(
      200,
    );
    await assertCompleted(overflow);
    await account(overflow.student, ['6.3', '0', '6.3']);
    await account(overflow.tutor, ['3.7', '0', '3.7']);
    cases.push({
      caso: 'capacidad excedida',
      rollbackTodasLasTablas: true,
      reintentoMismaClave: true,
      pagos: 1,
    });

    stage =
      'E/F: otras retenciones de ambos participantes y catalogo modificado';
    const heldStudent = await register('10');
    const heldTutor = await register('10');
    const extraTutor = await register();
    const extra = await book(heldStudent, extraTutor, {
      hour: 12,
      amount: '2.1',
    });
    const tutorOwn = await book(heldTutor, await register(), {
      hour: 13,
      amount: '1.2',
    });
    const exact = await book(heldStudent, heldTutor, { hour: 9 });
    await db.query(
      'UPDATE "OFERTAS" SET costo_creditos=9.9 WHERE id_oferta=$1',
      [exact.offer.id_oferta],
    );
    const extraRow = await reservationRow(extra.reservation.id_reserva);
    const extraMovements = await movements(extra.reservation.id_reserva);
    const tutorOwnRow = await reservationRow(tutorOwn.reservation.id_reserva);
    const tutorOwnMovements = await movements(tutorOwn.reservation.id_reserva);
    await account(heldStudent, ['10', '5.8', '4.2']);
    await account(heldTutor, ['10', '1.2', '8.8']);
    ended(exact);
    await confirm(heldStudent, exact.reservation).expect(200);
    await confirm(heldTutor, exact.reservation, randomUUID(), otherApi).expect(
      200,
    );
    const exactMovements = await assertCompleted(exact);
    await account(heldStudent, ['6.3', '2.1', '4.2']);
    await account(heldTutor, ['13.7', '1.2', '12.5']);
    assert.deepEqual(
      await reservationRow(extra.reservation.id_reserva),
      extraRow,
    );
    assert.deepEqual(
      await movements(extra.reservation.id_reserva),
      extraMovements,
    );
    assert.deepEqual(
      await reservationRow(tutorOwn.reservation.id_reserva),
      tutorOwnRow,
    );
    assert.deepEqual(
      await movements(tutorOwn.reservation.id_reserva),
      tutorOwnMovements,
    );
    const exactTransfer = exactMovements.find(
      (m) => m.tipo === 'Transferencia',
    );
    assert.deepEqual(
      [
        exactTransfer.saldo_anterior,
        exactTransfer.saldo_posterior,
        exactTransfer.retenidos_anterior,
        exactTransfer.retenidos_posterior,
      ],
      ['10', '13.7', '1.2', '1.2'],
    );
    const exactConsumption = exactMovements.find((m) => m.tipo === 'Consumo');
    assert.deepEqual(
      [
        exactConsumption.saldo_anterior,
        exactConsumption.saldo_posterior,
        exactConsumption.retenidos_anterior,
        exactConsumption.retenidos_posterior,
      ],
      ['10', '6.3', '5.8', '2.1'],
    );
    assert.equal(
      (
        await db.query(
          'SELECT costo_creditos::text AS precio FROM "OFERTAS" WHERE id_oferta=$1',
          [exact.offer.id_oferta],
        )
      ).rows[0].precio,
      '9.9',
    );
    cases.push({
      caso: 'E/F: retenciones ajenas conservadas y catalogo9.9',
      pacto: '3.7',
      estudiante: { saldo: '6.3', retenido: '2.1', disponible: '4.2' },
      tutor: { saldo: '13.7', retenido: '1.2', disponible: '12.5' },
      otrasReservasIdenticas: true,
    });

    stage = 'G: historico45min3 y auditoria de integridad global';
    const legacy = await book(await register('10'), await register(), {
      hour: 10,
      legacy: true,
    });
    assert.equal(legacy.created.id_oferta, null);
    assert.equal(legacy.created.creditos_requeridos, '3');
    ended(legacy);
    await confirm(legacy.student, legacy.reservation).expect(200);
    await confirm(legacy.tutor, legacy.reservation).expect(200);
    await assertCompleted(legacy, '3');
    await account(legacy.student, ['7', '0', '7']);
    await account(legacy.tutor, ['3', '0', '3']);
    const integrity = (
      await api
        .get('/exchanges/integrity')
        .auth(administrator.token, { type: 'bearer' })
        .expect(200)
    ).body;
    assert.equal(integrity.status, 'ok');
    assert.equal(integrity.scope, 'postgresql-transaction');
    assert.deepEqual(integrity.issues, []);
    const duplicates = (
      await db.query(
        'SELECT id_reserva,tipo,id_usuario,count(*)::int AS n FROM "MOVIMIENTOS_CREDITO" WHERE id_reserva IS NOT NULL GROUP BY id_reserva,tipo,id_usuario HAVING count(*)>1',
      )
    ).rows;
    assert.deepEqual(duplicates, []);
    cases.push({
      caso: 'G: historico45min3, activacion/bono0 y regresion cancelacion fase4',
      precio: '3',
      pagos: 1,
      integridad: [],
      duplicadosLedger: [],
    });
    console.log(
      'Liquidacion de reservas PostgreSQL OK (migraciones oficiales):',
      JSON.stringify(cases),
    );
    return cases;
  } catch (error) {
    const mismatch =
      typeof error?.message === 'string'
        ? /^expected (\d{3})[^\r\n]*got (\d{3})/.exec(error.message)
        : null;
    console.error(
      'Liquidacion PostgreSQL: fallo de comprobacion',
      JSON.stringify({
        etapa: stage,
        tipo: error?.constructor?.name,
        comparacion:
          error instanceof assert.AssertionError ? error.operator : undefined,
        ...(mismatch
          ? { esperadoHTTP: mismatch[1], recibidoHTTP: mismatch[2] }
          : {}),
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

module.exports = { verifyReservationSettlement };
