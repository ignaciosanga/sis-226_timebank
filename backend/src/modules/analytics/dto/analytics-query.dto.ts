import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export type GroupBy = 'day' | 'month';

/** Periodo [from, to); por defecto los ultimos 30 dias hasta ahora. */
export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Inicio ISO-8601 con zona horaria (incluido)',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Fin ISO-8601 con zona horaria (excluido)',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({ enum: ['day', 'month'], default: 'day' })
  @IsOptional()
  @IsIn(['day', 'month'])
  groupBy: GroupBy = 'day';

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}

export interface Period {
  from: Date;
  to: Date;
}
