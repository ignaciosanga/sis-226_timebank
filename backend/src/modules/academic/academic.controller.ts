import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RoadmapResponse } from './academic.responses';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PublicUser } from '../users/user.types';
import {
  AcademicPeriodDto,
  ClassesQueryDto,
  CurriculumQueryDto,
  RoadmapUpdateDto,
} from './academic.dto';
import { AcademicRepository } from './academic.repository';

@ApiTags('Pensum y Mi ruta')
@ApiServiceUnavailableResponse({
  description:
    'Requiere PostgreSQL y propuesta académica aprobada, migrada y cargada',
})
@Controller()
export class AcademicController {
  constructor(private readonly academic: AcademicRepository) {}
  @Get('curricula/systems')
  @ApiOperation({
    summary: 'Pensum por código, área y semestre; MAT-030 externo',
  })
  curriculum(@Query() query: CurriculumQueryDto) {
    return this.academic.curriculum(query);
  }
  @Get('roadmap/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: RoadmapResponse })
  @ApiOperation({
    summary:
      'Declaraciones manuales propias del currículo systems, disponible a cualquier carrera',
  })
  roadmap(@CurrentUser() user: PublicUser) {
    return this.academic.roadmap(user.id);
  }
  @Put('roadmap/me/courses/:codigo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: RoadmapResponse })
  @ApiOperation({
    summary:
      'Actualiza solo una materia; pending elimina la declaración; no exige prerrequisitos',
  })
  update(
    @CurrentUser() user: PublicUser,
    @Param('codigo') code: string,
    @Body() input: RoadmapUpdateDto,
  ) {
    return this.academic.updateRoadmap(user.id, code, input);
  }
  @Get('intercambios/mis-clases')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Clases completadas propias y resumen Aprendí/Enseñé; créditos como texto exacto',
  })
  classes(@CurrentUser() user: PublicUser, @Query() query: ClassesQueryDto) {
    return this.academic.classes(user.id, query);
  }
}

@ApiTags('Indicadores académicos ADMIN')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('analytics')
export class AcademicAnalyticsController {
  constructor(private readonly academic: AcademicRepository) {}
  @Get('academic')
  @ApiOperation({
    summary:
      'Command Center: demanda observada, cobertura y proyección etiquetada',
  })
  command(@Query() query: AcademicPeriodDto) {
    return this.academic.commandCenter(query);
  }
  @Get('reputation')
  @ApiOperation({
    summary:
      'Ranking descriptivo por tutor/materia; Knowledge Score pendiente del PO',
  })
  ranking(@Query() query: AcademicPeriodDto) {
    return this.academic.ranking(query);
  }
  @Get('economy')
  @ApiOperation({
    summary:
      'Distribución de precios, horarios y cuentas sin movimientos; solo lectura',
  })
  economy(@Query() query: AcademicPeriodDto) {
    return this.academic.economy(query);
  }
}
