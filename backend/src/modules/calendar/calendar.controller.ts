import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PublicUser } from '../users/user.types';
import { CalendarService } from './calendar.service';

@ApiTags('Google Calendar')
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Post('reservations/:id/authorization-url')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ESTUDIANTE)
  @ApiBearerAuth()
  @ApiOkResponse({
    description:
      'URL de Google solicitada solamente al agregar una reserva Confirmada al calendario',
  })
  authorizationUrl(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendar.authorizationUrl(user.id, id);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (!code || !state)
      throw new BadRequestException('Autorizacion de Google incompleta');
    const result = await this.calendar.createEvent(code, state);
    response.redirect(this.calendar.frontendResultUrl(result));
  }
}
