# Avances — Equipo APIs e Implementación

## Estructura monorepo de integración

- **Fecha:** 2026-10-24
- **Estado:** En progreso
- **Responsables:** Equipo APIs e Implementación

### Descripción

Se organizó el repositorio en una carpeta por equipo para integrar las entregas en `main` sin conflictos entre ramas. Cada carpeta conserva el contenido publicado en la rama de su equipo; el README de normas de la raíz no se modificó.

### Funcionalidades

- `backend/`: contenido de la rama `Backend` (commit 8419ea9).
- `frontend/`: contenido de la rama `equipo/frontend` (commit 9379790).
- `database/`: esquema y documentación de la rama `equipo/BD` (commit 1f23326), sin el archivo `gerencial_2026.zip`.
- `dashboards/` y `docs/avances/dashboards.md`: contenido de la rama `equipo/dashboards` (commit 8043ac4).
- `.gitignore` en la raíz para excluir dependencias, compilados y archivos `.env`.

### Evidencias y pruebas

- Pruebas ejecutadas: backend levantado con Docker Compose desde su rama; `GET /health/ready` responde `{"status":"ok","persistence":"postgresql"}`. Flujo verificado por API: registro, login, publicación de habilidad, disponibilidad y creación de solicitud.
- Limitación encontrada: la aceptación de una solicitud devuelve 409 porque los usuarios nuevos inician con 0 créditos; requiere una carga de créditos por un administrador.
- Pruebas pendientes: levantar el sistema completo desde la raíz del monorepo.

### Dependencias

- `docker-compose.yml` unificado en la raíz (RF-19, RF-20, RF-21).
- Cada equipo debe continuar su trabajo dentro de su carpeta en `main`.

## Despliegue público del sistema

- **Fecha:** 2026-10-24
- **Estado:** Completado
- **Responsables:** Equipo APIs e Implementación

### Descripción

El sistema quedó publicado: frontend y backend en Render, y la base de datos PostgreSQL en Neon. La guía, las variables y los problemas resueltos están en `docs/despliegue.md`.

### Funcionalidades

- Frontend: https://timebank-frontend.onrender.com
- Backend: https://timebank-backend-51q9.onrender.com, con Swagger en `/docs`.
- Base de datos en Neon con las 2 migraciones del backend y los catálogos iniciales.
- Integración en `main` del rediseño de Frontend (PR #3) y de los avances de Base de Datos (PR #5).

### Evidencias y pruebas

- Commits y PR: #3, #5, #6, #7 y #8.
- Pruebas ejecutadas: `GET /health/ready` responde `{"status":"ok","persistence":"postgresql"}`; `GET /careers`, `/categories` y `/skills` responden 200 con los catálogos; el frontend carga en la URL pública.
- Pruebas pendientes o limitaciones: el frontend aún usa el simulador de `frontend/src/features/timebank/demo-actions.js` y no consume la API. Los usuarios nuevos empiezan con 0 créditos, por lo que aceptar un intercambio requiere una carga de créditos por un administrador hasta que Backend defina el saldo inicial.

### Dependencias

- Conexión de las pantallas con la API desde `frontend/src/services` (RF-01 a RF-18).
- Saldo inicial, registro con dominio `ucb.edu.bo` y búsqueda de ofertantes, solicitados a Backend mediante Issue.

