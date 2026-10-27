import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './config/configure-app';
import { Environment } from './config/environment';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    bodyParser: true,
  });
  configureApp(app);
  app.enableShutdownHooks();
  const config = app.get(ConfigService<Environment, true>);
  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap().catch(() => {
  // Nest informa errores de configuracion sin incluir valores sensibles.
  console.error(
    'No se pudo iniciar el backend. Revise la configuracion local y el puerto.',
  );
  process.exitCode = 1;
});
