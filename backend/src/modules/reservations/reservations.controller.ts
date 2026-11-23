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
  ApiOperation,
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
  @ApiOperation({
    summary:
      'Confirmar participacion y liquidar al recibir ambas confirmaciones',
    description:
      'Bearer de un participante, cuerpo {} e Idempotency-Key. Solo despues del fin. La primera confirmacion mantiene Confirmada y la retencion; la segunda consume y transfiere una sola vez RESERVAS.creditos y devuelve Completada. Repetir una persona no sustituye a la otra. Reservas de oferta o fraccionarias requieren esquema decimal compatible; en esquema entero devuelven 409 DECIMAL_SETTLEMENT_PENDING. La cancelacion ya comprometida impide pagar.',
  })
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
  @ApiOperation({
    summary: 'Cancelar y liberar exactamente el importe retenido',
    description:
      'Una sola Liberacion por el importe de la reserva, sin pago al tutor. Participantes antes del inicio; despues requiere ADMIN. El horario de una oferta vuelve a estar disponible. Reintentos no repiten la liberacion.',
  })
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
