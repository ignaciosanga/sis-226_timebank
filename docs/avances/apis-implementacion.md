# Avances — Equipo APIs e Implementación

## Estructura monorepo de integración

- **Fecha:** 2026-10-24
- **Estado:** En progreso
- **Responsables:** Ignacio Sanga

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
