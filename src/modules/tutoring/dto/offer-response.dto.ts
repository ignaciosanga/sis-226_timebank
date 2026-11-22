import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../../../common/dto/list-query.dto';
import { SkillLevel } from '../../user-skills/user-skill.types';

export class OfferResponse {
  @ApiProperty({ format: 'uuid' }) id_oferta!: string;
  @ApiProperty({ format: 'uuid' }) id_usuario!: string;
  @ApiProperty({ format: 'uuid' }) id_tutor!: string;
  @ApiProperty({ format: 'uuid' }) id_habilidad!: string;
  @ApiProperty({ format: 'uuid' }) id_disponibilidad!: string;
  @ApiProperty({ enum: SkillLevel }) nivel!: SkillLevel;
  @ApiProperty() titulo!: string;
  @ApiProperty() descripcion!: string;
  @ApiProperty({ type: String, example: '3.7' }) costo_creditos!: string;
  @ApiProperty({ type: String, nullable: true }) bannerUrl!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) fecha_inicio!: string;
  @ApiProperty({ type: String, format: 'date-time' }) fecha_fin!: string;
  @ApiProperty({
    type: Object,
    example: { id: 'UUID', nombre: 'Ana', apellido: 'Perez' },
  })
  tutor!: object;
  @ApiProperty({
    type: Object,
    example: { id_habilidad: 'UUID', nombre: 'Programacion' },
  })
  materia!: object;
  @ApiProperty({
    type: Object,
    example: { promedio: null, opiniones: 0, tutorias_completadas: 0 },
  })
  metricas!: object;
}

export class OfferPage {
  @ApiProperty({ type: OfferResponse, isArray: true }) data!: OfferResponse[];
  @ApiProperty({ type: PaginationMeta }) meta!: PaginationMeta;
}
