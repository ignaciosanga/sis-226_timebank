import { Role } from '../../common/enums/role.enum';

// Contrato de aplicacion. Los IDs son opacos; no implica tipos SQL ni nombres Prisma.
export interface PublicUser {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  idCarrera: string;
  semestre: number;
  roles: Role[];
}

export interface UserRecord extends PublicUser {
  passwordHash: string;
  active: boolean;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    nombre: user.nombre,
    apellido: user.apellido,
    correo: user.correo,
    idCarrera: user.idCarrera,
    semestre: user.semestre,
    roles: [...user.roles],
  };
}
