import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';
import { UserStatus } from '../src/common/enums/record-status.enum';
import { VerificationMailer } from '../src/modules/auth/verification-mailer';
import { MAX_CREDITS } from '../src/modules/exchanges/credits';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../src/modules/exchanges/exchange.repository';
import { MemoryUsersRepository } from '../src/modules/users/memory-users.repository';
import { USERS_REPOSITORY } from '../src/modules/users/users.repository';
import {
  confirmFromMailbox,
  mailCapture,
} from './support/verification.fixture';

interface Actor {
  id: string;
  correo: string;
  password: string;
  token: string;
}

interface Offer {
  id_oferta: string;
  id_disponibilidad: string;
  fecha_inicio: string;
  fecha_fin: string;
}

interface Reservation {
  id_reserva: string;
  id_solicitud: string;
  estado: string;
  creditos: string;
  confirmacion_solicitante_at: string | null;
  confirmacion_ofertante_at: string | null;
  completed_at: string | null;
}

describe('Doble confirmacion y pago exacto de ofertas por HTTP (memoria decimal)', () => {
  let app: INestApplication;
  let persistence: ExchangeRepository;
  let mailbox: ReturnType<typeof mailCapture>;
  let admin: Actor;
  let student: Actor;
  let tutor: Actor;
  let other: Actor;
  let offer: Offer;
  let reservation: Reservation;
  let clock: jest.SpyInstance<number, []>;
  const actors: Actor[] = [];
  const publishedSkills = new Set<string>();
  const skillId = '20000000-0000-4000-8000-000000000002';
  const api = () => request(app.getHttpServer());
  const post = (actor: Actor, path: string, body = {}, key = randomUUID()) =>
    api()
      .post(path)
      .auth(actor.token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);
  const confirm = (
    actor: Actor,
    id = reservation.id_reserva,
    key = randomUUID(),
  ) => post(actor, `/reservations/${id}/confirm`, {}, key);
  const cancel = (id = reservation.id_reserva) =>
    post(admin, `/reservations/${id}/cancel`, {
      motivo: 'Cancelacion administrativa de prueba tras finalizar la clase',
    });
  const wallet = async (actor: Actor) =>
    (
      await api()
        .get('/credits/me')
        .auth(actor.token, { type: 'bearer' })
        .expect(200)
    ).body;
  const saved = () =>
    persistence.read((state) => ({
      reservations: [...state.reservations.values()],
      movements: [...state.movements.values()],
      accounts: [...state.users.values()].map((user) => ({
        id: user.id_usuario,
        saldo: user.saldo,
        retained: user.creditos_retenidos,
      })),
      idempotency: [...state.idempotency.entries()],
    }));
  const events = (id = reservation.id_reserva) =>
    persistence.read((state) =>
      [...state.movements.values()].filter((row) => row.id_reserva === id),
    );
  const current = (id = reservation.id_reserva) =>
    persistence.read((state) => state.reservations.get(id)!);

  async function login(actor: Actor) {
    actor.token = (
      await api()
        .post('/auth/login')
        .send({ correo: actor.correo, password: actor.password })
        .expect(200)
    ).body.access_token as string;
  }

  async function register(isAdmin = false): Promise<Actor> {
    const correo = `liquidacion-${randomUUID()}@ucb.edu.bo`;
    const password = randomBytes(24).toString('base64url');
    const response = await api()
      .post('/auth/register')
      .send({
        nombre: 'Ana',
        apellido: 'Liquidacion',
        correo,
        password,
        idCarrera: '30000000-0000-4000-8000-000000000001',
        semestre: 2,
      })
      .expect(201);
    await confirmFromMailbox(app, mailbox, correo);
    const actor = {
      id: response.body.id as string,
      correo,
      password,
      token: '',
    };
    if (isAdmin)
      await app
        .get<MemoryUsersRepository>(USERS_REPOSITORY)
        .grantDevelopmentAdmin(actor.id);
    await login(actor);
    actors.push(actor);
    return actor;
  }

  async function fund(actor: Actor, amount: string) {
    await post(admin, '/credits/grants', {
      userId: actor.id,
      amount,
      reason: 'Saldo inicial reproducible para liquidacion exacta',
    }).expect(201);
  }

  async function publish(actor: Actor, day = 2, price = '3.7'): Promise<Offer> {
    if (!publishedSkills.has(actor.id)) {
      await api()
        .post('/users/me/skills')
        .auth(actor.token, { type: 'bearer' })
        .send({ skillId, nivel: 'Intermedio' })
        .expect(201);
      publishedSkills.add(actor.id);
    }
    const start = new Date(Date.now() + day * 86400000);
    return (
      await post(actor, '/tutoring/offers', {
        skillId,
        nivel: 'Intermedio',
        titulo: 'Liquidacion de una tutoria de 45 minutos',
        descripcion: 'Precio total exacto pactado al solicitar la clase.',
        costoCreditos: price,
        fechaInicio: start.toISOString(),
        fechaFin: new Date(start.getTime() + 45 * 60000).toISOString(),
      }).expect(201)
    ).body as Offer;
  }

  async function reserve(
    requester = student,
    provider = tutor,
    published = offer,
  ): Promise<Reservation> {
    const created = (
      await post(requester, '/exchanges', {
        providerId: provider.id,
        skillId,
        availabilityId: published.id_disponibilidad,
        offerId: published.id_oferta,
        fechaInicio: published.fecha_inicio,
        fechaFin: published.fecha_fin,
      }).expect(201)
    ).body;
    return (
      await post(provider, `/exchanges/${created.id_solicitud}/accept`).expect(
        200,
      )
    ).body as Reservation;
  }

  async function advance(at = Date.parse(offer.fecha_fin) + 1000) {
    clock.mockReturnValue(at);
    // El reloj de este proceso de prueba avanza, por lo que renovamos JWT por login real.
    for (const actor of actors) await login(actor);
  }

  async function integrity() {
    const response = await api()
      .get('/exchanges/integrity')
      .auth(admin.token, { type: 'bearer' })
      .expect(200);
    expect(response.body.issues).toEqual([]);
  }

  beforeEach(async () => {
    actors.length = 0;
    publishedSkills.clear();
    clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now());
    mailbox = mailCapture();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VerificationMailer)
      .useValue(mailbox)
      .compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    persistence = app.get(EXCHANGE_REPOSITORY);
    // Capacidad exclusiva del doble de memoria; no es una bandera de la API.
    await persistence.transaction((state) => {
      state.creditSchema = 'decimal';
    });
    admin = await register(true);
    student = await register();
    tutor = await register();
    other = await register();
    await fund(student, '10');
    offer = await publish(tutor);
    reservation = await reserve();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it('la primera confirmacion y sus repeticiones solo guardan la marca propia sin sustituir a la contraparte', async () => {
    await advance();
    const key = randomUUID();
    const first = (
      await confirm(student, reservation.id_reserva, key).expect(200)
    ).body as Reservation;
    expect(first).toMatchObject({
      estado: 'Confirmada',
      confirmacion_ofertante_at: null,
      completed_at: null,
    });
    expect(first.confirmacion_solicitante_at).toBeTruthy();
    await advance(Date.now() + 60_000);
    expect(
      (await confirm(student, reservation.id_reserva, key).expect(200)).body,
    ).toEqual(first);
    expect((await confirm(student).expect(200)).body).toEqual(first);
    expect(await wallet(student)).toMatchObject({
      saldo: '10',
      creditos_retenidos: '3.7',
      disponibles: '6.3',
    });
    expect((await wallet(tutor)).saldo).toBe('0');
    expect(await events()).toHaveLength(1);
    await integrity();
  });

  it.each(['estudiante', 'tutor'])(
    'liquida 3.7 una vez con %s primero y mantiene IDs al repetir ambas claves',
    async (firstActor) => {
      await advance();
      const [first, second] =
        firstActor === 'estudiante' ? [student, tutor] : [tutor, student];
      await confirm(first).expect(200);
      const key = randomUUID();
      const completed = (
        await confirm(second, reservation.id_reserva, key).expect(200)
      ).body;
      expect(completed).toMatchObject({
        estado: 'Completada',
        creditos: '3.7',
      });
      expect(completed.confirmacion_solicitante_at).toBeTruthy();
      expect(completed.confirmacion_ofertante_at).toBeTruthy();
      expect(completed.completed_at).toBeTruthy();
      const original = await events();
      expect(original).toEqual([
        expect.objectContaining({ tipo: 'Retencion', cantidad: '3.7' }),
        expect.objectContaining({
          id_usuario: student.id,
          tipo: 'Consumo',
          cantidad: '-3.7',
          saldo_anterior: '10',
          saldo_posterior: '6.3',
          retenidos_anterior: '3.7',
          retenidos_posterior: '0',
        }),
        expect.objectContaining({
          id_usuario: tutor.id,
          tipo: 'Transferencia',
          cantidad: '3.7',
          saldo_anterior: '0',
          saldo_posterior: '3.7',
          retenidos_anterior: '0',
          retenidos_posterior: '0',
        }),
      ]);
      expect(await wallet(student)).toMatchObject({
        saldo: '6.3',
        creditos_retenidos: '0',
        disponibles: '6.3',
      });
      expect(await wallet(tutor)).toMatchObject({
        saldo: '3.7',
        creditos_retenidos: '0',
        disponibles: '3.7',
      });
      expect(
        (await confirm(second, reservation.id_reserva, key).expect(200)).body,
      ).toEqual(completed);
      expect((await confirm(second).expect(200)).body).toEqual(completed);
      await confirm(first).expect(200);
      expect(await events()).toEqual(original);
      await cancel().expect(409);
      await integrity();
    },
  );

  it('confirmacion anticipada, cuenta ajena y cuerpo inyectado no guardan marcas ni efectos idempotentes', async () => {
    const before = await saved();
    await confirm(student).expect(409);
    await confirm(other).expect(403);
    await post(student, `/reservations/${reservation.id_reserva}/confirm`, {
      id_usuario: tutor.id,
      creditos: '0.1',
    }).expect(400);
    expect(await saved()).toEqual(before);
    await advance();
    const afterClock = await saved();
    await confirm(other).expect(403);
    expect(await saved()).toEqual(afterClock);
  });

  it('consulta estado vigente de actor y contraparte antes de confirmar o cobrar', async () => {
    await advance();
    await confirm(student).expect(200);
    await persistence.transaction((state) => {
      state.users.get(student.id)!.estado = UserStatus.SUSPENDIDO;
    });
    const before = await saved();
    await confirm(student).expect(401);
    await confirm(tutor).expect(404);
    expect(await saved()).toEqual(before);
    await persistence.transaction((state) => {
      state.users.get(student.id)!.estado = UserStatus.ACTIVO;
    });
    await confirm(tutor).expect(200);
    await integrity();
  });

  it('liquida exclusivamente RESERVAS.creditos aunque el catalogo cambie despues de reservar', async () => {
    await persistence.transaction((state) => {
      state.offers.get(offer.id_oferta)!.costo_creditos = '9.9';
    });
    await advance();
    await confirm(tutor).expect(200);
    await confirm(student).expect(200);
    expect((await wallet(student)).saldo).toBe('6.3');
    expect((await wallet(tutor)).saldo).toBe('3.7');
    expect((await current()).creditos).toBe('3.7');
    expect((await events()).map((row) => row.cantidad)).toEqual([
      '3.7',
      '-3.7',
      '3.7',
    ]);
    await integrity();
  });

  it('conserva exactamente la otra retencion del estudiante al consumir solo esta reserva', async () => {
    const anotherOffer = await publish(other, 3, '4.2');
    const another = await reserve(student, other, anotherOffer);
    const otherEvents = await events(another.id_reserva);
    expect(await wallet(student)).toMatchObject({
      saldo: '10',
      creditos_retenidos: '7.9',
      disponibles: '2.1',
    });
    await advance();
    await confirm(student).expect(200);
    await confirm(tutor).expect(200);
    expect(await wallet(student)).toMatchObject({
      saldo: '6.3',
      creditos_retenidos: '4.2',
      disponibles: '2.1',
    });
    expect((await current(another.id_reserva)).estado).toBe('Confirmada');
    expect(await events(another.id_reserva)).toEqual(otherEvents);
    expect(
      (await events()).find((row) => row.tipo === 'Consumo'),
    ).toMatchObject({ retenidos_anterior: '7.9', retenidos_posterior: '4.2' });
    await integrity();
  });

  it('suma al saldo previo del tutor y preserva su propia retencion en otra clase', async () => {
    await fund(tutor, '12');
    const otherOffer = await publish(other, 3, '2.5');
    const heldByTutor = await reserve(tutor, other, otherOffer);
    const existingEvents = await events(heldByTutor.id_reserva);
    await advance();
    await confirm(tutor).expect(200);
    await confirm(student).expect(200);
    expect(await wallet(tutor)).toMatchObject({
      saldo: '15.7',
      creditos_retenidos: '2.5',
      disponibles: '13.2',
    });
    expect(
      (await events()).find((row) => row.tipo === 'Transferencia'),
    ).toMatchObject({
      saldo_anterior: '12',
      saldo_posterior: '15.7',
      retenidos_anterior: '2.5',
      retenidos_posterior: '2.5',
    });
    expect(await events(heldByTutor.id_reserva)).toEqual(existingEvents);
    expect((await current(heldByTutor.id_reserva)).estado).toBe('Confirmada');
    await integrity();
  });

  it('fallo despues de preparar la liquidacion revierte la segunda marca, pago y clave; el reintento conserva la primera', async () => {
    await advance();
    await confirm(student).expect(200);
    const before = await saved();
    const transaction = persistence.transaction.bind(persistence);
    const failure = jest
      .spyOn(persistence, 'transaction')
      .mockImplementationOnce((work) =>
        transaction(async (state) => {
          await work(state);
          throw new Error(
            'Fallo deliberado al finalizar el borrador financiero',
          );
        }),
      );
    const key = randomUUID();
    await confirm(tutor, reservation.id_reserva, key).expect(500);
    failure.mockRestore();
    expect(await saved()).toEqual(before);
    const completed = await confirm(tutor, reservation.id_reserva, key).expect(
      200,
    );
    expect(completed.body.estado).toBe('Completada');
    expect(await events()).toHaveLength(3);
    await confirm(tutor, reservation.id_reserva, key).expect(200);
    expect(await events()).toHaveLength(3);
    await integrity();
  });

  it('capacidad insuficiente del tutor revierte el segundo intento sin perder la primera confirmacion', async () => {
    await fund(tutor, MAX_CREDITS);
    await advance();
    await confirm(student).expect(200);
    const before = await saved();
    const response = await confirm(tutor).expect(409);
    expect(response.body.message).toContain('limite de creditos');
    expect(await saved()).toEqual(before);
    expect((await current()).confirmacion_ofertante_at).toBeNull();
    expect((await wallet(tutor)).saldo).toBe(MAX_CREDITS);
    expect(await events()).toHaveLength(1);
    await integrity();
  });

  it('otra retencion suficiente no reemplaza el movimiento de retencion propio de la reserva', async () => {
    const anotherOffer = await publish(other, 3, '4.2');
    await reserve(student, other, anotherOffer);
    await advance();
    await confirm(student).expect(200);
    await persistence.transaction((state) => {
      // Corrupcion deliberada del doble: el agregado 7.9 todavia supera 3.7,
      // pero la reserva que se intenta liquidar ya no acredita su retencion.
      for (const [id, movement] of state.movements) {
        if (movement.id_reserva === reservation.id_reserva)
          state.movements.delete(id);
      }
    });
    const before = await saved();
    await confirm(tutor).expect(409);
    expect(await saved()).toEqual(before);
    expect((await current()).confirmacion_solicitante_at).not.toBeNull();
    expect((await current()).confirmacion_ofertante_at).toBeNull();
    expect((await current()).estado).toBe('Confirmada');
    expect(await events()).toEqual([]);
  });

  it('confirma concurrentemente ambos participantes y conserva una sola pareja de pagos', async () => {
    await advance();
    const responses = await Promise.all([
      confirm(student),
      confirm(tutor),
      confirm(student),
      confirm(tutor),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 200,
    ]);
    expect((await current()).estado).toBe('Completada');
    const financial = await events();
    expect(financial.filter((row) => row.tipo === 'Consumo')).toHaveLength(1);
    expect(
      financial.filter((row) => row.tipo === 'Transferencia'),
    ).toHaveLength(1);
    expect(financial).toHaveLength(3);
    expect((await wallet(student)).saldo).toBe('6.3');
    expect((await wallet(tutor)).saldo).toBe('3.7');
    await integrity();
  });

  it.each(['confirmar', 'cancelar'])(
    'serializa segunda confirmacion contra cancelacion ADMIN, enviando primero %s',
    async (firstOperation) => {
      await advance();
      await confirm(student).expect(200);
      const responses = await Promise.all(
        firstOperation === 'confirmar'
          ? [confirm(tutor), cancel()]
          : [cancel(), confirm(tutor)],
      );
      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 409,
      ]);
      const final = await current();
      const financial = await events();
      expect((await wallet(student)).creditos_retenidos).toBe('0');
      if (final.estado === 'Completada') {
        expect(financial.map((row) => row.tipo)).toEqual([
          'Retencion',
          'Consumo',
          'Transferencia',
        ]);
        expect((await wallet(student)).saldo).toBe('6.3');
        expect((await wallet(tutor)).saldo).toBe('3.7');
      } else {
        expect(final.estado).toBe('Cancelada');
        expect(financial.map((row) => row.tipo)).toEqual([
          'Retencion',
          'Liberacion',
        ]);
        expect((await wallet(student)).saldo).toBe('10');
        expect((await wallet(tutor)).saldo).toBe('0');
      }
      await integrity();
    },
  );

  it('reutilizar una clave de confirmacion en otra reserva conserva el conflicto de contenido', async () => {
    const anotherOffer = await publish(other, 3);
    const another = await reserve(student, other, anotherOffer);
    await advance(Date.parse(anotherOffer.fecha_fin) + 1000);
    const key = randomUUID();
    await confirm(student, reservation.id_reserva, key).expect(200);
    const before = await saved();
    await confirm(student, another.id_reserva, key).expect(409);
    expect(await saved()).toEqual(before);
    expect(
      (await current(another.id_reserva)).confirmacion_solicitante_at,
    ).toBeNull();
    await integrity();
  });
});
