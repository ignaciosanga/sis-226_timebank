import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { AvailabilityService } from './availability.service';
import { Availability } from './availability.types';
import {
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
} from './dto/availability.dto';

@ApiTags('Disponibilidad')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ESTUDIANTE)
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}
  @Post()
  @ApiCreatedResponse({ type: Availability })
  @ApiBadRequestResponse()
  @ApiConflictResponse({ description: 'Horario duplicado o superpuesto' })
  create(
    @CurrentUser() user: PublicUser,
    @Body() input: CreateAvailabilityDto,
  ) {
    return this.availability.create(user.id, input);
  }
  @Get('me')
  @ApiOkResponse({ type: Availability, isArray: true })
  mine(@CurrentUser() user: PublicUser) {
    return this.availability.list(user.id);
  }
  @Patch(':id')
  @ApiOkResponse({ type: Availability })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  update(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateAvailabilityDto,
  ) {
    return this.availability.update(user.id, id, input);
  }
  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({
    description: 'Desactivada; borrado lógico idempotente',
  })
  @ApiNotFoundResponse()
  remove(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.availability.deactivate(user.id, id);
  }
}

@ApiTags('Disponibilidad')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class PublishedAvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}
  @Get(':id/availability')
  @ApiOkResponse({ type: Availability, isArray: true })
  @ApiNotFoundResponse({
    description: 'Estudiante inexistente, inactivo o sin rol ESTUDIANTE',
  })
  published(@Param('id', ParseUUIDPipe) id: string) {
    return this.availability.list(id);
  }
}
