import { BadRequestException } from '@nestjs/common';
import { AvailabilityInterval } from './availability.repository';

export function availabilityInterval(
  start: string | Date,
  end: string | Date,
): AvailabilityInterval {
  const fecha_inicio = new Date(start);
  const fecha_fin = new Date(end);
  if (
    !Number.isFinite(fecha_inicio.getTime()) ||
    !Number.isFinite(fecha_fin.getTime()) ||
    fecha_fin <= fecha_inicio
  )
    throw new BadRequestException('fechaFin debe ser posterior a fechaInicio');
  return { fecha_inicio, fecha_fin };
}
