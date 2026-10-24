import {
  CallHandler,
  ExecutionContext,
  INestApplication,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import { mergeMap, throwError } from 'rxjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../src/modules/exchanges/exchange.repository';
import { MemoryUsersRepository } from '../src/modules/users/memory-users.repository';
import { USERS_REPOSITORY } from '../src/modules/users/users.repository';

interface Actor {
  id: string;
  correo: string;
  password: string;
  token: string;
}

interface ExchangeResponse {
  id_solicitud: string;
  estado: string;
  fecha_inicio_propuesta: string;
  fecha_fin_propuesta: string;
  creditos_requeridos: number;
  created_at: string;
  respondida_at: string | null;
}

interface ReservationResponse {
  id_reserva: string;
  id_solicitud: string;
  estado: string;
  creditos: number;
  confirmacion_solicitante_at: string | null;
  confirmacion_ofertante_at: string | null;
  cancelado_por: string | null;
  motivo_cancelacion: string | null;
  horas_anticipacion_cancelacion: number | null;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
}

interface WalletResponse {
  saldo: string;
  creditos_retenidos: string;
  disponibles: string;
}

interface MovementResponse {
  tipo: string;
  id_usuario: string;
  id_reserva: string | null;
  cantidad: number;
  saldo_anterior: number;
  saldo_posterior: number;
  retenidos_anterior: number;
  retenidos_posterior: number;
  created_at: string;
}

describe('Reservas y creditos atomicos por HTTP con memoria y JWT reales', () => {
  let app: INestApplication;
  let admin: Actor;
  let requester: Actor;
  let provider: Actor;
  let other: Actor;
  let availabilityId: string;
  let fechaInicio: string;
  let fechaFin: string;
  let failResponseForKey: string | undefined;
  const skillId = '20000000-0000-4000-8000-000000000002';
  const client = () => request(app.getHttpServer());

  function post(
    actor: Actor,
    path: string,
    body: object = {},
    key: string = randomUUID(),
  ) {
    return client()
      .post(path)
      .auth(actor.token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);
  }

  async function login(actor: Actor): Promise<void> {
    const response = await client()
      .post('/auth/login')
      .send({ correo: actor.correo, password: actor.password })
      .expect(200);
    actor.token = response.body.access_token as string;
  }

  async function register(isAdmin = false): Promise<Actor> {
    const correo = `intercambio-${randomUUID()}@example.test`;
    const password = randomBytes(24).toString('base64url');
    const response = await client()
      .post('/auth/register')
      .send({
        nombre: 'Ana',
        apellido: 'Intercambios',
        correo,
        password,
        idCarrera: '30000000-0000-4000-8000-000000000001',
        semestre: 3,
      })
      .expect(201);
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
    return actor;
  }

  async function publish(actor: Actor): Promise<string> {
    await client()
      .post('/users/me/skills')
      .auth(actor.token, { type: 'bearer' })
      .send({ skillId, nivel: 'Intermedio' })
      .expect(201);
    const response = await client()
      .post('/availability')
      .auth(actor.token, { type: 'bearer' })
      .send({ fechaInicio, fechaFin })
      .expect(201);
    return response.body.id_disponibilidad as string;
  }

  function requestBody(target = provider, targetAvailability = availabilityId) {
    return {
      providerId: target.id,
      skillId,
      availabilityId: targetAvailability,
      fechaInicio,
      fechaFin,
      descripcion: 'Ayuda con Python durante una hora',
    };
  }

  async function createExchange(
    source = requester,
    target = provider,
    targetAvailability = availabilityId,
  ): Promise<ExchangeResponse> {
    const response = await post(
      source,
      '/exchanges',
      requestBody(target, targetAvailability),
    ).expect(201);
    return response.body as ExchangeResponse;
  }

  async function acceptExchange(
    exchange: ExchangeResponse,
    actor = provider,
  ): Promise<ReservationResponse> {
    const response = await post(
      actor,
      `/exchanges/${exchange.id_solicitud}/accept`,
    ).expect(200);
    return response.body as ReservationResponse;
  }

  async function wallet(actor: Actor): Promise<WalletResponse> {
    const response = await client()
      .get('/credits/me')
      .auth(actor.token, { type: 'bearer' })
      .expect(200);
    return response.body as WalletResponse;
  }

  async function movements(actor: Actor): Promise<MovementResponse[]> {
    const response = await client()
      .get('/credits/me/movements')
      .auth(actor.token, { type: 'bearer' })
      .expect(200);
    return response.body as MovementResponse[];
  }

  async function reservations(actor: Actor): Promise<ReservationResponse[]> {
    const response = await client()
      .get('/reservations/me')
      .auth(actor.token, { type: 'bearer' })
      .expect(200);
    return response.body as ReservationResponse[];
  }

  async function requests(actor: Actor): Promise<ExchangeResponse[]> {
    const response = await client()
      .get('/exchanges/me')
      .auth(actor.token, { type: 'bearer' })
      .expect(200);
    return response.body as ExchangeResponse[];
  }

  async function fund(actor: Actor, amount = '8'): Promise<void> {
    await post(admin, '/credits/grants', {
      userId: actor.id,
      amount,
      reason: 'Credito de desarrollo para prueba HTTP',
    }).expect(201);
  }

  async function advanceClock(at: number): Promise<void> {
    jest.spyOn(Date, 'now').mockReturnValue(at);
    // Los JWT previos expiraron al avanzar horas. Se autentica nuevamente
    // para que las comprobaciones temporales pasen por los guards reales.
    for (const actor of [admin, requester, provider, other]) await login(actor);
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    failResponseForKey = undefined;
    app.useGlobalInterceptors({
      intercept(context: ExecutionContext, next: CallHandler) {
        const httpRequest = context.switchToHttp().getRequest<{
          headers: Record<string, string | undefined>;
        }>();
        if (
          !failResponseForKey ||
          httpRequest.headers['idempotency-key'] !== failResponseForKey
        )
          return next.handle();
        // El handler real ya resolvio y confirmo su transaccion cuando emite.
        // Se pierde solo la respuesta, reproduciendo un fallo posterior al commit.
        return next.handle().pipe(
          mergeMap(() => {
            failResponseForKey = undefined;
            return throwError(
              () =>
                new InternalServerErrorException(
                  'Respuesta perdida tras commit',
                ),
            );
          }),
        );
      },
    });
    await app.init();
    admin = await register(true);
    requester = await register();
    provider = await register();
    other = await register();

    const start = Math.ceil((Date.now() + 3_600_000) / 60_000) * 60_000;
    fechaInicio = new Date(start).toISOString();
    fechaFin = new Date(start + 3_600_000).toISOString();
    availabilityId = await publish(provider);
    await fund(requester);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it('parte de cero y distingue saldo total, retencion y credito disponible', async () => {
    expect(await wallet(provider)).toMatchObject({
      saldo: '0',
      creditos_retenidos: '0',
      disponibles: '0',
    });
    expect(await wallet(requester)).toMatchObject({
      saldo: '8',
      creditos_retenidos: '0',
      disponibles: '8',
    });
    await client().get('/credits/me').expect(401);
    await client().get('/reservations/me').expect(401);
  });

  it('persiste solicitudes, reservas y saldos en el modelo de 12 tablas con creditos enteros', async () => {
    const exchange = await createExchange();
    expect(exchange).toMatchObject({
      fecha_inicio_propuesta: fechaInicio,
      fecha_fin_propuesta: fechaFin,
      creditos_requeridos: 4,
      estado: 'Solicitada',
      respondida_at: null,
    });
    expect(Number.isNaN(Date.parse(exchange.created_at))).toBe(false);
    const reservation = await acceptExchange(exchange);
    expect(reservation).toMatchObject({
      creditos: 4,
      estado: 'Confirmada',
      confirmacion_solicitante_at: null,
      confirmacion_ofertante_at: null,
      cancelado_por: null,
      motivo_cancelacion: null,
      horas_anticipacion_cancelacion: null,
      completed_at: null,
      cancelled_at: null,
    });
    const repository = app.get<ExchangeRepository>(EXCHANGE_REPOSITORY);
    const stored = await repository.read((state) => ({
      owner: state.users.get(requester.id),
      keys: Object.keys(state),
    }));
    expect(stored.owner).toMatchObject({
      id_usuario: requester.id,
      rol: 'Estudiante',
      saldo: 8,
      creditos_retenidos: 4,
    });
    for (const removed of [
      'accounts',
      'transfers',
      'confirmations',
      'cancellations',
    ]) {
      expect(stored.keys).not.toContain(removed);
    }
    const held = (await movements(requester)).find(
      (entry) => entry.tipo === 'Retencion',
    );
    expect(held).toMatchObject({
      id_usuario: requester.id,
      id_reserva: reservation.id_reserva,
      cantidad: 4,
      saldo_anterior: 8,
      saldo_posterior: 8,
      retenidos_anterior: 0,
      retenidos_posterior: 4,
    });
    expect(held).not.toHaveProperty('id_cuenta');
    expect(await wallet(requester)).not.toHaveProperty('id_cuenta');
  });

  it('cobra un credito entero por una sesion de quince minutos', async () => {
    const response = await post(requester, '/exchanges', {
      ...requestBody(),
      fechaFin: new Date(Date.parse(fechaInicio) + 900_000).toISOString(),
    }).expect(201);
    expect(response.body.creditos_requeridos).toBe(1);
    const reservation = await acceptExchange(response.body as ExchangeResponse);
    expect(reservation.creditos).toBe(1);
    expect(await wallet(requester)).toMatchObject({
      saldo: '8',
      creditos_retenidos: '1',
      disponibles: '7',
    });
  });

  it.each(['0', '-1', '1.00', '1.5', '1e2', '2147483648'])(
    'rechaza cargas incompatibles con creditos int de PostgreSQL: %s',
    async (amount) => {
      await post(admin, '/credits/grants', {
        userId: requester.id,
        amount,
        reason: 'Validacion de enteros de la base de datos',
      }).expect(400);
      expect((await wallet(requester)).saldo).toBe('8');
      expect(await movements(requester)).toHaveLength(1);
    },
  );

  it('exige clave idempotente y reintenta una solicitud sin duplicar ni aceptar otro payload', async () => {
    await client()
      .post('/exchanges')
      .auth(requester.token, { type: 'bearer' })
      .send(requestBody())
      .expect(400);
    await post(requester, '/exchanges', requestBody(), 'corta').expect(400);

    const key = randomUUID();
    const first = await post(
      requester,
      '/exchanges',
      requestBody(),
      key,
    ).expect(201);
    const replay = await post(
      requester,
      '/exchanges',
      requestBody(),
      key,
    ).expect(201);
    expect(replay.body).toEqual(first.body);
    await post(
      requester,
      '/exchanges',
      { ...requestBody(), descripcion: 'Un contenido diferente' },
      key,
    ).expect(409);
    expect(await requests(requester)).toHaveLength(1);
    expect(await requests(provider)).toHaveLength(1);
    expect(await reservations(requester)).toEqual([]);
    expect((await wallet(requester)).creditos_retenidos).toBe('0');
  });

  it('dos aceptaciones simultaneas crean una sola reserva y una sola retencion', async () => {
    const exchange = await createExchange();
    const path = `/exchanges/${exchange.id_solicitud}/accept`;
    const responses = await Promise.all([
      post(provider, path),
      post(provider, path),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses[0]!.body.id_reserva).toBe(responses[1]!.body.id_reserva);
    expect(responses[0]!.body.creditos).toBe(4);
    expect(await reservations(requester)).toHaveLength(1);
    expect(await wallet(requester)).toMatchObject({
      saldo: '8',
      creditos_retenidos: '4',
      disponibles: '4',
    });
    expect(
      (await movements(requester)).filter((m) => m.tipo === 'Retencion'),
    ).toHaveLength(1);
  });

  it('impide dos reservas simultaneas del mismo ofertante con distintos solicitantes', async () => {
    await fund(other);
    const first = await createExchange();
    const second = await createExchange(other);
    const responses = await Promise.all([
      post(provider, `/exchanges/${first.id_solicitud}/accept`),
      post(provider, `/exchanges/${second.id_solicitud}/accept`),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(await reservations(provider)).toHaveLength(1);
    const winner = responses[0]!.status === 200 ? requester : other;
    const loser = winner === requester ? other : requester;
    expect((await wallet(winner)).creditos_retenidos).toBe('4');
    expect((await wallet(loser)).creditos_retenidos).toBe('0');
    expect(await reservations(loser)).toEqual([]);
    expect((await requests(loser))[0]!.estado).toBe('Solicitada');
  });

  it('impide dos reservas simultaneas de un solicitante aunque cambie el ofertante', async () => {
    const otherAvailability = await publish(other);
    const first = await createExchange();
    const second = await createExchange(requester, other, otherAvailability);
    const responses = await Promise.all([
      post(provider, `/exchanges/${first.id_solicitud}/accept`),
      post(other, `/exchanges/${second.id_solicitud}/accept`),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(await reservations(requester)).toHaveLength(1);
    expect((await wallet(requester)).creditos_retenidos).toBe('4');
    expect(
      (await movements(requester)).filter((m) => m.tipo === 'Retencion'),
    ).toHaveLength(1);
  });

  it('detecta el conflicto cuando un participante intercambia sus roles entre reservas', async () => {
    await fund(provider);
    const otherAvailability = await publish(other);
    const first = await createExchange();
    const second = await createExchange(provider, other, otherAvailability);
    const responses = await Promise.all([
      post(provider, `/exchanges/${first.id_solicitud}/accept`),
      post(other, `/exchanges/${second.id_solicitud}/accept`),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(await reservations(provider)).toHaveLength(1);
  });

  it('rechaza fondos insuficientes sin escribir y permite reintentar con la misma clave tras cargar credito', async () => {
    const exchange = await createExchange(other);
    const path = `/exchanges/${exchange.id_solicitud}/accept`;
    const key = randomUUID();
    await post(provider, path, {}, key).expect(409);
    expect(await reservations(provider)).toEqual([]);
    expect(await reservations(other)).toEqual([]);
    expect((await requests(other))[0]!.estado).toBe('Solicitada');
    expect(await movements(other)).toEqual([]);
    expect(await wallet(other)).toMatchObject({
      saldo: '0',
      creditos_retenidos: '0',
      disponibles: '0',
    });
    await fund(other, '4');
    await post(provider, path, {}, key).expect(200);
    expect(await reservations(other)).toHaveLength(1);
    expect((await wallet(other)).creditos_retenidos).toBe('4');
  });

  it('descarta todas las escrituras si ocurre un error despues de preparar una aceptacion', async () => {
    const exchange = await createExchange();
    const repository = app.get<ExchangeRepository>(EXCHANGE_REPOSITORY);
    const transaction = repository.transaction.bind(repository);
    jest.spyOn(repository, 'transaction').mockImplementationOnce((work) =>
      transaction(async (state) => {
        await work(state);
        throw new Error(
          'Fallo inducido despues de las escrituras del borrador',
        );
      }),
    );
    const path = `/exchanges/${exchange.id_solicitud}/accept`;
    const key = randomUUID();
    await post(provider, path, {}, key).expect(500);
    expect(await reservations(requester)).toEqual([]);
    expect((await requests(requester))[0]!.estado).toBe('Solicitada');
    expect(await wallet(requester)).toMatchObject({
      saldo: '8',
      creditos_retenidos: '0',
      disponibles: '8',
    });
    expect(
      (await movements(requester)).filter((m) => m.tipo === 'Retencion'),
    ).toEqual([]);
    await post(provider, path, {}, key).expect(200);
    expect(await reservations(requester)).toHaveLength(1);
  });

  it('cancelar y reintentar libera una sola vez y no cobra ni transfiere credito', async () => {
    const reservation = await acceptExchange(await createExchange());
    const path = `/reservations/${reservation.id_reserva}/cancel`;
    const key = randomUUID();
    const body = { motivo: 'Cambio de horario antes del inicio' };
    const canceled = await post(requester, path, body, key).expect(200);
    expect(canceled.body.estado).toBe('Cancelada');
    const retry = await post(requester, path, body, key).expect(200);
    expect(retry.body).toEqual(canceled.body);
    await post(requester, path, body).expect(200);
    expect(await wallet(requester)).toMatchObject({
      saldo: '8',
      creditos_retenidos: '0',
      disponibles: '8',
    });
    expect((await wallet(provider)).saldo).toBe('0');
    const entries = await movements(requester);
    expect(entries.filter((m) => m.tipo === 'Liberacion')).toHaveLength(1);
    expect(entries.filter((m) => m.tipo === 'Consumo')).toEqual([]);
  });

  it('dos confirmaciones de participantes y sus reintentos completan y transfieren una sola vez', async () => {
    const reservation = await acceptExchange(await createExchange());
    const path = `/reservations/${reservation.id_reserva}/confirm`;
    await post(requester, path).expect(409);
    expect((await wallet(requester)).creditos_retenidos).toBe('4');
    await advanceClock(Date.parse(fechaFin) + 1_000);

    const responses = await Promise.all([
      post(requester, path),
      post(provider, path),
      post(provider, path),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
    await post(requester, path).expect(200);
    await post(provider, path).expect(200);
    expect((await reservations(requester))[0]!.estado).toBe('Completada');
    expect(await wallet(requester)).toMatchObject({
      saldo: '4',
      creditos_retenidos: '0',
      disponibles: '4',
    });
    expect(await wallet(provider)).toMatchObject({
      saldo: '4',
      creditos_retenidos: '0',
      disponibles: '4',
    });
    expect(
      (await movements(requester)).filter((m) => m.tipo === 'Consumo'),
    ).toHaveLength(1);
    expect(
      (await movements(provider)).filter((m) => m.tipo === 'Transferencia'),
    ).toHaveLength(1);
    const completed = (await reservations(requester))[0]!;
    expect(completed.confirmacion_solicitante_at).not.toBeNull();
    expect(completed.confirmacion_ofertante_at).not.toBeNull();
    expect(completed.completed_at).not.toBeNull();
    expect(completed.cancelled_at).toBeNull();
    expect(
      (await movements(requester)).find((m) => m.tipo === 'Consumo'),
    ).toMatchObject({
      cantidad: -4,
      saldo_anterior: 8,
      saldo_posterior: 4,
      retenidos_anterior: 4,
      retenidos_posterior: 0,
    });
    expect(
      (await movements(provider)).find((m) => m.tipo === 'Transferencia'),
    ).toMatchObject({
      cantidad: 4,
      saldo_anterior: 0,
      saldo_posterior: 4,
      retenidos_anterior: 0,
      retenidos_posterior: 0,
    });
    await post(admin, `/reservations/${reservation.id_reserva}/cancel`, {
      motivo: 'Una reserva completada no se cancela',
    }).expect(409);
  });

  it('un fallo al completar conserva la retencion y descarta debito, abono y confirmacion final', async () => {
    const reservation = await acceptExchange(await createExchange());
    const path = `/reservations/${reservation.id_reserva}/confirm`;
    await advanceClock(Date.parse(fechaFin) + 1_000);
    await post(requester, path).expect(200);

    const repository = app.get<ExchangeRepository>(EXCHANGE_REPOSITORY);
    const transaction = repository.transaction.bind(repository);
    jest.spyOn(repository, 'transaction').mockImplementationOnce((work) =>
      transaction(async (state) => {
        await work(state);
        throw new Error(
          'Fallo inducido tras preparar la transferencia completa',
        );
      }),
    );
    const key = randomUUID();
    await post(provider, path, {}, key).expect(500);
    expect((await reservations(requester))[0]!.estado).toBe('Confirmada');
    expect(await wallet(requester)).toMatchObject({
      saldo: '8',
      creditos_retenidos: '4',
      disponibles: '4',
    });
    expect((await wallet(provider)).saldo).toBe('0');
    expect(
      (await movements(requester)).filter((m) => m.tipo === 'Consumo'),
    ).toEqual([]);
    expect(
      (await movements(provider)).filter((m) => m.tipo === 'Transferencia'),
    ).toEqual([]);

    const retry = await post(provider, path, {}, key).expect(200);
    expect(retry.body.estado).toBe('Completada');
    expect((await wallet(requester)).saldo).toBe('4');
    expect((await wallet(requester)).creditos_retenidos).toBe('0');
    expect((await wallet(provider)).saldo).toBe('4');
  });

  it('serializa cancelacion administrativa contra la ultima confirmacion sin liberar y cobrar a la vez', async () => {
    const reservation = await acceptExchange(await createExchange());
    const path = `/reservations/${reservation.id_reserva}`;
    await advanceClock(Date.parse(fechaFin) + 1_000);
    await post(requester, `${path}/confirm`).expect(200);
    const responses = await Promise.all([
      post(provider, `${path}/confirm`),
      post(admin, `${path}/cancel`, { motivo: 'Revision administrativa' }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);

    const final = (await reservations(requester))[0]!;
    const sourceWallet = await wallet(requester);
    const targetWallet = await wallet(provider);
    const sourceMovements = await movements(requester);
    const targetMovements = await movements(provider);
    expect(sourceWallet.creditos_retenidos).toBe('0');
    if (final.estado === 'Completada') {
      expect(sourceWallet.saldo).toBe('4');
      expect(targetWallet.saldo).toBe('4');
      expect(sourceMovements.filter((m) => m.tipo === 'Consumo')).toHaveLength(
        1,
      );
      expect(
        targetMovements.filter((m) => m.tipo === 'Transferencia'),
      ).toHaveLength(1);
      expect(sourceMovements.filter((m) => m.tipo === 'Liberacion')).toEqual(
        [],
      );
    } else {
      expect(final.estado).toBe('Cancelada');
      expect(sourceWallet.saldo).toBe('8');
      expect(targetWallet.saldo).toBe('0');
      expect(
        sourceMovements.filter((m) => m.tipo === 'Liberacion'),
      ).toHaveLength(1);
      expect(sourceMovements.filter((m) => m.tipo === 'Consumo')).toEqual([]);
      expect(targetMovements.filter((m) => m.tipo === 'Transferencia')).toEqual(
        [],
      );
    }
  });

  it('restringe aceptacion, lectura, confirmacion, cancelacion y cargas al actor autorizado', async () => {
    const exchange = await createExchange();
    const acceptance = `/exchanges/${exchange.id_solicitud}/accept`;
    await post(requester, acceptance).expect(403);
    await post(other, acceptance).expect(403);
    const reservation = await acceptExchange(exchange);
    const path = `/reservations/${reservation.id_reserva}`;
    await client().get(path).auth(other.token, { type: 'bearer' }).expect(403);
    await client()
      .get(path)
      .auth(requester.token, { type: 'bearer' })
      .expect(200);
    await post(other, `${path}/confirm`).expect(403);
    await post(other, `${path}/cancel`, {
      motivo: 'No soy participante',
    }).expect(403);
    await post(requester, '/credits/grants', {
      userId: requester.id,
      amount: '40',
      reason: 'Carga no autorizada',
    }).expect(403);
    expect((await wallet(requester)).saldo).toBe('8');
    expect((await reservations(requester))[0]!.estado).toBe('Confirmada');
  });

  it('permite ampliar disponibilidad reservada y bloquea recortes, desplazamientos o desactivacion incompatibles', async () => {
    await acceptExchange(await createExchange());
    const path = `/availability/${availabilityId}`;
    const expandedEnd = new Date(
      Date.parse(fechaFin) + 3_600_000,
    ).toISOString();
    await client()
      .patch(path)
      .auth(provider.token, { type: 'bearer' })
      .send({ fechaFin: expandedEnd })
      .expect(200);
    await client()
      .patch(path)
      .auth(provider.token, { type: 'bearer' })
      .send({
        fechaFin: new Date(Date.parse(fechaFin) - 900_000).toISOString(),
      })
      .expect(409);
    await client()
      .patch(path)
      .auth(provider.token, { type: 'bearer' })
      .send({
        fechaInicio: new Date(Date.parse(fechaInicio) + 900_000).toISOString(),
      })
      .expect(409);
    await client()
      .delete(path)
      .auth(provider.token, { type: 'bearer' })
      .expect(409);
    const response = await client()
      .get('/availability/me')
      .auth(provider.token, { type: 'bearer' })
      .expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].fecha_inicio).toBe(fechaInicio);
    expect(response.body[0].fecha_fin).toBe(expandedEnd);
    expect((await wallet(requester)).creditos_retenidos).toBe('4');
  });

  it('rechaza o cancela solicitudes pendientes sin reservar ni retener creditos', async () => {
    const rejected = await createExchange();
    const rejectedPath = `/exchanges/${rejected.id_solicitud}`;
    await post(other, `${rejectedPath}/reject`).expect(403);
    await post(provider, `${rejectedPath}/reject`).expect(200);
    await post(provider, `${rejectedPath}/accept`).expect(409);
    const canceled = await createExchange();
    const canceledPath = `/exchanges/${canceled.id_solicitud}`;
    await post(provider, `${canceledPath}/cancel`).expect(403);
    await post(requester, `${canceledPath}/cancel`).expect(200);
    await post(provider, `${canceledPath}/accept`).expect(409);
    expect(
      (await requests(requester)).map((exchange) => exchange.estado).sort(),
    ).toEqual(['Cancelada', 'Rechazada']);
    expect(await reservations(requester)).toEqual([]);
    expect((await wallet(requester)).creditos_retenidos).toBe('0');
  });

  it('solo ADMIN puede cancelar una reserva iniciada y recupera la retencion completa', async () => {
    const reservation = await acceptExchange(await createExchange());
    await advanceClock(Date.parse(fechaInicio) + 1_000);
    const path = `/reservations/${reservation.id_reserva}/cancel`;
    const body = { motivo: 'Cancelacion documentada por administracion' };
    await post(requester, path, body).expect(409);
    await post(provider, path, body).expect(409);
    await post(admin, path, body).expect(200);
    expect((await reservations(requester))[0]!.estado).toBe('Cancelada');
    expect(await wallet(requester)).toMatchObject({
      saldo: '8',
      creditos_retenidos: '0',
      disponibles: '8',
    });
    expect((await wallet(provider)).saldo).toBe('0');
  });

  it('una carga administrativa repetida conserva un solo abono y rechaza otra cantidad con su clave', async () => {
    const key = randomUUID();
    const body = {
      userId: requester.id,
      amount: '4',
      reason: 'Carga unica',
    };
    const responses = await Promise.all([
      post(admin, '/credits/grants', body, key),
      post(admin, '/credits/grants', body, key),
    ]);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(responses[0]!.body).toEqual(responses[1]!.body);
    await post(admin, '/credits/grants', { ...body, amount: '8' }, key).expect(
      409,
    );
    expect(await wallet(requester)).toMatchObject({
      saldo: '12',
      creditos_retenidos: '0',
      disponibles: '12',
    });
    expect(
      (await movements(requester)).filter((m) => m.tipo === 'Ajuste'),
    ).toHaveLength(2);
  });

  it('rechaza campos arbitrarios en acciones y evita que el cliente suplante participantes o montos', async () => {
    await post(requester, '/exchanges', {
      ...requestBody(),
      id_solicitante: other.id,
    }).expect(400);
    const exchange = await createExchange();
    const requestPath = `/exchanges/${exchange.id_solicitud}`;
    const injected = { id_usuario: other.id, creditos: '0' };
    await post(provider, `${requestPath}/accept`, injected).expect(400);
    await post(provider, `${requestPath}/reject`, injected).expect(400);
    await post(requester, `${requestPath}/cancel`, injected).expect(400);
    expect((await requests(requester))[0]!.estado).toBe('Solicitada');
    expect(await reservations(requester)).toEqual([]);

    const reservation = await acceptExchange(exchange);
    const reservationPath = `/reservations/${reservation.id_reserva}`;
    await post(requester, `${reservationPath}/confirm`, injected).expect(400);
    await post(requester, `${reservationPath}/cancel`, {
      ...injected,
      motivo: 'Intento de inyectar campos internos',
      administrativa: true,
    }).expect(400);
    await post(admin, '/credits/grants', {
      userId: requester.id,
      amount: '4',
      reason: 'Carga con campos arbitrarios',
      roles: ['ADMIN'],
    }).expect(400);
    expect((await reservations(requester))[0]!.estado).toBe('Confirmada');
    expect(await wallet(requester)).toMatchObject({
      saldo: '8',
      creditos_retenidos: '4',
      disponibles: '4',
    });
  });

  it('acepta acciones sin cuerpo y permite Idempotency-Key desde el navegador', async () => {
    const exchange = await createExchange();
    await client()
      .post(`/exchanges/${exchange.id_solicitud}/accept`)
      .auth(provider.token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    const preflight = await client()
      .options(`/exchanges/${exchange.id_solicitud}/accept`)
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization,Idempotency-Key')
      .expect(204);
    expect(
      preflight.headers['access-control-allow-headers']!.toLowerCase(),
    ).toContain('idempotency-key');
  });

  it('recupera una aceptacion confirmada cuya respuesta se perdio sin reservar ni retener otra vez', async () => {
    const exchange = await createExchange();
    const path = `/exchanges/${exchange.id_solicitud}/accept`;
    const key = randomUUID();
    failResponseForKey = key;
    await post(provider, path, {}, key).expect(500);

    const committed = await reservations(requester);
    expect(committed).toHaveLength(1);
    expect((await requests(requester))[0]!.estado).toBe('Aceptada');
    expect((await wallet(requester)).creditos_retenidos).toBe('4');
    const recovered = await post(provider, path, {}, key).expect(200);
    expect(recovered.body.id_reserva).toBe(committed[0]!.id_reserva);
    expect(await reservations(requester)).toHaveLength(1);
    expect(await wallet(requester)).toMatchObject({
      saldo: '8',
      creditos_retenidos: '4',
      disponibles: '4',
    });
    expect(
      (await movements(requester)).filter((m) => m.tipo === 'Retencion'),
    ).toHaveLength(1);
  });
});
