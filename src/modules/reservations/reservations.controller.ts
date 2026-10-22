import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
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
import { EmptyBodyPipe } from '../../common/pipes/empty-body.pipe';
import { IdempotencyHeader } from '../exchanges/exchanges.controller';
import { ExchangesService } from '../exchanges/exchanges.service';
import { PublicUser } from '../users/user.types';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { ReservationResponse } from '../exchanges/dto/exchange-responses.dto';

@ApiTags('Reservas')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@ApiBadRequestResponse()
@ApiConflictResponse()
@ApiNotFoundResponse()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ESTUDIANTE, Role.ADMIN)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly exchanges: ExchangesService) {}
  @Get('me')
  @ApiOkResponse({ type: ReservationResponse, isArray: true })
  mine(@CurrentUser() user: PublicUser) {
    return this.exchanges.listReservations(user.id);
  }
  @Get(':id')
  @ApiOkResponse({ type: ReservationResponse })
  get(@CurrentUser() user: PublicUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exchanges.getReservation(user.id, id);
  }
  @Post(':id/confirm')
  @ApiOkResponse({ type: ReservationResponse })
  @HttpCode(200)
  @IdempotencyHeader()
  confirm(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(EmptyBodyPipe) body: unknown,
    @Headers('idempotency-key') key?: string,
  ) {
    void body;
    return this.exchanges.confirmReservation(user.id, id, key);
  }
  @Post(':id/cancel')
  @ApiOkResponse({ type: ReservationResponse })
  @HttpCode(200)
  @IdempotencyHeader()
  cancel(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CancelReservationDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.exchanges.cancelReservation(user.id, id, input.motivo, key);
  }
}
