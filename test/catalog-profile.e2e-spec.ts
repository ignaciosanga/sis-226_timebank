import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Role } from '../src/common/enums/role.enum';
import { RecordStatus } from '../src/common/enums/record-status.enum';
import { configureApp } from '../src/config/configure-app';
import {
  CATEGORIES_REPOSITORY,
  CategoriesRepository,
} from '../src/modules/categories/categories.repository';
import {
  SKILLS_REPOSITORY,
  SkillsRepository,
} from '../src/modules/skills/skills.repository';
import { USERS_REPOSITORY } from '../src/modules/users/users.repository';
import { MemoryUsersRepository } from '../src/modules/users/memory-users.repository';

describe('Flujo v0.2 HTTP real con memoria, Argon2id y JWT', () => {
  let app: INestApplication;
  let users: MemoryUsersRepository;
  let student: { id: string; token: string };
  let other: { id: string; token: string };
  let admin: { id: string; token: string };
  const categoryId = '10000000-0000-4000-8000-000000000001';
  const skillId = '20000000-0000-4000-8000-000000000002';
  const password = randomBytes(24).toString('base64url');
  const registration = {
    nombre: 'Ana',
    apellido: 'Perez',
    password,
    idCarrera: '30000000-0000-4000-8000-000000000001',
    semestre: 3,
  };
  const slot = {
    fechaInicio: '2026-11-02T09:00:00-04:00',
    fechaFin: '2026-11-02T10:00:00-04:00',
  };

  const client = () => request(app.getHttpServer());
  async function register(correo: string, isAdmin = false) {
    const created = await client()
      .post('/auth/register')
      .send({ ...registration, correo })
      .expect(201);
    expect(created.body).not.toHaveProperty('passwordHash');
    expect(created.body.roles).toEqual([Role.ESTUDIANTE]);
    if (isAdmin) await users.grantDevelopmentAdmin(created.body.id);
    const login = await client()
      .post('/auth/login')
      .send({ correo, password })
      .expect(200);
    expect(login.body.token_type).toBe('Bearer');
    expect(login.text).not.toContain(password);
    return {
      id: created.body.id as string,
      token: login.body.access_token as string,
    };
  }
  async function createSlot(owner = student, input = slot) {
    const response = await client()
      .post('/availability')
      .auth(owner.token, { type: 'bearer' })
      .send(input)
      .expect(201);
    return response.body.id_disponibilidad as string;
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    users = app.get(USERS_REPOSITORY);
    student = await register('ana@example.test');
    other = await register('luis@example.test');
    admin = await register('admin@example.test', true);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('consulta categorias activas y detalles con paginacion', async () => {
    const response = await client()
      .get('/categories?limit=2&page=2')
      .expect(200);
    expect(response.body.meta).toEqual({
      page: 2,
      limit: 2,
      total: 4,
      totalPages: 2,
    });
    expect(response.body.data).toHaveLength(2);
    const detail = await client().get(`/categories/${categoryId}`).expect(200);
    expect(detail.body.nombre).toBe('Tecnología');
    await client().get(`/categories/${randomUUID()}`).expect(404);
  });
  it('expone carreras del modelo y el rol unico del usuario sin secretos ni saldos editables', async () => {
    const careers = await client().get('/careers').expect(200);
    expect(careers.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id_carrera: registration.idCarrera,
          estado: 'activo',
        }),
      ]),
    );
    const profile = await client()
      .get('/users/me')
      .auth(student.token, { type: 'bearer' })
      .expect(200);
    expect(profile.body).toMatchObject({
      rol: 'Estudiante',
      roles: [Role.ESTUDIANTE],
      idCarrera: registration.idCarrera,
    });
    expect(profile.body).not.toHaveProperty('password_hash');
    expect(profile.body).not.toHaveProperty('saldo');
    await client()
      .patch('/users/me')
      .auth(student.token, { type: 'bearer' })
      .send({ rol: 'Administrador' })
      .expect(400);
  });
  it.each([
    { idCarrera: undefined },
    { idCarrera: null },
    { idCarrera: 'carrera-arbitraria' },
    { semestre: 0 },
    { semestre: 13 },
    { semestre: 1.5 },
  ])(
    'rechaza carrera o semestre incompatibles con el modelo: %j',
    async (input) => {
      await client()
        .post('/auth/register')
        .send({
          ...registration,
          correo: `invalido-${randomUUID()}@example.test`,
          ...input,
        })
        .expect(400);
    },
  );
  it('rechaza una carrera inexistente al registrar o editar y conserva el perfil anterior', async () => {
    await client()
      .post('/auth/register')
      .send({
        ...registration,
        correo: `sin-carrera-${randomUUID()}@example.test`,
        idCarrera: randomUUID(),
      })
      .expect(404);
    await client()
      .patch('/users/me')
      .auth(student.token, { type: 'bearer' })
      .send({ idCarrera: randomUUID() })
      .expect(404);
    const profile = await client()
      .get('/users/me')
      .auth(student.token, { type: 'bearer' })
      .expect(200);
    expect(profile.body.idCarrera).toBe(registration.idCarrera);
  });
  it('ADMIN crea categorias y rechaza nombre duplicado normalizado', async () => {
    await client()
      .post('/categories')
      .auth(admin.token, { type: 'bearer' })
      .send({ nombre: 'Ciencias naturales' })
      .expect(201);
    await client()
      .post('/categories')
      .auth(admin.token, { type: 'bearer' })
      .send({ nombre: ' CIENCIAS   NATURALES ' })
      .expect(409);
  });
  it('ADMIN registra habilidades visibles desde el mismo catalogo compartido', async () => {
    const created = await client()
      .post('/skills')
      .auth(admin.token, { type: 'bearer' })
      .send({ nombre: 'TypeScript', categoryId })
      .expect(201);
    expect(created.body.id_categoria).toBe(categoryId);
    const found = await client()
      .get(`/skills/${created.body.id_habilidad}`)
      .expect(200);
    expect(found.body.nombre).toBe('TypeScript');
    await client()
      .post('/skills')
      .auth(admin.token, { type: 'bearer' })
      .send({ nombre: 'typescript', categoryId })
      .expect(409);
    await client()
      .post('/users/me/skills')
      .auth(student.token, { type: 'bearer' })
      .send({ skillId: created.body.id_habilidad, nivel: 'Basico' })
      .expect(201);
    await client()
      .delete(`/users/me/skills/${created.body.id_habilidad}`)
      .auth(student.token, { type: 'bearer' })
      .expect(204);
  });
  it.each(['/categories', '/skills'])(
    'deniega administracion sin rol en %s',
    async (path) => {
      await client()
        .post(path)
        .auth(student.token, { type: 'bearer' })
        .send({
          nombre: 'No permitido',
          ...(path === '/skills' ? { categoryId } : {}),
        })
        .expect(403);
    },
  );
  it('busca habilidades por nombre y categoria', async () => {
    const search = await client().get('/skills?search=pYtH').expect(200);
    expect(
      search.body.data.map((skill: { nombre: string }) => skill.nombre),
    ).toEqual(['Python']);
    const filtered = await client()
      .get('/skills?categoryId=10000000-0000-4000-8000-000000000002&search=ing')
      .expect(200);
    expect(filtered.body.meta.total).toBe(1);
    expect(filtered.body.data[0].nombre).toBe('Inglés');
  });
  it('rechaza categoria inexistente o inactiva al registrar habilidad', async () => {
    await client()
      .post('/skills')
      .auth(admin.token, { type: 'bearer' })
      .send({ nombre: 'No existe', categoryId: randomUUID() })
      .expect(404);
    const repository = app.get<CategoriesRepository>(CATEGORIES_REPOSITORY);
    jest.spyOn(repository, 'findById').mockResolvedValue({
      id_categoria: categoryId,
      nombre: 'Tecnología',
      estado: RecordStatus.INACTIVO,
    });
    await client()
      .post('/skills')
      .auth(admin.token, { type: 'bearer' })
      .send({ nombre: 'Inactiva', categoryId })
      .expect(404);
  });
  it.each([
    '/skills?categoryId=invalido',
    '/skills?page=0',
    '/skills?limit=101',
    '/skills?limit=2.5',
    '/skills?page=1e2',
    '/skills?search[]=Python',
    '/categories?limit=-1',
    '/categories?desconocido=true',
    '/skills/no-uuid',
  ])('valida UUID, filtros y paginacion: %s', async (path) => {
    await client().get(path).expect(400);
  });
  it('registra habilidad propia, rechaza duplicado y otro estudiante la consulta', async () => {
    const created = await client()
      .post('/users/me/skills')
      .auth(student.token, { type: 'bearer' })
      .send({ skillId, nivel: 'Intermedio' })
      .expect(201);
    expect(created.body.id_usuario).toBe(student.id);
    await client()
      .post('/users/me/skills')
      .auth(student.token, { type: 'bearer' })
      .send({ skillId, nivel: 'Avanzado' })
      .expect(409);
    const mine = await client()
      .get('/users/me/skills')
      .auth(student.token, { type: 'bearer' })
      .expect(200);
    expect(mine.body[0].habilidad.nombre).toBe('Python');
    const published = await client()
      .get(`/users/${student.id}/skills`)
      .auth(other.token, { type: 'bearer' })
      .expect(200);
    expect(published.body[0].id_habilidad).toBe(skillId);
    expect(published.text).not.toMatch(/password|correo|hash/);
  });
  it('rechaza habilidad inexistente, inactiva y nivel no permitido', async () => {
    await client()
      .post('/users/me/skills')
      .auth(student.token, { type: 'bearer' })
      .send({ skillId: randomUUID(), nivel: 'Basico' })
      .expect(404);
    await client()
      .post('/users/me/skills')
      .auth(student.token, { type: 'bearer' })
      .send({ skillId, nivel: 'PRINCIPIANTE' })
      .expect(400);
    const repository = app.get<SkillsRepository>(SKILLS_REPOSITORY);
    jest.spyOn(repository, 'findById').mockResolvedValue({
      id_habilidad: skillId,
      nombre: 'Python',
      id_categoria: categoryId,
      estado: RecordStatus.INACTIVO,
    });
    await client()
      .post('/users/me/skills')
      .auth(other.token, { type: 'bearer' })
      .send({ skillId, nivel: 'Basico' })
      .expect(404);
  });
  it('publica el nivel Experto definido por el modelo optimizado', async () => {
    const created = await client()
      .post('/users/me/skills')
      .auth(other.token, { type: 'bearer' })
      .send({ skillId, nivel: 'Experto' })
      .expect(201);
    expect(created.body.nivel).toBe('Experto');
    await client()
      .delete(`/users/me/skills/${skillId}`)
      .auth(other.token, { type: 'bearer' })
      .expect(204);
  });
  it('rechaza IDs arbitrarios y eliminacion ajena sin alterar al propietario', async () => {
    await client()
      .post('/users/me/skills')
      .auth(other.token, { type: 'bearer' })
      .send({ skillId, nivel: 'Basico', id_usuario: student.id })
      .expect(400);
    await client()
      .delete(`/users/${student.id}/skills/${skillId}`)
      .auth(other.token, { type: 'bearer' })
      .expect(404);
    await client()
      .delete(`/users/me/skills/${skillId}`)
      .auth(other.token, { type: 'bearer' })
      .expect(404);
    const mine = await client()
      .get('/users/me/skills')
      .auth(student.token, { type: 'bearer' })
      .expect(200);
    expect(mine.body).toHaveLength(1);
    await client()
      .delete(`/users/me/skills/${skillId}`)
      .auth(student.token, { type: 'bearer' })
      .expect(204);
  });
  it('crea, consulta, edita y desactiva disponibilidad propia', async () => {
    const id = await createSlot();
    const mine = await client()
      .get('/availability/me')
      .auth(student.token, { type: 'bearer' })
      .expect(200);
    expect(mine.body[0].fecha_inicio).toBe('2026-11-02T13:00:00.000Z');
    const published = await client()
      .get(`/users/${student.id}/availability`)
      .auth(other.token, { type: 'bearer' })
      .expect(200);
    expect(published.body[0].id_disponibilidad).toBe(id);
    await client()
      .patch(`/availability/${id}`)
      .auth(student.token, { type: 'bearer' })
      .send({ fechaFin: '2026-11-02T10:30:00-04:00' })
      .expect(200);
    await client()
      .delete(`/availability/${id}`)
      .auth(student.token, { type: 'bearer' })
      .expect(204);
    const empty = await client()
      .get(`/users/${student.id}/availability`)
      .auth(other.token, { type: 'bearer' })
      .expect(200);
    expect(empty.body).toEqual([]);
    await client()
      .patch(`/availability/${id}`)
      .auth(student.token, { type: 'bearer' })
      .send({ fechaFin: slot.fechaFin })
      .expect(409);
  });
  it('rechaza duplicados equivalentes en otra zona y superposiciones', async () => {
    const id = await createSlot();
    await client()
      .post('/availability')
      .auth(student.token, { type: 'bearer' })
      .send({
        fechaInicio: '2026-11-02T13:00:00Z',
        fechaFin: '2026-11-02T14:00:00Z',
      })
      .expect(409);
    await client()
      .post('/availability')
      .auth(student.token, { type: 'bearer' })
      .send({
        fechaInicio: '2026-11-02T09:30:00-04:00',
        fechaFin: '2026-11-02T11:00:00-04:00',
      })
      .expect(409);
    const second = await createSlot(student, {
      fechaInicio: '2026-11-02T10:00:00-04:00',
      fechaFin: '2026-11-02T11:00:00-04:00',
    });
    await client()
      .patch(`/availability/${id}`)
      .auth(student.token, { type: 'bearer' })
      .send({ fechaFin: '2026-11-02T10:15:00-04:00' })
      .expect(409);
    await client()
      .delete(`/availability/${id}`)
      .auth(student.token, { type: 'bearer' })
      .expect(204);
    await client()
      .delete(`/availability/${second}`)
      .auth(student.token, { type: 'bearer' })
      .expect(204);
  });
  it('impide modificar o desactivar disponibilidad ajena', async () => {
    const id = await createSlot();
    await client()
      .patch(`/availability/${id}`)
      .auth(other.token, { type: 'bearer' })
      .send({ fechaFin: slot.fechaFin })
      .expect(403);
    await client()
      .delete(`/availability/${id}`)
      .auth(other.token, { type: 'bearer' })
      .expect(403);
    await client()
      .post('/availability')
      .auth(other.token, { type: 'bearer' })
      .send({ ...slot, id_usuario: student.id })
      .expect(400);
    await client()
      .delete(`/availability/${id}`)
      .auth(student.token, { type: 'bearer' })
      .expect(204);
  });
  it.each([
    { fechaFin: '2026-11-02T08:00:00-04:00' },
    { fechaFin: slot.fechaInicio },
    { fechaInicio: '2026-11-02T09:00:00' },
    { fechaInicio: '2026-02-30T09:00:00Z' },
    { fechaInicio: '2026-11-02' },
    { fechaInicio: '2026-11-02T24:00:00Z' },
    { fechaInicio: '2026-11-02T09:00:00+15:00' },
    { fechaInicio: null },
  ])('rechaza fechas invalidas o sin zona: %j', async (input) => {
    await client()
      .post('/availability')
      .auth(student.token, { type: 'bearer' })
      .send({ ...slot, ...input })
      .expect(400);
  });
  it('valida PATCH vacio, null, UUID y existencia del registro', async () => {
    await client()
      .patch(`/availability/${randomUUID()}`)
      .auth(student.token, { type: 'bearer' })
      .send({})
      .expect(400);
    await client()
      .patch(`/availability/${randomUUID()}`)
      .auth(student.token, { type: 'bearer' })
      .send({ fechaFin: null })
      .expect(400);
    await client()
      .patch('/availability/invalid')
      .auth(student.token, { type: 'bearer' })
      .send({ fechaFin: slot.fechaFin })
      .expect(400);
    await client()
      .patch(`/availability/${randomUUID()}`)
      .auth(student.token, { type: 'bearer' })
      .send({ fechaFin: slot.fechaFin })
      .expect(404);
  });
  it.each([
    ['post', '/categories'],
    ['post', '/skills'],
    ['get', '/users/me/skills'],
    ['post', '/users/me/skills'],
    ['delete', `/users/me/skills/${skillId}`],
    ['post', '/availability'],
    ['get', '/availability/me'],
    ['patch', `/availability/${randomUUID()}`],
    ['delete', `/availability/${randomUUID()}`],
  ] as const)('exige JWT en %s %s', async (method, path) => {
    await client()[method](path).expect(401);
  });
  it('exige JWT para consultar datos publicados de otros estudiantes', async () => {
    await client().get(`/users/${student.id}/skills`).expect(401);
    await client().get(`/users/${student.id}/availability`).expect(401);
  });
  it('rechaza sujetos suspendidos con JWT vigente y oculta su publicacion', async () => {
    const original = users.findById.bind(users);
    jest.spyOn(users, 'findById').mockImplementation(async (id) => {
      const user = await original(id);
      return id === student.id && user ? { ...user, active: false } : user;
    });
    await client()
      .post('/users/me/skills')
      .auth(student.token, { type: 'bearer' })
      .send({ skillId, nivel: 'Basico' })
      .expect(401);
    await client()
      .post('/availability')
      .auth(student.token, { type: 'bearer' })
      .send(slot)
      .expect(401);
    await client()
      .get(`/users/${student.id}/skills`)
      .auth(other.token, { type: 'bearer' })
      .expect(404);
    await client()
      .get(`/users/${student.id}/availability`)
      .auth(other.token, { type: 'bearer' })
      .expect(404);
  });
  it('devuelve 404 por estudiantes inexistentes y valida identificadores', async () => {
    await client()
      .get(`/users/${randomUUID()}/skills`)
      .auth(other.token, { type: 'bearer' })
      .expect(404);
    await client()
      .get(`/users/${randomUUID()}/availability`)
      .auth(other.token, { type: 'bearer' })
      .expect(404);
    await client()
      .get('/users/invalid/skills')
      .auth(other.token, { type: 'bearer' })
      .expect(400);
  });
  it('rechaza correo duplicado, credenciales incorrectas y elevacion de rol', async () => {
    await client()
      .post('/auth/register')
      .send({ ...registration, correo: ' ANA@EXAMPLE.TEST ' })
      .expect(409);
    await client()
      .post('/auth/login')
      .send({ correo: 'ana@example.test', password: 'incorrecta' })
      .expect(401);
    await client()
      .post('/auth/register')
      .send({
        ...registration,
        correo: 'ataque@example.test',
        roles: ['ADMIN'],
      })
      .expect(400);
  });
  it('permite preflight CORS para DELETE', async () => {
    const response = await client()
      .options('/availability/test')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'DELETE')
      .expect(204);
    expect(response.headers['access-control-allow-methods']).toContain(
      'DELETE',
    );
  });
});
