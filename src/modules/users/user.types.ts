import { DatabaseRole, Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/record-status.enum';
import { ApiProperty } from '@nestjs/swagger';

// Contrato de aplicacion. Los IDs son opacos; no implica tipos SQL ni nombres Prisma.
export class PublicUser {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  nombre!: string;
  @ApiProperty()
  apellido!: string;
  @ApiProperty({ format: 'email' })
  correo!: string;
  @ApiProperty()
  idCarrera!: string | null;
  @ApiProperty()
  semestre!: number | null;
  @ApiProperty({ enum: DatabaseRole })
  rol!: DatabaseRole;
  @ApiProperty({ enum: Role, isArray: true })
  roles!: Role[];
}

export interface UserRecord extends PublicUser {
  passwordHash: string;
  active: boolean;
}

/** Una fila de USUARIOS del modelo optimizado: sin tablas de roles/cuentas. */
export interface StoredUser {
  id_usuario: string;
  nombre: string;
  apellido: string;
  correo: string;
  password_hash: string;
  rol: DatabaseRole;
  id_carrera: string | null;
  semestre: number | null;
  saldo: number;
  creditos_retenidos: number;
  fecha_registro: Date;
  ultimo_acceso: Date | null;
  estado: UserStatus;
}

export function adaptStoredUser(user: StoredUser): UserRecord {
  const roles = [Role.ESTUDIANTE];
  if (user.rol === DatabaseRole.PROFESOR) roles.push(Role.PROFESOR);
  if (user.rol === DatabaseRole.ADMIN) roles.push(Role.ADMIN);
  return {
    id: user.id_usuario,
    nombre: user.nombre,
    apellido: user.apellido,
    correo: user.correo,
    idCarrera: user.id_carrera,
    semestre: user.semestre,
    rol: user.rol,
    roles,
    passwordHash: user.password_hash,
    active: user.estado === UserStatus.ACTIVO,
  };
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    nombre: user.nombre,
    apellido: user.apellido,
    correo: user.correo,
    idCarrera: user.idCarrera,
    semestre: user.semestre,
    rol: user.rol,
    roles: [...user.roles],
  };
}
