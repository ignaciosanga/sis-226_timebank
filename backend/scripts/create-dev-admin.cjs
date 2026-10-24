require('reflect-metadata');
const { randomBytes } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const { AppModule } = require('../dist/app.module');
const { AuthService } = require('../dist/modules/auth/auth.service');
const { USERS_REPOSITORY } = require('../dist/modules/users/users.repository');

async function main() {
  const correo = process.argv[2];
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
    throw new Error('Uso: npm run admin:local -- admin@example.test');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    const config = app.get(ConfigService);
    if (
      config.get('NODE_ENV') !== 'development' ||
      config.get('PERSISTENCE_MODE') !== 'prisma'
    )
      throw new Error(
        'Requiere NODE_ENV=development y PERSISTENCE_MODE=prisma.',
      );
    const repository = app.get(USERS_REPOSITORY);
    if (await repository.findByEmail(correo.toLowerCase()))
      throw new Error(
        'El correo ya existe; este comando no modifica usuarios existentes.',
      );
    const password = randomBytes(24).toString('base64url');
    const user = await app.get(AuthService).register({
      nombre: 'Admin',
      apellido: 'Desarrollo',
      correo,
      password,
      idCarrera: '30000000-0000-4000-8000-000000000001',
      semestre: 1,
    });
    await repository.grantDevelopmentAdmin(user.id);
    console.log(
      `ADMIN local creado: ${correo}\nPassword aleatoria: ${password}\nAutenticar con POST /auth/login. Guardar la clave localmente.`,
    );
  } finally {
    await app.close();
  }
}
void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'No se pudo crear ADMIN local.',
  );
  process.exitCode = 1;
});
