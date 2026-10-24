import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('Analytics (Dashboard)')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse({ description: 'Requiere rol ADMIN' })
@ApiBadRequestResponse({ description: 'Fechas o parámetros inválidos' })
@ApiServiceUnavailableResponse({
  description: 'Disponible solo con PERSISTENCE_MODE=prisma',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @ApiOkResponse({ description: 'Resumen general; saldos actuales separados' })
  @ApiOperation({
    summary: 'Resumen general: usuarios, intercambios y créditos del periodo',
  })
  overview(@Query() query: AnalyticsQueryDto) {
    return this.analytics.overview(query);
  }

  @Get('users')
  @ApiOkResponse({ description: 'Agregados de usuarios sin datos personales' })
  @ApiOperation({ summary: 'Usuarios por estado, carrera y registros' })
  users(@Query() query: AnalyticsQueryDto) {
    return this.analytics.users(query);
  }

  @Get('exchanges')
  @ApiOkResponse({ description: 'Solicitudes, reservas, tasas y series' })
  @ApiOperation({ summary: 'Solicitudes, reservas y cancelaciones' })
  exchanges(@Query() query: AnalyticsQueryDto) {
    return this.analytics.exchanges(query);
  }

  @Get('credits')
  @ApiOkResponse({ description: 'Créditos como strings enteros' })
  @ApiOperation({ summary: 'Créditos transferidos, liberados, bonos y retenidos' })
  credits(@Query() query: AnalyticsQueryDto) {
    return this.analytics.credits(query);
  }

  @Get('skills')
  @ApiOkResponse({ description: 'Rankings limitados por `limit`' })
  @ApiOperation({ summary: 'Habilidades y categorías más solicitadas' })
  skills(@Query() query: AnalyticsQueryDto) {
    return this.analytics.skills(query);
  }
}
