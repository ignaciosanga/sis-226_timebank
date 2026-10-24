import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSkillDto } from './dto/create-skill.dto';
import { SkillsQueryDto } from './dto/skills-query.dto';
import { Skill, SkillsPage } from './skill.types';
import { SkillsService } from './skills.service';

@ApiTags('Habilidades')
@Controller('skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}
  @Get()
  @ApiOkResponse({ type: SkillsPage })
  @ApiOperation({
    summary:
      'Habilidades activas; filtros search/categoryId y paginación { data, meta }',
  })
  list(@Query() query: SkillsQueryDto) {
    return this.skills.list(query);
  }
  @Get(':id')
  @ApiOkResponse({ type: Skill })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.skills.requireActive(id);
  }
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: Skill })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Categoría inexistente o inactiva' })
  @ApiConflictResponse()
  create(@Body() input: CreateSkillDto) {
    return this.skills.create(input);
  }
}
