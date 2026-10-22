import {
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { Role } from '../../common/enums/role.enum';
import { UsersService } from '../users/users.service';
import { EmailAlreadyExistsError } from '../users/users.repository';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { RegisterDto } from './dto/register.dto';
import {
  repositoryMock,
  userFixture,
} from '../../../test/support/users.fixture';

describe('AuthService (repositorio aislado, Argon2id y JWT reales)', () => {
  const passwords = new PasswordService();
  const jwt = new JwtService({
    secret: randomBytes(48).toString('hex'),
    signOptions: {
      algorithm: 'HS256',
      expiresIn: 900,
      issuer: 'test-issuer',
      audience: 'test-client',
    },
    verifyOptions: {
      algorithms: ['HS256'],
      issuer: 'test-issuer',
      audience: 'test-client',
    },
  });
  let hash: string;
  let repository: ReturnType<typeof repositoryMock>;
  let service: AuthService;
  const input: RegisterDto = {
    nombre: 'Ana',
    apellido: 'Perez',
    correo: 'Ana@EXAMPLE.test',
    password: 'clave-segura-de-prueba',
    idCarrera: 'carrera-test',
    semestre: 3,
  };

  beforeAll(async () => {
    hash = await passwords.hash(input.password);
  });
  beforeEach(() => {
    repository = repositoryMock();
    // Valor exclusivo del test, no constituye una politica del producto.
    service = new AuthService(new UsersService(repository), passwords, jwt, {
      initialCredits: '2.50',
    });
  });

  it('genera y verifica un JWT con sujeto, emisor, audiencia y expiracion', async () => {
    repository.findByEmail.mockResolvedValue(
      userFixture({ passwordHash: hash }),
    );
    repository.recordActiveLogin.mockResolvedValue(true);
    const result = await service.login(input);
    const payload = await jwt.verifyAsync<{
      sub: string;
      exp: number;
      iat: number;
    }>(result.access_token);
    expect(payload.sub).toBe('usuario-test');
    expect(payload.exp - payload.iat).toBe(900);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('password_hash');
    expect(repository.findByEmail).toHaveBeenCalledWith('ana@example.test');
  });

  it.each(['missing', 'wrong', 'suspended'])(
    'rechaza credenciales: %s',
    async (reason) => {
      repository.findByEmail.mockResolvedValue(
        reason === 'missing'
          ? null
          : userFixture({
              passwordHash: hash,
              active: reason !== 'suspended',
            }),
      );
      await expect(
        service.login({
          correo: input.correo,
          password: reason === 'wrong' ? 'incorrecta' : input.password,
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(repository.recordActiveLogin).not.toHaveBeenCalled();
    },
  );

  it('rechaza una suspension concurrente al login', async () => {
    repository.findByEmail.mockResolvedValue(
      userFixture({ passwordHash: hash }),
    );
    repository.recordActiveLogin.mockResolvedValue(false);
    await expect(service.login(input)).rejects.toThrow(UnauthorizedException);
  });

  it('bloquea registro hasta aprobar la politica inicial', async () => {
    const pending = new AuthService(
      new UsersService(repository),
      passwords,
      jwt,
      { initialCredits: null },
    );
    await expect(pending.register(input)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(repository.findByEmail).not.toHaveBeenCalled();
  });

  it('bloquea acceso si no hay adaptador oficial', async () => {
    const pending = new AuthService(new UsersService(), passwords, jwt, {
      initialCredits: null,
    });
    await expect(pending.login(input)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('envia usuario, rol estudiante y cuenta a una sola operacion atomica', async () => {
    repository.findByEmail.mockResolvedValue(null);
    repository.createStudentWithAccount.mockResolvedValue(
      userFixture({ passwordHash: hash }),
    );
    const result = await service.register(
      Object.assign({}, input, { role: Role.ADMIN, saldo: '999' }),
    );
    expect(repository.createStudentWithAccount).toHaveBeenCalledTimes(1);
    const created = repository.createStudentWithAccount.mock.calls[0]![0];
    expect(created.role).toBe(Role.ESTUDIANTE);
    expect(created.initialCredits).toBe('2.50');
    expect(created.correo).toBe('ana@example.test');
    expect(created).not.toHaveProperty('saldo');
    expect(created.passwordHash).not.toBe(input.password);
    expect(await passwords.verify(created.passwordHash, input.password)).toBe(
      true,
    );
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rechaza correo existente antes de escribir', async () => {
    repository.findByEmail.mockResolvedValue(userFixture());
    await expect(service.register(input)).rejects.toThrow(ConflictException);
    expect(repository.createStudentWithAccount).not.toHaveBeenCalled();
  });

  it('traduce duplicado concurrente a conflicto', async () => {
    repository.findByEmail.mockResolvedValue(null);
    repository.createStudentWithAccount.mockRejectedValue(
      new EmailAlreadyExistsError(),
    );
    await expect(service.register(input)).rejects.toThrow(ConflictException);
  });

  it('rechaza tokens vencidos, de otra firma y de otra audiencia', async () => {
    await expect(
      jwt.verifyAsync(await jwt.signAsync({ sub: 'test' }, { expiresIn: -1 })),
    ).rejects.toThrow();
    await expect(
      jwt.verifyAsync(
        await new JwtService({
          secret: randomBytes(48).toString('hex'),
        }).signAsync({ sub: 'test' }),
      ),
    ).rejects.toThrow();
    await expect(
      jwt.verifyAsync(
        await jwt.signAsync({ sub: 'test' }, { audience: 'otro-cliente' }),
      ),
    ).rejects.toThrow();
  });
});
