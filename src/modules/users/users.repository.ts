import { Role } from '../../common/enums/role.enum';
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
}

export class EmailAlreadyExistsError extends Error {}

export type CreateStudentProfile = Omit<CreateStudent, 'initialCredits'>;

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
}
