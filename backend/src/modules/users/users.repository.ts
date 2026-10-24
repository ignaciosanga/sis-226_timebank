import { DatabaseRole, Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/record-status.enum';
import { UserRecord } from './user.types';
import { UpdateProfileDto } from './dto/update-profile.dto';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface CreateStudent {
  nombre: string;
  apellido: string;
  correo: string;
  passwordHash: string;
  idCarrera: string;
  semestre: number;
  role: Role.ESTUDIANTE;
  initialCredits: string;
  /** ID del ADMIN que da de alta; registra ADMIN_USER_CREATE en la misma transaccion. */
  createdBy?: string;
}

export class EmailAlreadyExistsError extends Error {}

export type CreateStudentProfile = Omit<CreateStudent, 'initialCredits'>;

export interface AdminUsersFilter {
  search?: string;
  estado?: UserStatus;
  rol?: DatabaseRole;
  idCarrera?: string;
}

export type AdminUserStatus = UserStatus.ACTIVO | UserStatus.INACTIVO;

export interface UsersRepository {
  /** Una fila USUARIOS con rol y saldos integrados; saldo inicial cero. */
  createStudentProfile(input: CreateStudentProfile): Promise<UserRecord>;
  findByEmail(correo: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  /** Alias compatible de registro anterior. Ahora solo escribe USUARIOS.
   * initialCredits es entero de una politica interna; nunca del body HTTP.
   */
  createStudentWithAccount(input: CreateStudent): Promise<UserRecord>;
  /** Comprobar estado activo en la misma operacion de escritura. */
  updateActiveProfile(
    id: string,
    input: UpdateProfileDto,
  ): Promise<UserRecord | null>;
  /** Actualizar ultimo_acceso solo si sigue activo; devolver false si dejo de estarlo. */
  recordActiveLogin(id: string, at: Date): Promise<boolean>;
  /** Listado administrativo ordenado por fecha de registro descendente. */
  listForAdmin(filter: AdminUsersFilter): Promise<UserRecord[]>;
  /**
   * Baja logica o reactivacion validada y auditada en una sola transaccion.
   * Lanza NotFound/Conflict segun las reglas de negocio; nunca borra filas.
   */
  setStatusByAdmin(
    adminId: string,
    userId: string,
    estado: AdminUserStatus,
    motivo?: string,
  ): Promise<UserRecord>;
}
