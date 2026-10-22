import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { Environment } from '../../config/environment';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

class HealthResponse {
  @ApiProperty({ example: 'ok' }) status!: string;
  @ApiProperty({ example: 'banco-tiempo-backend' }) service!: string;
}

class ReadinessResponse {
  @ApiProperty({ example: 'ok' }) status!: string;
  @ApiProperty({ enum: ['memory', 'postgresql'] }) persistence!: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness del proceso; no comprueba PostgreSQL' })
  @ApiOkResponse({ type: HealthResponse })
  check(): HealthResponse {
    return { status: 'ok', service: 'banco-tiempo-backend' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Comprueba conexion y presencia de las 12 tablas' })
  @ApiOkResponse({ type: ReadinessResponse })
  @ApiServiceUnavailableResponse({
    description: 'PostgreSQL o esquema no disponible',
  })
  async ready(): Promise<ReadinessResponse> {
    if (this.config.get('PERSISTENCE_MODE', { infer: true }) === 'memory')
      return { status: 'ok', persistence: 'memory' };
    try {
      const client = await this.prisma.connect();
      const [result] = await client.$queryRaw<{ total: number }[]>`
        SELECT count(*)::int AS total FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name IN (
          'CARRERAS', 'CATEGORIAS', 'USUARIOS', 'HABILIDADES',
          'USUARIO_HABILIDADES', 'DISPONIBILIDADES', 'SOLICITUDES_INTERCAMBIO',
          'RESERVAS', 'MOVIMIENTOS_CREDITO', 'CALIFICACIONES',
          'NOTIFICACIONES', 'AUDITORIA'
        )
      `;
      if (result?.total !== 12) throw new Error('Esquema incompleto');
      return { status: 'ok', persistence: 'postgresql' };
    } catch {
      throw new ServiceUnavailableException(
        'PostgreSQL o esquema no disponible',
      );
    }
  }
}
