import { DatabaseRole, Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/record-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../../common/dto/list-query.dto';

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

export class AdminUsersPage {
  @ApiProperty({ type: () => AdminUser, isArray: true })
  data!: AdminUser[];
  @ApiProperty({ type: PaginationMeta })
  meta!: PaginationMeta;
}

export interface UserRecord extends PublicUser {
  passwordHash: string;
  active: boolean;
  estado?: UserStatus;
  fechaRegistro?: Date;
  ultimoAcceso?: Date | null;
}

/** Proyeccion administrativa: estado y fechas sin saldos ni secretos. */
export class AdminUser extends PublicUser {
  @ApiProperty({ enum: UserStatus })
  estado!: UserStatus;
  @ApiProperty({ type: String, format: 'date-time' })
  fechaRegistro!: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  ultimoAcceso!: Date | null;
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
    estado: user.estado,
    fechaRegistro: user.fecha_registro,
    ultimoAcceso: user.ultimo_acceso,
  };
}

export function toAdminUser(user: UserRecord): AdminUser {
  return {
    ...toPublicUser(user),
    estado:
      user.estado ?? (user.active ? UserStatus.ACTIVO : UserStatus.INACTIVO),
    fechaRegistro: user.fechaRegistro ?? new Date(0),
    ultimoAcceso: user.ultimoAcceso ?? null,
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
