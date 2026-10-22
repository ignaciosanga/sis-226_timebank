# Banco de Tiempo Universitario — Backend

**Primera versión del equipo Backend · v0.1.0 · Rama `Backend`**

Backend del proyecto SIS-226 para intercambiar habilidades entre estudiantes utilizando créditos de tiempo. Esta entrega incluye la infraestructura HTTP y la base de seguridad, y prepara su integración con el esquema PostgreSQL del equipo de BD.

> **Estado real:** `GET /health` y Swagger están disponibles. Autenticación y perfil tienen servicios probados con repositorios simulados, pero sus endpoints todavía no están publicados. No hay operaciones reales de PostgreSQL ni gestión de créditos implementada.

## Contenido

- [Alcance](#alcance)
- [Tecnologías](#tecnologías)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Variables de entorno](#variables-de-entorno)
- [Arquitectura y estructura](#arquitectura-y-estructura)
- [Procesamiento de solicitudes](#procesamiento-de-solicitudes)
- [API](#api)
- [Autenticación, usuarios y roles](#autenticación-usuarios-y-roles)
- [Créditos de tiempo](#créditos-de-tiempo)
- [PostgreSQL y Prisma](#postgresql-y-prisma)
- [Pruebas](#pruebas)
- [Docker](#docker)
- [Colaboración y siguientes pasos](#colaboración-y-siguientes-pasos)
- [Resolución de problemas](#resolución-de-problemas)
- [Documentación](#documentación)

## Alcance

| Componente                                                  | Estado en v0.1.0                                        |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| NestJS, entorno validado y puerto 4000                      | Implementado                                            |
| Health y Swagger/OpenAPI                                    | Operativos sin PostgreSQL                               |
| Helmet, CORS, throttling y validación global                | Implementados                                           |
| Errores seguros y eliminación de contraseñas/hashes en JSON | Implementados                                           |
| Argon2id, JWT, Passport, guards y decorators RBAC           | Implementados y probados                                |
| Servicios de registro, login y perfil                       | Preparados; pruebas con repositorio simulado            |
| Endpoints Auth/Users                                        | No registrados; devuelven 404                           |
| Prisma 7 y adaptador PostgreSQL                             | Configurados; falta esquema oficial y cliente generado  |
| Repositorio real y transacciones                            | Pendientes                                              |
| Saldo inicial                                               | Pendiente del PO; el servicio de registro se bloquea    |
| Habilidades, horarios, intercambios y demás módulos         | Directorios documentados; reglas pendientes             |
| Reservas, confirmaciones, retenciones y transferencias      | Sin implementación de negocio                           |
| Dockerfile/Compose                                          | Preparados; configuración validada, ejecución pendiente |

Los módulos futuros no aparecen en Swagger como terminados. No hay una BD alternativa ni persistencia en memoria para simular el funcionamiento del producto.

## Tecnologías

| Área                   | Tecnología / versión instalada de referencia              |
| ---------------------- | --------------------------------------------------------- |
| Entorno                | Node.js 24 LTS, verificado con 24.21.0                    |
| Paquetes               | npm 11, verificado con 11.19.0                            |
| Lenguaje               | TypeScript 5.9.3                                          |
| Framework HTTP         | NestJS common/core/platform-express 11.2.7                |
| Configuración          | @nestjs/config 4.0.4 y dotenv                             |
| Persistencia preparada | PostgreSQL; Prisma CLI/Client 7.10.1                      |
| Adaptador y driver     | @prisma/adapter-pg 7.10.1 y pg 8.23.1                     |
| Autenticación          | @nestjs/jwt 11.0.2, @nestjs/passport 11.0.5, Passport JWT |
| Contraseñas            | Argon2 0.44.0, variante Argon2id                          |
| Validación             | class-validator 0.14.4, class-transformer 0.5.1           |
| Seguridad HTTP         | Helmet 8.3.0, CORS y @nestjs/throttler 6.7.1              |
| Documentación API      | @nestjs/swagger 11.4.7, OpenAPI                           |
| Pruebas                | Jest 29.7.0, Nest Testing y Supertest 7.3.1               |
| Calidad                | ESLint 9.39.5, typescript-eslint y Prettier 3.9.10        |
| Contenedores           | Docker y Docker Compose                                   |

`package-lock.json` fija el árbol reproducible: instalar con `npm ci`. Prisma CLI, cliente y adaptador están fijados exactamente a 7.10.1; no se mezclan APIs de Prisma 8.

La aplicación usa CommonJS en package.json y TypeScript. El generador `prisma-client` declara `moduleFormat = "cjs"` para mantener ese formato cuando se reciban los modelos oficiales.

## Instalación y ejecución

### Clonar la rama

```bash
git clone --branch Backend https://github.com/ignaciosanga/sis-226_timebank.git
cd sis-226_timebank
```

El backend está en la raíz de esta rama; no hay una carpeta backend adicional.

### Windows / PowerShell

```powershell
npm.cmd ci
npm.cmd run setup:env
npm.cmd run build
npm.cmd start
```

`npm.cmd` evita el bloqueo de npm.ps1 sin modificar la política de PowerShell.

### Linux, macOS u otra terminal

```bash
npm ci
npm run setup:env
npm run build
npm start
```

Para desarrollo con recarga: `npm run start:dev`. Detener con `Ctrl+C`.

`setup:env` crea .env a partir de .env.example, genera una clave JWT aleatoria de 48 bytes y deja PostgreSQL deshabilitado. No imprime el secreto ni sobrescribe un .env existente.

| Recurso local | URL                             |
| ------------- | ------------------------------- |
| Health        | http://localhost:4000/health    |
| Swagger UI    | http://localhost:4000/docs      |
| OpenAPI JSON  | http://localhost:4000/docs-json |

## Variables de entorno

| Variable               | Valor inicial / requisito                   | Finalidad                              |
| ---------------------- | ------------------------------------------- | -------------------------------------- |
| NODE_ENV               | development, test o production              | Entorno                                |
| PORT                   | 4000; entero 1–65535                        | Puerto HTTP                            |
| CORS_ORIGINS           | http://localhost:3000,http://localhost:5173 | Orígenes permitidos separados por coma |
| RATE_LIMIT_TTL_MS      | 60000; entero positivo                      | Ventana en milisegundos                |
| RATE_LIMIT_MAX         | 100; entero positivo                        | Solicitudes por ruta/IP y ventana      |
| JWT_SECRET             | Obligatoria, mínimo 32 caracteres           | Firma/verificación                     |
| JWT_EXPIRES_IN_SECONDS | 900; entero 1–86400                         | Vigencia del access token              |
| JWT_ISSUER             | banco-tiempo-backend                        | Emisor esperado                        |
| JWT_AUDIENCE           | banco-tiempo-clients                        | Audiencia esperada                     |
| DATABASE_URL           | Vacía hasta recibir acceso autorizado       | Conexión PostgreSQL                    |
| DATABASE_ENABLED       | false; solo true/false                      | Permite solicitar conexión diferida    |
| SWAGGER_ENABLED        | true; solo true/false                       | Publicación de documentación           |

El entorno se valida antes de escuchar. Los errores indican nombres de variables sin imprimir valores. No hay clave JWT de respaldo: incluso arrancar sin BD requiere una clave válida, porque se inicializa la infraestructura de AuthModule.

CORS exige orígenes HTTP/HTTPS completos, sin comodines ni rutas. Las variables del proceso tienen prioridad sobre .env. Las pruebas omiten ese archivo.

.env, credenciales, tokens y claves privadas no se versionan. Solo se publica .env.example con secretos vacíos.

## Arquitectura y estructura

Monolito modular con Clean Architecture simplificada:

- **Controladores:** atienden HTTP, reciben DTO y delegan.
- **Servicios:** contienen los casos de uso y las reglas.
- **Puertos de repositorio:** definen las operaciones de persistencia necesarias.
- **Infraestructura:** adapta Prisma/PostgreSQL al contrato de la aplicación.

```text
.
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   ├── common/
│   │   ├── decorators/
│   │   ├── enums/
│   │   ├── filters/
│   │   ├── guards/
│   │   └── interceptors/
│   ├── infrastructure/prisma/
│   └── modules/
│       ├── auth/
│       ├── users/
│       ├── health/
│       ├── roles/
│       ├── skills/
│       ├── availability/
│       ├── exchanges/
│       ├── reservations/
│       ├── confirmations/
│       ├── credits/
│       ├── notifications/
│       ├── ratings/
│       └── audit/
├── prisma/schema.prisma
├── prisma.config.ts
├── scripts/setup-env.cjs
├── test/
├── docs/
├── .env.example
├── Dockerfile
├── compose.yaml
└── package.json
```

Los módulos posteriores contienen README de alcance, sin clases vacías ni endpoints ficticios.

| Archivo                                                 | Responsabilidad                                        |
| ------------------------------------------------------- | ------------------------------------------------------ |
| src/main.ts                                             | Arranque, puerto validado y hooks de cierre            |
| src/app.module.ts                                       | Composición y protecciones globales                    |
| src/config/environment.ts                               | Tipos y validación del entorno                         |
| src/config/configure-app.ts                             | Helmet, CORS, ValidationPipe y Swagger                 |
| src/common/filters/http-exception.filter.ts             | Errores uniformes sin detalles internos 5xx            |
| src/common/interceptors/sensitive-fields.interceptor.ts | Elimina password, passwordHash y password_hash de JSON |
| src/modules/auth/auth.service.ts                        | Registro condicionado y login                          |
| src/modules/auth/password.service.ts                    | Hash/verificación Argon2id                             |
| src/modules/auth/jwt.strategy.ts                        | Verifica JWT y consulta estado/roles actuales          |
| src/modules/users/users.service.ts                      | Perfil y campos permitidos                             |
| src/modules/users/users.repository.ts                   | Puerto y contrato de registro atómico                  |
| src/infrastructure/prisma/prisma.service.ts             | Carga diferida y ciclo de vida del cliente             |
| prisma.config.ts                                        | Configuración CLI Prisma 7 y URL fuera del schema      |

## Procesamiento de solicitudes

1. NestJS valida el entorno e inicia los módulos.
2. Helmet configura cabeceras de seguridad y CORS controla orígenes del navegador.
3. El guard global aplica límites por ruta/IP.
4. En controladores protegidos, JwtAuthGuard autentica y RolesGuard comprueba permisos.
5. ValidationPipe valida DTO, rechaza campos adicionales y evita conversiones implícitas.
6. El controlador delega al servicio y este al puerto de persistencia cuando corresponda.
7. El interceptor elimina contraseñas y hashes de las respuestas JSON.
8. El filtro global entrega errores consistentes y oculta los detalles internos.

El throttling actual está en memoria por proceso. Varias instancias requerirán almacenamiento compartido. No se confía en X-Forwarded-For por defecto; cualquier proxy debe configurarse explícitamente.

## API

### Disponible: GET /health

```http
GET http://localhost:4000/health
```

Respuesta HTTP 200:

```json
{
  "status": "ok",
  "service": "banco-tiempo-backend"
}
```

Es liveness del proceso: no abre una conexión ni certifica el estado de PostgreSQL. Swagger y OpenAPI solo documentan esta ruta.

### Previsto, todavía no publicado

| Ruta                | Finalidad                            | Seguridad prevista              |
| ------------------- | ------------------------------------ | ------------------------------- |
| POST /auth/register | Crear estudiante, rol y cuenta       | Pública; rol ESTUDIANTE forzado |
| POST /auth/login    | Verificar credenciales y generar JWT | Pública                         |
| GET /users/me       | Consultar el perfil                  | JWT de usuario activo           |
| PATCH /users/me     | Actualizar el perfil permitido       | JWT de usuario activo           |

Estas rutas responden **404** en esta versión. Su contrato debe acordarse con APIs y BD antes de publicarlas.

Registro preparado: nombre, apellido, correo, password, idCarrera y semestre. Perfil editable: nombre, apellido, idCarrera y semestre. No se aceptan roles, estado, saldo, hashes ni un ID de usuario alternativo.

Login previsto: access_token, token_type="Bearer" y perfil público sin hash. Consultar [api-contract.md](docs/api-contract.md) para límites y validaciones.

### Errores

```json
{
  "statusCode": 400,
  "message": ["correo must be an email"],
  "timestamp": "2026-10-21T16:00:00.000Z"
}
```

message puede ser texto o una lista. Los errores 5xx son genéricos, sin stack trace ni detalles del driver.

Códigos preparados: 400 validación; 401 autenticación; 403 permisos; 404 ruta inexistente; 409 correo duplicado; 429 rate limiting; 503 dependencia/política pendiente. Los casos de autenticación se verifican en controladores exclusivos de Jest, no en endpoints publicados.

## Autenticación, usuarios y roles

### Registro preparado

El servicio exige una política aprobada de créditos iniciales; hoy vale null y bloquea el registro. Después normaliza el correo, comprueba disponibilidad, hashea con Argon2id, fuerza ESTUDIANTE y solicita una sola operación de repositorio para crear usuario, relación de rol y cuenta.

El adaptador real deberá ejecutar esa operación en una transacción y traducir la violación concurrente de correo único a conflicto. Las pruebas actuales verifican el contrato de una única operación, no una transacción PostgreSQL.

### Login preparado

Busca el correo normalizado, verifica Argon2id, exige estado activo y registra el último acceso condicionado a que el usuario siga activo. Con credenciales válidas genera un JWT con sub, iat, exp, iss y aud.

Usuario inexistente, contraseña incorrecta y suspensión reciben el mismo mensaje de credenciales inválidas. Para usuarios inexistentes se verifica un hash de descarte real, evitando omitir todo el trabajo criptográfico.

Argon2id utiliza sal automática, memoria de 19456 KiB, dos iteraciones y paralelismo uno. Nunca se guarda ni se devuelve la contraseña en texto plano.

### JWT y RBAC

- Firma HS256 con clave del entorno y expiración configurable.
- Passport verifica firma, emisor, audiencia y expiración.
- La estrategia vuelve a consultar al usuario activo y sus roles actuales.
- JwtAuthGuard autentica; RolesGuard comprueba permisos de @Roles(...).
- @CurrentUser() entrega el principal autenticado.
- La identidad proviene del JWT verificado, no de un ID en body/query.
- La suspensión debe impedir acceso incluso con un token todavía vigente.

Roles previstos: ESTUDIANTE y ADMIN. La administración persistente de roles está pendiente. No hay refresh tokens, recuperación de contraseña ni revocación remota implementados.

### Perfil y datos sensibles

UsersService utiliza una lista explícita de campos editables. PublicUser proyecta la respuesta sin hash; el interceptor elimina además password/passwordHash/password_hash de JSON como defensa adicional.

Sin un proveedor real de USERS_REPOSITORY, los servicios fallan explícitamente. La aplicación no registra un repositorio que invente usuarios o saldos.

## Créditos de tiempo

**Este flujo es un diseño para fases futuras; no está implementado en v0.1.0.** La equivalencia exacta tiempo/crédito, precisión, redondeo y saldo inicial requieren aprobación del PO.

- **Saldo:** créditos registrados en la cuenta.
- **Créditos retenidos:** cantidad comprometida en reservas pendientes.
- **Disponibles:** saldo menos creditos_retenidos.

Flujo previsto:

1. Comprobar créditos disponibles antes de comprometer una reserva.
2. Retener la cantidad correspondiente sin transferirla todavía.
3. Tras la finalización y confirmación válidas, descontar al solicitante y acreditar al ofertante de forma atómica.
4. Registrar movimientos con saldos y retenciones anteriores/posteriores.
5. Liberar la retención ante una cancelación válida.
6. Evitar transferencias duplicadas ante confirmaciones o solicitudes repetidas.

Ejemplo solo ilustrativo: saldo 5 y retenidos 2 implican 3 disponibles. No configura una política inicial ni crea datos.

El modelo informado incluye CUENTAS_CREDITO, MOVIMIENTOS_CREDITO y TRANSFERENCIAS_CREDITO. Sus tipos, restricciones y relaciones se implementarán contra la fuente oficial.

No hay créditos de bienvenida, penalizaciones ni endpoints de saldo en esta entrega. El usuario nunca podrá modificar sus créditos desde el perfil.

## PostgreSQL y Prisma

Durante la preparación inicial no se recibió SQL/DBML ni conexión autorizada al esquema oficial. schema.prisma declara solo proveedor y generador, sin modelos supuestos.

PrismaService prepara PrismaPg con conexión diferida, timeout de conexión de cinco segundos, máximo diez conexiones y desconexión al cerrar. Su interfaz actual cubre el ciclo de vida; las consultas tipadas del repositorio siguen pendientes.

Cuando BD entregue la fuente definitiva:

1. Confirmar destino de desarrollo, permisos, tipos, estados, índices y relaciones.
2. Configurar DATABASE_URL localmente sin compartir credenciales.
3. Introspectar y generar:

```bash
npm run prisma:introspect
npm run prisma:validate
npm run prisma:generate
npm run build
```

4. Revisar el schema y conservar moduleFormat="cjs" y la salida src/generated/prisma.
5. Implementar el repositorio tipado, mapear IDs/estados/roles y vincular USERS_REPOSITORY.
6. Aprobar el saldo inicial y probar unicidad, concurrencia y rollback en una BD autorizada.
7. Registrar controladores Auth/Users y completar OpenAPI.

prisma db pull lee la BD y modifica el schema local. Las migraciones oficiales pertenecen a BD: no ejecutar db push, migrate dev, migrate reset ni SQL destructivo sobre una base compartida.

DATABASE_ENABLED=true solo permite solicitar conexión diferida; **no crea repositorios ni activa endpoints**. El inventario de las 18 tablas y dependencias está en [pending-decisions.md](docs/pending-decisions.md).

## Pruebas

```bash
npm run build
npm run lint
npm test
npm run test:e2e
npm run format:check
npm run prisma:validate
```

Opcionales: npm run test:cov para cobertura y npm run format para aplicar formato. En PowerShell usar npm.cmd.

| Verificación de referencia | Resultado                         |
| -------------------------- | --------------------------------- |
| Build                      | Correcto                          |
| ESLint                     | Sin errores ni advertencias       |
| Unitarias                  | 5 suites, 33 pruebas aprobadas    |
| HTTP/E2E                   | 2 suites, 35 pruebas aprobadas    |
| Formato                    | Correcto                          |
| Prisma validate            | Schema preparatorio válido        |
| HTTP en puerto 4000        | Health y Swagger respondieron 200 |
| Compose config             | Configuración válida              |

Se cubren validación, credenciales incorrectas, Argon2id real, JWT firmado/vencido/audiencia inválida, estado suspendido, roles, identidad autenticada, restricciones de perfil, hashes ocultos, errores seguros y límites.

Los mocks solo se usan en pruebas. Las rutas `/__test__` están en test/security.e2e-spec.ts, no se importan desde src ni se compilan en dist. Ninguna prueba actual necesita ni modifica una BD compartida.

No se verificaron consultas/transacciones reales ni ejecución de contenedores. Ver [el registro completo](docs/verification.md).

## Docker

Con Docker y su motor activos:

```bash
npm run setup:env
docker compose config --quiet
docker compose up --build
```

Detener con `docker compose down`.

Compose publica 127.0.0.1:4000, monta el código, conserva dependencias Linux en volúmenes y ejecuta como usuario node. Su healthcheck consulta /health. No levanta una BD alternativa ni importa SQL.

Dockerfile contiene targets development, build y runtime. .env está excluido del contexto de construcción; las variables se inyectan al ejecutar. Tras cambiar dependencias, actualizar el volumen con `docker compose run --rm backend npm ci` y reconstruir.

Compose validó correctamente. El motor estaba detenido durante la comprobación inicial: la imagen y su ejecución permanecen pendientes.

## Colaboración y siguientes pasos

Esta es la primera entrega del **equipo Backend**, no el primer commit del historial del repositorio. Se conserva main como base y no se integran cambios en otras ramas.

La rama se denomina Backend por solicitud expresa del desarrollador. Las normas generales proponen equipo/backend; la diferencia queda registrada en [el avance del equipo](docs/avances/backend.md). El README original del grupo se conserva en [docs/collaboration.md](docs/collaboration.md).

| Responsable   | Dependencia                                               |
| ------------- | --------------------------------------------------------- |
| BD            | SQL/DBML definitivo, conexión autorizada y restricciones  |
| PO            | Saldo inicial, unidades, redondeos y políticas            |
| Backend       | Repositorios, transacciones e integración Auth/Users      |
| APIs/Frontend | Acordar campos, errores, IDs, CORS y consumo del contrato |

Orden recomendado: Users/Auth integrados → Skills → Availability → Exchanges → Reservations → Confirmations/Credits. Notificaciones, calificaciones y auditoría se incorporarán con sus contratos correspondientes.

No se desarrolla Frontend ni API Gateway. Integrar en main y publicar avances allí requiere el proceso de revisión del grupo.

## Resolución de problemas

| Situación                    | Acción                                                         |
| ---------------------------- | -------------------------------------------------------------- |
| npm.ps1 bloqueado            | Usar npm.cmd                                                   |
| JWT_SECRET inválida          | Crear .env con setup:env o configurar la clave local existente |
| Puerto 4000 ocupado          | Detener el proceso propio o cambiar PORT                       |
| Auth/Users devuelve 404      | Estado esperado hasta completar su integración                 |
| Cliente Prisma ausente       | Recibir esquema oficial, introspectar y generar                |
| DATABASE_ENABLED sin URL     | Configurar conexión autorizada o mantener false                |
| Swagger no disponible        | Revisar SWAGGER_ENABLED y reiniciar                            |
| Docker no conecta            | Iniciar su motor y repetir la comprobación                     |
| Navegador bloqueado por CORS | Registrar el origen exacto acordado y reiniciar                |

## Documentación

- [Arquitectura](docs/architecture.md)
- [Configuración local](docs/setup-local.md)
- [Contrato API](docs/api-contract.md)
- [Reglas de negocio](docs/business-rules.md)
- [Decisiones pendientes](docs/pending-decisions.md)
- [Verificaciones](docs/verification.md)
- [Avances del equipo Backend](docs/avances/backend.md)
- [Normas de colaboración del grupo](docs/collaboration.md)
