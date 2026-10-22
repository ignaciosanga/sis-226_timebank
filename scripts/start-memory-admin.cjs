// Servidor de desarrollo con un ADMIN efimero y clave aleatoria por ejecucion.
require('reflect-metadata');
const { randomBytes } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/config/configure-app');
const { AuthService } = require('../dist/modules/auth/auth.service');
const { USERS_REPOSITORY } = require('../dist/modules/users/users.repository');

async function main() {
  const correo = process.argv[2];
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
    throw new Error('Uso: npm run start:memory-admin -- admin@example.test');
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  try {
    const config = app.get(ConfigService);
    if (
      config.get('NODE_ENV') !== 'development' ||
      config.get('PERSISTENCE_MODE') !== 'memory'
    )
      throw new Error(
        'Este comando requiere NODE_ENV=development y PERSISTENCE_MODE=memory',
      );
    configureApp(app);
    app.enableShutdownHooks();
    const password = randomBytes(24).toString('base64url');
    const user = await app.get(AuthService).register({
      nombre: 'Admin',
      apellido: 'Desarrollo',
      correo,
      password,
      idCarrera: '30000000-0000-4000-8000-000000000001',
      semestre: 1,
    });
    await app.get(USERS_REPOSITORY).grantDevelopmentAdmin(user.id);
    await app.listen(config.get('PORT'), '127.0.0.1');
    console.log(
      `ADMIN temporal: ${correo}\nPassword aleatoria: ${password}\nUtilice POST /auth/login. Los datos se pierden al detener el proceso.`,
    );
  } catch (error) {
    await app.close();
    throw error;
  }
}
void main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'No se pudo iniciar el servidor local',
  );
  process.exitCode = 1;
});
