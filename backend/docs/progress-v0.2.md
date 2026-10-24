# Reporte de implementación — Backend v0.2.0

Fecha: **22 de octubre de 2026**, America/La_Paz. Proyecto existente: Banco de Tiempo Universitario. Rama de trabajo: `Backend`; entrega exclusivamente local.

> Registro histórico de v0.2. La actualización implementada de concurrencia, reservas y créditos está en [progress-v0.3.md](progress-v0.3.md).

## Trabajo realizado

- Se analizó la estructura, servicios, configuración, guards, DTO, pruebas y esquema preparatorio anteriores antes de implementar.
- Se mantuvo el monolito NestJS, sus dependencias y la separación controlador → servicio → interfaz → adaptador.
- Se implementaron categorías, habilidades, habilidades de estudiantes y disponibilidades con repositorios de memoria funcionales y proveedores compartidos por NestJS.
- Se conectaron registro/login/perfil a memoria, reutilizando AuthService, UsersService, PasswordService, JwtStrategy, JWT, RolesGuard, JwtAuthGuard, Roles y CurrentUser.
- Se publicaron DTO y esquemas Swagger, permisos ADMIN/ESTUDIANTE, estados activos, búsqueda, filtros, paginación y errores 400/401/403/404/409.
- Se añadieron datos de desarrollo: Tecnología, Idiomas, Matemáticas, Diseño; Programación Java, Python, Inglés, Excel y Diseño gráfico. Excel se clasificó provisionalmente en Tecnología.
- Se añadió arranque local ADMIN con contraseña aleatoria, sin contraseñas fijas ni elevación pública por HTTP.
- Se actualizaron README, contrato, arquitectura, configuración y reglas; se conserva la documentación histórica identificada como tal.

No se creó otro proyecto, no se añadieron dependencias y no se desarrollaron Frontend, API Gateway, solicitudes, reservas ni créditos.

## Diferencias encontradas en v0.1 y decisiones

La orden describía un modo memoria y autenticación ya publicados; el código real no tenía repositorios de memoria ni controladores Auth/Users. El registro estaba condicionado a una política de créditos pendiente. Se resolvió con `createStudentProfile` y `RegistrationPolicy.profileOnly`: el registro local crea perfil y rol, sin cuentas, saldos ni una política implícita de créditos. El contrato anterior `createStudentWithAccount` y sus pruebas se conservan; memoria rechaza esa operación fuera del alcance.

El CORS anterior omitía DELETE, lo que habría impedido retirar publicaciones desde un cliente web autorizado. Se añadió ese método y una prueba de preflight.

La prueba HTTP detectó fechas clonadas serializadas como `{}` por el interceptor: `instanceof Date` no reconocía fechas de otro contexto. Se utiliza `node:util/types.isDate` y conversión ISO explícita; una prueba de regresión conserva también la redacción de hashes anidados.

Los nombres oficiales se conservan en registros. Los DTO adaptan categoryId → id_categoria, skillId → id_habilidad, fechaInicio/fechaFin → fecha_inicio/fecha_fin y el principal JWT → id_usuario. MemoryUsersRepository almacena todos los campos de USUARIOS indicados, incluidos fecha_registro y ultimo_acceso, y adapta el contrato anterior de aplicación. Roles se mantienen separados de esa tabla.

Estados internos ACTIVO/INACTIVO, niveles BASICO/INTERMEDIO/AVANZADO, unicidad global de nombres de habilidades y clasificación de Excel son decisiones provisionales documentadas para confirmar con PO/BD. No se infiere un schema Prisma definitivo.

## Endpoints implementados

| Método | Endpoint                    | Acceso                                       |
| ------ | --------------------------- | -------------------------------------------- |
| GET    | `/categories`               | Público; search/page/limit                   |
| GET    | `/categories/:id`           | Público; UUID activo                         |
| POST   | `/categories`               | ADMIN                                        |
| GET    | `/skills`                   | Público; search/categoryId/page/limit        |
| GET    | `/skills/:id`               | Público; UUID activo                         |
| POST   | `/skills`                   | ADMIN                                        |
| GET    | `/users/me/skills`          | ESTUDIANTE autenticado                       |
| POST   | `/users/me/skills`          | ESTUDIANTE; identidad del JWT                |
| DELETE | `/users/me/skills/:skillId` | ESTUDIANTE; relación propia                  |
| GET    | `/users/:id/skills`         | JWT activo; estudiante objetivo activo       |
| POST   | `/availability`             | ESTUDIANTE; identidad del JWT                |
| GET    | `/availability/me`          | ESTUDIANTE autenticado                       |
| GET    | `/users/:id/availability`   | JWT activo; estudiante objetivo activo       |
| PATCH  | `/availability/:id`         | ESTUDIANTE propietario                       |
| DELETE | `/availability/:id`         | ESTUDIANTE propietario; desactivación lógica |

Se habilitan además POST `/auth/register`, POST `/auth/login`, GET `/users/me` y PATCH `/users/me`; se conserva GET `/health` y se actualizan `/docs` y `/docs-json`.

Los listados de catálogo usan `{ data, meta: { page, limit, total, totalPages } }`; los listados de publicaciones usan arrays. POST crea con 201; DELETE propio responde 204 sin cuerpo. Consultar el [contrato API](api-contract.md) para cuerpos, respuestas, estados HTTP y adaptadores.

## Seguridad y reglas

- ADMIN crea categorías y catálogo de habilidades; ESTUDIANTE publica solo sus propios registros.
- JWT válido obligatorio para publicaciones y consulta de otros estudiantes; cada petición revisa estado/roles actuales. Un suspendido no puede usar un token vigente.
- No se admite un ID de usuario en el body. La lista de campos de DTO rechaza propiedades adicionales, null indebido y UUID inválidos.
- Las habilidades deben existir y estar activas, con categoría activa. La relación usuario-habilidad tiene clave compuesta única y nivel validado.
- Estudiantes inexistentes/inactivos no publican habilidades ni horarios para otros usuarios.
- Disponibilidad: ISO 8601 con zona explícita, fechas válidas y fin posterior al inicio. PATCH parcial revalida el intervalo completo.
- Duplicados y superposiciones activas se rechazan por usuario, comparando instantes UTC. Intervalos [inicio, fin): extremos contiguos permitidos.
- Desactivación lógica idempotente para el propietario; registros inactivos no se publican ni bloquean horarios nuevos. No se permite editar un registro inactivo.
- Sin contraseñas/hashes/secretos en respuestas. Se conservan Argon2id, Helmet, rate limiting, errores seguros y controles CORS.

## Persistencia y límites

MemoryCategoriesRepository, MemorySkillsRepository, MemoryUserSkillsRepository, MemoryAvailabilityRepository y MemoryUsersRepository implementan sus interfaces e inyección mediante tokens. Se registra un proveedor por módulo, compartido por todos sus consumidores. Las relaciones almacenan IDs y consultan catálogos/perfiles compartidos; no mantienen copias divergentes. Las lecturas devuelven copias independientes.

Unicidad y solapamientos se comprueban y escriben sin await intermedio en los repositorios; la garantía cubre un proceso. Se probaron escrituras simultáneas en memoria, sin afirmar garantías distribuidas. Al reiniciar se pierden usuarios, categorías/habilidades añadidas y publicaciones; se restauran solo los catálogos de ejemplo.

PERSISTENCE_MODE=memory es el único proveedor implementado, solo para development/test. El arranque con NODE_ENV=production se rechaza para evitar presentar memoria temporal como persistencia duradera. DATABASE_ENABLED no selecciona repositorios ni activa integración.

No se conectó PostgreSQL, no se cambió prisma/schema.prisma y no se ejecutaron migraciones, introspección, db push ni comandos que modifiquen bases de datos. Los servicios nuevos no importan Prisma y no existe un repositorio Prisma ficticio.

## Estructura de carpetas

```text
src/common/dto/                   # Query de listados y paginación
src/common/enums/                 # Roles previos y estado interno
src/common/utils/                 # Normalización de nombres
src/common/interceptors/          # Redacción y regresión de fechas
src/modules/auth/                # Servicios previos, DTO documentados y HTTP
src/modules/users/               # Puerto, adaptador USUARIOS y perfil HTTP
src/modules/categories/          # Controlador, servicio, puerto, memoria, DTO
src/modules/skills/              # Controlador, servicio, puerto, memoria, DTO
src/modules/user-skills/         # Publicaciones y clave compuesta
src/modules/availability/        # Intervalos, propiedad, desactivación y DTO
scripts/start-memory-admin.cjs   # ADMIN efímero con contraseña aleatoria
test/catalog-profile.e2e-spec.ts # Flujo HTTP real v0.2
docs/                           # Reporte, contrato y guías
```

## Variables de entorno

| Variable                           | Valor / uso                                                  |
| ---------------------------------- | ------------------------------------------------------------ |
| NODE_ENV                           | development o test en esta versión                           |
| PERSISTENCE_MODE                   | memory; nueva, predeterminada aunque falte en .env anterior  |
| PORT                               | 4000; rango 1–65535                                          |
| CORS_ORIGINS                       | http://localhost:3000,http://localhost:5173                  |
| RATE_LIMIT_TTL_MS / RATE_LIMIT_MAX | 60000 / 100; límites por proceso                             |
| JWT_SECRET                         | Clave local aleatoria >=32 caracteres, sin valor de respaldo |
| JWT_EXPIRES_IN_SECONDS             | 900; rango 1–86400                                           |
| JWT_ISSUER / JWT_AUDIENCE          | banco-tiempo-backend / banco-tiempo-clients                  |
| DATABASE_ENABLED / DATABASE_URL    | false / vacía; sin conexión                                  |
| SWAGGER_ENABLED                    | true                                                         |

No se modificó `.env` ni se incorporaron credenciales. `.env.example` documenta PERSISTENCE_MODE. `setup:env` conserva archivos existentes y genera una clave cuando corresponde.

## Cómo ejecutar y probar el flujo de estudiante

```powershell
npm.cmd ci
npm.cmd run setup:env
npm.cmd run build
npm.cmd start
```

1. Abrir http://localhost:4000/docs.
2. Registrar Ana en POST /auth/register con nombre, apellido, correo, password de al menos 12 caracteres, idCarrera y semestre entero.
3. Iniciar sesión en POST /auth/login y copiar access_token en Authorize.
4. Consultar categorías y buscar Python con GET /skills?search=Python; copiar id_habilidad.
5. Publicar `{ "skillId": "UUID obtenido", "nivel": "INTERMEDIO" }` en POST /users/me/skills; repetir debe dar 409.
6. Publicar `{ "fechaInicio": "2026-11-02T09:00:00-04:00", "fechaFin": "2026-11-02T10:00:00-04:00" }` en POST /availability; repetir o superponer debe dar 409.
7. Registrar/autenticar otro estudiante. Consultar /users/{id_de_Ana}/skills y /users/{id_de_Ana}/availability con su JWT.
8. Intentar PATCH o DELETE sobre el horario de Ana con el JWT del segundo estudiante: 403. Quitar la habilidad desde el perfil del segundo no altera el primero.
9. Volver al JWT de Ana: editar su horario, quitar habilidad (204), desactivar horario (204) y comprobar que ya no aparece publicado.

El [README](../README.md#flujo-de-estudiante-en-powershell) incluye comandos PowerShell completos. No se exige fecha futura ni duración mínima/máxima hasta decisión del PO.

Para ADMIN, detener el servidor y arrancar `npm.cmd run start:memory-admin -- admin@example.test` después de compilar. Usar la contraseña aleatoria mostrada para login; no se precrea un administrador al arrancar normalmente. El comando escucha en loopback y solo funciona en development. Todos los datos viven en esa instancia.

## Pruebas y comandos de calidad

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd run format:check
```

| Verificación                       | Resultado                        |
| ---------------------------------- | -------------------------------- |
| Unitarias                          | 11 suites, 70 pruebas aprobadas  |
| HTTP/E2E                           | 3 suites, 80 pruebas aprobadas   |
| Compilación final, lint y formato  | Correctos                        |
| Servidor compilado y comando ADMIN | Correctos                        |
| PostgreSQL / migraciones           | No ejecutados; fuera del alcance |
| Docker                             | No ejecutado en v0.2             |

Cobertura funcional: consultas y paginación de catálogos; ADMIN y rechazo de permisos; búsqueda/categoría; creación propia, duplicados, inexistentes/inactivos y niveles; identidad JWT y registros ajenos; fechas/zona/calendario; intervalos inválidos, duplicados, solapados, contiguos, usuarios diferentes, edición y desactivación; estado suspendido; correo único concurrente y solapamiento concurrente en memoria; Swagger y CORS DELETE. Se conservan las regresiones de Argon2id, JWT vencido/inválido/audiencia, roles manipulados, perfil, errores y rate limiting.

Las pruebas anteriores no se eliminaron. Se actualizaron expectativas de rutas 404/Swagger health para el contrato publicado; la prueba de política de crédito pendiente conserva su proveedor aislado.

## Pendientes de PostgreSQL y recomendación v0.3

Recibir esquema oficial completo y acceso autorizado; adaptar UUID, estados, niveles y carreras; implementar repositorios reales detrás de los mismos tokens; definir normalización/índices únicos; verificar transacciones y restricciones de solapamiento bajo concurrencia real; persistir roles/estado de usuario y reemplazar el bootstrap temporal de ADMIN por el mecanismo autorizado.

La protección definitiva contra dos reservas simultáneas pertenece a una fase posterior y debe verificarse en PostgreSQL. Solicitudes, reservas, confirmaciones, cuentas, créditos, retenciones, movimientos y transferencias no están implementados en v0.2. Tampoco recuperación de contraseña, refresh tokens, logout remoto o auditoría de negocio.

Recomendación: dedicar v0.3 a integración PostgreSQL y pruebas de persistencia/concurrencia, acordando primero los valores pendientes con PO/BD. No avanzar al sistema completo antes de cerrar esos contratos.

## Estado de entrega local

No se hicieron commits, push, Pull Requests, despliegues ni cambios remotos. Todo queda en el árbol de trabajo local para revisión y una publicación posterior solicitada por el usuario. No se tocó la BD del otro equipo.

## Manifiesto de archivos

### Archivos creados (44)

- `docs/progress-v0.2.md`
- `scripts/start-memory-admin.cjs`
- `src/common/dto/list-query.dto.ts`
- `src/common/enums/record-status.enum.ts`
- `src/common/interceptors/sensitive-fields.interceptor.spec.ts`
- `src/common/utils/catalog-name.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/availability/availability.controller.ts`
- `src/modules/availability/availability.module.ts`
- `src/modules/availability/availability.repository.ts`
- `src/modules/availability/availability.service.spec.ts`
- `src/modules/availability/availability.service.ts`
- `src/modules/availability/availability.types.ts`
- `src/modules/availability/dto/availability.dto.ts`
- `src/modules/availability/memory-availability.repository.ts`
- `src/modules/categories/categories.controller.ts`
- `src/modules/categories/categories.module.ts`
- `src/modules/categories/categories.repository.ts`
- `src/modules/categories/categories.service.spec.ts`
- `src/modules/categories/categories.service.ts`
- `src/modules/categories/category.types.ts`
- `src/modules/categories/dto/create-category.dto.ts`
- `src/modules/categories/memory-categories.repository.ts`
- `src/modules/skills/dto/create-skill.dto.ts`
- `src/modules/skills/dto/skills-query.dto.ts`
- `src/modules/skills/memory-skills.repository.ts`
- `src/modules/skills/skill.types.ts`
- `src/modules/skills/skills.controller.ts`
- `src/modules/skills/skills.module.ts`
- `src/modules/skills/skills.repository.ts`
- `src/modules/skills/skills.service.spec.ts`
- `src/modules/skills/skills.service.ts`
- `src/modules/user-skills/dto/create-user-skill.dto.ts`
- `src/modules/user-skills/memory-user-skills.repository.ts`
- `src/modules/user-skills/user-skill.types.ts`
- `src/modules/user-skills/user-skills.controller.ts`
- `src/modules/user-skills/user-skills.module.ts`
- `src/modules/user-skills/user-skills.repository.ts`
- `src/modules/user-skills/user-skills.service.spec.ts`
- `src/modules/user-skills/user-skills.service.ts`
- `src/modules/users/memory-users.repository.spec.ts`
- `src/modules/users/memory-users.repository.ts`
- `src/modules/users/users.controller.ts`
- `test/catalog-profile.e2e-spec.ts`

### Archivos modificados (31)

- `.env.example`
- `README.md`
- `docs/api-contract.md`
- `docs/architecture.md`
- `docs/avances/backend.md`
- `docs/business-rules.md`
- `docs/setup-local.md`
- `docs/verification.md`
- `package-lock.json`
- `package.json`
- `src/app.module.ts`
- `src/common/interceptors/sensitive-fields.interceptor.ts`
- `src/config/configure-app.ts`
- `src/config/environment.spec.ts`
- `src/config/environment.ts`
- `src/modules/auth/auth.module.ts`
- `src/modules/auth/auth.service.spec.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/dto/login.dto.ts`
- `src/modules/auth/dto/register.dto.ts`
- `src/modules/auth/registration-policy.ts`
- `src/modules/availability/README.md`
- `src/modules/skills/README.md`
- `src/modules/users/dto/update-profile.dto.ts`
- `src/modules/users/user.types.ts`
- `src/modules/users/users.module.ts`
- `src/modules/users/users.repository.ts`
- `src/modules/users/users.service.ts`
- `test/app.e2e-spec.ts`
- `test/security.e2e-spec.ts`
- `test/support/users.fixture.ts`
