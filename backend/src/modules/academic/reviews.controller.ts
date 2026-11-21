import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewPage, ReviewResponse } from './academic.responses';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { IdempotencyHeader } from '../exchanges/exchanges.controller';
import { PublicUser } from '../users/user.types';
import { ReviewDto, ReviewsQueryDto } from './academic.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Opiniones y reputación')
@Controller('tutoring')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}
  @Get('reviews/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: ReviewPage })
  @ApiOperation({ summary: 'Opiniones escritas por la cuenta autenticada' })
  mine(@CurrentUser() user: PublicUser, @Query() query: ListQueryDto) {
    return this.reviews.list(query, user.id);
  }
  @Get('reviews')
  @ApiOkResponse({ type: ReviewPage })
  @ApiOperation({
    summary:
      'Opiniones válidas por tutor y materia; sin identidad del evaluador',
  })
  list(@Query() query: ReviewsQueryDto) {
    return this.reviews.list(query, undefined, query);
  }
  @Get('reputation')
  @ApiOperation({
    summary:
      'Media, opiniones y clases completadas por tutor/materia; sin score no aprobado',
  })
  reputation(@Query() query: ReviewsQueryDto) {
    return this.reviews.reputation(query);
  }
  @Post('reservations/:id/review')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @IdempotencyHeader()
  @ApiCreatedResponse({ type: ReviewResponse })
  @ApiOperation({
    summary:
      'Calificar una reserva completada; solo solicitante, una opinión y replay seguro',
  })
  create(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReviewDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.reviews.create(user.id, id, input, key);
  }
}
