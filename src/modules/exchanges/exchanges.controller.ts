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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
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
import { PublicUser } from '../users/user.types';
import { CreateExchangeDto } from './dto/create-exchange.dto';
import { ExchangesService } from './exchanges.service';
import {
  ExchangeRequestResponse,
  IntegrityResponse,
  ReservationResponse,
} from './dto/exchange-responses.dto';

export const IdempotencyHeader = () =>
  ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      '16–128 caracteres; conservar la misma clave al reintentar la misma operación',
  });

@ApiTags('Solicitudes de intercambio')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@ApiBadRequestResponse()
@ApiConflictResponse()
@ApiNotFoundResponse()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exchanges')
export class ExchangesController {
  constructor(private readonly exchanges: ExchangesService) {}
  @Post()
  @ApiCreatedResponse({ type: ExchangeRequestResponse })
  @Roles(Role.ESTUDIANTE)
  @IdempotencyHeader()
  @ApiOperation({
    summary:
      'Solicitar intercambio; no retiene créditos hasta que el ofertante acepte',
  })
  create(
    @CurrentUser() user: PublicUser,
    @Body() input: CreateExchangeDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.exchanges.createRequest(user.id, input, key);
  }
  @Get('me')
  @ApiOkResponse({ type: ExchangeRequestResponse, isArray: true })
  @Roles(Role.ESTUDIANTE)
  mine(@CurrentUser() user: PublicUser) {
    return this.exchanges.listRequests(user.id);
  }
  @Get('integrity')
  @ApiOkResponse({ type: IntegrityResponse })
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Auditoría de solo lectura: reservas simultáneas y coherencia de créditos en esta instancia',
  })
  audit(@CurrentUser() user: PublicUser) {
    return this.exchanges.audit(user.id);
  }
  @Post(':id/accept')
  @ApiOkResponse({ type: ReservationResponse })
  @Roles(Role.ESTUDIANTE)
  @HttpCode(200)
  @IdempotencyHeader()
  accept(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(EmptyBodyPipe) body: unknown,
    @Headers('idempotency-key') key?: string,
  ) {
    void body;
    return this.exchanges.acceptRequest(user.id, id, key);
  }
  @Post(':id/reject')
  @ApiOkResponse({ type: ExchangeRequestResponse })
  @Roles(Role.ESTUDIANTE)
  @HttpCode(200)
  @IdempotencyHeader()
  reject(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(EmptyBodyPipe) body: unknown,
    @Headers('idempotency-key') key?: string,
  ) {
    void body;
    return this.exchanges.rejectRequest(user.id, id, key);
  }
  @Post(':id/cancel')
  @ApiOkResponse({ type: ExchangeRequestResponse })
  @Roles(Role.ESTUDIANTE)
  @HttpCode(200)
  @IdempotencyHeader()
  cancel(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(EmptyBodyPipe) body: unknown,
    @Headers('idempotency-key') key?: string,
  ) {
    void body;
    return this.exchanges.cancelRequest(user.id, id, key);
  }
}
