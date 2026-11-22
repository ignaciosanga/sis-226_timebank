import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserStatus } from '../src/common/enums/record-status.enum';
import { configureApp } from '../src/config/configure-app';
import { VerificationMailer } from '../src/modules/auth/verification-mailer';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../src/modules/exchanges/exchange.repository';
import { RequestStatus } from '../src/modules/exchanges/exchange.types';
import {
  confirmFromMailbox,
  mailCapture,
} from './support/verification.fixture';

interface Actor {
  id: string;
  token: string;
}

interface OfferResponse {
  id_oferta: string;
  id_disponibilidad: string;
  id_habilidad: string;
  costo_creditos: string;
  fecha_inicio: string;
  fecha_fin: string;
}

describe('Ofertas con precio publicado por HTTP (memoria; correo simulado)', () => {
  let app: INestApplication;
  let persistence: ExchangeRepository;
  let mailbox: ReturnType<typeof mailCapture>;
  let tutor: Actor;
  let student: Actor;
  let fechaInicio: string;
  let fechaFin: string;
  const skillId = '20000000-0000-4000-8000-000000000002';
  const otherSkillId = '20000000-0000-4000-8000-000000000001';
  const api = () => request(app.getHttpServer());

  async function register(verify = true): Promise<Actor> {
    const correo = `oferta-${randomUUID()}@ucb.edu.bo`;
    const password = randomBytes(24).toString('base64url');
    const response = await api()
      .post('/auth/register')
      .send({
        nombre: 'Ana',
        apellido: 'Tutorias',
        correo,
        password,
        idCarrera: '30000000-0000-4000-8000-000000000001',
        semestre: 3,
      })
      .expect(201);
    const id = response.body.id as string;
    if (!verify)
      return {
        id,
        token: await app
          .get(JwtService)
          .signAsync({ sub: id, purpose: 'session' }),
      };
    await confirmFromMailbox(app, mailbox, correo);
    const login = await api()
      .post('/auth/login')
      .send({ correo, password })
      .expect(200);
    return { id, token: login.body.access_token as string };
  }

  function post(actor: Actor, body: object, key = randomUUID()) {
    return api()
      .post('/tutoring/offers')
      .auth(actor.token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);
  }

  const input = (patch: Record<string, unknown> = {}) => ({
    skillId,
    nivel: 'Intermedio',
    titulo: 'Python en ejercicios guiados',
    descripcion: 'Una clase completa para resolver ejercicios paso a paso.',
    costoCreditos: '3.7',
    fechaInicio,
    fechaFin,
    ...patch,
  });

  async function ownSkill(actor: Actor) {
    await api()
      .post('/users/me/skills')
      .auth(actor.token, { type: 'bearer' })
      .send({ skillId, nivel: 'Intermedio' })
      .expect(201);
  }

  const finances = () =>
    persistence.read((state) => ({
      users: [...state.users.values()].map((user) => ({
        id_usuario: user.id_usuario,
        saldo: user.saldo,
        creditos_retenidos: user.creditos_retenidos,
        bono_decidido_at: user.bono_decidido_at,
      })),
      movements: [...state.movements.values()],
    }));
  const counts = () =>
    persistence.read((state) => ({
      offers: state.offers.size,
      availability: state.availability.size,
      requests: state.requests.size,
      reservations: state.reservations.size,
    }));

  beforeEach(async () => {
    mailbox = mailCapture();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VerificationMailer)
      .useValue(mailbox)
      .compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    persistence = app.get(EXCHANGE_REPOSITORY);
    fechaInicio = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    fechaFin = new Date(
      new Date(fechaInicio).getTime() + 45 * 60 * 1000,
    ).toISOString();
    tutor = await register();
    student = await register();
    await ownSkill(tutor);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it('HU-05: detalle, filtros y edición propia conservan saldos y replay', async () => {
    const created = await post(tutor, input()).expect(201);
    const id = created.body.id_oferta as string;
    await api().get(`/tutoring/offers/${id}`).expect(200);
    const filtered = await api()
      .get(`/tutoring/offers?skillId=${skillId}&excludeTutorId=${tutor.id}`)
      .expect(200);
    expect(filtered.body.data).toEqual([]);
    const before = await finances();
    const key = randomUUID();
    const update = (actor: Actor) =>
      api()
        .put(`/tutoring/offers/${id}`)
        .auth(actor.token, { type: 'bearer' })
        .set('Idempotency-Key', key)
        .send(input({ titulo: 'Enfoque actualizado', costoCreditos: '5' }));
    await update(student).expect(403);
    const edited = await update(tutor).expect(200);
    expect((await update(tutor).expect(200)).body).toEqual(edited.body);
    expect(edited.body.costo_creditos).toBe('5');
    expect(await finances()).toEqual(before);
  });

  it('HU-05: una materia inexistente devuelve 400 sin escrituras parciales', async () => {
    const before = await counts();
    await post(tutor, input({ skillId: randomUUID() })).expect(400);
    expect(await counts()).toEqual(before);
  });

  it('publica 45 minutos por 3.7, permite descubrirla y no modifica saldos ni movimientos', async () => {
    const before = await finances();
    const response = await post(tutor, input()).expect(201);
    const offer = response.body as OfferResponse;
    expect(offer).toMatchObject({
      id_habilidad: skillId,
      nivel: 'Intermedio',
      titulo: input().titulo,
      descripcion: input().descripcion,
      costo_creditos: '3.7',
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    });
    expect(typeof offer.id_oferta).toBe('string');
    expect(typeof offer.id_disponibilidad).toBe('string');
    const catalogue = await api()
      .get('/tutoring/offers?page=1&limit=100')
      .auth(student.token, { type: 'bearer' })
      .expect(200);
    expect(catalogue.body.meta.totalPages).toBe(1);
    expect(catalogue.body.data).toEqual([
      expect.objectContaining({
        id_oferta: offer.id_oferta,
        costo_creditos: '3.7',
      }),
    ]);
    expect(catalogue.body.data[0].metricas).toEqual({
      promedio: null,
      opiniones: 0,
      tutorias_completadas: 0,
    });
    const serialized = JSON.stringify(catalogue.body);
    expect(serialized).not.toContain('password_hash');
    expect(serialized).not.toContain('@ucb.edu.bo');
    expect(await counts()).toEqual({
      offers: 1,
      availability: 1,
      requests: 0,
      reservations: 0,
    });
    expect(await finances()).toEqual(before);
    const state = await persistence.read((current) => ({
      offer: current.offers.get(offer.id_oferta),
      slot: current.availability.get(offer.id_disponibilidad),
    }));
    expect(state.offer?.costo_creditos).toBe('3.7');
    expect(state.slot?.id_usuario).toBe(tutor.id);
    expect(
      state.slot!.fecha_fin.getTime() - state.slot!.fecha_inicio.getTime(),
    ).toBe(45 * 60 * 1000);
  });

  it('acepta 3.5 y publica sin banner', async () => {
    const response = await post(tutor, input({ costoCreditos: '3.5' })).expect(
      201,
    );
    expect(response.body.costo_creditos).toBe('3.5');
    const list = await api().get('/tutoring/offers').expect(200);
    expect(list.body.data[0].costo_creditos).toBe('3.5');
    expect(
      list.body.data[0].banner_url ?? list.body.data[0].bannerUrl ?? null,
    ).toBeNull();
  });

  it('rechaza cero, negativos, centesimas, exponentes y JSON numerico antes de persistir', async () => {
    const before = await finances();
    for (const amount of ['0', '-3.7', '3.75', '3.70', '3e1', 3.7]) {
      await post(tutor, input({ costoCreditos: amount })).expect(400);
      expect(await counts()).toEqual({
        offers: 0,
        availability: 0,
        requests: 0,
        reservations: 0,
      });
    }
    expect(await finances()).toEqual(before);
  });

  it('exige sesion activa, habilidad propia, nivel propio e intervalo valido', async () => {
    await api()
      .post('/tutoring/offers')
      .set('Idempotency-Key', randomUUID())
      .send(input())
      .expect(401);
    const pending = await register(false);
    await post(pending, input()).expect(401);
    await post(tutor, input({ skillId: otherSkillId })).expect(403);
    await post(tutor, input({ skillId: randomUUID() })).expect(400);
    await post(tutor, input({ nivel: 'Avanzado' })).expect(409);
    await post(tutor, input({ titulo: '' })).expect(400);
    await post(tutor, input({ titulo: 'a'.repeat(101) })).expect(400);
    await post(tutor, input({ descripcion: '' })).expect(400);
    await post(tutor, input({ descripcion: 'a'.repeat(1501) })).expect(400);
    await post(tutor, input({ fechaFin: fechaInicio })).expect(400);
    await post(tutor, input({ fechaInicio: '2027-01-02T10:00:00' })).expect(
      400,
    );
    await post(
      tutor,
      input({
        fechaFin: new Date(
          new Date(fechaInicio).getTime() + 46 * 60 * 1000,
        ).toISOString(),
      }),
    ).expect(400);
    await post(
      tutor,
      input({
        fechaInicio: '2020-01-01T10:00:00Z',
        fechaFin: '2020-01-01T10:45:00Z',
      }),
    ).expect(400);
    expect(await counts()).toEqual({
      offers: 0,
      availability: 0,
      requests: 0,
      reservations: 0,
    });
  });

  it('requiere Idempotency-Key y recupera una sola oferta y horario al reintentar simultaneamente', async () => {
    await api()
      .post('/tutoring/offers')
      .auth(tutor.token, { type: 'bearer' })
      .send(input())
      .expect(400);
    const key = randomUUID();
    const responses = await Promise.all([
      post(tutor, input(), key),
      post(tutor, input(), key),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(responses[1].body).toEqual(responses[0].body);
    const replay = await post(tutor, input(), key).expect(201);
    expect(replay.body.id_oferta).toBe(responses[0].body.id_oferta);
    await post(tutor, input({ titulo: 'Otro contenido' }), key).expect(409);
    expect(await counts()).toEqual({
      offers: 1,
      availability: 1,
      requests: 0,
      reservations: 0,
    });
  });

  it('dos claves concurrentes respetan una oferta activa por tutor y materia', async () => {
    const responses = await Promise.all([
      post(tutor, input()),
      post(tutor, input()),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await counts()).toEqual({
      offers: 1,
      availability: 1,
      requests: 0,
      reservations: 0,
    });
  });

  it('rechaza la contratacion por duracion sin crear solicitud ni retener creditos', async () => {
    const response = await post(tutor, input()).expect(201);
    const offer = response.body as OfferResponse;
    const before = await finances();
    const rejected = await api()
      .post('/exchanges')
      .auth(student.token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({
        providerId: tutor.id,
        skillId,
        availabilityId: offer.id_disponibilidad,
        fechaInicio,
        fechaFin,
      })
      .expect(409);
    expect(rejected.body.code).toBe('OFFER_PRICE_FLOW_PENDING');
    expect(await counts()).toEqual({
      offers: 1,
      availability: 1,
      requests: 0,
      reservations: 0,
    });
    expect(await finances()).toEqual(before);
  });

  it('la aceptacion revalida el horario asociado y bloquea una solicitud antigua sin reserva ni retencion', async () => {
    const response = await post(tutor, input()).expect(201);
    const offer = response.body as OfferResponse;
    const id = randomUUID();
    await persistence.transaction((state) => {
      state.requests.set(id, {
        id_solicitud: id,
        id_solicitante: student.id,
        id_ofertante: tutor.id,
        id_habilidad: skillId,
        fecha_inicio_propuesta: new Date(fechaInicio),
        fecha_fin_propuesta: new Date(fechaFin),
        creditos_requeridos: '3',
        estado: RequestStatus.PENDIENTE,
        created_at: new Date(),
        respondida_at: null,
      });
      state.requestMetadata.set(id, {
        availabilityId: offer.id_disponibilidad,
        descripcion: 'Solicitud anterior',
      });
    });
    const before = await finances();
    const rejected = await api()
      .post(`/exchanges/${id}/accept`)
      .auth(tutor.token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(409);
    expect(rejected.body.code).toBe('OFFER_PRICE_FLOW_PENDING');
    expect(await counts()).toEqual({
      offers: 1,
      availability: 1,
      requests: 1,
      reservations: 0,
    });
    expect(
      await persistence.read((state) => state.requests.get(id)?.estado),
    ).toBe(RequestStatus.PENDIENTE);
    expect(await finances()).toEqual(before);
  });

  it('impide modificar o cancelar el horario publicado por las rutas generales de disponibilidad', async () => {
    const response = await post(tutor, input()).expect(201);
    const offer = response.body as OfferResponse;
    const before = await persistence.read((state) =>
      state.availability.get(offer.id_disponibilidad),
    );
    const update = await api()
      .patch(`/availability/${offer.id_disponibilidad}`)
      .auth(tutor.token, { type: 'bearer' })
      .send({
        fechaFin: new Date(
          new Date(fechaFin).getTime() + 15 * 60 * 1000,
        ).toISOString(),
      })
      .expect(409);
    expect(update.body.code).toBe('OFFER_AVAILABILITY_MANAGED');
    const remove = await api()
      .delete(`/availability/${offer.id_disponibilidad}`)
      .auth(tutor.token, { type: 'bearer' })
      .expect(409);
    expect(remove.body.code).toBe('OFFER_AVAILABILITY_MANAGED');
    expect(
      await persistence.read((state) =>
        state.availability.get(offer.id_disponibilidad),
      ),
    ).toEqual(before);
  });

  it('pagina el catalogo y excluye cuentas inactivas y ofertas vencidas', async () => {
    const first = (await post(tutor, input()).expect(201))
      .body as OfferResponse;
    await ownSkill(student);
    const second = (
      await post(student, input({ costoCreditos: '3.5' })).expect(201)
    ).body as OfferResponse;
    const page = await api().get('/tutoring/offers?page=1&limit=1').expect(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta.totalPages).toBe(2);
    const next = await api().get('/tutoring/offers?page=2&limit=1').expect(200);
    expect(next.body.data).toHaveLength(1);
    expect(next.body.data[0].id_oferta).not.toBe(page.body.data[0].id_oferta);
    await persistence.transaction((state) => {
      state.users.get(tutor.id)!.estado = UserStatus.INACTIVO;
    });
    const active = await api().get('/tutoring/offers').expect(200);
    expect(active.body.data.map((row: OfferResponse) => row.id_oferta)).toEqual(
      [second.id_oferta],
    );
    jest.spyOn(Date, 'now').mockReturnValue(new Date(fechaFin).getTime() + 1);
    const expired = await api().get('/tutoring/offers').expect(200);
    expect(expired.body.data).toEqual([]);
    expect(first.id_oferta).not.toBe(second.id_oferta);
  });
});
