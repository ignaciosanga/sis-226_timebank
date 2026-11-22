# Fase 2: cuentas institucionales, activación y bono único

Entrega local del 20 de noviembre de 2026, rama `feat/backend-nucleo-transaccional-parcial3`, base `18f3ccc6960e177769e13a0bdfccb66f8d7042c8`. Sin commit, push ni despliegue. Se conservan el [reporte de fase 1](fase1-nucleo-transaccional-parcial3.md), los cambios locales previos y `.local/phase1/`.

## Comportamiento anterior e implementado

Antes, el registro comprobaba el dominio institucional y creaba una cuenta activa con el bono en la transacción de creación. No había prueba persistente de titularidad por correo ni una decisión explícita para el bono cero. Google comprobaba identidad del proveedor, pero no se guardaba su identificador `sub` ni evidencia de verificación en el usuario. Los JWT de sesión y el state firmado del calendario compartían finalidad insuficientemente delimitada.

Ahora el registro con contraseña normaliza el correo y exige el dominio exacto `@ucb.edu.bo`. Crea `Pendiente`, saldo cero y ningún movimiento de bienvenida. Envía la credencial por SMTP; la respuesta pública contiene perfil, `estado: "Pendiente"` y `verification_required: true`, sin token ni sesión. Una contraseña correcta antes de verificar recibe 403 con `code: "EMAIL_VERIFICATION_REQUIRED"`; las rutas protegidas rechazan cuentas pendientes incluso con un JWT firmado. Contraseña incorrecta: 401.

La primera prueba válida activa la cuenta y decide el bono de la configuración vigente al activar. El valor predeterminado sigue siendo **8**, pendiente de confirmación del PO. Con **0**, se guarda igualmente la decisión, sin movimiento ficticio. El registro repetido devuelve 409 y no cambia la contraseña existente. Los accesos siguientes no vuelven a conceder bono.

## Flujos y contrato HTTP

| Método y endpoint                                       | Resultado relevante                                                                                                                                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/register`                                   | 201: perfil pendiente y `verification_required: true`; 400: DTO/dominio; 409: correo existente; 503: correo/configuración no disponible.                                                                 |
| `GET /auth/verify-email`                                | Página HTML con botón explícito. GET no activa ni consume.                                                                                                                                               |
| `POST /auth/verify-email`                               | Cuerpo `{ "token": "credencial-del-correo" }`; 200 `{ "status": "verified", "login_required": true }`. Inválido/vencido: 400. Un token ya confirmado recupera el resultado sin sesión ni efectos nuevos. |
| `POST /auth/resend-verification`                        | `{ "correo": "estudiante@ucb.edu.bo" }`; 202 con mensaje genérico. Cuando emite otro enlace, consume los anteriores.                                                                                     |
| `POST /auth/login`                                      | 200 con `access_token`, `token_type: "Bearer"` y `user`; pendiente con contraseña válida: 403 y código estable.                                                                                          |
| `POST /auth/google`                                     | Recibe ID token en `credential`. Usuario nuevo sin perfil: `registration_required: true`; completar con `idCarrera` y `semestre`. Identidad válida y cuenta habilitada: sesión.                          |
| `POST /admin/users`                                     | Mantiene permisos ADMIN y auditoría, pero el alta también queda pendiente y envía confirmación. El cambio administrativo de estado no activa pendientes.                                                 |
| `GET /users/me`, `/credits/me`, `/credits/me/movements` | Se mantienen protegidos por sesión y estado actual. Permiten comprobar perfil, saldo y movimiento.                                                                                                       |
| Calendario: generación y validación de state            | Conserva las rutas existentes; añade `purpose: "calendar-oauth"` y audiencia específica. No sirve como sesión.                                                                                           |

Swagger está disponible en `/docs` y OpenAPI en `/docs-json`. [La guía de Frontend](frontend-integration.md) incluye los cuerpos, códigos y pasos actualizados.

### Correo y persistencia del token

- Credencial opaca de 32 bytes aleatorios, codificada en base64url; se persiste únicamente SHA-256, UUID de usuario, creación, vencimiento y consumo. No se registra el valor original en logs ni auditoría.
- Vencimiento predeterminado: 60 minutos, configurable mediante `EMAIL_VERIFICATION_TTL_MINUTES` (1–1440).
- El enlace lleva la credencial en un fragmento `#token=...`. La página la retira de la barra de direcciones y realiza POST solo después de pulsar el botón. Envía `Cache-Control: no-store`, `Referrer-Policy: no-referrer` y CSP con nonce.
- Reenvío: tres solicitudes por minuto/IP y espera mínima de 60 segundos si la cuenta tiene un enlace pendiente recién emitido. Una cuenta ya activa o inexistente recibe el mismo mensaje genérico, sin nuevo token.
- Si SMTP falla después de crear la cuenta, esta conserva `Pendiente` y saldo cero; se revoca solo el token cuyo envío falló. La respuesta es 503 sanitizada y se recupera mediante reenvío. Con transporte deshabilitado se rechaza el alta antes de persistirla.
- SMTP se ejecuta fuera de la transacción de BD. La activación y sus efectos sí se confirman conjuntamente. No se implementa una cola de correo: el reenvío es el mecanismo de recuperación disponible.

### Google y finalidad de credenciales

Se reutiliza la consulta de identidad del proveedor, con timeout y validación de respuesta: `aud`, `iss`, vencimiento finito, `email_verified`, `hd: "ucb.edu.bo"`, correo institucional y `sub`. No se activa ni vincula por una coincidencia de correo sin esos controles. Se persiste `google_sub` único y no se permite sustituirlo por otro sujeto. Los criterios de identidad y autoridad institucional siguen la [guía oficial de Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

Una cuenta nueva por Google se crea, verifica y activa atómicamente; una pendiente se activa una vez. Al activar una pendiente por Google se invalida la contraseña del prerregistro, evitando conservar una clave preparada por otra persona. Debe seguir entrando por Google; recuperación/establecimiento de contraseña queda fuera de esta entrega. Las cuentas ya activas con contraseña la conservan y pueden usar ambos métodos. Inactivos y suspendidos no se rehabilitan mediante Google ni mediante replay de correo.

Los JWT de sesión contienen `purpose: "session"`; el guard exige ese propósito, ausencia de `action`, firma, algoritmo, issuer, audiencia y vencimiento válidos, y consulta el estado/roles actuales en persistencia. El state del calendario usa propósito y audiencia diferentes. Las sesiones antiguas sin propósito requieren volver a iniciar sesión; no se cambian contraseñas ni acceso de las cuentas por ello. Un enlace de correo tampoco sirve como Bearer.

## Atomicidad y decisión del bono

`account-activation.ts` concentra la decisión usando `parseCredits`, `MAX_CREDITS` y la representación entera vigente. El adaptador de memoria trabaja con un borrador y commit único; el adaptador PostgreSQL reutiliza su transacción y bloqueo asesor común `22603112` entre instancias.

Dentro del mismo commit quedan: activación, evidencia actual de verificación, vínculo Google cuando corresponde, `bono_decidido_at` incluso para cero, saldo, movimiento `BonoInicial` si el importe es positivo, y consumo de los enlaces pendientes. Una excepción descarta todos esos cambios. El índice parcial único sobre `MOVIMIENTOS_CREDITO(id_usuario) WHERE tipo = 'BonoInicial'` agrega una defensa persistente contra movimientos duplicados.

Un token consumido puede devolver el resultado ya confirmado, pero no vuelve a ejecutar la activación ni emitir una sesión. Incluso después de suspender al usuario, ese replay no modifica su estado. Correo y Google concurrentes usan el mismo protocolo transaccional. Escritores externos deben respetar el bloqueo y la política; el índice no reemplaza ese protocolo.

## Esquema, evidencia anterior y conservación de datos

Se actualizaron las referencias remotas sin cambiar de rama. `origin/equipo/BD` y `origin/equipo/base-de-datos` no publicaron una migración equivalente de verificación o decimales respecto a la fase 1. Por eso se incorpora únicamente:

`prisma/migrations/20261120000000_verificacion_institucional/migration.sql`

- `USUARIOS`: `cuenta_previa`, `email_verificado_at`, `metodo_verificacion`, `bono_decidido_at` y `google_sub` único.
- `VERIFICACIONES_CORREO`: hash único, FK restrictiva al usuario, fechas, control de intervalo y formato del hash, índice por usuario/creación.
- Índice único parcial de bienvenida. Si otra base contiene bonos históricos duplicados, debe revisarse con BD antes de aplicar; la migración no borra ni reconstruye historia.
- Se conservan las cuatro migraciones anteriores. El esquema queda en 12 tablas originales + una de autenticación + `_prisma_migrations`: 14 tablas físicas en esta instancia. Esto no declara equivalencia con otro modelo de 13 tablas de BD.

El esquema anterior no guardaba fechas ni método de verificación o sujeto Google. No hay evidencia para atribuir verificación histórica a las cuentas existentes. La migración las marca `cuenta_previa=true`, mantiene su estado, rol, contraseña, saldo e historial y deja las fechas nuevas en NULL. Una prueba Google posterior puede registrar evidencia **actual**, sin concederles otro bono. Las nuevas filas tienen `cuenta_previa=false`.

Antes de aplicar se comprobó el destino: host `127.0.0.1`, puerto `55434`, base `nexo_u_phase1`, usuario `nexo_phase1`. Se detuvo solo la API, conservando PostgreSQL y volumen. Se guardó un `pg_dump` y un snapshot privado de las 12 tablas. Se aplicó exclusivamente la nueva migración. Las filas y todas las columnas originales coincidieron exactamente después: SHA-256 `f5ead1b305e9f02fbf91f395369a3e43f2cdd3ff9ce485d4b21d0d4974e5cbb2`. Las tres cuentas anteriores conservaron metadatos nuevos sin evidencia inventada.

Después se inició sesión por HTTP con las contraseñas existentes: ADMIN saldo 0 y estudiantes saldos 7 y 3; roles e historiales idénticos, cero bonos adicionales con política actual 8. Solo se actualizaron los accesos normales. La demo añadió una cuenta de desarrollo propia, sin truncar ni reconstruir datos de fase 1.

Los nueve campos de crédito siguen siendo **INTEGER**: `USUARIOS.saldo/creditos_retenidos`, `SOLICITUDES_INTERCAMBIO.creditos_requeridos`, `RESERVAS.creditos`, y `MOVIMIENTOS_CREDITO.cantidad/saldo_anterior/saldo_posterior/retenidos_anterior/retenidos_posterior`. La conversión decimal no forma parte de esta migración. El futuro cambio de representación debe adaptar el punto común de créditos y el escritor del bono, con BD, sin usar flotantes binarios para el ledger.

## Pruebas: línea base y resultado final

La línea base se registró **antes de modificar autenticación**. Se repararon los fixtures institucionales en archivos versionados; los correos inválidos se conservaron en sus casos negativos. Los escenarios transaccionales fijan explícitamente bono cero. El script oficial PostgreSQL pasó de exigir exactamente una carrera a comprobar que la carrera activa conocida existe; mantiene los conteos de categorías/habilidades que sí comprueban la semilla. Se preservaron las comprobaciones originales de permisos, estados, saldos e idempotencia.

| Comprobación oficial      | Fase 1 registrada                   | Línea base reparada, antes de auth | Final fase 2                                                        |
| ------------------------- | ----------------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| Unitarias, memoria/mocks  | 177 aprobadas                       | 177 / 177; 19 suites               | **183 / 183; 19 suites**                                            |
| E2E HTTP, memoria/mocks   | 41 aprobadas, 91 fallidas           | 132 / 132; 5 suites                | **144 / 144; 6 suites**                                             |
| `npm run test:postgres`   | Se detenía por catálogo de carreras | Aprobado                           | **Aprobado**, flujo original y ciclo de activación ampliado         |
| `npm run prisma:validate` | Ver reporte anterior                | —                                  | **Aprobado**                                                        |
| `npm run build`           | Ver reporte anterior                | —                                  | **Aprobado**                                                        |
| `npm run lint`            | Ver reporte anterior                | —                                  | **Aprobado**, sin ignorar archivos fuente; `.local/` queda excluido |

Las unitarias y E2E fuerzan memoria y deshabilitan BD. En las suites que necesitan registro se sustituye solo el transporte de correo por una bandeja capturada y se confirma mediante el endpoint real. Las pruebas negativas de seguridad conservan sus permisos y validaciones. Los seis nuevos casos unitarios refuerzan respuestas inválidas de identidad Google.

El script **versionado y oficial** `scripts/test-postgres.cjs` crea una base `timebank_test_<aleatorio>` separada dentro del servidor local, aplica migraciones y semilla dos veces y la elimina al terminar. No reconstruye `nexo_u_phase1`. Prueba HTTP/JWT, dos instancias, reserva/cobro único, idempotencia persistente, rollback, reapertura, bono positivo/cero y carreras entre métodos de activación. El fallo intermedio provoca una violación real de FK al insertar el movimiento dentro de PostgreSQL y comprueba que usuario y token también se revirtieron; el reintento funciona.

También se probó un reinicio **del proceso** de la API local: se confirmó una cuenta con SMTP real Mailpit, se detuvo el proceso propio, se arrancó con el mismo PostgreSQL, se reutilizó el enlace y se inició sesión. Se mantuvieron saldo 8 y un bono.

**Alcance de proveedores:** Google se simuló en unitarias, E2E y pruebas PostgreSQL. No se ejecutó login contra una cuenta real Google ni Google Calendar remoto: `GOOGLE_LOGIN_CLIENT_ID` no está configurado para esta demo. La validación de state como Bearer usa el state generado por el servicio real de calendario, sin llamar a Google. SMTP sí se probó realmente contra Mailpit; no se enviaron mensajes a un proveedor externo.

No había navegador conectado en la sesión. Se verificaron por HTTP la entrega SMTP en la API de Mailpit, el HTML, sus cabeceras, la confirmación, el login y los movimientos. La interacción visual del botón queda disponible para revisión manual; no se presenta como una prueba de navegador ejecutada.

### Escenarios observados

| Escenario                                | Estado final                      | Saldo      | Bonos         | Resultado/adaptador                                                                                                                               |
| ---------------------------------------- | --------------------------------- | ---------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registro válido, sin verificar           | Pendiente                         | 0          | 0             | Login 403, acceso protegido 401; memoria y PostgreSQL.                                                                                            |
| Primera confirmación, política 8         | Activo                            | 8          | 1             | Memoria, PostgreSQL y SMTP real Mailpit.                                                                                                          |
| Dos confirmaciones simultáneas           | Activo                            | 8          | 1             | Dos instancias PostgreSQL; ambas recuperan 200.                                                                                                   |
| Reutilización y login repetido           | Activo                            | 8          | 1             | Sin nuevos efectos.                                                                                                                               |
| Reapertura y reinicio real de API        | Activo                            | 8          | 1             | Credencial consumida y decisión persistentes.                                                                                                     |
| Política 0, después 8 y acceso Google    | Activo                            | 0          | 0             | Decisión no nula; memoria/PostgreSQL, Google simulado.                                                                                            |
| Token inválido o vencido                 | Pendiente                         | 0          | 0             | 400; reenvío rota y recupera la cuenta.                                                                                                           |
| SMTP fallido                             | Pendiente                         | 0          | 0             | 503, token revocado; reenvío posterior activa una vez. Simulación del fallo.                                                                      |
| Fallo intermedio al activar              | Pendiente → Activo tras reintento | 0 → 8      | 0 → 1         | Rollback memoria y SQL real; token sin consumir tras fallo.                                                                                       |
| Google válido, nuevo o pendiente         | Activo                            | 8          | 1             | Proveedor simulado; vínculo `sub` persistente.                                                                                                    |
| Correo y Google concurrentes             | Activo                            | 8          | 1             | PostgreSQL real, proveedor Google simulado.                                                                                                       |
| Google no verificado/sujeto incompatible | Sin activar o modificar           | Conservado | Conservados   | 401/409 según el caso.                                                                                                                            |
| Cuenta anterior con historial            | Activo                            | 0 / 7 / 3  | 0 adicionales | Tres cuentas PostgreSQL anteriores, contraseña real de desarrollo e historial idéntico. Google legado también cubierto con simulación en memoria. |
| Cuenta suspendida/inactiva               | Suspendido/Inactivo               | Conservado | Conservados   | Sin reactivación; JWT previo rechazado. Replay confirmado no emite sesión.                                                                        |
| State OAuth como Bearer                  | Activo sin cambios                | 8          | 1             | 401; sesión válida de control 200.                                                                                                                |

Evidencias locales sin versionar: `.local/phase2/baseline-fixtures.patch`, `baseline-unit-final.log`, `baseline-e2e-final.log`, `baseline-postgres.log`, `final-prisma-validate.log`, `final-build.log`, `final-lint.log`, `final-test.log`, `final-test-e2e.log`, `final-test-postgres.log`, `upgrade-results.json` y `demo-results.json`. Los archivos `*.private.json`, `.env.phase2` y `phase1-before.dump` contienen material privado y permanecen ignorados; no compartirlos.

## Demostración corta en esta PC

La API queda ejecutándose en `http://127.0.0.1:4103`, PostgreSQL en `127.0.0.1:55434` y Mailpit en `http://127.0.0.1:4104`. Readiness debe indicar `postgresql`:

```powershell
Set-Location 'C:\Users\GONZALO APAZA\Desktop\Backend_\BancoTiempo\backend'
Invoke-RestMethod http://127.0.0.1:4103/health/ready
```

1. Abrir Swagger: `http://127.0.0.1:4103/docs`. Consultar `GET /careers` y copiar un UUID activo.
2. Ejecutar `POST /auth/register` con un correo de desarrollo nuevo `demo-tu-nombre@ucb.edu.bo`, nombre/apellido, contraseña propia de 12–128 caracteres, `idCarrera` y semestre 1–12. Observar `Pendiente` y `verification_required: true`. Intentar login: 403.
3. Abrir `http://127.0.0.1:4104`, abrir el mensaje dirigido a ese correo y seguir el enlace. Pulsar **Confirmar mi correo**. El correo queda en el buzón local, no en UCB.
4. Ejecutar `POST /auth/login` con la contraseña elegida. Copiar `access_token` en **Authorize** de Swagger, sin compartirlo.
5. Consultar `GET /credits/me`: saldo `"8"`; `GET /credits/me/movements`: un `BonoInicial`. Repetir el enlace o login y comprobar que sigue habiendo uno.

Si los servicios están detenidos, los scripts privados preparados permiten arrancar/parar sin modificar fase 1:

```powershell
& .\.local\phase2\start.ps1
# Para detener API y Mailpit, conservando PostgreSQL y los volúmenes:
& .\.local\phase2\stop.ps1
```

No ejecutar `start.ps1` mientras esa API ya esté activa. Los scripts usan el runtime conservado de fase 1, comprueban el destino PostgreSQL y verifican propiedad del PID antes de detenerlo. `.local/phase2/.env.phase2` reutiliza la conexión privada de fase 1 y selecciona bono 8 y SMTP local. No modifica `.local/phase1/.env.phase1`. Para recompilar cambios, usar el Node 26.8.2/npm 11.19.1 conservado, compilar y reiniciar la API propia.

En otro entorno, tomar `backend/.env.example`, configurar secretos propios y revisar `DATABASE_URL` antes de migrar. El transporte viene deshabilitado por defecto; no expone un token alternativo por HTTP ni por consola. Para Mailpit usar `compose.mailpit.yaml`, SMTP `127.0.0.1:11026`, `MAIL_TRANSPORT=smtp`, `SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=false` y `PUBLIC_API_URL` con el origen correcto de la API. En producción se exige HTTPS y SMTP con TLS. Las opciones se corresponden con [SMTP de Nodemailer](https://nodemailer.com/smtp) y [configuración de Mailpit](https://mailpit.axllent.org/docs/configuration/runtime-options/).

## Inventario de archivos para revisar

Rutas relativas a `backend/`; el reporte de fase 1 se conserva y no forma parte de los cambios de fase 2.

| Grupo                              | Archivos nuevos o modificados                                                                                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migración y esquema                | `prisma/migrations/20261120000000_verificacion_institucional/migration.sql` (nuevo), `prisma/schema.prisma`, `src/infrastructure/prisma/schema-contract.spec.ts`.                                                                                                         |
| Activación y correo                | `src/modules/auth/account-activation.ts`, `email-verification.service.ts`, `verification-mailer.ts`, `verification-page.ts`, `dto/verify-email.dto.ts` (todos nuevos bajo auth).                                                                                          |
| Registro, Google, sesión y Swagger | `src/modules/auth/auth.controller.ts`, `auth.module.ts`, `auth.service.ts`, `google-auth.service.ts`, `google-identity.ts`, `jwt.strategy.ts`, `registration-policy.ts`; `src/modules/calendar/calendar.service.ts`; `src/config/configure-app.ts`.                       |
| Usuario y adaptadores              | `src/modules/users/memory-users.repository.ts`, `users.repository.ts`, `user.types.ts`, `admin-users.controller.ts`; `src/modules/exchanges/exchange.types.ts`, `memory-exchange.repository.ts`; `src/infrastructure/prisma/prisma-exchange.repository.ts`.               |
| Configuración y protección         | `src/config/environment.ts`, `src/common/enums/record-status.enum.ts`, `src/common/filters/http-exception.filter.ts`, `src/common/interceptors/sensitive-fields.interceptor.ts`, `src/modules/health/health.controller.ts`, `.env.example`.                               |
| Correo y dependencias              | `compose.mailpit.yaml` (nuevo), `package.json`, `package-lock.json` (Nodemailer 10.6.1), `eslint.config.mjs` (excluye herramientas privadas `.local/`).                                                                                                                   |
| Pruebas oficiales PostgreSQL       | `scripts/test-postgres.cjs`, `scripts/test-account-activation.cjs` (nuevo).                                                                                                                                                                                               |
| Unitarias                          | `src/modules/auth/auth.service.spec.ts`, `google-identity.spec.ts`; `src/modules/users/users.service.spec.ts`; `src/modules/health/health.controller.spec.ts`; contrato de esquema mencionado arriba.                                                                     |
| E2E y fixtures                     | `test/account-activation.e2e-spec.ts`, `test/support/verification.fixture.ts` (nuevos); `test/availability-integrity.e2e-spec.ts`, `catalog-profile.e2e-spec.ts`, `exchanges-integrity.e2e-spec.ts`, `security.e2e-spec.ts`, `setup-env.cjs`, `support/users.fixture.ts`. |
| Operación y documentación          | `scripts/create-dev-admin.cjs`, `README.md`, `docs/frontend-integration.md`, este reporte. Herramientas/evidencias privadas nuevas solo en `.local/phase2/`.                                                                                                              |

## Revisión de BD, decisión del PO y fase 3

BD debe revisar nombres/constraints de la migración incremental, el tratamiento `cuenta_previa` sin evidencia histórica, el índice de bono único y posibles duplicados en otros destinos. La instalación limpia se validó con el script oficial; la actualización se validó sobre la base anterior con copia previa y comparación exacta. Cada aplicación adicional debe comprobar su destino local o acordarse explícitamente con el responsable de esa base.

El PO conserva la decisión del **monto definitivo**; hoy se usa 8 configurable y se probó 0. Cambiarlo afecta futuras activaciones nuevas, sin abonos retroactivos ni cambios de historial.

Se puede iniciar la **fase 3 de ofertas** sobre esta base local. Deben acordarse con Frontend los endpoints de ofertas y el precio fijado por el tutor, con snapshot al solicitar/reservar. Los importes como `3.7` siguen bloqueados hasta la migración decimal coordinada de los nueve campos, sus validadores y contratos. Esta entrega no implementa ni declara verificados esos endpoints de ofertas. El login Google real y la revisión visual local siguen pendientes de proveedor/navegador disponibles; sus límites se distinguen de las pruebas simuladas aprobadas.
