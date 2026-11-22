import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiProperty,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ListQueryDto, PaginationMeta } from '../../common/dto/list-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EmptyBodyPipe } from '../../common/pipes/empty-body.pipe';
import { PublicUser } from '../users/user.types';
import { NotificationType } from './notification.types';
import { NotificationsService } from './notifications.service';

class NotificationResponse {
  @ApiProperty({ format: 'uuid' })
  id_notificacion!: string;
  @ApiProperty({
    enum: Object.values(NotificationType),
    example: NotificationType.SOLICITUD_RECIBIDA,
  })
  tipo!: string;
  @ApiProperty()
  titulo!: string;
  @ApiProperty()
  mensaje!: string;
  @ApiProperty()
  leida!: boolean;
  @ApiProperty({ type: String, format: 'date-time' })
  created_at!: Date;
}

class MarkAllNotificationsResponse {
  @ApiProperty({ type: 'integer', minimum: 0, example: 3 })
  actualizadas!: number;
}

class NotificationPageMeta extends PaginationMeta {
  @ApiProperty()
  noLeidas!: number;
}

class NotificationsPageResponse {
  @ApiProperty({ type: NotificationResponse, isArray: true })
  data!: NotificationResponse[];
  @ApiProperty({ type: NotificationPageMeta })
  meta!: NotificationPageMeta;
}

@ApiTags('Notificaciones')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('me')
  @ApiOkResponse({ type: NotificationsPageResponse })
  @ApiOperation({
    summary: 'Consultar las notificaciones propias, más recientes primero',
  })
  list(@CurrentUser() user: PublicUser, @Query() query: ListQueryDto) {
    return this.notifications.listForUser(user.id, query);
  }

  @Patch(':id/read')
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiOkResponse({ type: NotificationResponse })
  @ApiOperation({ summary: 'Marcar una notificación propia como leída' })
  markRead(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(EmptyBodyPipe) body: unknown,
  ) {
    void body;
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiBadRequestResponse()
  @ApiOkResponse({ type: MarkAllNotificationsResponse })
  @ApiOperation({
    summary: 'Marcar como leídas todas las notificaciones propias',
  })
  markAllRead(
    @CurrentUser() user: PublicUser,
    @Body(EmptyBodyPipe) body: unknown,
  ) {
    void body;
    return this.notifications.markAllRead(user.id);
  }
}
