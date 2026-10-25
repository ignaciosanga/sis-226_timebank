# APIs e Implementación — Banco de Tiempo Universitario

Integración entre el frontend y el backend, despliegue del sistema y coordinación técnica entre equipos del proyecto Banco de Tiempo Universitario.

## Alcance

El equipo conecta las pantallas de Vue 3 con la API de NestJS, publica el sistema completo y mantiene `main` como versión integrada de todos los equipos. Cubre tres frentes:

- **Conexión con la API:** cliente HTTP, sesión con token Bearer, manejo de errores y una función por endpoint en `frontend/src/services`.
- **Despliegue:** frontend y backend en Render, base de datos PostgreSQL en Neon y datos de demostración.
- **Integración:** estructura del repositorio, revisión de Pull Requests e incorporación del trabajo de cada equipo en `main`.

## Sistema publicado

| Componente | URL |
|---|---|
| Aplicación web | https://timebank-frontend.onrender.com |
| API | https://timebank-backend-51q9.onrender.com |
| Documentación de la API (Swagger) | https://timebank-backend-51q9.onrender.com/docs |
| Estado del backend y la base | https://timebank-backend-51q9.onrender.com/health/ready |

## Historias de usuario y estimación (Sprint 1: 53 puntos)

| Código | HU | Título | Puntos | Responsable | Estado |
|--------|-----|--------|:------:|-------------|--------|
| TBAPI-73 | HU-01 | Registro e inicio de sesión con correo UCB | **8** | Dev 1 | En curso |
| TBAPI-74 | HU-02 | Publicar habilidades y disponibilidad | **5** | Dev 2 | En curso |
| TBAPI-75 | HU-03 | Solicitar y gestionar intercambios | **13** | Dev 2 | Finalizado |
| TBAPI-76 | HU-04 | Consultar saldo y movimientos de créditos | **3** | Dev 2 | Finalizado |
| TBAPI-77 | HU-05 | Gestión de usuarios y créditos por el administrador | **8** | Dev 1 | Backlog |
| TBAPI-78 | HU-06 | Desplegar el sistema completo con URL pública | **8** | Scrum Master | En curso |
| TBAPI-79 | HU-07 | Integrar y documentar el trabajo de los equipos | **8** | Product Owner | En curso |

**Total:** 53 Story Points; 45 en el Sprint 1 y 8 en el backlog (HU-05). Cada historia agrupa como subtareas los requisitos funcionales RF-01 a RF-25 e INT-01 a INT-04.

## Arquitectura de integración

```
Navegador ──► Frontend Vue 3 (Render, sitio estático)
                 │  frontend/src/services: token Bearer, Idempotency-Key, errores
                 ▼
              Backend NestJS (Render, Docker, Oregón)
                 │  Prisma
                 ▼
              PostgreSQL (Neon, Oregón)
```

1. **Pantallas:** las vistas usan el store `frontend/src/stores/app.js`, que llama a las funciones de `frontend/src/services`.
2. **API:** el backend valida la sesión, aplica las reglas de créditos y reservas, y expone su contrato en `/docs`.
3. **Base de datos:** el esquema oficial son las migraciones de `backend/prisma/migrations`. El backend y la base están en la misma región para reducir la latencia.

## Archivos a cargo del equipo

```
render.yaml                     ← Despliegue de frontend y backend en Render
scripts/demo-data.mjs           ← Estudiantes, habilidades, horarios y créditos de demostración
frontend/src/services/          ← Cliente HTTP y una función por endpoint
frontend/.env.example           ← URL de la API para el frontend
docs/despliegue.md              ← Guía de despliegue y problemas resueltos
docs/avances/apis-implementacion.md  ← Registro de hitos del equipo
apis-implementacion/README.md   ← Este archivo
```

## Cómo contribuir

1. Actualizar `main`: `git checkout main` y `git pull`.
2. Crear una rama con prefijo `apis/`, por ejemplo `apis/coleccion-postman`.
3. Hacer commits con títulos descriptivos y subir la rama con `git push -u origin <rama>`.
4. Abrir un Pull Request hacia `main` indicando la tarea de Jira. Si modifica archivos de otro equipo, mencionarlo en la descripción para su revisión.

## Equipo y roles

| Rol | Responsabilidad |
|-----|-----------------|
| **Product Owner** | Prioridades, decisiones de producto, integración en `main` y despliegue (HU-07) |
| **Scrum Master** | Seguimiento del sprint y Docker Compose del sistema completo (HU-06) |
| **Dev Lead** | Contrato de la API y revisión técnica (RF-24) |
| **Dev 1** | Sesión, registro, administración y colección de pruebas de API (HU-01, HU-05) |
| **Dev 2** | Habilidades, disponibilidad, intercambios, créditos y datos de demostración (HU-02, HU-03, HU-04) |
