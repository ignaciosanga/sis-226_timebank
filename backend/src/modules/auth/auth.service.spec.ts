import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { VerificationEmailService } from './verification-email.service';
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
  let verificationEmail: {
    sendVerificationEmail: jest.Mock;
  };
  const input: RegisterDto = {
    nombre: 'Ana',
    apellido: 'Perez',
    correo: 'Ana@EXAMPLE.test',
    password: 'clave-segura-de-prueba',
    idCarrera: '30000000-0000-4000-8000-000000000001',
    semestre: 3,
  };

  beforeAll(async () => {
    hash = await passwords.hash(input.password);
  });
    beforeEach(() => {
    repository = repositoryMock();

    verificationEmail = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };

    repository.setEmailVerificationToken.mockResolvedValue(true);

    service = new AuthService(
      new UsersService(repository),
      passwords,
      jwt,
      { initialCredits: '10' },
      verificationEmail as unknown as VerificationEmailService,
    );
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

  it('no registra ultimo_acceso si falla la firma del JWT', async () => {
    repository.findByEmail.mockResolvedValue(
      userFixture({ passwordHash: hash }),
    );
    repository.recordActiveLogin.mockResolvedValue(true);
    const failure = new Error('Firma JWT no disponible');
    const sign = jest.spyOn(jwt, 'signAsync').mockRejectedValueOnce(failure);
    try {
      await expect(service.login(input)).rejects.toBe(failure);
      expect(repository.recordActiveLogin).not.toHaveBeenCalled();
    } finally {
      sign.mockRestore();
    }
  });

  it('bloquea registro hasta aprobar la politica inicial', async () => {
    const pending = new AuthService(
      new UsersService(repository),
      passwords,
      jwt,
      { initialCredits: null },
      verificationEmail as unknown as VerificationEmailService,
    );
    await expect(pending.register(input)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(repository.findByEmail).not.toHaveBeenCalled();
  });

  it('registra solo el perfil en modo memoria sin aprobar ni crear creditos', async () => {
    const local = new AuthService(
      new UsersService(repository),
      passwords,
      jwt,
      { initialCredits: null, profileOnly: true },
      verificationEmail as unknown as VerificationEmailService,
    );
    repository.findByEmail.mockResolvedValue(null);
    repository.createStudentProfile.mockResolvedValue(
      userFixture({ passwordHash: hash }),
    );
    expect((await local.register(input)).roles).toEqual([Role.ESTUDIANTE]);
    expect(repository.createStudentProfile).toHaveBeenCalledWith(
      expect.objectContaining({ role: Role.ESTUDIANTE }),
    );
    expect(
      repository.createStudentProfile.mock.calls[0]![0],
    ).not.toHaveProperty('initialCredits');
    expect(repository.createStudentWithAccount).not.toHaveBeenCalled();
  });

  it('bloquea acceso si no hay adaptador oficial', async () => {
    const pending = new AuthService(
      new UsersService(),
      passwords,
      jwt,
      { initialCredits: null },
      verificationEmail as unknown as VerificationEmailService,
    );
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
    expect(created.initialCredits).toBe('10');
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
    it('genera un token seguro, guarda su hash y envia el correo', async () => {
      const start = Date.now();

      repository.findByEmail.mockResolvedValue(null);
      repository.createStudentWithAccount.mockResolvedValue(
        userFixture({ passwordHash: hash, correoVerificado: false }),
      );

      await service.register(input);

      expect(repository.setEmailVerificationToken).toHaveBeenCalledTimes(1);
      expect(verificationEmail.sendVerificationEmail).toHaveBeenCalledTimes(1);

      const [userId, tokenHash, expiresAt] =
        repository.setEmailVerificationToken.mock.calls[0]!;

      expect(userId).toBe('usuario-test');
      expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
        start + 24 * 60 * 60 * 1000,
      );
      expect(expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + 24 * 60 * 60 * 1000,
      );

      const [correo, token] =
        verificationEmail.sendVerificationEmail.mock.calls[0]!;

      expect(correo).toBe('ana@example.test');
      expect(createHash('sha256').update(token).digest('hex')).toBe(tokenHash);
    });

    it('no envia correo adicional cuando el registro viene verificado por Google', async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.createStudentWithAccount.mockResolvedValue(
        userFixture({ passwordHash: hash, correoVerificado: true }),
      );

      await service.register(input, { correoVerificado: true });

      expect(
        repository.createStudentWithAccount.mock.calls[0]![0].correoVerificado,
      ).toBe(true);
      expect(repository.setEmailVerificationToken).not.toHaveBeenCalled();
      expect(verificationEmail.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('rechaza el login si la contraseña es correcta pero el correo no esta verificado', async () => {
      repository.findByEmail.mockResolvedValue(
        userFixture({
          passwordHash: hash,
          correoVerificado: false,
        }),
      );

      await expect(service.login(input)).rejects.toThrow(ForbiddenException);

      expect(repository.recordActiveLogin).not.toHaveBeenCalled();
    });

    it('consume el token al verificar el correo', async () => {
      repository.verifyEmailToken.mockResolvedValue(
        userFixture({ correoVerificado: true }),
      );

      const result = await service.verifyEmail('token-de-prueba');

      expect(repository.verifyEmailToken).toHaveBeenCalledWith(
        createHash('sha256').update('token-de-prueba').digest('hex'),
        expect.any(Date),
      );
      expect(result.message).toBe('Correo verificado correctamente');
    });
      it('reenvia el correo de verificacion a una cuenta pendiente', async () => {
    repository.findByEmail.mockResolvedValue(
      userFixture({
        correo: 'ana@example.test',
        correoVerificado: false,
      }),
    );

    const result = await service.resendVerification('ANA@EXAMPLE.TEST');

    expect(repository.findByEmail).toHaveBeenCalledWith('ana@example.test');
    expect(repository.setEmailVerificationToken).toHaveBeenCalledTimes(1);
    expect(verificationEmail.sendVerificationEmail).toHaveBeenCalledWith(
      'ana@example.test',
      expect.any(String),
    );
    expect(result.message).toContain('Si la cuenta existe');
  });

  it('no revela si una cuenta inexistente necesita verificacion', async () => {
    repository.findByEmail.mockResolvedValue(null);

    const result = await service.resendVerification('desconocido@example.test');

    expect(result.message).toContain('Si la cuenta existe');
    expect(repository.setEmailVerificationToken).not.toHaveBeenCalled();
    expect(verificationEmail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('no reenvia correo a cuentas ya verificadas', async () => {
    repository.findByEmail.mockResolvedValue(
      userFixture({ correoVerificado: true }),
    );

    const result = await service.resendVerification('ana@example.test');

    expect(result.message).toContain('Si la cuenta existe');
    expect(repository.setEmailVerificationToken).not.toHaveBeenCalled();
    expect(verificationEmail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('mantiene respuesta generica si falla el envio del correo', async () => {
    repository.findByEmail.mockResolvedValue(
      userFixture({ correoVerificado: false }),
    );
    verificationEmail.sendVerificationEmail.mockRejectedValue(
      new Error('SMTP no disponible'),
    );

    const result = await service.resendVerification('ana@example.test');

    expect(result.message).toContain('Si la cuenta existe');
  });
});
