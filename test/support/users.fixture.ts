import { DatabaseRole, Role } from '../../src/common/enums/role.enum';
import { UserRecord } from '../../src/modules/users/user.types';
import { UsersRepository } from '../../src/modules/users/users.repository';

export function userFixture(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'usuario-test',
    nombre: 'Ana',
    apellido: 'Perez',
    correo: 'ana@example.test',
    idCarrera: '30000000-0000-4000-8000-000000000001',
    semestre: 3,
    rol: DatabaseRole.ESTUDIANTE,
    roles: [Role.ESTUDIANTE],
    active: true,
    passwordHash: 'not-a-real-hash',
    ...overrides,
  };
}

export function repositoryMock(): jest.Mocked<UsersRepository> {
  return {
    createStudentProfile: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    createStudentWithAccount: jest.fn(),
    updateActiveProfile: jest.fn(),
    recordActiveLogin: jest.fn(),
  };
}
