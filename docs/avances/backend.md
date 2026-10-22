# Avances — Equipo Backend

## Primera versión del backend — v0.1.0

- **Fecha:** 2026-10-21 (America/La_Paz).
- **Responsable:** Equipo Backend; desarrollador Gonzalo Apaza.
- **Estado:** Fase 0 completada; base de seguridad preparada y probada; PostgreSQL pendiente.
- **Rama:** [Backend](https://github.com/ignaciosanga/sis-226_timebank/tree/Backend).

### Descripción

Primera entrega Backend: NestJS/TypeScript, infraestructura HTTP, seguridad, contratos de persistencia, pruebas, Docker y documentación. Se conserva el historial de main como base; no se integran cambios en main ni en ramas de otros equipos.

La rama se denomina Backend por instrucción expresa del desarrollador. Las normas generales proponen equipo/backend; la diferencia de nombre se documenta aquí. El README original se conserva en docs/collaboration.md.

### Funcionalidades

- Health independiente de PostgreSQL y Swagger/OpenAPI.
- Entorno validado, Helmet, CORS, throttling y validación estricta.
- Errores uniformes y protección de contraseñas/hashes.
- Argon2id, JWT, Passport, guards y decorators RBAC.
- Servicios Auth/Users y puertos sin repositorios ficticios de producción.
- Preparación Prisma 7.10.1/PostgreSQL sin inventar modelos.
- Dockerfile, Compose, organización modular y documentación.

### Evidencias y pruebas

- [Código de esta entrega](https://github.com/ignaciosanga/sis-226_timebank/tree/Backend).
- [Registro de verificación](../verification.md).
- Build y lint correctos.
- 33 pruebas unitarias y 35 HTTP/E2E aprobadas.
- Health y Swagger verificados con HTTP 200 en puerto 4000.
- Compose validado; imagen/ejecución pendientes de motor Docker.
- Mensaje del commit: `feat(backend): primera version v0.1.0 del Banco de Tiempo Universitario`.

### Dependencias

Faltan esquema oficial, conexión autorizada, repositorios/transacciones reales y aprobación del saldo inicial por el PO. Auth/Users no se publican como endpoints funcionales; créditos, reservas y transferencias siguen pendientes.

La publicación en Backend no incorpora este registro a main; su integración requiere el proceso de revisión del grupo.
