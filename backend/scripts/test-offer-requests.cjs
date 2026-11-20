// Integracion fase 4: llamada solo despues de preparar el esquema decimal
// provisional en la BD desechable timebank_test_* del script oficial.
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { Client } = require('pg');
const request = require('supertest');

async function verifyOfferRequests({ open, mailbox, connectionString }) {
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
  let current;
  let other;
  let api;
  let otherApi;
  let stage = 'esquema: nueve columnas NUMERIC y base desechable';
  const cases = [];
  const password = randomBytes(24).toString('base64url');
  const skillId = '20000000-0000-4000-8000-000000000002';
  const tutorsWithSkill = new Set();
  const originalNow = Date.now;
  const post = (client, actor, path, body = {}, key = randomUUID()) =>
    client
      .post(path)
      .auth(actor.token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);
  const credits = async (actor) =>
    (
      await api
        .get('/credits/me')
        .auth(actor.token, { type: 'bearer' })
        .expect(200)
    ).body;
  const snapshot = async () => ({
    requests: (
      await db.query(
        'SELECT * FROM "SOLICITUDES_INTERCAMBIO" ORDER BY id_solicitud',
      )
    ).rows,
    reservations: (
      await db.query('SELECT * FROM "RESERVAS" ORDER BY id_reserva')
    ).rows,
    movements: (
      await db.query(
        'SELECT * FROM "MOVIMIENTOS_CREDITO" ORDER BY id_movimiento',
      )
    ).rows,
    audit: (await db.query('SELECT * FROM "AUDITORIA" ORDER BY id_auditoria'))
      .rows,
    slots: (
      await db.query(
        'SELECT * FROM "DISPONIBILIDADES" ORDER BY id_disponibilidad',
      )
    ).rows,
    balances: (
      await db.query(
        'SELECT id_usuario,saldo::text,creditos_retenidos::text FROM "USUARIOS" ORDER BY id_usuario',
      )
    ).rows,
  });
  const savedMovements = async (id) =>
    (
      await db.query(
        'SELECT id_movimiento,id_usuario,tipo,cantidad::text,saldo_anterior::text,saldo_posterior::text,retenidos_anterior::text,retenidos_posterior::text FROM "MOVIMIENTOS_CREDITO" WHERE id_reserva=$1 ORDER BY created_at,id_movimiento',
        [id],
      )
    ).rows;
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
    const correo = `fase4-pg-${randomUUID()}@ucb.edu.bo`;
    const user = (
      await api
        .post('/auth/register')
        .send({
          nombre: 'Prueba',
          apellido: 'Fase4',
          correo,
          password,
          idCarrera: '30000000-0000-4000-8000-000000000001',
          semestre: 2,
        })
        .expect(201)
    ).body;
    assert.equal(user.estado, 'Pendiente');
    assert.equal(
      (
        await db.query(
          'SELECT saldo::text FROM "USUARIOS" WHERE id_usuario=$1',
          [user.id],
        )
      ).rows[0].saldo,
      '0',
    );
    const email = mailbox.findLast((m) => m.correo === correo);
    assert.ok(email);
    await api
      .post('/auth/verify-email')
      .send({ token: email.token })
      .expect(200);
    await api
      .post('/auth/verify-email')
      .send({ token: email.token })
      .expect(200);
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM "MOVIMIENTOS_CREDITO" WHERE id_usuario=$1 AND tipo=\'BonoInicial\'',
          [user.id],
        )
      ).rows[0].n,
      0,
    );
    const token = (
      await api.post('/auth/login').send({ correo, password }).expect(200)
    ).body.access_token;
    // Fixture controlado: usuarios nuevos sin movimientos; no modifica historia previa.
    if (balance !== '0')
      await db.query(
        'UPDATE "USUARIOS" SET saldo=$2::numeric WHERE id_usuario=$1',
        [user.id, balance],
      );
    return { ...user, token };
  }
  async function publish(tutor, day = 2) {
    if (!tutorsWithSkill.has(tutor.id)) {
      await api
        .post('/users/me/skills')
        .auth(tutor.token, { type: 'bearer' })
        .send({ skillId, nivel: 'Intermedio' })
        .expect(201);
      tutorsWithSkill.add(tutor.id);
    }
    const start = new Date(originalNow() + day * 86400000);
    const end = new Date(start.getTime() + 45 * 60000);
    const offer = (
      await post(api, tutor, '/tutoring/offers', {
        skillId,
        nivel: 'Intermedio',
        titulo: 'Precio total publicado 3.7',
        descripcion: 'Ensayo aislado de contratacion, 45 minutos.',
        costoCreditos: '3.7',
        fechaInicio: start.toISOString(),
        fechaFin: end.toISOString(),
      }).expect(201)
    ).body;
    assert.equal(offer.costo_creditos, '3.7');
    return offer;
  }
  const body = (offer, tutor) => ({
    providerId: tutor.id,
    skillId,
    offerId: offer.id_oferta,
    availabilityId: offer.id_disponibilidad,
    fechaInicio: offer.fecha_inicio,
    fechaFin: offer.fecha_fin,
  });
  const create = (student, tutor, offer, key = randomUUID(), client = api) =>
    post(client, student, '/exchanges', body(offer, tutor), key);
  const accept = (tutor, id, key = randomUUID(), client = api) =>
    post(client, tutor, `/exchanges/${id}/accept`, {}, key);
  const assertBalance = async (actor, retained, available, total = '10') => {
    const account = await credits(actor);
    assert.equal(account.saldo, total);
    assert.equal(account.creditos_retenidos, retained);
    assert.equal(account.disponibles, available);
    return {
      saldo: account.saldo,
      retenido: account.creditos_retenidos,
      disponible: account.disponibles,
    };
  };
  try {
    const fields = (
      await db.query(`SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND
      ((table_name='USUARIOS' AND column_name IN ('saldo','creditos_retenidos')) OR
       (table_name='SOLICITUDES_INTERCAMBIO' AND column_name='creditos_requeridos') OR
       (table_name='RESERVAS' AND column_name='creditos') OR
       (table_name='MOVIMIENTOS_CREDITO' AND column_name IN ('cantidad','saldo_anterior','saldo_posterior','retenidos_anterior','retenidos_posterior')))`)
    ).rows;
    assert.equal(fields.length, 9);
    assert.ok(fields.every((field) => field.data_type === 'numeric'));
    stage = 'preparacion: dos instancias, registro, verificacion y publicacion';
    await reopen();

    const tutor = await register();
    const student = await register('10');
    const offer = await publish(tutor);
    stage = 'A: solicitud 3.7 sin retencion y replay entre instancias';
    const createKey = randomUUID();
    const created = (await create(student, tutor, offer, createKey).expect(201))
      .body;
    assert.equal(created.id_oferta, offer.id_oferta);
    assert.equal(created.creditos_requeridos, '3.7');
    assert.equal(created.costo_creditos, '3.7');
    assert.deepEqual(
      (await create(student, tutor, offer, createKey, otherApi).expect(201))
        .body,
      created,
    );
    const afterRequest = await assertBalance(student, '0', '10');
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM "RESERVAS" WHERE id_solicitud=$1',
          [created.id_solicitud],
        )
      ).rows[0].n,
      0,
    );
    const beforeIncompatible = await snapshot();
    await post(
      api,
      student,
      '/exchanges',
      { ...body(offer, tutor), descripcion: 'Otro contenido incompatible' },
      createKey,
    ).expect(409);
    assert.deepEqual(await snapshot(), beforeIncompatible);
    // B: no se crea endpoint de edicion; cambia exclusivamente el fixture del catalogo.
    stage =
      'B/D: cambio del catalogo y aceptaciones concurrentes con snapshot 3.7';
    await db.query(
      'UPDATE "OFERTAS" SET costo_creditos=9.9 WHERE id_oferta=$1',
      [offer.id_oferta],
    );
    const acceptKey = randomUUID();
    const accepts = await Promise.all([
      accept(tutor, created.id_solicitud, acceptKey),
      accept(tutor, created.id_solicitud, acceptKey, otherApi),
    ]);
    assert.deepEqual(
      accepts.map((r) => r.status),
      [200, 200],
    );
    assert.deepEqual(accepts[0].body, accepts[1].body);
    const reservation = accepts[0].body;
    assert.equal(reservation.creditos, '3.7');
    assert.equal(reservation.monto_creditos, '3.7');
    const afterAccept = await assertBalance(student, '3.7', '6.3');
    assert.equal((await credits(tutor)).saldo, '0');
    const held = await savedMovements(reservation.id_reserva);
    assert.equal(held.length, 1);
    assert.deepEqual(
      { ...held[0], id_movimiento: undefined },
      {
        id_movimiento: undefined,
        id_usuario: student.id,
        tipo: 'Retencion',
        cantidad: '3.7',
        saldo_anterior: '10',
        saldo_posterior: '10',
        retenidos_anterior: '0',
        retenidos_posterior: '3.7',
      },
    );
    assert.equal(
      (
        await db.query(
          'SELECT id_oferta,creditos_requeridos::text AS amount FROM "SOLICITUDES_INTERCAMBIO" WHERE id_solicitud=$1',
          [created.id_solicitud],
        )
      ).rows[0].amount,
      '3.7',
    );
    assert.equal(
      (
        await db.query(
          'SELECT creditos::text AS amount FROM "RESERVAS" WHERE id_reserva=$1',
          [reservation.id_reserva],
        )
      ).rows[0].amount,
      '3.7',
    );
    const catalogue = (
      await api.get('/tutoring/offers?page=1&limit=100').expect(200)
    ).body;
    assert.ok(
      !catalogue.data.some((entry) => entry.id_oferta === offer.id_oferta),
    );
    const managed = await api
      .patch(`/availability/${offer.id_disponibilidad}`)
      .auth(tutor.token, { type: 'bearer' })
      .send({ fechaInicio: offer.fecha_inicio, fechaFin: offer.fecha_fin })
      .expect(409);
    assert.equal(managed.body.code, 'OFFER_AVAILABILITY_MANAGED');
    cases.push({
      caso: 'A/B/D: snapshot3.7, dos instancias y mismo idempotency key',
      solicitud: created.id_solicitud,
      reserva: reservation.id_reserva,
      alSolicitar: afterRequest,
      alAceptar: afterAccept,
      retenciones: held.length,
      pagoTutor: '0',
    });

    stage =
      'D: reinicio de dos instancias y replay con los mismos identificadores';
    await reopen();
    assert.deepEqual(
      (await create(student, tutor, offer, createKey).expect(201)).body,
      created,
    );
    assert.deepEqual(
      (await accept(tutor, created.id_solicitud, acceptKey).expect(200)).body,
      reservation,
    );
    assert.deepEqual(await savedMovements(reservation.id_reserva), held);
    await assertBalance(student, '3.7', '6.3');
    cases.push({
      caso: 'D: reapertura de ambas instancias y reintento persistente',
      mismaSolicitud: true,
      mismaReserva: true,
      retenciones: 1,
    });

    // C: insuficiente, la foto financiera y las tablas de solicitud/horario no cambian.
    stage = 'C: saldo insuficiente sin efectos parciales';
    const poor = await register('3.6');
    const poorTutor = await register();
    const poorOffer = await publish(poorTutor, 3);
    const poorRequest = (await create(poor, poorTutor, poorOffer).expect(201))
      .body;
    const beforePoor = await snapshot();
    await accept(poorTutor, poorRequest.id_solicitud).expect(409);
    assert.deepEqual(await snapshot(), beforePoor);
    await assertBalance(poor, '0', '3.6', '3.6');
    cases.push({
      caso: 'C: disponible3.6 insuficiente',
      saldo: '3.6',
      retenido: '0',
      reservasNuevas: 0,
      movimientosNuevos: 0,
    });

    // E1: dos estudiantes desean el mismo horario.
    stage = 'E1: competencia por un horario entre dos instancias';
    const second = await register('10');
    const third = await register('10');
    const slotTutor = await register();
    const oneSlot = await publish(slotTutor, 4);
    const requestA = (await create(second, slotTutor, oneSlot).expect(201))
      .body;
    const requestB = (await create(third, slotTutor, oneSlot).expect(201)).body;
    const sameSlot = await Promise.all([
      accept(slotTutor, requestA.id_solicitud),
      accept(slotTutor, requestB.id_solicitud, randomUUID(), otherApi),
    ]);
    assert.deepEqual(sameSlot.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM "RESERVAS" WHERE id_solicitud=ANY($1::uuid[])',
          [[requestA.id_solicitud, requestB.id_solicitud]],
        )
      ).rows[0].n,
      1,
    );

    // E2: horarios no solapados compiten por el mismo saldo (5 alcanza una sola).
    stage = 'E2: competencia por saldo para una sola reserva';
    const scarce = await register('5');
    const scarceTutorA = await register();
    const anotherTutor = await register();
    const scarceA = await publish(scarceTutorA, 5);
    const scarceB = await publish(anotherTutor, 6);
    const requestC = (await create(scarce, scarceTutorA, scarceA).expect(201))
      .body;
    const requestD = (await create(scarce, anotherTutor, scarceB).expect(201))
      .body;
    const sameBalance = await Promise.all([
      accept(scarceTutorA, requestC.id_solicitud),
      accept(anotherTutor, requestD.id_solicitud, randomUUID(), otherApi),
    ]);
    assert.deepEqual(sameBalance.map((r) => r.status).sort(), [200, 409]);
    await assertBalance(scarce, '3.7', '1.3', '5');
    cases.push({
      caso: 'E: competencia mismo horario y mismo saldo en dos instancias',
      mismoHorario: [200, 409],
      mismoSaldo: [200, 409],
      saldo: '5',
      retenido: '3.7',
      disponible: '1.3',
    });

    // El mismo participante tampoco puede reservar como tutor en otra clase.
    stage = 'E3: conflicto horario de participante con roles cruzados';
    const crossStudent = await register('10');
    const crossRequester = await register('10');
    const crossTutor = await register();
    const crossFirstOffer = await publish(crossTutor, 11);
    const crossSecondOffer = await publish(crossStudent, 11);
    const crossFirst = (
      await create(crossStudent, crossTutor, crossFirstOffer).expect(201)
    ).body;
    const crossSecond = (
      await create(crossRequester, crossStudent, crossSecondOffer).expect(201)
    ).body;
    await accept(crossTutor, crossFirst.id_solicitud).expect(200);
    const beforeCrossRole = await snapshot();
    await accept(
      crossStudent,
      crossSecond.id_solicitud,
      randomUUID(),
      otherApi,
    ).expect(409);
    assert.deepEqual(await snapshot(), beforeCrossRole);
    await assertBalance(crossRequester, '0', '10');
    cases.push({
      caso: 'conflicto de participante con roles cruzados',
      estadoHTTP: 409,
      efectosNuevos: 0,
    });

    // F: el rechazo no retiene; la cancelacion devuelve 3.7, sin remuneracion.
    stage = 'F: rechazo pendiente sin reserva ni nuevos movimientos';
    const rejectTutor = await register();
    const rejectOffer = await publish(rejectTutor, 7);
    const rejectRequest = (
      await create(student, rejectTutor, rejectOffer).expect(201)
    ).body;
    const beforeReject = await savedMovements(reservation.id_reserva);
    await post(
      api,
      rejectTutor,
      `/exchanges/${rejectRequest.id_solicitud}/reject`,
    ).expect(200);
    await assertBalance(student, '3.7', '6.3');
    assert.deepEqual(
      await savedMovements(reservation.id_reserva),
      beforeReject,
    );
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM "RESERVAS" WHERE id_solicitud=$1',
          [rejectRequest.id_solicitud],
        )
      ).rows[0].n,
      0,
    );
    const cancelKey = randomUUID();
    stage = 'F: cancelacion libera 3.7 una sola vez y conserva pago tutor cero';
    const cancelled = (
      await post(
        api,
        student,
        `/reservations/${reservation.id_reserva}/cancel`,
        { motivo: 'Cancelacion exacta de ensayo' },
        cancelKey,
      ).expect(200)
    ).body;
    assert.equal(cancelled.estado, 'Cancelada');
    assert.deepEqual(
      (
        await post(
          otherApi,
          student,
          `/reservations/${reservation.id_reserva}/cancel`,
          { motivo: 'Cancelacion exacta de ensayo' },
          cancelKey,
        ).expect(200)
      ).body,
      cancelled,
    );
    const afterCancel = await assertBalance(student, '0', '10');
    const released = await savedMovements(reservation.id_reserva);
    assert.equal(released.length, 2);
    assert.equal(
      released.filter(
        (m) =>
          m.tipo === 'Liberacion' &&
          m.cantidad === '3.7' &&
          m.retenidos_anterior === '3.7' &&
          m.retenidos_posterior === '0',
      ).length,
      1,
    );
    assert.equal((await credits(tutor)).saldo, '0');
    cases.push({
      caso: 'F: rechazo sin retencion y cancelacion exacta/replay',
      ...afterCancel,
      movimientos: released.length,
      liberaciones: 1,
      pagoTutor: '0',
    });

    // Fallo SQL real al final del escritor: comprueba rollback de todas las tablas.
    stage = 'rollback: FK real al escribir retencion y reintento';
    const faultUser = await register('10');
    const faultTutor = await register();
    const faultOffer = await publish(faultTutor, 8);
    const faultRequest = (
      await create(faultUser, faultTutor, faultOffer).expect(201)
    ).body;
    const name = `phase4_fault_${randomBytes(6).toString('hex')}`;
    const missingReservationId = randomUUID();
    assert.equal(
      (
        await db.query(
          'SELECT EXISTS(SELECT 1 FROM "RESERVAS" WHERE id_reserva=$1) AS found',
          [missingReservationId],
        )
      ).rows[0].found,
      false,
    );
    const beforeFault = await snapshot();
    try {
      await db.query(
        `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.id_reserva='${missingReservationId}'::uuid; RETURN NEW; END $$`,
      );
      await db.query(
        `CREATE TRIGGER ${name} BEFORE INSERT ON "MOVIMIENTOS_CREDITO" FOR EACH ROW WHEN (NEW.id_usuario='${faultUser.id}'::uuid AND NEW.tipo='Retencion') EXECUTE FUNCTION ${name}()`,
      );
      await accept(faultTutor, faultRequest.id_solicitud).expect(409);
    } finally {
      await db.query(`DROP TRIGGER IF EXISTS ${name} ON "MOVIMIENTOS_CREDITO"`);
      await db.query(`DROP FUNCTION IF EXISTS ${name}()`);
    }
    assert.deepEqual(await snapshot(), beforeFault);
    const afterFault = (
      await accept(faultTutor, faultRequest.id_solicitud).expect(200)
    ).body;
    await assertBalance(faultUser, '3.7', '6.3');
    cases.push({
      caso: 'fallo SQL FK al escribir retencion, rollback y reintento',
      reservaTrasReintento: afterFault.id_reserva,
      retenciones: 1,
    });

    // La validacion temporal sigue intacta al habilitar la liquidacion de fase 5.
    stage = 'confirmacion anticipada decimal sin consumo ni pago';
    const beforeSettlement = await snapshot();
    await post(
      api,
      faultUser,
      `/reservations/${afterFault.id_reserva}/confirm`,
    ).expect(409);
    assert.deepEqual(await snapshot(), beforeSettlement);
    assert.equal((await credits(faultTutor)).saldo, '0');
    cases.push({
      caso: 'confirmacion anticipada sin efectos',
      estadoHTTP: 409,
      consumos: 0,
      pagos: 0,
    });

    // G: horario historico sin oferta conserva la tarifa de 15 minutos.
    stage = 'G: horario historico 45 minutos por 3 sin referencia a oferta';
    const legacyTutor = await register();
    const legacyStudent = await register('10');
    await api
      .post('/users/me/skills')
      .auth(legacyTutor.token, { type: 'bearer' })
      .send({ skillId, nivel: 'Intermedio' })
      .expect(201);
    const legacyStart = new Date(originalNow() + 10 * 86400000);
    const times = {
      fechaInicio: legacyStart.toISOString(),
      fechaFin: new Date(legacyStart.getTime() + 45 * 60000).toISOString(),
    };
    const slot = (
      await api
        .post('/availability')
        .auth(legacyTutor.token, { type: 'bearer' })
        .send(times)
        .expect(201)
    ).body;
    const legacy = (
      await post(api, legacyStudent, '/exchanges', {
        providerId: legacyTutor.id,
        skillId,
        availabilityId: slot.id_disponibilidad,
        ...times,
      }).expect(201)
    ).body;
    assert.equal(legacy.id_oferta, null);
    assert.equal(legacy.creditos_requeridos, '3');
    const legacyReservation = (
      await accept(legacyTutor, legacy.id_solicitud).expect(200)
    ).body;
    assert.equal(legacyReservation.creditos, '3');
    await assertBalance(legacyStudent, '3', '7');
    assert.equal(
      (
        await db.query(
          'SELECT id_oferta FROM "SOLICITUDES_INTERCAMBIO" WHERE id_solicitud=$1',
          [legacy.id_solicitud],
        )
      ).rows[0].id_oferta,
      null,
    );
    cases.push({
      caso: 'G: control historico45min sin oferta y registro/bono0/publicacion',
      precio: '3',
      retenido: '3',
      disponible: '7',
      referenciaOferta: null,
    });
    // Despues del fin se admite el pacto 3.7, sin relajar el reloj normal de la API.
    // Se renuevan sesiones del fixture porque esta clase fue publicada a ocho dias.
    stage =
      'fase 5: fin alcanzado, primera marca sin pago y segunda liquida3.7';
    Date.now = () => new Date(afterFault.fecha_fin).getTime() + 1000;
    const renewedUser = {
      ...faultUser,
      token: (
        await api
          .post('/auth/login')
          .send({ correo: faultUser.correo, password })
          .expect(200)
      ).body.access_token,
    };
    const renewedTutor = {
      ...faultTutor,
      token: (
        await api
          .post('/auth/login')
          .send({ correo: faultTutor.correo, password })
          .expect(200)
      ).body.access_token,
    };
    const first = (
      await post(
        api,
        renewedUser,
        `/reservations/${afterFault.id_reserva}/confirm`,
      ).expect(200)
    ).body;
    assert.equal(first.estado, 'Confirmada');
    assert.ok(first.confirmacion_solicitante_at);
    assert.equal(first.confirmacion_ofertante_at, null);
    assert.equal((await savedMovements(afterFault.id_reserva)).length, 1);
    assert.equal((await credits(renewedTutor)).saldo, '0');
    const settled = (
      await post(
        otherApi,
        renewedTutor,
        `/reservations/${afterFault.id_reserva}/confirm`,
      ).expect(200)
    ).body;
    assert.equal(settled.estado, 'Completada');
    assert.equal(settled.creditos, '3.7');
    await assertBalance(renewedUser, '0', '6.3', '6.3');
    assert.equal((await credits(renewedTutor)).saldo, '3.7');
    const settledMovements = await savedMovements(afterFault.id_reserva);
    assert.equal(settledMovements.length, 3);
    assert.equal(
      settledMovements.filter(
        (m) => m.tipo === 'Consumo' && m.cantidad === '-3.7',
      ).length,
      1,
    );
    assert.equal(
      settledMovements.filter(
        (m) => m.tipo === 'Transferencia' && m.cantidad === '3.7',
      ).length,
      1,
    );
    cases.push({
      caso: 'fase5 tras el fin: liquidacion exacta',
      reserva: afterFault.id_reserva,
      saldo: '6.3',
      retenido: '0',
      disponible: '6.3',
      tutor: '3.7',
      consumos: 1,
      pagos: 1,
    });
    console.log(
      'Solicitudes de ofertas PostgreSQL OK (esquema decimal provisional, no migracion oficial):',
      JSON.stringify(cases),
    );
    return cases;
  } catch (error) {
    // Etapas constantes y codigos HTTP; nunca cuerpos, SQL, URLs ni credenciales.
    const statusMismatch =
      typeof error?.message === 'string'
        ? /^expected (\d{3})[^\r\n]*got (\d{3})/.exec(error.message)
        : null;
    console.error(
      'Solicitudes de ofertas PostgreSQL: fallo de comprobacion',
      JSON.stringify({
        etapa: stage,
        tipo: error?.constructor?.name,
        comparacion:
          error instanceof assert.AssertionError ? error.operator : undefined,
        ...(statusMismatch
          ? { esperadoHTTP: statusMismatch[1], recibidoHTTP: statusMismatch[2] }
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

module.exports = { verifyOfferRequests };
