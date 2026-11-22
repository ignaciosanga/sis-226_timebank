import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PublicUser } from '../users/user.types';
import { AssistantService } from './assistant.service';
import {
  AskAssistantDto,
  AssistantAnswerDto,
  AssistantAvatarDto,
  AssistantKeyDto,
  AssistantProfileDto,
} from './dto/ask-assistant.dto';

@ApiTags('Asistente IA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('ask')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOkResponse({ type: AssistantAnswerDto })
  @ApiTooManyRequestsResponse({
    description:
      'Se acabaron los mensajes gratis del día (ASSISTANT_QUOTA_EXCEEDED) o más de 10 por minuto',
  })
  @ApiServiceUnavailableResponse({
    description: 'Asistente sin configurar u ocupado',
  })
  @ApiBadGatewayResponse({ description: 'El modelo no respondió' })
  ask(@CurrentUser() user: PublicUser, @Body() body: AskAssistantDto) {
    return this.assistant.ask(user.id, body);
  }

  @Get('me')
  @ApiOkResponse({ type: AssistantProfileDto })
  profile(@CurrentUser() user: PublicUser) {
    return this.assistant.profile(user.id);
  }

  @Put('me/avatar')
  @ApiOkResponse({ type: AssistantProfileDto })
  saveAvatar(
    @CurrentUser() user: PublicUser,
    @Body() body: AssistantAvatarDto,
  ) {
    return this.assistant.saveAvatar(user.id, body);
  }

  @Put('me/key')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOkResponse({
    type: AssistantProfileDto,
    description:
      'Comprueba la key con Groq y la guarda cifrada; nunca se devuelve',
  })
  saveKey(@CurrentUser() user: PublicUser, @Body() body: AssistantKeyDto) {
    return this.assistant.saveKey(user.id, body);
  }

  @Delete('me/key')
  @ApiOkResponse({ type: AssistantProfileDto })
  clearKey(@CurrentUser() user: PublicUser) {
    return this.assistant.clearKey(user.id);
  }
}
