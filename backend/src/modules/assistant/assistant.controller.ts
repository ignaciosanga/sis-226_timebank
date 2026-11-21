import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AssistantService } from './assistant.service';
import { AskAssistantDto, AssistantAnswerDto } from './dto/ask-assistant.dto';

@ApiTags('Asistente IA')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('ask')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOkResponse({ type: AssistantAnswerDto })
  @ApiTooManyRequestsResponse({
    description: 'Más de 10 preguntas por minuto desde la misma conexión',
  })
  @ApiServiceUnavailableResponse({
    description: 'Asistente sin configurar u ocupado',
  })
  @ApiBadGatewayResponse({ description: 'El modelo no respondió' })
  ask(@Body() body: AskAssistantDto) {
    return this.assistant.ask(body);
  }
}
