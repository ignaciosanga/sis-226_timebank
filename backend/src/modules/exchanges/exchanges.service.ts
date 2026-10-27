import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { isDate } from 'node:util/types';
import { Role } from '../../common/enums/role.enum';
import { AvailabilityStatus } from '../../common/enums/record-status.enum';
import { availabilityInterval } from '../availability/availability-interval';
import { GrantCreditsDto } from '../credits/dto/grant-credits.dto';
import { UsersService } from '../users/users.service';
import type { StoredUser } from '../users/user.types';
import { SkillsService } from '../skills/skills.service';
import {
  formatCredits,
  MAX_CREDITS,
  parseCredits,
  reservationCost,
} from './credits';
import { CreateExchangeDto } from './dto/create-exchange.dto';
import { EXCHANGE_REPOSITORY, ExchangeRepository } from './exchange.repository';
import {
  ExchangeRequest,
  ExchangeState,
  Movement,
  RequestStatus,
  Reservation,
  ReservationStatus,
} from './exchange.types';
import { inspectIntegrity } from './integrity';

@Injectable()
export class ExchangesService {
  constructor(
    @Inject(EXCHANGE_REPOSITORY)
    private readonly persistence: ExchangeRepository,
    private readonly users: UsersService,
    private readonly skills: SkillsService,
  ) {}

  private transaction<T>(
    work: (state: ExchangeState) => Promise<T> | T,
  ): Promise<T> {
    return this.persistence.transaction(async (state) => {
      const result = await work(state);
      if (inspectIntegrity(state).length)
        throw new ConflictException(
          'Inconsistencia de reservas o creditos; la operacion fue revertida',
        );
      return result;
    });
  }
  private fingerprint(input: unknown): string {
    const canonical = (value: unknown): unknown => {
      if (isDate(value)) return value.toISOString();
      if (Array.isArray(value)) return value.map(canonical);
      if (value && typeof value === 'object')
        return Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, entry]) => [key, canonical(entry)]),
        );
      return value;
    };
    return createHash('sha256')
      .update(JSON.stringify(canonical(input)))
      .digest('hex');
  }
  private async operation<T>(
    actor: string,
    operation: string,
    key: string | undefined,
    payload: unknown,
    work: (state: ExchangeState) => Promise<T> | T,
  ): Promise<T> {
    if (!key || !/^[A-Za-z0-9._:-]{16,128}$/.test(key))
      throw new BadRequestException(
        'Idempotency-Key requerida: 16 a 128 caracteres alfanumericos o . _ : -',
      );
    await this.users.requireActive(actor);
    const fingerprint = this.fingerprint(payload);
    return this.transaction(async (state) => {
      await this.users.requireActive(actor);
      const scope = `${actor}:${operation}:${key}`;
      const previous = state.idempotency.get(scope);
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new ConflictException(
            'Idempotency-Key ya utilizada con otro contenido',
          );
        return structuredClone(previous.result) as T;
      }
      const result = await work(state);
      state.idempotency.set(scope, {
        fingerprint,
        result: structuredClone(result),
      });
      return result;
    });
  }
  private account(state: ExchangeState, userId: string): StoredUser {
    const account = state.users.get(userId);
    if (!account) throw new NotFoundException('Usuario no encontrado');
    if (account.estado !== 'Activo')
      throw new ConflictException('El usuario no esta activo');
    return account;
  }
  private accountView(account: StoredUser) {
    return {
      id_usuario: account.id_usuario,
      saldo: formatCredits(account.saldo),
      creditos_retenidos: formatCredits(account.creditos_retenidos),
      disponibles: formatCredits(account.saldo - account.creditos_retenidos),
      unidad: 'CREDITO_15_MINUTOS',
    };
  }
  private movement(
    state: ExchangeState,
    account: StoredUser,
    reservationId: string | null,
    tipo: Movement['tipo'],
    amount: number,
    description?: string,
  ): Movement {
    const before = {
      saldo: account.saldo,
      retenidos: account.creditos_retenidos,
    };
    if (tipo === 'Retencion') account.creditos_retenidos += amount;
    else if (tipo === 'Liberacion') account.creditos_retenidos -= amount;
    else {
      account.saldo += amount;
      if (tipo === 'Consumo') account.creditos_retenidos += amount;
    }
    const record: Movement = {
      id_movimiento: randomUUID(),
      id_usuario: account.id_usuario,
      id_reserva: reservationId,
      tipo,
      cantidad: amount,
      saldo_anterior: before.saldo,
      saldo_posterior: account.saldo,
      retenidos_anterior: before.retenidos,
      retenidos_posterior: account.creditos_retenidos,
      created_at: new Date(Date.now()),
      descripcion: description ?? null,
    };
    state.movements.set(record.id_movimiento, record);
    return record;
  }
  private movementView(record: Movement) {
    return { ...record, monto: formatCredits(record.cantidad) };
  }
  private requestView(state: ExchangeState, record: ExchangeRequest) {
    const metadata = state.requestMetadata.get(record.id_solicitud);
    return {
      ...record,
      id_disponibilidad: metadata?.availabilityId ?? null,
      descripcion: metadata?.descripcion ?? '',
      costo_creditos: formatCredits(record.creditos_requeridos),
    };
  }
  private reservationView(state: ExchangeState, record: Reservation) {
    const metadata = state.reservationMetadata.get(record.id_reserva);
    return {
      ...record,
      id_disponibilidad: metadata?.availabilityId ?? null,
      monto_creditos: formatCredits(record.creditos),
      confirmaciones: [
        {
          id_usuario: record.id_solicitante,
          fecha: record.confirmacion_solicitante_at,
        },
        {
          id_usuario: record.id_ofertante,
          fecha: record.confirmacion_ofertante_at,
        },
      ]
        .filter((item) => item.fecha !== null)
        .map((item) => ({ ...item, id_reserva: record.id_reserva })),
      cancelacion: record.cancelled_at
        ? {
            id_reserva: record.id_reserva,
            id_usuario: record.cancelado_por,
            motivo: record.motivo_cancelacion,
            fecha: record.cancelled_at,
            administrativa: metadata?.administrativa ?? false,
          }
        : null,
    };
  }
  private requireRequest(state: ExchangeState, id: string): ExchangeRequest {
    const record = state.requests.get(id);
    if (!record) throw new NotFoundException('Solicitud no encontrada');
    return record;
  }
  private requireReservation(state: ExchangeState, id: string): Reservation {
    const record = state.reservations.get(id);
    if (!record) throw new NotFoundException('Reserva no encontrada');
    return record;
  }
  private requireParticipant(
    record: { id_solicitante: string; id_ofertante: string },
    actor: string,
  ): void {
    if (record.id_solicitante !== actor && record.id_ofertante !== actor)
      throw new ForbiddenException(
        'Solo los participantes pueden acceder a la reserva',
      );
  }
  private requireFuture(start: Date): void {
    if (start.getTime() <= Date.now())
      throw new ConflictException('El horario solicitado ya comenzo');
  }
  private requireAvailability(
    state: ExchangeState,
    providerId: string,
    availabilityId: string,
    start: Date,
    end: Date,
  ): void {
    const availability = state.availability.get(availabilityId);
    if (
      !availability ||
      availability.id_usuario !== providerId ||
      availability.estado !== AvailabilityStatus.DISPONIBLE
    )
      throw new NotFoundException(
        'Disponibilidad activa del ofertante no encontrada',
      );
    if (start < availability.fecha_inicio || end > availability.fecha_fin)
      throw new ConflictException(
        'El intervalo no esta cubierto por la disponibilidad',
      );
  }
  private requireOffering(
    state: ExchangeState,
    providerId: string,
    skillId: string,
  ): void {
    if (!state.userSkills.has(`${providerId}:${skillId}`))
      throw new NotFoundException('El ofertante no publica esa habilidad');
  }
  private requireNoReservationConflict(
    state: ExchangeState,
    requester: string,
    provider: string,
    start: Date,
    end: Date,
  ): void {
    const participants = new Set([requester, provider]);
    const conflict = [...state.reservations.values()].some(
      (record) =>
        record.estado !== ReservationStatus.CANCELADA &&
        (participants.has(record.id_solicitante) ||
          participants.has(record.id_ofertante)) &&
        start < record.fecha_fin &&
        end > record.fecha_inicio,
    );
    if (conflict)
      throw new ConflictException(
        'Uno de los participantes ya tiene una reserva superpuesta',
      );
  }
  async createRequest(actor: string, input: CreateExchangeDto, key?: string) {
    const interval = availabilityInterval(input.fechaInicio, input.fechaFin);
    reservationCost(interval.fecha_inicio, interval.fecha_fin);
    if (input.providerId === actor)
      throw new BadRequestException(
        'No puedes solicitar un intercambio contigo mismo',
      );
    return this.operation(
      actor,
      'request-create',
      key,
      {
        ...input,
        descripcion: input.descripcion ?? '',
        fechaInicio: interval.fecha_inicio.toISOString(),
        fechaFin: interval.fecha_fin.toISOString(),
      },
      async (state) => {
        await this.users.requirePublishedStudent(actor);
        await this.users.requirePublishedStudent(input.providerId);
        await this.skills.requireActive(input.skillId);
        this.requireFuture(interval.fecha_inicio);
        this.requireOffering(state, input.providerId, input.skillId);
        this.requireAvailability(
          state,
          input.providerId,
          input.availabilityId,
          interval.fecha_inicio,
          interval.fecha_fin,
        );
        const record: ExchangeRequest = {
          id_solicitud: randomUUID(),
          id_solicitante: actor,
          id_ofertante: input.providerId,
          id_habilidad: input.skillId,
          fecha_inicio_propuesta: interval.fecha_inicio,
          fecha_fin_propuesta: interval.fecha_fin,
          creditos_requeridos: reservationCost(
            interval.fecha_inicio,
            interval.fecha_fin,
          ),
          estado: RequestStatus.PENDIENTE,
          created_at: new Date(Date.now()),
          respondida_at: null,
        };
        state.requests.set(record.id_solicitud, record);
        state.requestMetadata.set(record.id_solicitud, {
          availabilityId: input.availabilityId,
          descripcion: input.descripcion ?? '',
        });
        return this.requestView(state, record);
      },
    );
  }
  async listRequests(actor: string) {
    await this.users.requireActive(actor);
    return this.persistence.read((state) =>
      [...state.requests.values()]
        .filter(
          (record) =>
            record.id_solicitante === actor || record.id_ofertante === actor,
        )
        .map((record) => this.requestView(state, record)),
    );
  }
  acceptRequest(
    actor: string,
    id: string,
    key?: string,
    options?: {
      modalidad?: Reservation['modalidad'];
      lugar?: string;
    },
  ) {
    const modalidad = options?.modalidad ?? 'Virtual';
    const lugar = options?.lugar?.trim() || 'Por coordinar';
    return this.operation(
      actor,
      'request-accept',
      key,
      { id, modalidad, lugar },
      async (state) => {
        const request = this.requireRequest(state, id);
        if (request.id_ofertante !== actor)
          throw new ForbiddenException('Solo el ofertante puede aceptar');
        const existing = [...state.reservations.values()].find(
          (record) => record.id_solicitud === id,
        );
        if (existing) return this.reservationView(state, existing);
        if (request.estado !== RequestStatus.PENDIENTE)
          throw new ConflictException('La solicitud ya no esta pendiente');
        await this.users.requirePublishedStudent(request.id_solicitante);
        await this.users.requirePublishedStudent(request.id_ofertante);
        await this.skills.requireActive(request.id_habilidad);
        this.requireFuture(request.fecha_inicio_propuesta);
        this.requireOffering(state, request.id_ofertante, request.id_habilidad);
        const metadata = state.requestMetadata.get(id);
        if (!metadata)
          throw new ConflictException(
            'La solicitud no tiene disponibilidad asociada',
          );
        this.requireAvailability(
          state,
          request.id_ofertante,
          metadata.availabilityId,
          request.fecha_inicio_propuesta,
          request.fecha_fin_propuesta,
        );
        this.requireNoReservationConflict(
          state,
          request.id_solicitante,
          request.id_ofertante,
          request.fecha_inicio_propuesta,
          request.fecha_fin_propuesta,
        );
        const amount = reservationCost(
          request.fecha_inicio_propuesta,
          request.fecha_fin_propuesta,
        );
        if (amount !== request.creditos_requeridos)
          throw new ConflictException(
            'El costo de la solicitud es inconsistente',
          );
        const account = this.account(state, request.id_solicitante);
        this.account(state, request.id_ofertante);
        if (account.saldo - account.creditos_retenidos < amount)
          throw new ConflictException('Creditos disponibles insuficientes');
        const reservation: Reservation = {
          id_reserva: randomUUID(),
          id_solicitud: id,
          id_solicitante: request.id_solicitante,
          id_ofertante: request.id_ofertante,
          id_habilidad: request.id_habilidad,
          fecha_inicio: request.fecha_inicio_propuesta,
          fecha_fin: request.fecha_fin_propuesta,
          estado: ReservationStatus.CONFIRMADA,
          creditos: amount,
          modalidad,
          lugar,
          confirmacion_solicitante_at: null,
          confirmacion_ofertante_at: null,
          cancelado_por: null,
          motivo_cancelacion: null,
          horas_anticipacion_cancelacion: null,
          created_at: new Date(Date.now()),
          completed_at: null,
          cancelled_at: null,
        };
        state.reservations.set(reservation.id_reserva, reservation);
        state.reservationMetadata.set(reservation.id_reserva, {
          availabilityId: metadata.availabilityId,
          administrativa: false,
        });
        request.estado = RequestStatus.ACEPTADA;
        request.respondida_at = new Date(Date.now());
        this.movement(
          state,
          account,
          reservation.id_reserva,
          'Retencion',
          amount,
        );
        return this.reservationView(state, reservation);
      },
    );
  }
  rejectRequest(actor: string, id: string, key?: string) {
    return this.operation(actor, 'request-reject', key, { id }, (state) => {
      const record = this.requireRequest(state, id);
      if (record.id_ofertante !== actor)
        throw new ForbiddenException('Solo el ofertante puede rechazar');
      if (record.estado === RequestStatus.RECHAZADA)
        return this.requestView(state, record);
      if (record.estado !== RequestStatus.PENDIENTE)
        throw new ConflictException('La solicitud ya no esta pendiente');
      record.estado = RequestStatus.RECHAZADA;
      record.respondida_at = new Date(Date.now());
      return this.requestView(state, record);
    });
  }
  cancelRequest(actor: string, id: string, key?: string) {
    return this.operation(actor, 'request-cancel', key, { id }, (state) => {
      const record = this.requireRequest(state, id);
      if (record.id_solicitante !== actor)
        throw new ForbiddenException(
          'Solo el solicitante puede cancelar la solicitud',
        );
      if (record.estado === RequestStatus.CANCELADA)
        return this.requestView(state, record);
      if (record.estado !== RequestStatus.PENDIENTE)
        throw new ConflictException(
          'Para una solicitud aceptada debes cancelar su reserva',
        );
      record.estado = RequestStatus.CANCELADA;
      record.respondida_at = new Date(Date.now());
      return this.requestView(state, record);
    });
  }
  async listReservations(actor: string) {
    await this.users.requireActive(actor);
    return this.persistence.read((state) =>
      [...state.reservations.values()]
        .filter(
          (record) =>
            record.id_solicitante === actor || record.id_ofertante === actor,
        )
        .map((record) => this.reservationView(state, record)),
    );
  }
  async getReservation(actor: string, id: string) {
    await this.users.requireActive(actor);
    return this.persistence.read((state) => {
      const record = this.requireReservation(state, id);
      this.requireParticipant(record, actor);
      return this.reservationView(state, record);
    });
  }
  async getReservationCalendarDetails(actor: string, id: string) {
    const reservation = await this.getReservation(actor, id);
    const [skill, requester, provider, requestDescription] =
      await Promise.all([
        this.skills.requireActive(reservation.id_habilidad),
        this.users.repository.findById(reservation.id_solicitante),
        this.users.repository.findById(reservation.id_ofertante),
        this.persistence.read((state) =>
          reservation.id_solicitud
            ? (state.requestMetadata.get(reservation.id_solicitud)
                ?.descripcion ?? '')
            : '',
        ),
      ]);
    const fullName = (user: { nombre: string; apellido: string } | null) =>
      user ? `${user.nombre} ${user.apellido}` : 'Estudiante';
    return {
      reservation,
      skillName: skill.nombre,
      requesterName: fullName(requester),
      providerName: fullName(provider),
      requestDescription,
    };
  }
  confirmReservation(actor: string, id: string, key?: string) {
    return this.operation(
      actor,
      'reservation-confirm',
      key,
      { id },
      async (state) => {
        const record = this.requireReservation(state, id);
        this.requireParticipant(record, actor);
        if (record.estado === ReservationStatus.COMPLETADA)
          return this.reservationView(state, record);
        if (record.estado !== ReservationStatus.CONFIRMADA)
          throw new ConflictException('La reserva fue cancelada');
        if (Date.now() < record.fecha_fin.getTime())
          throw new ConflictException('La reserva aun no termino');
        await this.users.requirePublishedStudent(record.id_solicitante);
        await this.users.requirePublishedStudent(record.id_ofertante);
        if (actor === record.id_solicitante)
          record.confirmacion_solicitante_at ??= new Date(Date.now());
        else record.confirmacion_ofertante_at ??= new Date(Date.now());
        const both =
          record.confirmacion_solicitante_at &&
          record.confirmacion_ofertante_at;
        if (both) {
          const requester = this.account(state, record.id_solicitante);
          const provider = this.account(state, record.id_ofertante);
          if (
            requester.creditos_retenidos < record.creditos ||
            requester.saldo < record.creditos
          )
            throw new ConflictException('Retencion inconsistente');
          if (provider.saldo + record.creditos > MAX_CREDITS)
            throw new ConflictException(
              'La cuenta de destino excede el limite de creditos',
            );
          this.movement(state, requester, id, 'Consumo', -record.creditos);
          this.movement(state, provider, id, 'Transferencia', record.creditos);
          record.estado = ReservationStatus.COMPLETADA;
          record.completed_at = new Date(Date.now());
        }
        return this.reservationView(state, record);
      },
    );
  }
  cancelReservation(actor: string, id: string, reason: string, key?: string) {
    if (!reason?.trim() || reason.length > 500)
      throw new BadRequestException('Debes indicar un motivo valido');
    return this.operation(
      actor,
      'reservation-cancel',
      key,
      { id, motivo: reason.trim() },
      async (state) => {
        const user = await this.users.requireActive(actor);
        const record = this.requireReservation(state, id);
        const admin = user.roles.includes(Role.ADMIN);
        if (!admin) this.requireParticipant(record, actor);
        if (record.estado === ReservationStatus.CANCELADA)
          return this.reservationView(state, record);
        if (record.estado === ReservationStatus.COMPLETADA)
          throw new ConflictException(
            'Una reserva completada no se puede cancelar',
          );
        if (!admin && Date.now() >= record.fecha_inicio.getTime())
          throw new ConflictException(
            'Despues del inicio la cancelacion requiere ADMIN',
          );
        const account = this.account(state, record.id_solicitante);
        if (account.creditos_retenidos < record.creditos)
          throw new ConflictException('Retencion inconsistente');
        this.movement(state, account, id, 'Liberacion', record.creditos);
        record.estado = ReservationStatus.CANCELADA;
        record.cancelado_por = actor;
        record.motivo_cancelacion = reason.trim();
        record.cancelled_at = new Date(Date.now());
        record.horas_anticipacion_cancelacion = Math.max(
          0,
          Math.floor(
            (record.fecha_inicio.getTime() - record.cancelled_at.getTime()) /
              3_600_000,
          ),
        );
        const metadata = state.reservationMetadata.get(id);
        if (metadata)
          metadata.administrativa =
            admin &&
            actor !== record.id_solicitante &&
            actor !== record.id_ofertante;
        return this.reservationView(state, record);
      },
    );
  }
  async getAccount(actor: string) {
    await this.users.requirePublishedStudent(actor);
    return this.transaction((state) =>
      this.accountView(this.account(state, actor)),
    );
  }
  async listMovements(actor: string) {
    await this.users.requirePublishedStudent(actor);
    return this.persistence.read((state) => {
      return [...state.movements.values()]
        .filter((record) => record.id_usuario === actor)
        .map((record) => this.movementView(record));
    });
  }
  grantCredits(actor: string, input: GrantCreditsDto, key?: string) {
    return this.operation(
      actor,
      'development-grant',
      key,
      input,
      async (state) => {
        const user = await this.users.requireActive(actor);
        if (
          !user.roles.includes(Role.ADMIN) ||
          process.env.NODE_ENV === 'production'
        )
          throw new ForbiddenException(
            'Cargas disponibles solo para ADMIN en desarrollo y pruebas',
          );
        await this.users.requirePublishedStudent(input.userId);
        const amount = parseCredits(input.amount);
        if (amount <= 0)
          throw new BadRequestException('La carga debe ser mayor que cero');
        const account = this.account(state, input.userId);
        if (account.saldo + amount > MAX_CREDITS)
          throw new ConflictException('La cuenta excede el limite de creditos');
        const movement = this.movement(
          state,
          account,
          null,
          'Ajuste',
          amount,
          input.reason,
        );
        return {
          cuenta: this.accountView(account),
          movimiento: this.movementView(movement),
        };
      },
    );
  }
  async audit(actor: string) {
    const user = await this.users.requireActive(actor);
    if (!user.roles.includes(Role.ADMIN)) throw new ForbiddenException();
    return this.persistence.read((state) => {
      const issues = inspectIntegrity(state);
      return {
        status: issues.length ? 'inconsistente' : 'ok',
        scope: this.persistence.scope ?? 'memory-process',
        issues,
        counts: {
          solicitudes: state.requests.size,
          reservas: state.reservations.size,
          movimientos: state.movements.size,
          usuarios: state.users.size,
        },
      };
    });
  }
}
