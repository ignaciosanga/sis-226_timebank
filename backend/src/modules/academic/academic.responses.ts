import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../../common/dto/list-query.dto';

export class RoadmapResponse {
  @ApiProperty({ example: 'systems' }) curriculum!: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string', enum: ['approved', 'current'] },
    example: { 'SIS-111': 'approved' },
  })
  courses!: Record<string, string>;
}
export class ReviewResponse {
  @ApiProperty({ format: 'uuid' }) id_calificacion!: string;
  @ApiProperty({ format: 'uuid' }) id_reserva!: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) calificacion!: number;
  @ApiProperty({ maxLength: 500 }) comentario!: string;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: Date;
}
export class ReviewPage {
  @ApiProperty({ type: ReviewResponse, isArray: true }) data!: ReviewResponse[];
  @ApiProperty({ type: PaginationMeta }) meta!: PaginationMeta;
}
