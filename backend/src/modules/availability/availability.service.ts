import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AvailabilityStatus } from '../../common/enums/record-status.enum';
import { UsersService } from '../users/users.service';
import {
  AVAILABILITY_REPOSITORY,
  AvailabilityRepository,
} from './availability.repository';
import {
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
} from './dto/availability.dto';
import { availabilityInterval } from './availability-interval';
import { AvailabilityPatch } from './availability.repository';

@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(AVAILABILITY_REPOSITORY)
    private readonly repository: AvailabilityRepository,
    private readonly users: UsersService,
  ) {}
  async list(userId: string) {
    await this.users.requirePublishedStudent(userId);
    return this.repository.findActiveByUser(userId);
  }
  async create(authenticatedId: string, input: CreateAvailabilityDto) {
    await this.users.requirePublishedStudent(authenticatedId);
    return this.repository.create(
      authenticatedId,
      availabilityInterval(input.fechaInicio, input.fechaFin),
    );
  }
  private async requireOwned(id: string, userId: string) {
    const record = await this.repository.findById(id);
    if (!record) throw new NotFoundException('Disponibilidad no encontrada');
    if (record.id_usuario !== userId)
      throw new ForbiddenException(
        'Solo puedes modificar tus propias disponibilidades',
      );
    return record;
  }
  async update(
    authenticatedId: string,
    id: string,
    input: UpdateAvailabilityDto,
  ) {
    await this.users.requirePublishedStudent(authenticatedId);
    if (input.fechaInicio === undefined && input.fechaFin === undefined)
      throw new BadRequestException('Debes indicar fechaInicio o fechaFin');
    const record = await this.requireOwned(id, authenticatedId);
    if (record.estado === AvailabilityStatus.CANCELADO)
      throw new ConflictException('La disponibilidad esta inactiva');
    const patch: AvailabilityPatch = {};
    if (input.fechaInicio !== undefined)
      patch.fecha_inicio = new Date(input.fechaInicio);
    if (input.fechaFin !== undefined)
      patch.fecha_fin = new Date(input.fechaFin);
    const updated = await this.repository.updateOwned(
      id,
      authenticatedId,
      patch,
    );
    if (!updated)
      throw new ConflictException('La disponibilidad ya no esta activa');
    return updated;
  }
  async deactivate(authenticatedId: string, id: string): Promise<void> {
    await this.users.requirePublishedStudent(authenticatedId);
    await this.requireOwned(id, authenticatedId);
    if (!(await this.repository.deactivateOwned(id, authenticatedId)))
      throw new NotFoundException('Disponibilidad no encontrada');
  }
}
