import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class EmptyBodyPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (value === undefined) return value;
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length
    )
      throw new BadRequestException(
        'Esta operacion no admite propiedades en el cuerpo',
      );
    return value;
  }
}
