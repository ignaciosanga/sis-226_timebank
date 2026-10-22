import {
  Body,
  Controller,
  Get,
  HttpCode,
  INestApplication,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';
import { CurrentUser } from '../src/common/decorators/current-user.decorator';
import { Roles } from '../src/common/decorators/roles.decorator';
import { Role } from '../src/common/enums/role.enum';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { LoginDto } from '../src/modules/auth/dto/login.dto';
import { RegisterDto } from '../src/modules/auth/dto/register.dto';
import { REGISTRATION_POLICY } from '../src/modules/auth/registration-policy';
import { UsersService } from '../src/modules/users/users.service';
import { PublicUser } from '../src/modules/users/user.types';
import { UpdateProfileDto } from '../src/modules/users/dto/update-profile.dto';
import { repositoryMock, userFixture } from './support/users.fixture';

// Controlador exclusivo de Jest. No se importa desde src ni se publica en el backend.
@Controller('__test__')
class SecurityTestController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: PublicUser) {
    return this.users.me(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  update(@CurrentUser() user: PublicUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin')
  admin() {
    return { authorized: true };
  }

  @Get('sensitive')
  sensitive() {
    return {
      password_hash: 'never-return-this',
      user: { passwordHash: 'also-private', nombre: 'Ana' },
    };
  }

  @Get('failure')
  failure(): never {
    throw new Error(
      'postgresql://private:secret@host/db password_hash=private',
    );
  }

  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Get('limited')
  limited() {
    return { ok: true };
  }
}

describe('Seguridad HTTP con repositorio simulado (no es integracion de BD)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let token: string;
  let hash: string;
  const repository = repositoryMock();
  const registration = {
    nombre: 'Ana',
    apellido: 'Perez',
    correo: 'ana@example.test',
    password: 'clave-segura-de-prueba',
    idCarrera: '30000000-0000-4000-8000-000000000001',
    semestre: 3,
  };

  beforeAll(async () => {
    hash = await new PasswordService().hash(registration.password);
    const module = await Test.createTestingModule({
      imports: [AppModule, AuthModule],
      controllers: [SecurityTestController],
    })
      .overrideProvider(UsersService)
      .useValue(new UsersService(repository))
      .overrideProvider(REGISTRATION_POLICY)
      .useValue({ initialCredits: null })
      .compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    jwt = app.get(JwtService);
    token = await jwt.signAsync({ sub: 'usuario-test' });
  });
  beforeEach(() => {
    repository.findById.mockResolvedValue(userFixture({ passwordHash: hash }));
    repository.findByEmail.mockResolvedValue(
      userFixture({ passwordHash: hash }),
    );
    repository.recordActiveLogin.mockResolvedValue(true);
    repository.updateActiveProfile.mockResolvedValue(
      userFixture({ passwordHash: hash, nombre: 'Nuevo' }),
    );
  });
  afterAll(async () => {
    await app?.close();
  });

  it('rechaza solicitudes protegidas sin token', async () => {
    await request(app.getHttpServer()).get('/__test__/me').expect(401);
  });

  it.each(['invalid', 'expired', 'wrong-audience', 'missing-sub'])(
    'rechaza JWT %s',
    async (kind) => {
      let bad = 'invalid.jwt.signature';
      if (kind === 'expired')
        bad = await jwt.signAsync({ sub: 'usuario-test' }, { expiresIn: -1 });
      if (kind === 'wrong-audience')
        bad = await jwt.signAsync(
          { sub: 'usuario-test' },
          { audience: 'otro' },
        );
      if (kind === 'missing-sub') bad = await jwt.signAsync({});
      await request(app.getHttpServer())
        .get('/__test__/me')
        .auth(bad, { type: 'bearer' })
        .expect(401);
    },
  );

  it('rechaza DTO invalido', async () => {
    const response = await request(app.getHttpServer())
      .post('/__test__/login')
      .send({ correo: 'invalid', password: 10 })
      .expect(400);
    expect(Array.isArray(response.body.message)).toBe(true);
  });

  it.each([
    { roles: ['ADMIN'] },
    { rol: 'Administrador' },
    { saldo: 100 },
    { id: 'otro' },
    { password_hash: 'unsafe' },
  ])('rechaza propiedades adicionales de registro: %j', async (extra) => {
    const response = await request(app.getHttpServer())
      .post('/__test__/register')
      .send({ ...registration, ...extra })
      .expect(400);
    expect(response.text).not.toContain('clave-segura-de-prueba');
  });

  it('rechaza contrasena corta en el registro', async () => {
    await request(app.getHttpServer())
      .post('/__test__/register')
      .send({ ...registration, password: 'corta' })
      .expect(400);
  });

  it('mantiene el registro bloqueado por politica pendiente', async () => {
    await request(app.getHttpServer())
      .post('/__test__/register')
      .send(registration)
      .expect(503);
    expect(repository.createStudentWithAccount).not.toHaveBeenCalled();
  });

  it('rechaza credenciales incorrectas con mensaje generico', async () => {
    const response = await request(app.getHttpServer())
      .post('/__test__/login')
      .send({ correo: registration.correo, password: 'incorrecta' })
      .expect(401);
    expect(response.body.message).toBe('Credenciales invalidas');
  });

  it('rechaza login suspendido', async () => {
    repository.findByEmail.mockResolvedValue(
      userFixture({ passwordHash: hash, active: false }),
    );
    await request(app.getHttpServer())
      .post('/__test__/login')
      .send(registration)
      .expect(400);
    await request(app.getHttpServer())
      .post('/__test__/login')
      .send({ correo: registration.correo, password: registration.password })
      .expect(401);
  });

  it('entrega token y perfil sin hash', async () => {
    const response = await request(app.getHttpServer())
      .post('/__test__/login')
      .send({ correo: ' ANA@EXAMPLE.TEST ', password: registration.password })
      .expect(200);
    expect(
      (await jwt.verifyAsync<{ sub: string }>(response.body.access_token)).sub,
    ).toBe('usuario-test');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.text).not.toContain('password_hash');
    expect(response.text).not.toContain(hash);
  });

  it('identifica al usuario a partir del JWT verificado', async () => {
    const response = await request(app.getHttpServer())
      .get('/__test__/me?id=otro')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(response.body.id).toBe('usuario-test');
    expect(repository.findById).toHaveBeenCalledWith('usuario-test');
    expect(response.text).not.toContain(hash);
  });

  it('rechaza usuario suspendido aunque tenga JWT aun vigente', async () => {
    repository.findById.mockResolvedValue(userFixture({ active: false }));
    await request(app.getHttpServer())
      .get('/__test__/me')
      .auth(token, { type: 'bearer' })
      .expect(401);
  });

  it('deniega rol insuficiente y permite un administrador actual', async () => {
    await request(app.getHttpServer())
      .get('/__test__/admin')
      .auth(token, { type: 'bearer' })
      .expect(403);
    repository.findById.mockResolvedValue(userFixture({ roles: [Role.ADMIN] }));
    await request(app.getHttpServer())
      .get('/__test__/admin')
      .auth(token, { type: 'bearer' })
      .expect(200);
  });

  it('ignora roles fabricados en un token y usa los del repositorio', async () => {
    const forgedRole = await jwt.signAsync({
      sub: 'usuario-test',
      roles: ['ADMIN'],
    });
    await request(app.getHttpServer())
      .get('/__test__/admin')
      .auth(forgedRole, { type: 'bearer' })
      .expect(403);
  });

  it.each([
    { saldo: 999 },
    { creditos_retenidos: 1 },
    { rol: 'Administrador' },
    { roles: ['ADMIN'] },
    { id: 'otro' },
    { nombre: null },
    { idCarrera: null },
    { idCarrera: 'sin-uuid' },
    { semestre: 13 },
  ])('rechaza modificacion de perfil invalida %j', async (patch) => {
    await request(app.getHttpServer())
      .patch('/__test__/me')
      .auth(token, { type: 'bearer' })
      .send(patch)
      .expect(400);
  });

  it('actualiza el perfil del sujeto autenticado sin exponer secretos', async () => {
    const response = await request(app.getHttpServer())
      .patch('/__test__/me')
      .auth(token, { type: 'bearer' })
      .send({ nombre: 'Nuevo' })
      .expect(200);
    expect(response.body.nombre).toBe('Nuevo');
    expect(repository.updateActiveProfile).toHaveBeenCalledWith(
      'usuario-test',
      { nombre: 'Nuevo' },
    );
    expect(response.text).not.toContain(hash);
  });

  it('redacta hashes incluso si un futuro controlador los retorna accidentalmente', async () => {
    const response = await request(app.getHttpServer())
      .get('/__test__/sensitive')
      .expect(200);
    expect(response.body).toEqual({ user: { nombre: 'Ana' } });
  });

  it('oculta los detalles de errores internos', async () => {
    const response = await request(app.getHttpServer())
      .get('/__test__/failure')
      .expect(500);
    expect(response.body.message).toBe('Servicio temporalmente no disponible');
    expect(response.text).not.toMatch(/postgresql|password_hash|private/);
  });

  it('aplica rate limiting y devuelve 429', async () => {
    await request(app.getHttpServer()).get('/__test__/limited').expect(200);
    await request(app.getHttpServer()).get('/__test__/limited').expect(200);
    const response = await request(app.getHttpServer())
      .get('/__test__/limited')
      .expect(429);
    expect(response.headers['retry-after']).toBeDefined();
  });
});
