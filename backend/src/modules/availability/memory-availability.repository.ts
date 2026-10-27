import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AvailabilityStatus } from '../../common/enums/record-status.enum';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../exchanges/exchange.repository';
import { ExchangeState, ReservationStatus } from '../exchanges/exchange.types';
import { MemoryExchangeRepository } from '../exchanges/memory-exchange.repository';
import { availabilityInterval } from './availability-interval';
import {
  AvailabilityInterval,
  AvailabilityPatch,
  AvailabilityRepository,
} from './availability.repository';
import { Availability } from './availability.types';

@Injectable()
export class MemoryAvailabilityRepository implements AvailabilityRepository {
  constructor(
    @Inject(EXCHANGE_REPOSITORY)
    private readonly persistence: ExchangeRepository = new MemoryExchangeRepository(),
  ) {}

  findActiveByUser(userId: string): Promise<Availability[]> {
    return this.persistence.read((state) =>
      [...state.availability.values()]
        .filter(
          (record) =>
            record.id_usuario === userId &&
            record.estado !== AvailabilityStatus.CANCELADO,
        )
        .sort((a, b) => a.fecha_inicio.getTime() - b.fecha_inicio.getTime()),
    );
  }
  findById(id: string): Promise<Availability | null> {
    return this.persistence.read((state) => state.availability.get(id) ?? null);
  }
  private assertNoOverlap(
    state: ExchangeState,
    userId: string,
    interval: AvailabilityInterval,
    exceptId?: string,
  ): void {
    if (
      [...state.availability.values()].some(
        (record) =>
          record.id_usuario === userId &&
          record.estado !== AvailabilityStatus.CANCELADO &&
          record.id_disponibilidad !== exceptId &&
          interval.fecha_inicio < record.fecha_fin &&
          interval.fecha_fin > record.fecha_inicio,
      )
    )
      throw new ConflictException(
        'El horario se superpone con otra disponibilidad activa',
      );
  }
  private assertReservationsCovered(
    state: ExchangeState,
    id: string,
    interval?: AvailabilityInterval,
  ): void {
    const uncovered = [...state.reservations.values()].some(
      (record) =>
        state.reservationMetadata.get(record.id_reserva)?.availabilityId ===
          id &&
        record.estado === ReservationStatus.CONFIRMADA &&
        (!interval ||
          record.fecha_inicio < interval.fecha_inicio ||
          record.fecha_fin > interval.fecha_fin),
    );
    if (uncovered)
      throw new ConflictException(
        'La disponibilidad respalda una reserva activa; cancela la reserva antes de quitar su horario',
      );
  }
  create(userId: string, input: AvailabilityInterval): Promise<Availability> {
    return this.persistence.transaction((state) => {
      const interval = availabilityInterval(
        input.fecha_inicio,
        input.fecha_fin,
      );
      this.assertNoOverlap(state, userId, interval);
      const record: Availability = {
        ...interval,
        id_disponibilidad: randomUUID(),
        id_usuario: userId,
        estado: AvailabilityStatus.DISPONIBLE,
      };
      state.availability.set(record.id_disponibilidad, record);
      return record;
    });
  }
  updateOwned(
    id: string,
    userId: string,
    patch: AvailabilityPatch,
  ): Promise<Availability | null> {
    return this.persistence.transaction((state) => {
      const record = state.availability.get(id);
      if (
        !record ||
        record.id_usuario !== userId ||
        record.estado === AvailabilityStatus.CANCELADO
      )
        return null;
      if (patch.fecha_inicio === undefined && patch.fecha_fin === undefined)
        throw new BadRequestException('Debes indicar fechaInicio o fechaFin');
      const interval = availabilityInterval(
        patch.fecha_inicio ?? record.fecha_inicio,
        patch.fecha_fin ?? record.fecha_fin,
      );
      this.assertNoOverlap(state, userId, interval, id);
      this.assertReservationsCovered(state, id, interval);
      const updated = { ...record, ...interval };
      state.availability.set(id, updated);
      return updated;
    });
  }
  deactivateOwned(id: string, userId: string): Promise<boolean> {
    return this.persistence.transaction((state) => {
      const record = state.availability.get(id);
      if (!record || record.id_usuario !== userId) return false;
      this.assertReservationsCovered(state, id);
      state.availability.set(id, {
        ...record,
        estado: AvailabilityStatus.CANCELADO,
      });
      return true;
    });
  }
}
