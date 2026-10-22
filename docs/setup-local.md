# Ejecución local

## Requisitos y comandos

Se verificó Node 24.21.0 y npm 11.19.0. El proyecto limita Node a la línea 24 LTS y npm a la línea 11 para mantener el mismo entorno que Docker. PostgreSQL no es necesario para health ni para las pruebas actuales.

```powershell
npm.cmd ci
npm.cmd run setup:env
npm.cmd run start:dev
```

Para ejecutar JavaScript compilado:

```powershell
npm.cmd run build
npm.cmd start
Invoke-RestMethod http://localhost:4000/health
```

setup:env usa creación exclusiva: nunca sobrescribe .env. Genera una clave JWT aleatoria de 48 bytes, no la imprime y deja PostgreSQL deshabilitado. .env está excluido de Git, Prettier y del contexto Docker. No compartirlo.

## Variables de entorno

| Variable               | Valor inicial / requisito                                                |
| ---------------------- | ------------------------------------------------------------------------ |
| NODE_ENV               | development, test o production                                           |
| PORT                   | 4000; entero 1–65535                                                     |
| CORS_ORIGINS           | Orígenes HTTP/HTTPS completos separados por coma; sin comodines ni rutas |
| RATE_LIMIT_TTL_MS      | 60000; milisegundos positivos                                            |
| RATE_LIMIT_MAX         | 100; peticiones positivas por ruta/IP y ventana                          |
| JWT_SECRET             | Obligatoria; al menos 32 caracteres; rechaza marcadores de ejemplo       |
| JWT_EXPIRES_IN_SECONDS | 900; entero entre 1 y 86400                                              |
| JWT_ISSUER             | banco-tiempo-backend                                                     |
| JWT_AUDIENCE           | banco-tiempo-clients                                                     |
| DATABASE_URL           | Vacía hasta recibir conexión PostgreSQL autorizada                       |
| DATABASE_ENABLED       | false; aceptar únicamente true o false                                   |
| SWAGGER_ENABLED        | true; permite desactivar la documentación                                |

La validación señala nombres de variables inválidas, sin mostrar sus valores. Si una variable ya está en el entorno del proceso tiene prioridad sobre .env. Un secreto inválido impide arrancar; no hay una clave de respaldo.

CORS permite acceso desde http://localhost:3000 y http://localhost:5173 por defecto. Clientes sin Origin, como curl, no dependen de CORS. El servidor no confía en X-Forwarded-For por defecto; configurar proxies explícitos antes de usarlo detrás de uno. El throttling actual está en memoria por proceso y se reinicia al reiniciar el backend.

## Conectar el esquema oficial de BD

1. Solicitar SQL/DBML definitivo y conexión autorizada de desarrollo al equipo de BD. Confirmar mayúsculas, esquema PostgreSQL, tipos, enums, defaults, índices y restricciones.
2. Configurar DATABASE_URL en .env con esa conexión. No colocar la URL en comandos compartidos ni documentación. Mantener DATABASE_ENABLED=false durante el análisis.
3. Ejecutar los comandos siguientes únicamente después de verificar el destino de desarrollo autorizado.

```powershell
npm.cmd run prisma:introspect
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run build
```

prisma db pull lee la BD y modifica el schema local; no aplica migraciones. Revisar el diff local y conservar moduleFormat = "cjs" y output = "../src/generated/prisma". El generador prisma-client produce TypeScript que se compila junto con src. La URL de conexión vive en prisma.config.ts (Prisma 7), no en datasource db del schema.

El schema actual no contiene modelos. No se genera ni se afirma haber generado un cliente utilizable contra las 18 tablas. Instalar @prisma/client no sustituye la introspección y generación oficial.

4. Implementar el repositorio tipado usando el cliente generado, vincular USERS_REPOSITORY en UsersModule y sustituir el límite de ciclo de vida de PrismaService por el cliente tipado. El cargador diferido actual prepara el arranque sin esquema; no es un repositorio.
5. Traducir tipos de ID a identificadores opacos de la aplicación, estado oficial a active y roles oficiales a Role. Verificar correo único e índices de insensibilidad a mayúsculas con BD.
6. Implementar y probar la transacción de creación de usuario, rol y cuenta. No aceptar ADMIN ni créditos del body.
7. Confirmar política inicial con el PO y proporcionar REGISTRATION_POLICY. No hay un saldo predeterminado.
8. Ejecutar pruebas reales aisladas de integración y habilitar los controladores previstos. DATABASE_ENABLED=true permite solicitar conexión diferida, pero **no registra endpoints ni implementa repositorios**.

No ejecutar db push, migrate dev, migrate reset ni SQL destructivo. Las migraciones oficiales pertenecen al equipo de BD. Si se recibe solo SQL, analizarlo y coordinar una instancia de desarrollo antes de conectar.

## Docker Compose

Desde la raíz, con Docker Desktop / motor Docker activo:

```powershell
npm.cmd run setup:env
docker compose config --quiet
docker compose up --build
docker compose down
```

Compose publica solo 127.0.0.1:4000, monta el código, mantiene node_modules Linux en un volumen y ejecuta como usuario node con recarga. Si cambia package-lock.json, actualizar el volumen de dependencias mediante docker compose run --rm backend npm ci y reconstruir la imagen.

No se agrega un PostgreSQL alternativo ni se importa SQL automáticamente. Para una BD local autorizada en el host, la dirección desde Docker Desktop suele ser host.docker.internal; confirmar la URL y las reglas de red con BD.

Dockerfile tiene targets development, build y runtime. El target runtime se prepara con docker build --target runtime -t banco-tiempo-backend:local . y necesita las variables de entorno al arrancar. No contiene secretos ni ejecuta migraciones.

Durante esta entrega el CLI Docker 29.8.2 y Compose 5.5.1 estaban instalados, pero el motor no respondía. La construcción y ejecución de imágenes quedan pendientes hasta iniciarlo.
