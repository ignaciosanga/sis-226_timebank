import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validateEnvironment } from '../../config/environment';
import { UserStatus } from '../../common/enums/record-status.enum';
import { RegisterDto } from '../auth/dto/register.dto';
import { CategoriesService } from '../categories/categories.service';
import { MemoryCategoriesRepository } from '../categories/memory-categories.repository';
import { MemoryExchangeRepository } from '../exchanges/memory-exchange.repository';
import { SkillLevel } from '../user-skills/user-skill.types';
import { MemoryUsersRepository } from '../users/memory-users.repository';
import { Role } from '../../common/enums/role.enum';
import { ProvidersQueryDto } from './dto/skill-providers.dto';
import { MemorySkillsRepository } from './memory-skills.repository';
import { SkillProvidersService } from './skill-providers.service';
import { SkillsService } from './skills.service';

const profile = {
  nombre: 'Ana',
  apellido: 'Perez',
  correo: 'ana@ucb.edu.bo',
  passwordHash: 'test-only',
  idCarrera: '30000000-0000-4000-8000-000000000001',
  semestre: 3,
  role: Role.ESTUDIANTE as const,
};

describe('Issue #9: validaciones y operaciones focalizadas, sin BD', () => {
  it.each([' ANA@UCB.EDU.BO ', 'ana.perez@ucb.edu.bo'])(
    'normaliza y acepta %s',
    async (correo) => {
      const dto = plainToInstance(RegisterDto, {
        ...profile,
        password: 'clave-de-prueba-segura',
        correo,
      });
      const errors = await validate(dto);
      expect(
        errors.filter((error) => error.property === 'correo'),
      ).toHaveLength(0);
      expect(dto.correo).toBe(correo.trim().toLowerCase());
    },
  );

  it.each([
    'ana@gmail.com',
    'ana@sub.ucb.edu.bo',
    'ana@ucb.edu.bo.evil.test',
    'ana@fakeucb.edu.bo',
    'ana@ucb.edu.bo@evil.test',
    'ana@ucb.edu.bo\n.evil',
    'ana＠ucb.edu.bo',
    'ana@ucb.edu.bo.',
  ])('rechaza dominio aparente %s', async (correo) => {
    const errors = await validate(plainToInstance(RegisterDto, { correo }));
    expect(errors.some((error) => error.property === 'correo')).toBe(true);
  });

  it('configura 8 por defecto, admite override y rechaza cantidades invalidas', () => {
    const JWT_SECRET = 'a'.repeat(64);
    expect(
      validateEnvironment({ JWT_SECRET }).REGISTRATION_INITIAL_CREDITS,
    ).toBe(8);
    expect(
      validateEnvironment({ JWT_SECRET, REGISTRATION_INITIAL_CREDITS: '0' })
        .REGISTRATION_INITIAL_CREDITS,
    ).toBe(0);
    for (const value of ['-1', '1.5', 'abc', '2147483648']) {
      expect(() =>
        validateEnvironment({
          JWT_SECRET,
          REGISTRATION_INITIAL_CREDITS: value,
        }),
      ).toThrow();
    }
  });

  it('crea un solo bono de 8 y no modifica saldos al repetir el alta', async () => {
    const persistence = new MemoryExchangeRepository();
    const users = new MemoryUsersRepository(persistence);
    const existing = await users.createStudentWithAccount({
      ...profile,
      correo: 'existente@ucb.edu.bo',
      initialCredits: '3',
    });
    const input = { ...profile, initialCredits: '8' };
    const outcomes = await Promise.allSettled([
      users.createStudentWithAccount(input),
      users.createStudentWithAccount(input),
    ]);
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    await persistence.read((state) => {
      const created = [...state.users.values()].find(
        (user) => user.correo === profile.correo,
      )!;
      expect(created.saldo).toBe(8);
      expect(state.users.get(existing.id)?.saldo).toBe(3);
      const movements = [...state.movements.values()].filter(
        (entry) => entry.id_usuario === created.id_usuario,
      );
      expect(movements).toEqual([
        expect.objectContaining({
          tipo: 'BonoInicial',
          cantidad: 8,
          saldo_anterior: 0,
          saldo_posterior: 8,
          retenidos_anterior: 0,
          retenidos_posterior: 0,
        }),
      ]);
    });
  });

  it('publica solo ofertas activas, filtra/pagina y proyecta campos publicos', async () => {
    const persistence = new MemoryExchangeRepository();
    const users = new MemoryUsersRepository(persistence);
    const first = await users.createStudentProfile(profile);
    const second = await users.createStudentProfile({
      ...profile,
      correo: 'otro@ucb.edu.bo',
    });
    const skills = new SkillsService(
      new MemorySkillsRepository(),
      new CategoriesService(new MemoryCategoriesRepository()),
    );
    const service = new SkillProvidersService(skills, persistence);
    const id = '20000000-0000-4000-8000-000000000001';
    await persistence.transaction((state) => {
      for (const user of [first, second])
        state.userSkills.set(user.id + ':' + id, {
          id_usuario: user.id,
          id_habilidad: id,
          nivel: SkillLevel.AVANZADO,
        });
      state.users.get(second.id)!.estado = UserStatus.INACTIVO;
    });
    const result = await service.list(
      id,
      Object.assign(new ProvidersQueryDto(), {
        search: 'ANA',
        nivel: SkillLevel.AVANZADO,
        limit: 1,
      }),
    );
    expect(result.meta.total).toBe(1);
    expect(result.data).toEqual([
      {
        id_usuario: first.id,
        nombre: 'Ana Perez',
        id_habilidad: id,
        habilidad: expect.any(String),
        nivel: SkillLevel.AVANZADO,
      },
    ]);
    expect(
      (
        await service.list(
          id,
          Object.assign(new ProvidersQueryDto(), { nivel: SkillLevel.BASICO }),
        )
      ).data,
    ).toEqual([]);
    expect(
      (
        await service.list(
          id,
          Object.assign(new ProvidersQueryDto(), { page: 2, limit: 1 }),
        )
      ).data,
    ).toEqual([]);
    const unavailable = jest
      .spyOn(skills, 'requireActive')
      .mockRejectedValueOnce(new Error('inactiva'));
    await expect(service.list(id, new ProvidersQueryDto())).rejects.toThrow(
      'inactiva',
    );
    unavailable.mockRestore();
  });
});
