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

  it('sirve Swagger y documenta solamente health', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200);
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(Object.keys(response.body.paths)).toEqual(['/health']);
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
    'no expone funciones pendientes: %s',
    async (path) => {
      const method = path.startsWith('/auth') ? 'post' : 'get';
      await request(app.getHttpServer())[method](path).expect(404);
    },
  );
});
