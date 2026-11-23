import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import { isDate } from 'node:util/types';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';
import { UserStatus } from '../src/common/enums/record-status.enum';
import { DatabaseRole, Role } from '../src/common/enums/role.enum';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../src/modules/exchanges/exchange.repository';
import { ReservationStatus } from '../src/modules/exchanges/exchange.types';
import { ExchangesService } from '../src/modules/exchanges/exchanges.service';
import { CalendarService } from '../src/modules/calendar/calendar.service';
import { VerificationMailer } from '../src/modules/auth/verification-mailer';
import { REGISTRATION_POLICY } from '../src/modules/auth/registration-policy';
import { verificationHash } from '../src/modules/auth/email-verification.service';
import { USERS_REPOSITORY } from '../src/modules/users/users.repository';
import { MemoryUsersRepository } from '../src/modules/users/memory-users.repository';
import { mailCapture } from './support/verification.fixture';

describe('Cuenta institucional, activacion y bono (memoria; correo y Google simulados)', () => {
  let app: INestApplication;
  let persistence: ExchangeRepository;
  let mailbox: ReturnType<typeof mailCapture>;
  let policy: { initialCredits: string };
  const password = randomBytes(24).toString('base64url');
  const career = '30000000-0000-4000-8000-000000000001';
  const api = () => request(app.getHttpServer());
  const body = (correo = `fase2-${randomUUID()}@ucb.edu.bo`) => ({
    nombre: 'Ana',
    apellido: 'Activacion',
    correo,
    password,
    idCarrera: career,
    semestre: 2,
  });
  const tokenFor = (correo: string) =>
    [...mailbox.send.mock.calls]
      .reverse()
      .find(([to]) => to === correo.trim().toLowerCase())![1];
  const confirm = (token: string) =>
    api().post('/auth/verify-email').send({ token });
  const login = (correo: string) =>
    api().post('/auth/login').send({ correo, password });
  const saved = (id: string) =>
    persistence.read((state) => ({
      user: state.users.get(id)!,
      bonus: [...state.movements.values()].filter(
        (m) => m.id_usuario === id && m.tipo === 'BonoInicial',
      ),
      tokens: [...state.verifications.values()].filter(
        (t) => t.id_usuario === id,
      ),
    }));
  const google = (correo: string, subject = `subject-${correo}`) => ({
    sub: subject,
    hd: 'ucb.edu.bo',
    aud: 'simulated-client',
    iss: 'https://accounts.google.com',
    email: correo,
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 600,
    given_name: 'Ana',
    family_name: 'Google',
  });
  const googleResponse = (claims: object) =>
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => Response.json(claims));

  beforeEach(async () => {
    mailbox = mailCapture();
    policy = { initialCredits: '8' };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VerificationMailer)
      .useValue(mailbox)
      .overrideProvider(REGISTRATION_POLICY)
      .useValue(policy)
      .compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    persistence = app.get(EXCHANGE_REPOSITORY);
    app.get(ConfigService).set('GOOGLE_LOGIN_CLIENT_ID', 'simulated-client');
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it('normaliza, queda pendiente sin bono, GET no activa, restringe acceso y activa con 8', async () => {
    const input = body(' ANA.PRUEBA@UCB.EDU.BO ');
    const response = await api().post('/auth/register').send(input).expect(201);
    expect(response.body).toMatchObject({
      correo: 'ana.prueba@ucb.edu.bo',
      estado: 'Pendiente',
      verification_required: true,
    });
    expect(response.body).not.toHaveProperty('token');
    expect(response.body).not.toHaveProperty('access_token');
    const id = response.body.id as string,
      token = tokenFor(input.correo);
    let snapshot = await saved(id);
    expect(snapshot.user.saldo).toBe('0');
    expect(snapshot.bonus).toHaveLength(0);
    expect(snapshot.tokens[0]!.token_hash).toBe(verificationHash(token));
    expect(JSON.stringify(snapshot)).not.toContain(token);
    await api()
      .get('/auth/verify-email')
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect((await saved(id)).user.estado).toBe('Pendiente');
    const pendingSession = await app
      .get(JwtService)
      .signAsync({ sub: id, purpose: 'session' });
    await api()
      .get('/users/me')
      .auth(pendingSession, { type: 'bearer' })
      .expect(401);
    const blocked = await login(input.correo).expect(403);
    expect(blocked.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    await api()
      .post('/auth/register')
      .send({ ...input, password: 'OtraClave123!' })
      .expect(409);
    await api()
      .post('/auth/login')
      .send({ correo: input.correo, password: 'incorrecta' })
      .expect(401);
    await confirm(token).expect(200);
    snapshot = await saved(id);
    expect(snapshot.user).toMatchObject({
      estado: 'Activo',
      saldo: '8',
      creditos_retenidos: '0',
      metodo_verificacion: 'correo',
    });
    expect(snapshot.bonus).toHaveLength(1);
    expect(snapshot.tokens[0]!.consumed_at).not.toBeNull();
    const session = await login(input.correo).expect(200);
    await api()
      .get('/credits/me')
      .auth(session.body.access_token, { type: 'bearer' })
      .expect(200)
      .expect((r) => expect(r.body.saldo).toBe('8'));
  });

  it('dos confirmaciones y reintentos conceden un solo bono; replay no rehabilita una suspension', async () => {
    const input = body(),
      user = (await api().post('/auth/register').send(input).expect(201)).body;
    const token = tokenFor(input.correo);
    const responses = await Promise.all([confirm(token), confirm(token)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(responses[0]!.body).toEqual({
      status: 'verified',
      login_required: true,
    });
    await confirm(token).expect(200);
    const session = await login(input.correo).expect(200);
    expect((await saved(user.id)).bonus).toHaveLength(1);
    await persistence.transaction((state) => {
      state.users.get(user.id)!.estado = UserStatus.SUSPENDIDO;
    });
    await confirm(token).expect(200);
    expect((await saved(user.id)).user.estado).toBe('Suspendido');
    await login(input.correo).expect(401);
    await api()
      .get('/users/me')
      .auth(session.body.access_token, { type: 'bearer' })
      .expect(401);
  });

  it('bono cero queda decidido y no se entrega retroactivamente al cambiar politica', async () => {
    policy.initialCredits = '0';
    const input = body(),
      user = (await api().post('/auth/register').send(input).expect(201)).body;
    await confirm(tokenFor(input.correo)).expect(200);
    expect(isDate((await saved(user.id)).user.bono_decidido_at)).toBe(true);
    policy.initialCredits = '8';
    await confirm(tokenFor(input.correo)).expect(200);
    await login(input.correo).expect(200);
    const snapshot = await saved(user.id);
    expect(snapshot.user.saldo).toBe('0');
    expect(snapshot.bonus).toHaveLength(0);
  });

  it('rechaza invalido/vencido, rota en reenvio y conserva correos invalidos como negativos', async () => {
    await api()
      .post('/auth/register')
      .send(body('ana@@example.test'))
      .expect(400);
    const input = body(),
      user = (await api().post('/auth/register').send(input).expect(201)).body;
    const old = tokenFor(input.correo);
    await confirm('x'.repeat(43)).expect(400);
    await persistence.transaction((state) => {
      const token = state.verifications.get(verificationHash(old))!;
      token.created_at = new Date(Date.now() - 120000);
      token.expires_at = new Date(Date.now() - 60000);
    });
    await confirm(old).expect(400);
    await api()
      .post('/auth/resend-verification')
      .send({ correo: input.correo })
      .expect(202);
    const fresh = tokenFor(input.correo);
    expect(fresh).not.toBe(old);
    await confirm(old).expect(400);
    await confirm(fresh).expect(200);
    expect((await saved(user.id)).bonus).toHaveLength(1);
  });

  it('fallo de correo deja cuenta recuperable; reenvio no duplica usuario ni bono', async () => {
    mailbox.send.mockRejectedValueOnce(new Error('SMTP unavailable'));
    const input = body();
    await api().post('/auth/register').send(input).expect(503);
    const user = await app
      .get<MemoryUsersRepository>(USERS_REPOSITORY)
      .findByEmail(input.correo);
    expect(user?.estado).toBe('Pendiente');
    await confirm(tokenFor(input.correo)).expect(400);
    await api().post('/auth/register').send(input).expect(409);
    await api()
      .post('/auth/resend-verification')
      .send({ correo: input.correo })
      .expect(202);
    await confirm(tokenFor(input.correo)).expect(200);
    expect((await saved(user!.id)).bonus).toHaveLength(1);
  });

  it('un fallo intermedio revierte activacion, decision, saldo, bono y consumo', async () => {
    const input = body(),
      user = (await api().post('/auth/register').send(input).expect(201)).body;
    const original = persistence.transaction.bind(persistence);
    jest.spyOn(persistence, 'transaction').mockImplementationOnce((work) =>
      original(async (state) => {
        await work(state);
        throw new Error('Fallo despues de preparar activacion');
      }),
    );
    await confirm(tokenFor(input.correo)).expect(500);
    let snapshot = await saved(user.id);
    expect(snapshot.user).toMatchObject({
      estado: 'Pendiente',
      saldo: '0',
      bono_decidido_at: null,
    });
    expect(snapshot.bonus).toHaveLength(0);
    expect(snapshot.tokens[0]!.consumed_at).toBeNull();
    await confirm(tokenFor(input.correo)).expect(200);
    snapshot = await saved(user.id);
    expect(snapshot.bonus).toHaveLength(1);
  });

  it('Google verificado registra y permite accesos siguientes sin segundo bono', async () => {
    const input = body();
    googleResponse(google(input.correo));
    const required = await api()
      .post('/auth/google')
      .send({ credential: 'google-simulado' })
      .expect(200);
    expect(required.body.registration_required).toBe(true);
    expect(
      await app
        .get<MemoryUsersRepository>(USERS_REPOSITORY)
        .findByEmail(input.correo),
    ).toBeNull();
    const session = await api()
      .post('/auth/google')
      .send({ credential: 'google-simulado', idCarrera: career, semestre: 2 })
      .expect(200);
    await api()
      .get('/users/me')
      .auth(session.body.access_token, { type: 'bearer' })
      .expect(200);
    await api()
      .post('/auth/google')
      .send({ credential: 'google-simulado' })
      .expect(200);
    const snapshot = await saved(session.body.user.id);
    expect(snapshot.user).toMatchObject({
      estado: 'Activo',
      saldo: '8',
      metodo_verificacion: 'google',
    });
    expect(snapshot.bonus).toHaveLength(1);
    expect(mailbox.send).not.toHaveBeenCalled();
  });

  it('Google rechaza email sin evidencia y al activar pendiente invalida su contraseña previa', async () => {
    const input = body(),
      user = (await api().post('/auth/register').send(input).expect(201)).body;
    const provider = googleResponse({
      ...google(input.correo),
      email_verified: false,
    });
    await api()
      .post('/auth/google')
      .send({ credential: 'google-simulado' })
      .expect(401);
    expect((await saved(user.id)).user.estado).toBe('Pendiente');
    provider.mockResolvedValue(Response.json(google(input.correo)));
    await api()
      .post('/auth/google')
      .send({ credential: 'google-simulado' })
      .expect(200);
    await login(input.correo).expect(401);
    await confirm(tokenFor(input.correo)).expect(200);
    expect((await saved(user.id)).bonus).toHaveLength(1);
    provider.mockResolvedValue(
      Response.json(google(input.correo, 'otro-subject')),
    );
    await api()
      .post('/auth/google')
      .send({ credential: 'google-simulado' })
      .expect(409);
  });

  it('conserva cuenta anterior, rol, contraseña, saldo e historial al acceder por Google y contraseña', async () => {
    const input = body();
    const { PasswordService } =
      await import('../src/modules/auth/password.service');
    const repository = app.get<MemoryUsersRepository>(USERS_REPOSITORY);
    const user = await repository.createStudentWithAccount({
      ...input,
      passwordHash: await app.get(PasswordService).hash(password),
      role: Role.ESTUDIANTE,
      initialCredits: '5',
    });
    await persistence.transaction((state) => {
      const row = state.users.get(user.id)!;
      row.cuenta_previa = true;
      row.email_verificado_at = null;
      row.bono_decidido_at = null;
      row.rol = DatabaseRole.PROFESOR;
    });
    const previous = await saved(user.id);
    googleResponse(google(input.correo));
    await api()
      .post('/auth/google')
      .send({ credential: 'google-simulado' })
      .expect(200);
    await login(input.correo).expect(200);
    const current = await saved(user.id);
    expect(current.user).toMatchObject({
      saldo: '5',
      rol: 'Profesor',
      cuenta_previa: true,
      bono_decidido_at: null,
    });
    expect(current.bonus).toEqual(previous.bonus);
  });

  it.each([UserStatus.INACTIVO, UserStatus.SUSPENDIDO])(
    'Google no reactiva %s',
    async (status) => {
      const input = body(),
        user = (await api().post('/auth/register').send(input).expect(201))
          .body;
      await persistence.transaction((state) => {
        state.users.get(user.id)!.estado = status;
      });
      googleResponse(google(input.correo));
      await api()
        .post('/auth/google')
        .send({ credential: 'google-simulado' })
        .expect(409);
      await confirm(tokenFor(input.correo)).expect(400);
      expect((await saved(user.id)).user).toMatchObject({
        estado: status,
        saldo: '0',
      });
    },
  );

  it('rechaza state OAuth y verificacion como Bearer; la sesion valida funciona y no sirve de state', async () => {
    const input = body(),
      user = (await api().post('/auth/register').send(input).expect(201)).body;
    await confirm(tokenFor(input.correo)).expect(200);
    const session = (await login(input.correo).expect(200)).body
      .access_token as string;
    const config = app.get(ConfigService);
    for (const [key, value] of Object.entries({
      GOOGLE_CALENDAR_ENABLED: true,
      GOOGLE_CALENDAR_CLIENT_ID: 'simulated',
      GOOGLE_CALENDAR_CLIENT_SECRET: 'simulated',
      GOOGLE_CALENDAR_REDIRECT_URI: 'http://localhost:4000/calendar/callback',
    }))
      config.set(key, value);
    const exchanges = app.get(ExchangesService);
    jest
      .spyOn(exchanges, 'getReservation')
      .mockResolvedValue({ estado: ReservationStatus.CONFIRMADA } as Awaited<
        ReturnType<ExchangesService['getReservation']>
      >);
    const calendar = app.get(CalendarService);
    const state = new URL(
      (await calendar.authorizationUrl(user.id, randomUUID())).authorizationUrl,
    ).searchParams.get('state')!;
    for (const credential of [
      state,
      tokenFor(input.correo),
      await app.get(JwtService).signAsync({ sub: user.id }),
      await app.get(JwtService).signAsync({
        sub: user.id,
        action: 'calendar-event',
        reservationId: randomUUID(),
      }),
      await app.get(JwtService).signAsync({
        sub: user.id,
        purpose: 'session',
        action: 'calendar-event',
      }),
    ])
      await api()
        .get('/users/me')
        .auth(credential, { type: 'bearer' })
        .expect(401);
    await api().get('/users/me').auth(session, { type: 'bearer' }).expect(200);
    await expect(
      calendar.createEvent('simulated-code', session),
    ).rejects.toThrow('Autorizacion de Google');
  });
});
