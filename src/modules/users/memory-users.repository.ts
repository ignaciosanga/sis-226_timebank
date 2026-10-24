import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  RecordStatus,
  UserStatus,
} from '../../common/enums/record-status.enum';
import { DatabaseRole } from '../../common/enums/role.enum';
import {
  CAREERS_REPOSITORY,
  CareersRepository,
} from '../careers/careers.repository';
import { MemoryCareersRepository } from '../careers/memory-careers.repository';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../exchanges/exchange.repository';
import { MemoryExchangeRepository } from '../exchanges/memory-exchange.repository';
import {
  AdminAuditEntry,
  ExchangeState,
  ReservationStatus,
} from '../exchanges/exchange.types';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  AdminUsersFilter,
  AdminUserStatus,
  CreateStudent,
  CreateStudentProfile,
  EmailAlreadyExistsError,
  UsersRepository,
} from './users.repository';

function recordAdminAudit(
  state: ExchangeState,
  entry: Omit<AdminAuditEntry, 'id_auditoria' | 'entidad' | 'created_at'>,
): void {
  const id_auditoria = randomUUID();
  state.adminAudit.set(id_auditoria, {
    id_auditoria,
    entidad: 'USUARIOS',
    created_at: new Date(),
    ...entry,
  });
}
import { adaptStoredUser, StoredUser, UserRecord } from './user.types';

@Injectable()
export class MemoryUsersRepository implements UsersRepository {
  constructor(
    @Inject(EXCHANGE_REPOSITORY)
    private readonly persistence: ExchangeRepository = new MemoryExchangeRepository(),
    @Inject(CAREERS_REPOSITORY)
    private readonly careers: CareersRepository = new MemoryCareersRepository(),
  ) {}
  async findByEmail(correo: string): Promise<UserRecord | null> {
    return this.persistence.read((state) => {
      const row = [...state.users.values()].find(
        (user) => user.correo === correo.trim().toLowerCase(),
      );
      return row ? adaptStoredUser(row) : null;
    });
  }
  async findById(id: string): Promise<UserRecord | null> {
    return this.persistence.read((state) => {
      const row = state.users.get(id);
      return row ? adaptStoredUser(row) : null;
    });
  }
  private async requireCareer(id: string): Promise<void> {
    const row = await this.careers.findById(id);
    if (!row || row.estado !== RecordStatus.ACTIVO)
      throw new NotFoundException('Carrera activa no encontrada');
  }
  createStudentProfile(input: CreateStudentProfile): Promise<UserRecord> {
    return this.create(input, 0);
  }
  createStudentWithAccount(input: CreateStudent): Promise<UserRecord> {
    const initial = Number(input.initialCredits);
    if (
      !/^\d+$/.test(input.initialCredits) ||
      !Number.isInteger(initial) ||
      initial < 0 ||
      initial > 2147483647
    )
      throw new BadRequestException(
        'El saldo inicial debe ser un entero PostgreSQL no negativo',
      );
    return this.create(input, initial);
  }
  private async create(
    input: CreateStudentProfile,
    initial: number,
  ): Promise<UserRecord> {
    await this.requireCareer(input.idCarrera);
    return this.persistence.transaction((state) => {
      const correo = input.correo.trim().toLowerCase();
      if ([...state.users.values()].some((user) => user.correo === correo))
        throw new EmailAlreadyExistsError();
      const row: StoredUser = {
        id_usuario: randomUUID(),
        nombre: input.nombre,
        apellido: input.apellido,
        correo,
        password_hash: input.passwordHash,
        rol: DatabaseRole.ESTUDIANTE,
        id_carrera: input.idCarrera,
        semestre: input.semestre,
        saldo: initial,
        creditos_retenidos: 0,
        fecha_registro: new Date(),
        ultimo_acceso: null,
        estado: UserStatus.ACTIVO,
      };
      state.users.set(row.id_usuario, row);
      if (initial > 0) {
        const movement = {
          id_movimiento: randomUUID(),
          id_usuario: row.id_usuario,
          id_reserva: null,
          tipo: 'BonoInicial' as const,
          cantidad: initial,
          saldo_anterior: 0,
          saldo_posterior: initial,
          retenidos_anterior: 0,
          retenidos_posterior: 0,
          created_at: new Date(),
          descripcion: 'Politica interna de registro',
        };
        state.movements.set(movement.id_movimiento, movement);
      }
      if (input.createdBy)
        recordAdminAudit(state, {
          id_usuario: input.createdBy,
          accion: 'ADMIN_USER_CREATE',
          entidad_id: row.id_usuario,
          datos_anteriores: null,
          datos_nuevos: {
            correo: row.correo,
            rol: row.rol,
            estado: row.estado,
            saldo_inicial: initial,
          },
        });
      return adaptStoredUser(row);
    });
  }
  async listForAdmin(filter: AdminUsersFilter): Promise<UserRecord[]> {
    const search = filter.search?.trim().toLowerCase();
    return this.persistence.read((state) =>
      [...state.users.values()]
        .filter(
          (row) =>
            (!filter.estado || row.estado === filter.estado) &&
            (!filter.rol || row.rol === filter.rol) &&
            (!filter.idCarrera || row.id_carrera === filter.idCarrera) &&
            (!search ||
              `${row.nombre} ${row.apellido} ${row.correo}`
                .toLowerCase()
                .includes(search)),
        )
        .sort((a, b) => b.fecha_registro.getTime() - a.fecha_registro.getTime())
        .map(adaptStoredUser),
    );
  }
  setStatusByAdmin(
    adminId: string,
    userId: string,
    estado: AdminUserStatus,
    motivo?: string,
  ): Promise<UserRecord> {
    return this.persistence.transaction((state) => {
      const row = state.users.get(userId);
      if (!row) throw new NotFoundException('Usuario no encontrado');
      const previous = row.estado;
      if (previous === estado)
        throw new ConflictException(`El usuario ya se encuentra ${estado}`);
      if (estado === UserStatus.INACTIVO) {
        if (userId === adminId)
          throw new ConflictException(
            'Un administrador no puede desactivar su propia cuenta',
          );
        if (previous !== UserStatus.ACTIVO)
          throw new ConflictException(
            'Solo se pueden desactivar usuarios en estado Activo',
          );
        if (
          row.rol === DatabaseRole.ADMIN &&
          ![...state.users.values()].some(
            (user) =>
              user.id_usuario !== userId &&
              user.rol === DatabaseRole.ADMIN &&
              user.estado === UserStatus.ACTIVO,
          )
        )
          throw new ConflictException(
            'No se puede desactivar al ultimo administrador activo',
          );
        const activeReservations = [...state.reservations.values()].filter(
          (reservation) =>
            reservation.estado === ReservationStatus.CONFIRMADA &&
            (reservation.id_solicitante === userId ||
              reservation.id_ofertante === userId),
        ).length;
        if (activeReservations > 0)
          throw new ConflictException(
            `El usuario tiene ${activeReservations} reserva(s) confirmada(s) pendientes de resolucion`,
          );
        if (row.creditos_retenidos > 0)
          throw new ConflictException(
            'El usuario tiene creditos retenidos pendientes de liberacion',
          );
      } else if (previous !== UserStatus.INACTIVO)
        throw new ConflictException(
          'Solo se pueden reactivar usuarios en estado Inactivo; las suspensiones requieren autorizacion especial',
        );
      row.estado = estado;
      recordAdminAudit(state, {
        id_usuario: adminId,
        accion:
          estado === UserStatus.INACTIVO
            ? 'ADMIN_USER_DEACTIVATE'
            : 'ADMIN_USER_REACTIVATE',
        entidad_id: userId,
        datos_anteriores: { estado: previous },
        datos_nuevos: { estado, ...(motivo ? { motivo } : {}) },
      });
      return adaptStoredUser(row);
    });
  }
  async updateActiveProfile(
    id: string,
    input: UpdateProfileDto,
  ): Promise<UserRecord | null> {
    if (input.idCarrera !== undefined)
      await this.requireCareer(input.idCarrera);
    return this.persistence.transaction((state) => {
      const row = state.users.get(id);
      if (!row || row.estado !== UserStatus.ACTIVO) return null;
      if (input.nombre !== undefined) row.nombre = input.nombre;
      if (input.apellido !== undefined) row.apellido = input.apellido;
      if (input.idCarrera !== undefined) row.id_carrera = input.idCarrera;
      if (input.semestre !== undefined) row.semestre = input.semestre;
      return adaptStoredUser(row);
    });
  }
  recordActiveLogin(id: string, at: Date): Promise<boolean> {
    return this.persistence.transaction((state) => {
      const row = state.users.get(id);
      if (!row || row.estado !== UserStatus.ACTIVO) return false;
      row.ultimo_acceso = new Date(at);
      return true;
    });
  }
  async grantDevelopmentRole(id: string, role: DatabaseRole): Promise<void> {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Roles de desarrollo no disponibles');
    await this.persistence.transaction((state) => {
      const row = state.users.get(id);
      if (!row) throw new NotFoundException('Usuario no encontrado');
      row.rol = role;
    });
  }
  grantDevelopmentAdmin(id: string): Promise<void> {
    return this.grantDevelopmentRole(id, DatabaseRole.ADMIN);
  }
}
