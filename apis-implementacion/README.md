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

## Sprints

| Sprint | Fechas | Puntos comprometidos | Puntos completados | Historias completadas |
|--------|--------|:--------------------:|:------------------:|:---------------------:|
| Sprint 1 | 24/10/2026 | 45 | 32 | 4 de 6 |
| Sprint 2 | 25/10/2026 | 29 + 8 agregados | 37 | 5 de 5 |

En el Sprint 1 quedaron abiertas HU-02 y HU-07, que pasaron al Sprint 2 junto con HU-05 y HU-08. Durante el Sprint 2 se agregó HU-09 (inicio de sesión con Google), que se completó el mismo día. El informe de velocidad de Jira muestra 0 puntos comprometidos en el Sprint 1 porque el sprint se inició antes de cargar las estimaciones; la planificación real fue de 45 puntos.

## Historias de usuario

| Código | HU | Título | Puntos | Responsable | Sprint | Estado |
|--------|-----|--------|:------:|-------------|:------:|--------|
| TBAPI-73 | HU-01 | Registro e inicio de sesión con correo UCB | **8** | Dev 1 | 1 | Finalizado |
| TBAPI-74 | HU-02 | Publicar, retirar y editar habilidades y disponibilidad | **5** | Dev 2 | 1 → 2 | Finalizado |
| TBAPI-75 | HU-03 | Solicitar y gestionar intercambios | **13** | Dev 2 | 1 | Finalizado |
| TBAPI-76 | HU-04 | Consultar saldo y movimientos de créditos | **3** | Dev 2 | 1 | Finalizado |
| TBAPI-77 | HU-05 | Gestión de usuarios, créditos y métricas del administrador | **8** | Dev 1 | 2 | Finalizado |
| TBAPI-78 | HU-06 | Desplegar el sistema completo con URL pública | **8** | Scrum Master | 1 | Finalizado |
| TBAPI-79 | HU-07 | Integrar y documentar el trabajo de los equipos | **8** | Product Owner | 1 → 2 | Finalizado |
| TBAPI-80 | HU-08 | Guardar las sesiones en el calendario (.ics y Google Calendar) | **8** | Dev Lead y Product Owner | 2 | Finalizado |
| TBAPI-87 | HU-09 | Iniciar sesión y registrarse con la cuenta institucional de Google | **8** | Product Owner | 2 | Finalizado |

**Total:** 69 Story Points en 9 historias. Cada historia agrupa como subtareas los requisitos funcionales RF-01 a RF-32 e INT-01 a INT-07.

## Funcionalidades entregadas

- **Cuenta:** registro con correo `@ucb.edu.bo` e inicio de sesión automático, inicio de sesión y registro con la cuenta institucional de Google, edición del perfil y 8 créditos de bienvenida.
- **Habilidades y horarios:** publicar, retirar y consultar habilidades; publicar, editar y desactivar horarios; búsqueda de ofertantes por habilidad, visible también sin iniciar sesión.
- **Intercambios:** solicitar, aceptar, rechazar y cancelar; reservas con créditos retenidos y doble confirmación antes de transferirlos.
- **Calendario:** descarga de la reserva como archivo `.ics` y alta del evento en Google Calendar.
- **Créditos:** saldo disponible, retenido y total, con historial de movimientos.
- **Administración:** gestión de usuarios, carga de créditos, panel de resumen y reporte de Looker Studio del equipo Dashboards.
- **Datos para reportes:** 32 vistas de reporte y un usuario de solo lectura en la base para Dashboards (INT-04).

## Calidad

- **Integración continua:** GitHub Actions compila, ejecuta el lint y las pruebas del backend y del frontend en cada Pull Request a `main` (`.github/workflows/ci.yml`).
- **Pruebas:** pruebas unitarias del backend con Jest y del frontend con `node --test`, incluidas la verificación del token de Google y la generación del `.ics`.
- **Revisión:** todo cambio entra a `main` mediante Pull Request.

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
.github/workflows/ci.yml        ← Integración continua de backend y frontend
scripts/demo-data.mjs           ← Estudiantes, habilidades, horarios y créditos de demostración
frontend/src/services/          ← Cliente HTTP y una función por endpoint
frontend/.env.example           ← URL de la API, reportes de Looker y cliente de Google
backend/src/modules/auth/google-*  ← Inicio de sesión con Google
backend/prisma/migrations/20261025000000_vistas_reporte  ← Vistas de reporte
docs/int-04-esquema.md          ← Unificación del esquema de base de datos
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
| **Product Owner** | Prioridades, integración en `main`, despliegue, CI e inicio de sesión con Google (HU-07, HU-09) |
| **Scrum Master** | Seguimiento del sprint y Docker Compose del sistema completo (HU-06) |
| **Dev Lead** | Contrato de la API, Google Cloud y Google Calendar (RF-24, HU-08) |
| **Dev 1** | Sesión, registro, administración, métricas y colección de pruebas de API (HU-01, HU-05) |
| **Dev 2** | Habilidades, disponibilidad, intercambios, créditos y datos de demostración (HU-02, HU-03, HU-04) |
