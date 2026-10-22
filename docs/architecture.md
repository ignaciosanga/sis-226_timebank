# Arquitectura

Monolito modular con separación simplificada de HTTP, casos de uso y persistencia. El directorio abierto es la raíz del backend; no se necesita otra carpeta anidada ni un Frontend/API Gateway.

## Dependencias

- AppModule compone Config, Throttler, Prisma, Health y Auth.
- Health solo atiende HTTP y no depende de PostgreSQL.
- AuthModule importa UsersModule e inyecta UsersService, PasswordService y JwtService.
- UsersService consume el puerto USERS_REPOSITORY. No existe un proveedor de persistencia por falta de esquema; acceder al puerto falla explícitamente con 503.
- PrismaModule prepara el adaptador PostgreSQL y el ciclo de vida. No hace introspección, consultas ni cambios de esquema al arrancar.

No se registran controladores de Auth/Users mientras no haya adaptador real. Los escenarios de HTTP de seguridad viven exclusivamente en test/security.e2e-spec.ts.

## Seguridad

Argon2id usa memoryCost=19456 KiB, timeCost=2 y parallelism=1, con sal automática. Usuarios inexistentes consumen una verificación ficticia de hash real; el mensaje de credenciales es el mismo para ausencia, contraseña incorrecta y suspensión.

JWT usa HS256, emisor, audiencia y expiración configurable. Passport verifica firma y expiración. JwtStrategy vuelve a consultar al usuario activo y toma los roles actuales del repositorio; no confía en roles enviados en el token ni en IDs de un body/query. RolesGuard se aplica después de JwtAuthGuard; Roles define los roles aceptados y CurrentUser entrega el principal validado.

Registro fuerza Role.ESTUDIANTE, hashea la contraseña y llama a una sola operación de repositorio para crear usuario, relación de rol y cuenta. Esa operación no está implementada hasta recibir BD; las pruebas verifican el contrato, no una transacción PostgreSQL. La política de créditos es null y bloquea registro.

La actualización de perfil utiliza una lista explícita de campos. PublicUser proyecta datos permitidos sin hash. Un interceptor global elimina password, passwordHash y password_hash de JSON como defensa adicional. El filtro global oculta detalles 5xx y no registra cuerpos, cabeceras, URL, objetos de error ni secretos.

## Prisma 7 y CommonJS

package.json y TypeScript son CommonJS; el generador prisma-client declara moduleFormat=cjs. Prisma 7.10.1, @prisma/client y @prisma/adapter-pg coinciden exactamente. La configuración CLI está en prisma.config.ts; el esquema solo declara proveedor PostgreSQL y generador.

El cliente se cargará de src/generated/prisma/client en desarrollo o dist/generated/prisma/client tras compilar. La carga es diferida para que el proyecto compile antes de recibir modelos oficiales. PrismaService evita conexiones simultáneas duplicadas, permite reintentar tras fallo y cierra el cliente al destruir el módulo. El pool tiene máximo 10 conexiones y timeout de conexión de 5 segundos. La adaptación tipada para consultas se completará tras introspección.

No se inventan modelos a partir de la descripción resumida. Las 18 tablas recibidas son inventario, no fuente suficiente para inferir claves, tipos o relaciones.

## Organización de módulos pendientes

Cada directorio futuro tiene un README que declara su alcance. Roles reutiliza los enums, decorators y guards comunes; su administración persistente sigue pendiente. Skills, Availability, Exchanges, Reservations, Confirmations, Credits, Notifications, Ratings y Audit no tienen endpoints ni reglas implementadas.

Las reglas posteriores deberán vivir en servicios con dependencias explícitas, y las operaciones concurrentes en repositorios transaccionales. No se crean clases vacías para simular avances.
