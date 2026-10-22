# Ejecución local v0.3

Node.js 24 y npm 11. Las verificaciones de esta entrega se ejecutaron en Windows con Node 24.21.0 y npm 11.19.0.

```powershell
npm.cmd ci
npm.cmd run setup:env
npm.cmd run build
npm.cmd start
```

Recarga: `npm.cmd run start:dev`. Health `/health`, Swagger `/docs`, OpenAPI `/docs-json`; puerto predeterminado 4000. Detener con Ctrl+C. No arrancar dos servidores en el mismo puerto.

`setup:env` no sobrescribe `.env`; genera JWT_SECRET local aleatoria y mantiene PostgreSQL deshabilitado. PERSISTENCE_MODE=memory se aplica por defecto aunque falte en un `.env` anterior. Todas las variables y sus límites están en el [README](../README.md#variables-de-entorno). Esta versión rechaza NODE_ENV=production mientras solo tenga persistencia temporal.

## ADMIN local

```powershell
npm.cmd run build
npm.cmd run start:memory-admin -- admin@example.test
```

Este comando sustituye al servidor normal durante la prueba, escucha solo en 127.0.0.1 y muestra una contraseña aleatoria. Login normal en `/auth/login`; después usar Bearer en Swagger. El administrador tiene también rol ESTUDIANTE. No hay contraseña fija ni usuarios precreados al arrancar normalmente.

Usuarios y publicaciones se comparten únicamente dentro de esa instancia. Al detenerla desaparecen; al reiniciar vuelven cuatro categorías y cinco habilidades de ejemplo, sin usuarios ni horarios. No hace falta limpiar una base de datos.

## Verificación

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd run format:check
```

Las pruebas usan JWT y Argon2id reales con repositorios de memoria o mocks aislados; no necesitan BD. El flujo manual de estudiante está en el [README](../README.md#flujo-de-estudiante-en-powershell).

## PostgreSQL y Docker

Mantener DATABASE_ENABLED=false y DATABASE_URL vacía. Esta entrega no necesita ningún comando Prisma. DATABASE_ENABLED no selecciona repositorios: activar esa variable no convierte la memoria en persistencia PostgreSQL.

Cuando se reciba la fuente definitiva de BD, revisar esquema, acceso autorizado, UUID, catálogos, estados, restricciones e índices antes de implementar adaptadores y pruebas transaccionales. No ejecutar migraciones sobre la base del otro equipo.

Compose conserva el target development y sus volúmenes; no se ejecutó Docker durante esta entrega. El target runtime configura production y no podrá arrancar hasta existir un proveedor duradero. No se añade PostgreSQL a Compose.

## Solicitudes, reservas y créditos

El flujo local, sus políticas provisionales, Idempotency-Key y cargas ADMIN están documentados en [README](../README.md) y [reporte v0.3](progress-v0.3.md). El saldo inicial es cero. La memoria transaccional no ofrece persistencia tras reiniciar. Ver [compatibilidad con BD](database-compatibility.md) antes de conectar PostgreSQL.
