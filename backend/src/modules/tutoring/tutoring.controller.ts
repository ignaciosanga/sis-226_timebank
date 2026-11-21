import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IdempotencyHeader } from '../exchanges/exchanges.controller';
import { PublicUser } from '../users/user.types';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferPage, OfferResponse } from './dto/offer-response.dto';
import { TutoringService } from './tutoring.service';

@ApiTags('Ofertas de tutoria')
@Controller('tutoring/offers')
export class TutoringController {
  constructor(private readonly tutoring: TutoringService) {}
  @Get()
  @ApiOperation({
    summary:
      'Catalogo publico de ofertas vigentes; page, limit y search opcional',
  })
  @ApiOkResponse({ type: OfferPage })
  list(@Query() query: ListQueryDto) {
    return this.tutoring.list(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @IdempotencyHeader()
  @ApiOperation({
    summary:
      'Publicar una clase con precio total exacto y crear su horario en una transaccion; no mueve creditos',
  })
  @ApiCreatedResponse({ type: OfferResponse })
  @ApiUnauthorizedResponse({
    description: 'Sesion invalida o cuenta pendiente/inactiva',
  })
  @ApiForbiddenResponse({
    description: 'La habilidad no pertenece al tutor autenticado',
  })
  @ApiBadRequestResponse({
    description:
      'Precio textual positivo, enteros o decimas; DTO/intervalo invalido',
  })
  @ApiConflictResponse({
    description:
      'Oferta activa duplicada, nivel/horario incompatible o clave reutilizada con otro contenido',
  })
  publish(
    @CurrentUser() user: PublicUser,
    @Body() input: CreateOfferDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.tutoring.publish(user.id, input, key);
  }
}
