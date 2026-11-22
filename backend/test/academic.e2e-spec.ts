import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../src/modules/exchanges/exchange.repository';
import { addReservation } from '../src/modules/exchanges/test-fixtures';
import { ReservationStatus } from '../src/modules/exchanges/exchange.types';

describe('Opiniones y permisos académicos HTTP (memoria, sin certificar PostgreSQL)', () => {
  let app: INestApplication;
  let student: string;
  let tutor: string;
  const reservation = '50000000-0000-4000-8000-000000000001';
  beforeAll(async () => {
    app = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication();
    configureApp(app);
    await app.init();
    await app.get<ExchangeRepository>(EXCHANGE_REPOSITORY).transaction((s) => {
      addReservation(s, {
        id: reservation,
        status: ReservationStatus.COMPLETADA,
      });
      const r = s.reservations.get(reservation)!;
      r.fecha_inicio = new Date('2020-01-01T09:00:00Z');
      r.fecha_fin = new Date('2020-01-01T10:00:00Z');
    });
    student = app.get(JwtService).sign({ sub: 'student', purpose: 'session' });
    tutor = app.get(JwtService).sign({ sub: 'provider', purpose: 'session' });
  });
  afterAll(async () => {
    await app?.close();
  });

  it('requiere sesión y limita indicadores a ADMIN', async () => {
    await request(app.getHttpServer()).get('/roadmap/me').expect(401);
    await request(app.getHttpServer())
      .get('/analytics/academic')
      .auth(student, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/roadmap/me')
      .auth(student, { type: 'bearer' })
      .expect(503);
  });
  it('valida DTO, paginación y propiedad antes de escribir', async () => {
    await request(app.getHttpServer())
      .get('/tutoring/reviews/me?limit=101')
      .auth(student, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/tutoring/reservations/${reservation}/review`)
      .auth(student, { type: 'bearer' })
      .set('Idempotency-Key', 'review-http-0001')
      .send({ calificacion: 6 })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/tutoring/reservations/${reservation}/review`)
      .auth(tutor, { type: 'bearer' })
      .set('Idempotency-Key', 'review-http-0001')
      .send({ calificacion: 5 })
      .expect(403);
  });
  it('persiste en el repositorio de prueba, reproduce y aísla opiniones propias', async () => {
    const post = () =>
      request(app.getHttpServer())
        .post(`/tutoring/reservations/${reservation}/review`)
        .auth(student, { type: 'bearer' })
        .set('Idempotency-Key', 'review-http-0001')
        .send({ calificacion: 5, comentario: 'Gracias' });
    const first = await post().expect(201);
    const second = await post().expect(201);
    expect(first.body).toEqual(second.body);
    const mine = await request(app.getHttpServer())
      .get('/tutoring/reviews/me')
      .auth(student, { type: 'bearer' })
      .expect(200);
    expect(mine.body.data).toHaveLength(1);
    const other = await request(app.getHttpServer())
      .get('/tutoring/reviews/me')
      .auth(tutor, { type: 'bearer' })
      .expect(200);
    expect(other.body.data).toEqual([]);
  });
  it('permite preflight PUT para Mi ruta', async () => {
    const result = await request(app.getHttpServer())
      .options('/roadmap/me/courses/SIS-111')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'PUT')
      .expect(204);
    expect(result.headers['access-control-allow-methods']).toContain('PUT');
  });
});
