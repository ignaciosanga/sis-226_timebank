import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';
import {
  AVAILABILITY_REPOSITORY,
  AvailabilityRepository,
} from '../src/modules/availability/availability.repository';

interface AvailabilityResponse {
  id_disponibilidad: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
}

describe('Integridad de disponibilidad por HTTP con memoria y JWT reales', () => {
  let app: INestApplication;
  let repository: AvailabilityRepository;
  let token: string;
  const slot = {
    fechaInicio: '2030-01-07T09:00:00-04:00',
    fechaFin: '2030-01-07T10:00:00-04:00',
  };
  const client = () => request(app.getHttpServer());

  async function createSlot(input = slot): Promise<AvailabilityResponse> {
    const response = await client()
      .post('/availability')
      .auth(token, { type: 'bearer' })
      .send(input)
      .expect(201);
    return response.body as AvailabilityResponse;
  }

  async function listSlots(): Promise<AvailabilityResponse[]> {
    const response = await client()
      .get('/availability/me')
      .auth(token, { type: 'bearer' })
      .expect(200);
    return response.body as AvailabilityResponse[];
  }

  function synchronizeReads(ids: string[]): void {
    const original = repository.findById.bind(repository);
    let arrived = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Se conserva la lectura real. La barrera reproduce dos peticiones que
    // leen el mismo estado antes de que cualquiera alcance su escritura.
    jest.spyOn(repository, 'findById').mockImplementation(async (id) => {
      const record = await original(id);
      if (ids.includes(id) && arrived < 2) {
        arrived += 1;
        if (arrived === 2) release();
        await bothRead;
      }
      return record;
    });
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    repository = app.get<AvailabilityRepository>(AVAILABILITY_REPOSITORY);

    const correo = `integridad-${randomUUID()}@example.test`;
    const password = randomBytes(24).toString('base64url');
    await client()
      .post('/auth/register')
      .send({
        nombre: 'Ana',
        apellido: 'Integridad',
        correo,
        password,
        idCarrera: '30000000-0000-4000-8000-000000000001',
        semestre: 3,
      })
      .expect(201);
    const login = await client()
      .post('/auth/login')
      .send({ correo, password })
      .expect(200);
    token = login.body.access_token as string;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it('conserva ambos campos de dos PATCH parciales concurrentes sobre el mismo horario', async () => {
    const created = await createSlot();
    synchronizeReads([created.id_disponibilidad]);

    const responses = await Promise.all([
      client()
        .patch(`/availability/${created.id_disponibilidad}`)
        .auth(token, { type: 'bearer' })
        .send({ fechaInicio: '2030-01-07T09:30:00-04:00' }),
      client()
        .patch(`/availability/${created.id_disponibilidad}`)
        .auth(token, { type: 'bearer' })
        .send({ fechaFin: '2030-01-07T11:00:00-04:00' }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await listSlots()).toEqual([
      {
        ...created,
        fecha_inicio: '2030-01-07T13:30:00.000Z',
        fecha_fin: '2030-01-07T15:00:00.000Z',
      },
    ]);
  });

  it('acepta solo uno de dos PATCH que producirian un solapamiento entre horarios distintos', async () => {
    const first = await createSlot();
    const second = await createSlot({
      fechaInicio: '2030-01-07T11:00:00-04:00',
      fechaFin: '2030-01-07T12:00:00-04:00',
    });
    synchronizeReads([first.id_disponibilidad, second.id_disponibilidad]);

    const responses = await Promise.all([
      client()
        .patch(`/availability/${first.id_disponibilidad}`)
        .auth(token, { type: 'bearer' })
        .send({ fechaFin: '2030-01-07T10:45:00-04:00' }),
      client()
        .patch(`/availability/${second.id_disponibilidad}`)
        .auth(token, { type: 'bearer' })
        .send({ fechaInicio: '2030-01-07T10:15:00-04:00' }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const records = await listSlots();
    expect(records).toHaveLength(2);
    expect(new Date(records[0]!.fecha_fin).getTime()).toBeLessThanOrEqual(
      new Date(records[1]!.fecha_inicio).getTime(),
    );
    const rejected = responses[0].status === 409 ? first : second;
    expect(
      records.find(
        (record) => record.id_disponibilidad === rejected.id_disponibilidad,
      ),
    ).toEqual(rejected);
  });

  it('crea un solo horario ante dos POST simultaneos del mismo usuario e intervalo', async () => {
    const responses = await Promise.all([
      client().post('/availability').auth(token, { type: 'bearer' }).send(slot),
      client().post('/availability').auth(token, { type: 'bearer' }).send(slot),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await listSlots()).toEqual([
      responses.find((response) => response.status === 201)?.body,
    ]);
  });

  it('un PATCH concurrente con DELETE nunca reactiva el horario desactivado', async () => {
    const created = await createSlot();
    synchronizeReads([created.id_disponibilidad]);

    const [updated, removed] = await Promise.all([
      client()
        .patch(`/availability/${created.id_disponibilidad}`)
        .auth(token, { type: 'bearer' })
        .send({ fechaFin: '2030-01-07T11:00:00-04:00' }),
      client()
        .delete(`/availability/${created.id_disponibilidad}`)
        .auth(token, { type: 'bearer' }),
    ]);

    expect([200, 409]).toContain(updated.status);
    expect(removed.status).toBe(204);
    expect(await listSlots()).toEqual([]);
    await client()
      .patch(`/availability/${created.id_disponibilidad}`)
      .auth(token, { type: 'bearer' })
      .send({ fechaFin: '2030-01-07T12:00:00-04:00' })
      .expect(409);
    await client()
      .delete(`/availability/${created.id_disponibilidad}`)
      .auth(token, { type: 'bearer' })
      .expect(204);
    expect(await listSlots()).toEqual([]);
  });

  it.each([
    { fechaFin: '2030-01-07T08:30:00-04:00' },
    { fechaInicio: null },
    { fechaInicio: 'fecha-invalida' },
  ])(
    'un PATCH invalido conserva el estado y permite continuar: %j',
    async (input) => {
      const created = await createSlot();
      await client()
        .patch(`/availability/${created.id_disponibilidad}`)
        .auth(token, { type: 'bearer' })
        .send(input)
        .expect(400);
      expect(await listSlots()).toEqual([created]);

      await client()
        .patch(`/availability/${created.id_disponibilidad}`)
        .auth(token, { type: 'bearer' })
        .send({ fechaFin: '2030-01-07T10:30:00-04:00' })
        .expect(200);
      expect(await listSlots()).toEqual([
        { ...created, fecha_fin: '2030-01-07T14:30:00.000Z' },
      ]);
    },
  );

  it('un PATCH rechazado por conflicto no modifica el horario y permite otro cambio valido', async () => {
    const created = await createSlot();
    const adjacent = await createSlot({
      fechaInicio: '2030-01-07T10:00:00-04:00',
      fechaFin: '2030-01-07T11:00:00-04:00',
    });
    await client()
      .patch(`/availability/${created.id_disponibilidad}`)
      .auth(token, { type: 'bearer' })
      .send({ fechaFin: '2030-01-07T10:30:00-04:00' })
      .expect(409);
    expect(await listSlots()).toEqual([created, adjacent]);

    await client()
      .patch(`/availability/${created.id_disponibilidad}`)
      .auth(token, { type: 'bearer' })
      .send({ fechaInicio: '2030-01-07T09:30:00-04:00' })
      .expect(200);
    expect(await listSlots()).toEqual([
      { ...created, fecha_inicio: '2030-01-07T13:30:00.000Z' },
      adjacent,
    ]);
  });
});
