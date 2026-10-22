import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';

class HealthResponse {
  @ApiProperty({ example: 'ok' }) status!: string;
  @ApiProperty({ example: 'banco-tiempo-backend' }) service!: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness del proceso; no comprueba PostgreSQL' })
  @ApiOkResponse({ type: HealthResponse })
  check(): HealthResponse {
    return { status: 'ok', service: 'banco-tiempo-backend' };
  }
}
