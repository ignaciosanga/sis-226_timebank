import { DatabaseRole, Role } from '../../common/enums/role.enum';
import { MemoryExchangeRepository } from '../exchanges/memory-exchange.repository';
import { MemoryUsersRepository } from './memory-users.repository';
import { EmailAlreadyExistsError } from './users.repository';

describe('MemoryUsersRepository', () => {
  const profile = {
    nombre: 'Ana',
    apellido: 'Perez',
    correo: 'ANA@example.test',
    passwordHash: 'hash-solo-test',
    idCarrera: '30000000-0000-4000-8000-000000000001',
    semestre: 3,
    role: Role.ESTUDIANTE as const,
  };
  it('crea UUID, adapta nombres oficiales y nunca acepta rol ADMIN del input', async () => {
    const repository = new MemoryUsersRepository();
    const user = await repository.createStudentProfile(profile);
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.correo).toBe('ana@example.test');
    expect(user.rol).toBe('Estudiante');
    expect(user.roles).toEqual([Role.ESTUDIANTE]);
    user.roles.push(Role.ADMIN);
    expect((await repository.findById(user.id))?.roles).toEqual([
      Role.ESTUDIANTE,
    ]);
  });
  it('impide duplicados de correo con escrituras simultaneas', async () => {
    const repository = new MemoryUsersRepository();
    const results = await Promise.allSettled([
      repository.createStudentProfile(profile),
      repository.createStudentProfile({
        ...profile,
        correo: 'ana@EXAMPLE.test',
      }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(
      EmailAlreadyExistsError,
    );
  });

  it('adapta el rol Profesor almacenado en USUARIOS a las capacidades del backend', async () => {
    const persistence = new MemoryExchangeRepository();
    const repository = new MemoryUsersRepository(persistence);
    const created = await repository.createStudentProfile(profile);
    await persistence.transaction((state) => {
      state.users.get(created.id)!.rol = DatabaseRole.PROFESOR;
    });
    expect(await repository.findById(created.id)).toMatchObject({
      rol: DatabaseRole.PROFESOR,
      roles: [Role.ESTUDIANTE, Role.PROFESOR],
    });
  });

  it('crea el bono inicial y su movimiento dentro de la misma transaccion del usuario', async () => {
    const persistence = new MemoryExchangeRepository();
    const repository = new MemoryUsersRepository(persistence);
    const created = await repository.createStudentWithAccount({
      ...profile,
      initialCredits: '10',
    });
    const saved = await persistence.read((state) => ({
      user: state.users.get(created.id),
      entries: [...state.movements.values()],
    }));
    expect(saved.user).toMatchObject({ saldo: 10, creditos_retenidos: 0 });
    expect(saved.entries).toEqual([
      expect.objectContaining({
        id_usuario: created.id,
        id_reserva: null,
        tipo: 'BonoInicial',
        cantidad: 10,
        saldo_anterior: 0,
        saldo_posterior: 10,
        retenidos_anterior: 0,
        retenidos_posterior: 0,
      }),
    ]);
  });
});
