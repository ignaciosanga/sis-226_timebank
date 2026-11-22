import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { UserStatus } from '../../../common/enums/record-status.enum';
import { DatabaseRole } from '../../../common/enums/role.enum';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SensitiveFieldsInterceptor } from '../../../common/interceptors/sensitive-fields.interceptor';
import { MemoryExchangeRepository } from '../../exchanges/memory-exchange.repository';
import { StoredUser } from '../../users/user.types';
import { SkillLevel } from '../../user-skills/user-skill.types';
import { TutoringBannerService } from './banner.service';
import { TutoringBannerController } from './banner.controller';
import { MAX_BANNER_BYTES } from './banner.types';

describe('Banners persistentes y cargas abandonadas', () => {
  let directory: string;
  let persistence: MemoryExchangeRepository;
  let service: TutoringBannerService;
  let config: ConfigService;
  let actor: string;
  let second: string;
  let buffer: Buffer;

  const upload = () => ({ buffer, size: buffer.length, mimetype: 'image/png' });
  const user = (id: string): StoredUser => ({
    id_usuario: id,
    nombre: 'Tutora',
    apellido: 'Prueba',
    correo: `${id}@ucb.edu.bo`,
    password_hash: '!fixture',
    rol: DatabaseRole.ESTUDIANTE,
    id_carrera: null,
    semestre: 3,
    saldo: 0,
    creditos_retenidos: 0,
    fecha_registro: new Date(),
    ultimo_acceso: null,
    estado: UserStatus.ACTIVO,
  });

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'nexou-banner-unit-'));
    config = new ConfigService({
      BANNER_STORAGE_DIR: directory,
      PUBLIC_API_URL: 'http://127.0.0.1:4103',
    });
    persistence = new MemoryExchangeRepository();
    actor = randomUUID();
    second = randomUUID();
    await persistence.transaction((state) => {
      state.users.set(actor, user(actor));
      state.users.set(second, user(second));
    });
    service = new TutoringBannerService(persistence, config);
    await service.onModuleInit();
    buffer = await sharp({
      create: { width: 3, height: 2, channels: 3, background: '#156369' },
    })
      .png()
      .toBuffer();
  });

  afterEach(async () => {
    const target = resolve(directory);
    if (
      dirname(target) !== resolve(tmpdir()) ||
      !target.startsWith(join(resolve(tmpdir()), 'nexou-banner-unit-'))
    )
      throw new Error('Destino de limpieza inesperado');
    await rm(target, { recursive: true, force: true });
  });

  it('recupera una carga idempotente concurrente con un solo archivo', async () => {
    const key = randomUUID();
    const results = await Promise.all([
      service.upload(actor, upload(), key),
      service.upload(actor, upload(), key),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await readdir(directory)).toHaveLength(1);
    expect(await persistence.read((state) => state.banners.size)).toBe(1);
    const next = new TutoringBannerService(persistence, config);
    await next.onModuleInit();
    expect(await next.upload(actor, upload(), key)).toEqual(results[0]);
    expect(await readdir(directory)).toHaveLength(1);
    expect(
      await persistence.read((state) => ({
        saldo: state.users.get(actor)!.saldo,
        movimientos: state.movements.size,
      })),
    ).toEqual({ saldo: 0, movimientos: 0 });
  });

  it('rechaza reutilizar una clave con otros bytes sin dejar archivo suelto', async () => {
    const key = randomUUID();
    await service.upload(actor, upload(), key);
    const other = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#ff0000' },
    })
      .png()
      .toBuffer();
    await expect(
      service.upload(
        actor,
        { buffer: other, size: other.length, mimetype: 'image/png' },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await readdir(directory)).toHaveLength(1);
    expect(await persistence.read((state) => state.banners.size)).toBe(1);
  });

  it('solo publica una referencia propia y no expone cargas pendientes', async () => {
    const result = await service.upload(actor, upload(), randomUUID());
    const id = result.url.split('/').at(-1)!;
    await expect(service.get(id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      persistence.transaction((state) =>
        service.validateAndAttach(state, second, result.url, randomUUID()),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      persistence.transaction((state) =>
        service.validateAndAttach(
          state,
          actor,
          'https://otra.example/imagen.png',
          randomUUID(),
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await persistence.read(
        (state) => state.banners.get(id)!.attached_offer_id,
      ),
    ).toBeNull();
  });

  it('conserva la imagen publicada al reabrir y no permite adjuntarla dos veces', async () => {
    const result = await service.upload(actor, upload(), randomUUID());
    const id = result.url.split('/').at(-1)!;
    const offerId = randomUUID();
    await persistence.transaction(async (state) => {
      const bannerId = await service.validateAndAttach(
        state,
        actor,
        result.url,
        offerId,
      );
      state.offers.set(offerId, {
        id_oferta: offerId,
        id_tutor: actor,
        id_habilidad: randomUUID(),
        id_disponibilidad: randomUUID(),
        id_banner: bannerId,
        nivel: SkillLevel.AVANZADO,
        titulo: 'Clase',
        descripcion: 'Prueba',
        costo_creditos: '3.7',
        estado: 'Activa',
        created_at: new Date(),
      });
      state.banners.get(id)!.expires_at = new Date(Date.now() - 1);
    });
    const next = new TutoringBannerService(persistence, config);
    await next.onModuleInit();
    const image = await next.get(id);
    expect(image.mime).toBe('image/png');
    expect(await sharp(image.bytes).metadata()).toMatchObject({
      width: 3,
      height: 2,
    });
    expect(await readdir(directory)).toHaveLength(1);
    await expect(
      persistence.transaction((state) =>
        next.validateAndAttach(state, actor, result.url, randomUUID()),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await persistence.transaction((state) => {
      state.users.get(actor)!.estado = UserStatus.SUSPENDIDO;
    });
    await expect(next.get(id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('revierte la vinculacion si la publicacion falla y permite volver a intentar', async () => {
    const result = await service.upload(actor, upload(), randomUUID());
    const id = result.url.split('/').at(-1)!;
    const offerId = randomUUID();
    await expect(
      persistence.transaction(async (state) => {
        await service.validateAndAttach(state, actor, result.url, offerId);
        throw new ConflictException('Fallo simulado al crear horario');
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      await persistence.read(
        (state) => state.banners.get(id)!.attached_offer_id,
      ),
    ).toBeNull();
    expect(await readdir(directory)).toHaveLength(1);
    expect(
      await persistence.transaction((state) =>
        service.validateAndAttach(state, actor, result.url, offerId),
      ),
    ).toBe(id);
  });

  it('elimina bytes abandonados tras 24h y conserva la clave como vencida', async () => {
    const key = randomUUID();
    const result = await service.upload(actor, upload(), key);
    const id = result.url.split('/').at(-1)!;
    await persistence.transaction((state) => {
      state.banners.get(id)!.expires_at = new Date(Date.now() - 1);
    });
    await service.cleanupExpired();
    expect(await readdir(directory)).toHaveLength(0);
    expect(
      await persistence.read((state) => state.banners.get(id)!.deleted_at),
    ).not.toBeNull();
    await expect(service.upload(actor, upload(), key)).rejects.toBeInstanceOf(
      GoneException,
    );
    expect(await readdir(directory)).toHaveLength(0);
    await expect(
      persistence.transaction((state) =>
        service.validateAndAttach(state, actor, result.url, randomUUID()),
      ),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it('rechaza cuentas pendientes y claves ausentes antes de guardar archivos', async () => {
    await expect(service.upload(actor, upload())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await persistence.transaction((state) => {
      state.users.get(actor)!.estado = UserStatus.PENDIENTE;
    });
    await expect(
      service.upload(actor, upload(), randomUUID()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(await readdir(directory)).toHaveLength(0);
  });

  it('valida multipart HTTP real y envia bytes publicados sin recorrer Response en el interceptor', async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [TutoringBannerController],
      providers: [{ provide: TutoringBannerService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp(): { getRequest(): { user: { id: string } } };
        }) => {
          context.switchToHttp().getRequest().user = { id: actor };
          return true;
        },
      })
      .compile();
    const app = testingModule.createNestApplication();
    app.useGlobalInterceptors(new SensitiveFieldsInterceptor());
    await app.init();
    try {
      const response = await request(app.getHttpServer())
        .post('/tutoring/banners')
        .set('Idempotency-Key', randomUUID())
        .attach('banner', buffer, {
          filename: 'foto.png',
          contentType: 'image/png',
        })
        .expect(201);
      const url = response.body.url as string;
      const path = new URL(url).pathname;
      const id = path.split('/').at(-1)!;
      await request(app.getHttpServer()).get(path).expect(404);
      const offerId = randomUUID();
      await persistence.transaction(async (state) => {
        const bannerId = await service.validateAndAttach(
          state,
          actor,
          url,
          offerId,
        );
        state.offers.set(offerId, {
          id_oferta: offerId,
          id_tutor: actor,
          id_habilidad: randomUUID(),
          id_disponibilidad: randomUUID(),
          id_banner: bannerId,
          nivel: SkillLevel.AVANZADO,
          titulo: 'Clase',
          descripcion: 'Prueba HTTP',
          costo_creditos: '3.7',
          estado: 'Activa',
          created_at: new Date(),
        });
      });
      const published = await request(app.getHttpServer())
        .get(path)
        .expect(200);
      expect(published.headers['content-type']).toBe('image/png');
      expect(published.headers['x-content-type-options']).toBe('nosniff');
      expect(published.headers['cross-origin-resource-policy']).toBe(
        'cross-origin',
      );
      expect(Buffer.isBuffer(published.body)).toBe(true);
      expect(await sharp(published.body as Buffer).metadata()).toMatchObject({
        width: 3,
        height: 2,
      });
      await request(app.getHttpServer())
        .post('/tutoring/banners')
        .set('Idempotency-Key', randomUUID())
        .attach('banner', Buffer.from('falso'), {
          filename: 'falso.png',
          contentType: 'image/png',
        })
        .expect(400);
      await request(app.getHttpServer())
        .post('/tutoring/banners')
        .set('Idempotency-Key', randomUUID())
        .attach('banner', Buffer.alloc(MAX_BANNER_BYTES + 1), {
          filename: 'grande.png',
          contentType: 'image/png',
        })
        .expect(413);
      expect(
        await persistence.read((state) => [...state.banners.keys()]),
      ).toEqual([id]);
    } finally {
      await app.close();
    }
  });
});
