import { UnauthorizedException } from '@nestjs/common';
import {
  repositoryMock,
  userFixture,
} from '../../../test/support/users.fixture';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const repository = repositoryMock();
  const service = new UsersService(repository);

  it('proyecta el perfil sin secretos ni campos inesperados', async () => {
    repository.findById.mockResolvedValue(
      Object.assign(userFixture(), { password_hash: 'sensible' }),
    );
    expect(await service.me('usuario-test')).toEqual({
      id: 'usuario-test',
      nombre: 'Ana',
      apellido: 'Perez',
      correo: 'ana@example.test',
      idCarrera: 'carrera-test',
      semestre: 3,
      roles: ['ESTUDIANTE'],
    });
  });

  it('permite actualizar solo los campos del perfil y el ID autenticado', async () => {
    repository.findById.mockResolvedValue(userFixture());
    repository.updateActiveProfile.mockResolvedValue(
      userFixture({ nombre: 'Nuevo' }),
    );
    await service.updateMe(
      'usuario-test',
      Object.assign(
        { nombre: 'Nuevo' },
        {
          id: 'otro-usuario',
          saldo: '1000',
          roles: ['ADMIN'],
          password_hash: 'ataque',
        },
      ),
    );
    expect(repository.updateActiveProfile).toHaveBeenCalledWith(
      'usuario-test',
      { nombre: 'Nuevo' },
    );
  });

  it('rechaza perfiles de usuarios suspendidos', async () => {
    repository.findById.mockResolvedValue(userFixture({ active: false }));
    await expect(service.me('usuario-test')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza suspension concurrente durante actualizacion', async () => {
    repository.findById.mockResolvedValue(userFixture());
    repository.updateActiveProfile.mockResolvedValue(null);
    await expect(
      service.updateMe('usuario-test', { nombre: 'Nuevo' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
