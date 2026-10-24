import { Availability } from './availability.types';

export const AVAILABILITY_REPOSITORY = Symbol('AVAILABILITY_REPOSITORY');
export interface AvailabilityInterval {
  fecha_inicio: Date;
  fecha_fin: Date;
}
export type AvailabilityPatch = Partial<AvailabilityInterval>;
export interface AvailabilityRepository {
  findActiveByUser(userId: string): Promise<Availability[]>;
  findById(id: string): Promise<Availability | null>;
  /** Verificar solapamientos y escribir atomicamente, por usuario y estado ACTIVO. */
  create(userId: string, interval: AvailabilityInterval): Promise<Availability>;
  /** Combinar PATCH con el registro vigente, validar y escribir atomicamente.
   * Debe coordinarse tambien con reservas y otras disponibilidades del usuario.
   */
  updateOwned(
    id: string,
    userId: string,
    patch: AvailabilityPatch,
  ): Promise<Availability | null>;
  deactivateOwned(id: string, userId: string): Promise<boolean>;
}
