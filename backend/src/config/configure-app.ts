import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Environment } from './environment';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Environment, true>);
  app.use(helmet());
  app.enableCors({
    origin: config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim()),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );
  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Banco de Tiempo Universitario')
        .setDescription(
          'v0.4, fase 5: cuentas institucionales, ofertas, solicitudes con precio pactado, retencion, cancelacion y doble confirmacion con pago exacto. El pago usa RESERVAS.creditos tras terminar la clase y recibir ambas confirmaciones. Ofertas y fracciones requieren esquema decimal compatible; la base entera mantiene OFFER_PRICE_FLOW_PENDING para contratar y DECIMAL_SETTLEMENT_PENDING para liquidar reservas de oferta. Importes financieros en JSON como strings.',
        )
        .setVersion('0.4.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: false },
    });
  }
}
