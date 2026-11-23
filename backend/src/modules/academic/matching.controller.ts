import {
  ServiceUnavailableException,
  BadRequestException,
  Controller,
  Get,
  Injectable,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsUUID, Matches } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PublicUser } from '../users/user.types';

export class MatchingQuery {
  @ApiProperty({ format: 'uuid' }) @IsUUID() skillId!: string;
  @ApiPropertyOptional({
    description: 'ISO-8601 con zona; enviar ambas fechas',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  fechaInicio?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  fechaFin?: string;
  @ApiPropertyOptional({
    enum: ['Presencial', 'Virtual', 'Hibrida', 'Cualquiera'],
  })
  @IsOptional()
  @IsIn(['Presencial', 'Virtual', 'Hibrida', 'Cualquiera'])
  modalidad?: string;
}

@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}
  async recommend(actor: string, query: MatchingQuery) {
    const start = query.fechaInicio ? new Date(query.fechaInicio) : null;
    const end = query.fechaFin ? new Date(query.fechaFin) : null;
    if (
      !!start !== !!end ||
      (start &&
        end &&
        (!Number.isFinite(+start) ||
          !Number.isFinite(+end) ||
          +start <= Date.now() ||
          +end <= +start))
    )
      throw new BadRequestException(
        'Indica ambas fechas futuras con inicio anterior al fin',
      );
    const db = await this.prisma.connect();
    return db.$transaction(
      async (tx) => {
        const skill = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT h.id_habilidad id FROM "HABILIDADES" h JOIN "CATEGORIAS" c USING(id_categoria) WHERE h.id_habilidad=$1::uuid AND h.estado='activo' AND c.estado='activo'`,
          query.skillId,
        );
        if (!skill.length)
          throw new BadRequestException('Habilidad inexistente o inactiva');
        const [installed] = await tx.$queryRawUnsafe<{ ready: boolean }[]>(
          "SELECT to_regprocedure('public.fn_obtener_top_tutores(uuid,timestamp with time zone,timestamp with time zone,text)') IS NOT NULL AS ready",
        );
        if (!installed?.ready)
          throw new ServiceUnavailableException(
            'Matching de BD no instalado: requiere fn_obtener_top_tutores',
          );
        const data = await tx.$queryRawUnsafe(
          `SELECT m.id_tutor tutor_id,m.nombre_tutor,m.afinidad::float afinidad
        FROM public.fn_obtener_top_tutores($1::uuid,$2::timestamptz,$3::timestamptz,$4::text) m
        WHERE m.id_tutor<>$5::uuid
        AND ($2::timestamptz IS NULL OR (
          EXISTS(SELECT 1 FROM "DISPONIBILIDADES" d WHERE d.id_usuario=m.id_tutor AND d.estado='disponible' AND d.fecha_inicio<=$2 AND d.fecha_fin>=$3)
          AND NOT EXISTS(SELECT 1 FROM "RESERVAS" r WHERE r.estado='Confirmada' AND r.fecha_inicio<$3 AND r.fecha_fin>$2
          AND (r.id_ofertante IN (m.id_tutor,$5::uuid) OR r.id_solicitante IN (m.id_tutor,$5::uuid)))))
        ORDER BY m.afinidad DESC,m.nombre_tutor,m.id_tutor`,
          query.skillId,
          start,
          end,
          query.modalidad ?? null,
          actor,
        );
        return {
          skillId: query.skillId,
          modelo: 'skillswap-v4-afinidad-100',
          data,
          aviso:
            'Recomendación; la contratación vuelve a validar horario y saldo. Modalidad puntúa experiencia previa, no garantiza modalidad futura.',
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}

@ApiTags('Matching')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tutoring')
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}
  @Get('recommendations')
  @ApiOperation({
    summary:
      'Hasta tres tutores por afinidad de BD; excluye la cuenta propia y conflictos del horario solicitado',
  })
  recommend(@CurrentUser() user: PublicUser, @Query() query: MatchingQuery) {
    return this.matching.recommend(user.id, query);
  }
}
