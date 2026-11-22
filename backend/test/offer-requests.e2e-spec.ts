import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';
import { UserStatus } from '../src/common/enums/record-status.enum';
import { VerificationMailer } from '../src/modules/auth/verification-mailer';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../src/modules/exchanges/exchange.repository';
import {
  confirmFromMailbox,
  mailCapture,
} from './support/verification.fixture';

interface Actor {
  id: string;
  token: string;
}

interface Offer {
  id_oferta: string;
  id_disponibilidad: string;
  fecha_inicio: string;
  fecha_fin: string;
}

describe('Solicitud al precio publicado y retencion exacta (memoria decimal de ensayo)', () => {
  let app: INestApplication;
  let persistence: ExchangeRepository;
  let mailbox: ReturnType<typeof mailCapture>;
  let tutor: Actor;
  let student: Actor;
  let offer: Offer;
  const skillId = '20000000-0000-4000-8000-000000000002';
  const api = () => request(app.getHttpServer());
  const post = (actor: Actor, path: string, body = {}, key = randomUUID()) =>
    api()
      .post(path)
      .auth(actor.token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);
  const balance = async (actor: Actor) =>
    (
      await api()
        .get('/credits/me')
        .auth(actor.token, { type: 'bearer' })
        .expect(200)
    ).body;
  const requestBody = (published: Offer = offer, provider: Actor = tutor) => ({
    providerId: provider.id,
    skillId,
    availabilityId: published.id_disponibilidad,
    offerId: published.id_oferta,
    fechaInicio: published.fecha_inicio,
    fechaFin: published.fecha_fin,
  });
  const create = (
    actor = student,
    published = offer,
    provider = tutor,
    key = randomUUID(),
  ) => post(actor, '/exchanges', requestBody(published, provider), key);
  const accept = (id: string, actor = tutor, key = randomUUID()) =>
    post(actor, `/exchanges/${id}/accept`, {}, key);
  const snapshots = () =>
    persistence.read((state) => ({
      requests: [...state.requests.values()],
      reservations: [...state.reservations.values()],
      movements: [...state.movements.values()],
      idempotency: [...state.idempotency.entries()],
      availability: [...state.availability.values()],
      users: [...state.users.values()].map((u) => ({
        id: u.id_usuario,
        saldo: u.saldo,
        retained: u.creditos_retenidos,
      })),
    }));
  const movements = (reservationId: string) =>
    persistence.read((state) =>
      [...state.movements.values()].filter(
        (m) => m.id_reserva === reservationId,
      ),
    );

  async function register(): Promise<Actor> {
    const correo = `solicitud-oferta-${randomUUID()}@ucb.edu.bo`;
    const password = randomBytes(24).toString('base64url');
    const user = (
      await api()
        .post('/auth/register')
        .send({
          nombre: 'Ana',
          apellido: 'Solicitud',
          correo,
          password,
          idCarrera: '30000000-0000-4000-8000-000000000001',
          semestre: 2,
        })
        .expect(201)
    ).body;
    await confirmFromMailbox(app, mailbox, correo);
    const token = (
      await api().post('/auth/login').send({ correo, password }).expect(200)
    ).body.access_token as string;
    return { id: user.id as string, token };
  }

  async function publish(actor: Actor, day = 2): Promise<Offer> {
    await api()
      .post('/users/me/skills')
      .auth(actor.token, { type: 'bearer' })
      .send({ skillId, nivel: 'Intermedio' })
      .expect(201);
    const start = new Date(Date.now() + day * 86400000);
    return (
      await post(actor, '/tutoring/offers', {
        skillId,
        nivel: 'Intermedio',
        titulo: 'Tutoria de 45 minutos',
        descripcion: 'Precio publicado total, independiente de la duracion.',
        costoCreditos: '3.7',
        fechaInicio: start.toISOString(),
        fechaFin: new Date(start.getTime() + 45 * 60000).toISOString(),
      }).expect(201)
    ).body as Offer;
  }

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
    // Solo el doble de prueba anuncia capacidad decimal; no existe bandera HTTP/env.
    await persistence.transaction((state) => {
      state.creditSchema = 'decimal';
    });
    tutor = await register();
    student = await register();
    await persistence.transaction((state) => {
      state.users.get(student.id)!.saldo = '10';
    });
    offer = await publish(tutor);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it('solicitar no retiene; aceptar copia 3.7 y conserva 10, retenido 3.7, disponible 6.3 sin pagar tutor', async () => {
    const created = (await create().expect(201)).body;
    expect(created).toMatchObject({
      id_oferta: offer.id_oferta,
      creditos_requeridos: '3.7',
      costo_creditos: '3.7',
      estado: 'Solicitada',
    });
    expect(await balance(student)).toMatchObject({
      saldo: '10',
      creditos_retenidos: '0',
      disponibles: '10',
    });
    expect((await snapshots()).movements).toHaveLength(0);
    const accepted = (await accept(created.id_solicitud).expect(200)).body;
    expect(accepted).toMatchObject({
      id_solicitud: created.id_solicitud,
      creditos: '3.7',
      monto_creditos: '3.7',
      estado: 'Confirmada',
    });
    expect(await balance(student)).toMatchObject({
      saldo: '10',
      creditos_retenidos: '3.7',
      disponibles: '6.3',
    });
    expect(await balance(tutor)).toMatchObject({
      saldo: '0',
      creditos_retenidos: '0',
      disponibles: '0',
    });
    expect(await movements(accepted.id_reserva)).toEqual([
      expect.objectContaining({
        tipo: 'Retencion',
        cantidad: '3.7',
        saldo_anterior: '10',
        saldo_posterior: '10',
        retenidos_anterior: '0',
        retenidos_posterior: '3.7',
        id_usuario: student.id,
      }),
    ]);
    const catalogue = (
      await api().get('/tutoring/offers?page=1&limit=100').expect(200)
    ).body;
    expect(
      catalogue.data.some((row: Offer) => row.id_oferta === offer.id_oferta),
    ).toBe(false);
    const managed = await api()
      .patch(`/availability/${offer.id_disponibilidad}`)
      .auth(tutor.token, { type: 'bearer' })
      .send({ fechaInicio: offer.fecha_inicio, fechaFin: offer.fecha_fin })
      .expect(409);
    expect(managed.body.code).toBe('OFFER_AVAILABILITY_MANAGED');
  });

  it('resuelve por horario sin offerId y conserva el snapshot aunque cambie el catalogo', async () => {
    const { offerId: omitted, ...body } = requestBody();
    void omitted;
    const created = (await post(student, '/exchanges', body).expect(201)).body;
    await persistence.transaction((state) => {
      state.offers.get(offer.id_oferta)!.costo_creditos = '9.9';
    });
    const accepted = (await accept(created.id_solicitud).expect(200)).body;
    expect(created.id_oferta).toBe(offer.id_oferta);
    expect(accepted.creditos).toBe('3.7');
    expect((await balance(student)).disponibles).toBe('6.3');
  });

  it('idempotencia recupera solicitud y reserva; claves incompatibles no escriben', async () => {
    const key = randomUUID();
    const created = (await create(student, offer, tutor, key).expect(201)).body;
    expect((await create(student, offer, tutor, key).expect(201)).body).toEqual(
      created,
    );
    const before = await snapshots();
    await post(
      student,
      '/exchanges',
      { ...requestBody(), descripcion: 'Otro contenido' },
      key,
    ).expect(409);
    expect(await snapshots()).toEqual(before);
    const acceptKey = randomUUID();
    const results = await Promise.all([
      accept(created.id_solicitud, tutor, acceptKey),
      accept(created.id_solicitud, tutor, acceptKey),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results[0]!.body).toEqual(results[1]!.body);
    const replay = await accept(created.id_solicitud, tutor, acceptKey).expect(
      200,
    );
    expect(replay.body).toEqual(results[0]!.body);
    expect((await snapshots()).reservations).toHaveLength(1);
    expect(await movements(replay.body.id_reserva)).toHaveLength(1);
  });

  it('saldo insuficiente revierte solicitud, horario, reserva y movimiento', async () => {
    await persistence.transaction((state) => {
      state.users.get(student.id)!.saldo = '3.6';
    });
    const created = (await create().expect(201)).body;
    const before = await snapshots();
    await accept(created.id_solicitud).expect(409);
    expect(await snapshots()).toEqual(before);
    expect(await balance(student)).toMatchObject({
      saldo: '3.6',
      creditos_retenidos: '0',
      disponibles: '3.6',
    });
  });

  it('dos solicitudes por el mismo horario permiten una sola aceptacion', async () => {
    const second = await register();
    await persistence.transaction((state) => {
      state.users.get(second.id)!.saldo = '10';
    });
    const a = (await create().expect(201)).body;
    const b = (await create(second).expect(201)).body;
    const results = await Promise.all([
      accept(a.id_solicitud),
      accept(b.id_solicitud),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const saved = await snapshots();
    expect(saved.reservations).toHaveLength(1);
    expect(saved.movements.filter((m) => m.tipo === 'Retencion')).toHaveLength(
      1,
    );
  });

  it('dos solicitudes no superponen saldo disponible para una sola', async () => {
    await persistence.transaction((state) => {
      state.users.get(student.id)!.saldo = '5';
    });
    const anotherTutor = await register();
    const anotherOffer = await publish(anotherTutor, 3);
    const a = (await create().expect(201)).body;
    const b = (await create(student, anotherOffer, anotherTutor).expect(201))
      .body;
    const results = await Promise.all([
      accept(a.id_solicitud),
      accept(b.id_solicitud, anotherTutor),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await balance(student)).toMatchObject({
      saldo: '5',
      creditos_retenidos: '3.7',
      disponibles: '1.3',
    });
    expect((await snapshots()).reservations).toHaveLength(1);
  });

  it('conflictos cruzados entre rol tutor y estudiante tambien impiden aceptar', async () => {
    const third = await register();
    await persistence.transaction((state) => {
      state.users.get(third.id)!.saldo = '10';
    });
    const reverse = await publish(student);
    const a = (await create().expect(201)).body;
    const b = (await create(third, reverse, student).expect(201)).body;
    await accept(a.id_solicitud).expect(200);
    const before = await snapshots();
    await accept(b.id_solicitud, student).expect(409);
    expect(await snapshots()).toEqual(before);
  });

  it('rechazo pendiente deja saldo intacto; cancelar libera exactamente 3.7 una vez', async () => {
    const rejected = (await create().expect(201)).body;
    await post(tutor, `/exchanges/${rejected.id_solicitud}/reject`).expect(200);
    expect(await balance(student)).toMatchObject({
      saldo: '10',
      creditos_retenidos: '0',
      disponibles: '10',
    });
    expect((await snapshots()).movements).toHaveLength(0);
    const created = (await create().expect(201)).body;
    const reservation = (await accept(created.id_solicitud).expect(200)).body;
    const key = randomUUID();
    const cancelled = (
      await post(
        student,
        `/reservations/${reservation.id_reserva}/cancel`,
        { motivo: 'No puedo asistir' },
        key,
      ).expect(200)
    ).body;
    expect(cancelled.estado).toBe('Cancelada');
    expect(
      (
        await post(
          student,
          `/reservations/${reservation.id_reserva}/cancel`,
          { motivo: 'No puedo asistir' },
          key,
        ).expect(200)
      ).body,
    ).toEqual(cancelled);
    expect(await balance(student)).toMatchObject({
      saldo: '10',
      creditos_retenidos: '0',
      disponibles: '10',
    });
    expect((await balance(tutor)).saldo).toBe('0');
    expect(await movements(reservation.id_reserva)).toEqual([
      expect.objectContaining({ tipo: 'Retencion', cantidad: '3.7' }),
      expect.objectContaining({
        tipo: 'Liberacion',
        cantidad: '3.7',
        retenidos_anterior: '3.7',
        retenidos_posterior: '0',
      }),
    ]);
  });

  it('un fallo posterior a las escrituras del borrador no deja retencion parcial', async () => {
    const created = (await create().expect(201)).body;
    const original = persistence.transaction.bind(persistence);
    const before = await snapshots();
    const failing = jest
      .spyOn(persistence, 'transaction')
      .mockImplementationOnce((work) =>
        original(async (state) => {
          await work(state);
          throw new Error('fallo deliberado despues de reservar');
        }),
      );
    await accept(created.id_solicitud).expect(500);
    failing.mockRestore();
    expect(await snapshots()).toEqual(before);
    await accept(created.id_solicitud).expect(200);
    expect((await balance(student)).creditos_retenidos).toBe('3.7');
  });

  it('rechaza importe del cliente, oferta incompatible, tutor distinto y auto solicitud sin efectos', async () => {
    const stranger = await register();
    const before = await snapshots();
    await post(student, '/exchanges', {
      ...requestBody(),
      costoCreditos: '0.1',
    }).expect(400);
    await post(student, '/exchanges', {
      ...requestBody(),
      offerId: randomUUID(),
    }).expect(409);
    await post(student, '/exchanges', {
      ...requestBody(),
      providerId: stranger.id,
    }).expect(409);
    await post(student, '/exchanges', {
      ...requestBody(),
      skillId: '20000000-0000-4000-8000-000000000001',
    }).expect(409);
    await post(student, '/exchanges', {
      ...requestBody(),
      providerId: student.id,
    }).expect(400);
    await create(tutor).expect(400);
    expect(await snapshots()).toEqual(before);
    const created = (await create().expect(201)).body;
    await accept(created.id_solicitud, student).expect(403);
  });

  it('no cambia a tarifa por duracion para oferta desactivada ni acepta participantes inactivos', async () => {
    const created = (await create().expect(201)).body;
    await persistence.transaction((state) => {
      state.users.get(student.id)!.estado = UserStatus.SUSPENDIDO;
    });
    const before = await snapshots();
    await accept(created.id_solicitud).expect(404);
    expect(await snapshots()).toEqual(before);
    await persistence.transaction((state) => {
      state.users.get(student.id)!.estado = UserStatus.ACTIVO;
      state.offers.get(offer.id_oferta)!.estado = 'Finalizada';
    });
    const disabled = await snapshots();
    await create().expect(409);
    expect(await snapshots()).toEqual(disabled);
  });

  it('esquema entero conserva 409 y el control historico de 45 minutos sigue costando 3', async () => {
    await persistence.transaction((state) => {
      state.creditSchema = 'integer';
    });
    const before = await snapshots();
    const rejected = await create().expect(409);
    expect(rejected.body.code).toBe('OFFER_PRICE_FLOW_PENDING');
    expect(await snapshots()).toEqual(before);
    const start = new Date(Date.now() + 5 * 86400000);
    const body = {
      fechaInicio: start.toISOString(),
      fechaFin: new Date(start.getTime() + 45 * 60000).toISOString(),
    };
    const slot = (
      await api()
        .post('/availability')
        .auth(tutor.token, { type: 'bearer' })
        .send(body)
        .expect(201)
    ).body;
    const created = (
      await post(student, '/exchanges', {
        providerId: tutor.id,
        skillId,
        availabilityId: slot.id_disponibilidad,
        ...body,
      }).expect(201)
    ).body;
    expect(created).toMatchObject({
      id_oferta: null,
      creditos_requeridos: '3',
      costo_creditos: '3',
    });
    const reserved = (await accept(created.id_solicitud).expect(200)).body;
    expect(reserved.creditos).toBe('3');
    expect((await balance(student)).disponibles).toBe('7');
  });

  it('confirmar antes del fin no registra marcas ni pago; un esquema entero conserva la proteccion decimal', async () => {
    const created = (await create().expect(201)).body;
    const reservation = (await accept(created.id_solicitud).expect(200)).body;
    const before = await snapshots();
    const response = await post(
      student,
      `/reservations/${reservation.id_reserva}/confirm`,
    ).expect(409);
    expect(response.body.message).toContain('aun no termino');
    expect(await snapshots()).toEqual(before);
    expect((await balance(tutor)).saldo).toBe('0');
    await persistence.transaction((state) => {
      state.creditSchema = 'integer';
    });
    const integerBefore = await snapshots();
    const protectedResponse = await post(
      student,
      `/reservations/${reservation.id_reserva}/confirm`,
    ).expect(409);
    expect(protectedResponse.body.code).toBe('DECIMAL_SETTLEMENT_PENDING');
    expect(await snapshots()).toEqual(integerBefore);
  });
});
