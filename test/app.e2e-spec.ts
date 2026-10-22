import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';

describe('Aplicacion real sin PostgreSQL (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('arranca y responde /health sin conexion ni esquema', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'banco-tiempo-backend',
    });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.text).not.toContain('password_hash');
  });

  it('sirve Swagger y documenta el contrato v0.4 y el modelo optimizado', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200);
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining([
        '/health',
        '/auth/register',
        '/auth/login',
        '/users/me',
        '/categories',
        '/careers',
        '/categories/{id}',
        '/skills',
        '/skills/{id}',
        '/users/me/skills',
        '/users/me/skills/{skillId}',
        '/users/{id}/skills',
        '/availability',
        '/availability/me',
        '/availability/{id}',
        '/users/{id}/availability',
        '/exchanges',
        '/exchanges/me',
        '/exchanges/{id}/accept',
        '/exchanges/integrity',
        '/reservations/me',
        '/reservations/{id}/confirm',
        '/credits/me',
        '/credits/grants',
      ]),
    );
    expect(response.body.info.version).toBe('0.4.0');
  });

  it('permite el origen configurado', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
  });

  it('no autoriza CORS a un origen desconocido', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://unknown.example.test')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it.each(['/auth/register', '/auth/login', '/users/me', '/__test__/me'])(
    'valida las rutas publicadas y mantiene privados los controladores de prueba: %s',
    async (path) => {
      const method = path.startsWith('/auth') ? 'post' : 'get';
      const status = path.startsWith('/auth')
        ? 400
        : path === '/users/me'
          ? 401
          : 404;
      await request(app.getHttpServer())[method](path).expect(status);
    },
  );
});
