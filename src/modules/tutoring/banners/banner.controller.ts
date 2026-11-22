import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { IdempotencyHeader } from '../../exchanges/exchanges.controller';
import { PublicUser } from '../../users/user.types';
import { TutoringBannerService } from './banner.service';
import { BannerUpload, MAX_BANNER_BYTES } from './banner.types';

export class BannerUploadResponse {
  @ApiProperty({
    format: 'uri',
    description:
      'Referencia propia para bannerUrl de la oferta; disponible publicamente al publicar. Caduca en 24h si no se utiliza.',
  })
  url!: string;
}

@ApiTags('Ofertas de tutorias')
@Controller('tutoring/banners')
export class TutoringBannerController {
  constructor(private readonly banners: TutoringBannerService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('banner', {
      limits: { fileSize: MAX_BANNER_BYTES, files: 1, fields: 0, parts: 1 },
    }),
  )
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @IdempotencyHeader()
  @ApiOperation({
    summary: 'Cargar un banner propio JPG, PNG o WebP de hasta 3 MiB',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['banner'],
      properties: { banner: { type: 'string', format: 'binary' } },
      additionalProperties: false,
    },
  })
  @ApiCreatedResponse({ type: BannerUploadResponse })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiConflictResponse()
  upload(
    @CurrentUser() actor: PublicUser,
    @UploadedFile() file: BannerUpload | undefined,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.banners.upload(actor.id, file, key);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Leer la imagen de una oferta publicada activa' })
  @ApiOkResponse({
    content: {
      'image/jpeg': { schema: { type: 'string', format: 'binary' } },
      'image/png': { schema: { type: 'string', format: 'binary' } },
      'image/webp': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiNotFoundResponse()
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const image = await this.banners.get(id);
    response.setHeader('Content-Type', image.mime);
    response.setHeader('Content-Length', image.bytes.length);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${image.filename}"`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.setHeader('Cache-Control', 'public, max-age=300');
    response.send(image.bytes);
  }
}
