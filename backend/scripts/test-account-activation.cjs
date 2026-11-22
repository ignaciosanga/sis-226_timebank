// Invocado por el script OFICIAL test:postgres. PostgreSQL real; correo/Google simulados.
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { Client } = require('pg');
const request = require('supertest');

async function verifyAccountLifecycle({
  open,
  first,
  mailbox,
  connectionString,
}) {
  const {
    REGISTRATION_POLICY,
  } = require('../dist/modules/auth/registration-policy');
  const {
    GoogleAuthService,
  } = require('../dist/modules/auth/google-auth.service');
  const { ConfigService } = require('@nestjs/config');
  const db = new Client({ connectionString });
  await db.connect();
  let current = first;
  let other = await open();
  let api = request(current.getHttpServer());
  const password = randomBytes(24).toString('base64url');
  const results = [];
  const policy = (app, value) => {
    app.get(REGISTRATION_POLICY).initialCredits = value;
  };
  policy(current, '8');
  policy(other, '8');
  const create = async () => {
    const correo = `activacion-${randomUUID()}@ucb.edu.bo`;
    const user = (
      await api
        .post('/auth/register')
        .send({
          nombre: 'Prueba',
          apellido: 'Activacion',
          correo,
          password,
          idCarrera: '30000000-0000-4000-8000-000000000001',
          semestre: 1,
        })
        .expect(201)
    ).body;
    assert.equal(user.estado, 'Pendiente');
    assert.equal(user.token, undefined);
    assert.equal(user.access_token, undefined);
    const token = mailbox.findLast((m) => m.correo === correo).token;
    return { ...user, token };
  };
  const snapshot = async (id) => {
    const row = (
      await db.query(
        'SELECT estado,saldo::text,creditos_retenidos::text,cuenta_previa,email_verificado_at,bono_decidido_at,google_sub,(SELECT count(*)::int FROM "MOVIMIENTOS_CREDITO" m WHERE m.id_usuario=u.id_usuario AND tipo=\'BonoInicial\') AS bonos FROM "USUARIOS" u WHERE id_usuario=$1',
        [id],
      )
    ).rows[0];
    return row;
  };
  const confirm = (client, token) =>
    client.post('/auth/verify-email').send({ token });
  const googleClaims = (correo) => ({
    sub: `google-${correo}`,
    hd: 'ucb.edu.bo',
    email: correo,
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 600,
    aud: 'simulated-client',
    iss: 'https://accounts.google.com',
  });
  const google = async (user, app = current) => {
    app.get(ConfigService).set('GOOGLE_LOGIN_CLIENT_ID', 'simulated-client');
    return app
      .get(GoogleAuthService)
      .signIn({ credential: 'simulado' }, async () =>
        Response.json(googleClaims(user.correo)),
      );
  };
  try {
    const concurrent = await create();
    assert.equal((await snapshot(concurrent.id)).saldo, '0');
    await api
      .post('/auth/login')
      .send({ correo: concurrent.correo, password })
      .expect(403);
    const responses = await Promise.all([
      confirm(api, concurrent.token),
      confirm(request(other.getHttpServer()), concurrent.token),
    ]);
    assert.deepEqual(
      responses.map((r) => r.status),
      [200, 200],
    );
    let row = await snapshot(concurrent.id);
    assert.equal(row.saldo, '8');
    assert.equal(row.bonos, 1);
    results.push({
      caso: 'dos confirmaciones/dos instancias',
      estado: row.estado,
      saldo: row.saldo,
      bonos: row.bonos,
    });

    await current.close();
    current = await open();
    api = request(current.getHttpServer());
    policy(current, '8');
    await confirm(api, concurrent.token).expect(200);
    await api
      .post('/auth/login')
      .send({ correo: concurrent.correo, password })
      .expect(200);
    row = await snapshot(concurrent.id);
    assert.equal(row.saldo, '8');
    assert.equal(row.bonos, 1);
    results.push({
      caso: 'reintento tras reapertura',
      estado: row.estado,
      saldo: row.saldo,
      bonos: row.bonos,
    });

    policy(current, '0');
    const zero = await create();
    await confirm(api, zero.token).expect(200);
    policy(current, '8');
    await confirm(api, zero.token).expect(200);
    await google(zero);
    row = await snapshot(zero.id);
    assert.equal(row.saldo, '0');
    assert.equal(row.bonos, 0);
    assert.ok(row.bono_decidido_at);
    results.push({
      caso: 'cero y cambio de politica/login Google',
      estado: row.estado,
      saldo: row.saldo,
      bonos: row.bonos,
    });

    const failed = await create();
    // Falla SQL después de persistir usuario y token: la misma transacción debe revertirlos.
    // El escritor decimal usa SQL parametrizado. El trigger ejerce la FK real
    // independientemente del método de persistencia y solo afecta este fixture.
    const fault = `activation_fault_${randomBytes(6).toString('hex')}`;
    const missingUser = randomUUID();
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM "USUARIOS" WHERE id_usuario=$1',
          [missingUser],
        )
      ).rows[0].n,
      0,
    );
    try {
      await db.query(
        `CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.id_usuario='${missingUser}'::uuid; RETURN NEW; END $$`,
      );
      await db.query(
        `CREATE TRIGGER ${fault} BEFORE INSERT ON "MOVIMIENTOS_CREDITO" FOR EACH ROW WHEN (NEW.id_usuario='${failed.id}'::uuid AND NEW.tipo='BonoInicial') EXECUTE FUNCTION ${fault}()`,
      );
      await confirm(api, failed.token).expect(409);
    } finally {
      await db.query(
        `DROP TRIGGER IF EXISTS ${fault} ON "MOVIMIENTOS_CREDITO"`,
      );
      await db.query(`DROP FUNCTION IF EXISTS ${fault}()`);
    }
    row = await snapshot(failed.id);
    assert.equal(row.estado, 'Pendiente');
    assert.equal(row.saldo, '0');
    assert.equal(row.bonos, 0);
    assert.equal(row.bono_decidido_at, null);
    assert.equal(
      (
        await db.query(
          'SELECT consumed_at FROM "VERIFICACIONES_CORREO" WHERE id_usuario=$1',
          [failed.id],
        )
      ).rows[0].consumed_at,
      null,
    );
    await confirm(api, failed.token).expect(200);
    results.push({
      caso: 'fallo SQL intermedio y recuperacion',
      ...(await snapshot(failed.id)),
    });

    const mixed = await create();
    await Promise.all([
      confirm(api, mixed.token).expect(200),
      google(mixed, other),
    ]);
    row = await snapshot(mixed.id);
    assert.equal(row.saldo, '8');
    assert.equal(row.bonos, 1);
    results.push({
      caso: 'correo y Google concurrentes',
      estado: row.estado,
      saldo: row.saldo,
      bonos: row.bonos,
    });

    const ledgerBefore = (
      await db.query(
        'SELECT * FROM "MOVIMIENTOS_CREDITO" WHERE id_usuario=$1 ORDER BY id_movimiento',
        [concurrent.id],
      )
    ).rows;
    await google(concurrent);
    await api
      .post('/auth/login')
      .send({ correo: concurrent.correo, password })
      .expect(200);
    assert.deepEqual(
      (
        await db.query(
          'SELECT * FROM "MOVIMIENTOS_CREDITO" WHERE id_usuario=$1 ORDER BY id_movimiento',
          [concurrent.id],
        )
      ).rows,
      ledgerBefore,
    );
    row = await snapshot(concurrent.id);
    results.push({
      caso: 'cuenta ya activa con historial/password y Google',
      estado: row.estado,
      saldo: row.saldo,
      bonos: row.bonos,
    });
    console.log('Activacion PostgreSQL OK:', JSON.stringify(results));
  } finally {
    await current.close();
    await other.close();
    await db.end();
  }
}
module.exports = { verifyAccountLifecycle };
