import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PublicUser } from '../users/user.types';
import { CreateUserSkillDto } from './dto/create-user-skill.dto';
import { PublishedUserSkill, UserSkill } from './user-skill.types';
import { UserSkillsService } from './user-skills.service';

@ApiTags('Habilidades de estudiantes')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiNotFoundResponse()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UserSkillsController {
  constructor(private readonly skills: UserSkillsService) {}
  @Get('me/skills')
  @Roles(Role.ESTUDIANTE)
  @ApiOkResponse({ type: PublishedUserSkill, isArray: true })
  mine(@CurrentUser() user: PublicUser) {
    return this.skills.list(user.id);
  }
  @Post('me/skills')
  @Roles(Role.ESTUDIANTE)
  @ApiCreatedResponse({ type: UserSkill })
  @ApiConflictResponse()
  @ApiForbiddenResponse()
  add(@CurrentUser() user: PublicUser, @Body() input: CreateUserSkillDto) {
    return this.skills.add(user.id, input);
  }
  @Delete('me/skills/:skillId')
  @Roles(Role.ESTUDIANTE)
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: PublicUser,
    @Param('skillId', ParseUUIDPipe) skillId: string,
  ) {
    return this.skills.remove(user.id, skillId);
  }
  @Get(':id/skills')
  @ApiOkResponse({ type: PublishedUserSkill, isArray: true })
  published(@Param('id', ParseUUIDPipe) id: string) {
    return this.skills.list(id);
  }
}
