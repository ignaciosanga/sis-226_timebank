import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
import { IdempotencyHeader } from '../exchanges/exchanges.controller';
import { ExchangesService } from '../exchanges/exchanges.service';
import { PublicUser } from '../users/user.types';
import { GrantCreditsDto } from './dto/grant-credits.dto';
import {
  AccountResponse,
  GrantCreditsResponse,
  MovementResponse,
} from '../exchanges/dto/exchange-responses.dto';

@ApiTags('Créditos de tiempo')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@ApiBadRequestResponse()
@ApiConflictResponse()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('credits')
export class CreditsController {
  constructor(private readonly exchanges: ExchangesService) {}
  @Get('me')
  @ApiOkResponse({ type: AccountResponse })
  @Roles(Role.ESTUDIANTE)
  me(@CurrentUser() user: PublicUser) {
    return this.exchanges.getAccount(user.id);
  }
  @Get('me/movements')
  @ApiOkResponse({ type: MovementResponse, isArray: true })
  @Roles(Role.ESTUDIANTE)
  movements(@CurrentUser() user: PublicUser) {
    return this.exchanges.listMovements(user.id);
  }
  @Post('grants')
  @ApiCreatedResponse({ type: GrantCreditsResponse })
  @Roles(Role.ADMIN)
  @IdempotencyHeader()
  @ApiOperation({
    summary:
      'Carga de créditos exclusiva para pruebas locales por ADMIN; no representa dinero ni saldo de bienvenida',
  })
  grant(
    @CurrentUser() user: PublicUser,
    @Body() input: GrantCreditsDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.exchanges.grantCredits(user.id, input, key);
  }
}
