// Fixture persistente de desarrollo. No levanta un puerto ni modifica el reloj.
require('reflect-metadata');
require('dotenv/config');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve, relative } = require('node:path');
const { Client } = require('pg');
const request = require('supertest');

async function main() {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.LOCAL_DEVELOPMENT_SEED !== 'true'
  )
    throw new Error(
      'Requiere NODE_ENV=development y LOCAL_DEVELOPMENT_SEED=true.',
    );
  const url = new URL(process.env.DATABASE_URL);
  const database = url.pathname.slice(1);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^(timebank_local|timebank_academic_[a-z0-9_]+)$/.test(database)
  )
    throw new Error(
      'Destino permitido: PostgreSQL loopback y BD timebank_local o timebank_academic_<nombre>.',
    );

  const db = new Client({ connectionString: url.href });
  let app;
  let privatePath;
  let stage = 'conexion y esquema';
  try {
    await db.connect();
    assert.equal(
      (await db.query('SELECT current_database() AS name')).rows[0].name,
      database,
    );
    const columns = await db.query(`
      SELECT table_name, column_name, udt_name
      FROM information_schema.columns
      WHERE table_schema='public' AND (table_name,column_name) IN (
        ('USUARIOS','saldo'),('USUARIOS','creditos_retenidos'),
        ('SOLICITUDES_INTERCAMBIO','creditos_requeridos'),('RESERVAS','creditos'),
        ('MOVIMIENTOS_CREDITO','cantidad'),('MOVIMIENTOS_CREDITO','saldo_anterior'),
        ('MOVIMIENTOS_CREDITO','saldo_posterior'),('MOVIMIENTOS_CREDITO','retenidos_anterior'),
        ('MOVIMIENTOS_CREDITO','retenidos_posterior'))
    `);
    assert.equal(columns.rowCount, 9, 'Aplicar primero npm run db:init.');
    assert.ok(
      columns.rows.every((column) => column.udt_name === 'int4'),
      'Esta fixture usa exclusivamente las migraciones oficiales INTEGER.',
    );
    const career = (
      await db.query(
        'SELECT id_carrera,nombre FROM "CARRERAS" WHERE estado=\'activo\' ORDER BY id_carrera LIMIT 1',
      )
    ).rows[0];
    const skill = (
      await db.query(
        "SELECT id_habilidad,nombre FROM \"HABILIDADES\" WHERE estado='activo' ORDER BY (nombre='Python') DESC,id_habilidad LIMIT 1",
      )
    ).rows[0];
    assert.ok(career && skill, 'Faltan catalogos: ejecutar npm run db:init.');

    // Solo este proceso usa correo capturado y bono 3/0. La API normal conserva
    // su SMTP y politica. La verificacion y todos los efectos pasan por HTTP real.
    Object.assign(process.env, {
      PERSISTENCE_MODE: 'prisma',
      DATABASE_ENABLED: 'true',
      REGISTRATION_INITIAL_CREDITS: '0',
      JWT_SECRET: randomBytes(48).toString('hex'),
      GOOGLE_CALENDAR_ENABLED: 'false',
      RATE_LIMIT_MAX: '1000',
    });
    const { Test } = require('@nestjs/testing');
    const { AppModule } = require('../dist/app.module');
    const { configureApp } = require('../dist/config/configure-app');
    const {
      VerificationMailer,
    } = require('../dist/modules/auth/verification-mailer');
    const {
      REGISTRATION_POLICY,
    } = require('../dist/modules/auth/registration-policy');
    const mailbox = new Map();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VerificationMailer)
      .useValue({
        assertConfigured() {},
        async send(correo, token) {
          mailbox.set(correo, token);
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false, abortOnError: false });
    configureApp(app);
    await app.init();
    const api = request(app.getHttpServer());
    assert.equal(
      (await api.get('/health/ready').expect(200)).body.persistence,
      'postgresql',
    );

    const runId = randomUUID();
    const credentials = {
      fixture: 'academic-integer-45min-3',
      database,
      createdAt: new Date().toISOString(),
      note: 'Solo desarrollo. Correo capturado en este proceso; no se envio SMTP.',
      student: {
        correo: `academic-student-${runId}@ucb.edu.bo`,
        password: randomBytes(24).toString('base64url'),
      },
      tutor: {
        correo: `academic-tutor-${runId}@ucb.edu.bo`,
        password: randomBytes(24).toString('base64url'),
      },
      career,
      skill,
    };
    const directory = resolve(__dirname, '..', '.local', 'academic-demo');
    mkdirSync(directory, { recursive: true });
    privatePath = resolve(directory, `${runId}.private.json`);
    writeFileSync(privatePath, JSON.stringify(credentials, null, 2), {
      flag: 'wx',
      mode: 0o600,
    });
    const save = () =>
      writeFileSync(privatePath, JSON.stringify(credentials, null, 2), {
        mode: 0o600,
      });
    const register = async (actor, initialCredits) => {
      app.get(REGISTRATION_POLICY).initialCredits = initialCredits;
      const user = (
        await api
          .post('/auth/register')
          .send({
            ...actor,
            nombre: 'Demo',
            apellido: 'Academica',
            idCarrera: career.id_carrera,
            semestre: 1,
          })
          .expect(201)
      ).body;
      actor.id = user.id;
      save();
      assert.equal(user.estado, 'Pendiente');
      assert.ok(mailbox.has(actor.correo));
      await api
        .post('/auth/verify-email')
        .send({ token: mailbox.get(actor.correo) })
        .expect(200);
      return (
        await api
          .post('/auth/login')
          .send({ correo: actor.correo, password: actor.password })
          .expect(200)
      ).body.access_token;
    };
    stage = 'registro y activacion';
    const tutorToken = await register(credentials.tutor, '0');
    const studentToken = await register(credentials.student, '3');
    const post = (path, token, body, key = randomUUID()) =>
      api
        .post(path)
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', key)
        .send(body);
    await api
      .post('/users/me/skills')
      .auth(tutorToken, { type: 'bearer' })
      .send({ skillId: skill.id_habilidad, nivel: 'Avanzado' })
      .expect(201);
    // Crear por HTTP un horario futuro sin oferta: tarifa historica 4/hora.
    const start = new Date(Math.ceil((Date.now() + 3600000) / 900000) * 900000);
    const end = new Date(start.getTime() + 45 * 60000);
    stage = 'solicitud y retencion';
    const slot = (
      await api
        .post('/availability')
        .auth(tutorToken, { type: 'bearer' })
        .send({ fechaInicio: start.toISOString(), fechaFin: end.toISOString() })
        .expect(201)
    ).body;
    credentials.availabilityId = slot.id_disponibilidad;
    save();
    const exchange = (
      await post('/exchanges', studentToken, {
        providerId: credentials.tutor.id,
        skillId: skill.id_habilidad,
        availabilityId: slot.id_disponibilidad,
        fechaInicio: start.toISOString(),
        fechaFin: end.toISOString(),
      }).expect(201)
    ).body;
    credentials.exchangeId = exchange.id_solicitud;
    save();
    assert.equal(exchange.id_oferta, null);
    assert.equal(exchange.creditos_requeridos, '3');
    const reservation = (
      await post(
        `/exchanges/${exchange.id_solicitud}/accept`,
        tutorToken,
        {},
      ).expect(200)
    ).body;
    credentials.reservationId = reservation.id_reserva;
    save();
    assert.equal(reservation.id_oferta, null);
    assert.equal(reservation.creditos, '3');

    // Preparar SOLO este intervalo nuevo como ya terminado, sin cambiar Date.now
    // ni saltarse la regla HTTP que exige el fin real para confirmar una clase.
    stage = 'intervalo terminado de la fixture';
    const endedAt = new Date(
      Math.floor((Date.now() - 3600000) / 900000) * 900000,
    );
    const beganAt = new Date(endedAt.getTime() - 45 * 60000);
    await db.query('BEGIN');
    try {
      await db.query('SELECT pg_advisory_xact_lock(22603112)');
      for (const [sql, values] of [
        [
          'UPDATE "DISPONIBILIDADES" SET fecha_inicio=$1,fecha_fin=$2 WHERE id_disponibilidad=$3 AND id_usuario=$4',
          [beganAt, endedAt, slot.id_disponibilidad, credentials.tutor.id],
        ],
        [
          'UPDATE "SOLICITUDES_INTERCAMBIO" SET fecha_inicio_propuesta=$1,fecha_fin_propuesta=$2 WHERE id_solicitud=$3 AND id_solicitante=$4 AND id_ofertante=$5',
          [
            beganAt,
            endedAt,
            exchange.id_solicitud,
            credentials.student.id,
            credentials.tutor.id,
          ],
        ],
        [
          'UPDATE "RESERVAS" SET fecha_inicio=$1,fecha_fin=$2 WHERE id_reserva=$3 AND id_solicitud=$4 AND estado=\'Confirmada\' AND confirmacion_solicitante_at IS NULL AND confirmacion_ofertante_at IS NULL',
          [beganAt, endedAt, reservation.id_reserva, exchange.id_solicitud],
        ],
      ]) {
        assert.equal((await db.query(sql, values)).rowCount, 1);
      }
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    stage = 'doble confirmacion y pago unico';
    const confirmPath = `/reservations/${reservation.id_reserva}/confirm`;
    await post(confirmPath, studentToken, {}).expect(200);
    const key = randomUUID();
    const completed = (await post(confirmPath, tutorToken, {}, key).expect(200))
      .body;
    assert.equal(completed.estado, 'Completada');
    assert.equal(completed.id_oferta, null);
    assert.equal(completed.creditos, '3');
    assert.deepEqual(
      (await post(confirmPath, tutorToken, {}, key).expect(200)).body,
      completed,
    );
    const movements = (
      await db.query(
        'SELECT id_movimiento,tipo,cantidad::text FROM "MOVIMIENTOS_CREDITO" WHERE id_reserva=$1 ORDER BY tipo',
        [reservation.id_reserva],
      )
    ).rows;
    assert.deepEqual(
      movements.map(({ tipo, cantidad }) => ({ tipo, cantidad })),
      [
        { tipo: 'Consumo', cantidad: '-3' },
        { tipo: 'Retencion', cantidad: '3' },
        { tipo: 'Transferencia', cantidad: '3' },
      ],
    );
    const account = async (token) =>
      (await api.get('/credits/me').auth(token, { type: 'bearer' }).expect(200))
        .body;
    assert.equal((await account(studentToken)).saldo, '0');
    assert.equal((await account(studentToken)).creditos_retenidos, '0');
    assert.equal((await account(tutorToken)).saldo, '3');
    credentials.result = {
      estado: completed.estado,
      creditos: '3',
      minutes: 45,
      id_oferta: null,
      movements,
    };
    save();
    console.log(
      'Reserva Completada persistente: 45 minutos, 3 creditos; solicitante aprende y ofertante ensena.',
    );
    console.log(
      `Reserva: ${reservation.id_reserva}; materia: ${skill.nombre} (${skill.id_habilidad}).`,
    );
    console.log(
      `Credenciales y UUID propios: ${relative(resolve(__dirname, '..'), privatePath)} (privado, ignorado por Git).`,
    );
    console.log(
      'No se borra la BD. Repetir crea otro caso; test:postgres, en cambio, elimina su BD temporal.',
    );
  } catch (error) {
    // Las excepciones de BD/configuracion pueden incluir secretos: no imprimirlas.
    console.error(
      `No se completo la fixture en: ${stage}. Verificar db:init, build y entorno local.`,
    );
    if (privatePath)
      console.error(
        `Se conservan los datos parciales y su archivo privado: ${relative(resolve(__dirname, '..'), privatePath)}.`,
      );
    if (error instanceof assert.AssertionError)
      console.error(
        'La comprobacion de datos o respuesta HTTP no coincidio con el contrato esperado.',
      );
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
    await db.end();
  }
}

void main().catch(() => {
  console.error(
    'Fixture rechazada. Revisar NODE_ENV, LOCAL_DEVELOPMENT_SEED y el destino local permitido.',
  );
  process.exitCode = 1;
});
