# Dashboards — Nexo U (Banco de Tiempo Universitario)

Componentes de visualización, indicadores de gestión y reportes decisionales de la plataforma **Nexo U** (UCB La Paz).

## Alcance y evolución técnica

Este equipo diseña, construye y mantiene los paneles analíticos de la plataforma para dos audiencias:

- **Vista del estudiante (`/perfil/resumen`):** panel personal privado con balance de créditos, historial de movimientos, servicios ofrecidos vs. recibidos, evolución de calificaciones/opiniones y progreso de actividad.
- **Vista del administrador (`/administracion/metricas`):** tablero gerencial con indicadores globales de la plataforma, **Reputación y reconocimiento de tutores (*Knowledge Score*)**, **Command Center académico** (49 materias del pensum de Ingeniería de Sistemas), **Economía dinámica, horarios y cancelaciones**, y composición de la comunidad.

### Migración de Looker Studio a Vue 3 nativo

En la primera etapa se utilizaron reportes embebidos de **Google Looker Studio** (`<iframe>`) conectados a PostgreSQL (Neon). En pruebas de producción se detectaron dos limitaciones estructurales:
1. Las cuentas institucionales `@ucb.edu.bo` tienen desactivado Data/Looker Studio en Google Workspace, lo que bloquea el acceso al informe incluso estando en modo público.
2. Un `<iframe>` público no permite aislar de forma segura los datos privados del estudiante autenticado.

Por ello, para la etapa actual se adoptó una arquitectura de **componentes nativos en Vue 3 con gráficos SVG/CSS** (sin dependencias externas), manteniendo la identidad visual institucional de la UCB y consumiendo directamente los endpoints autenticados del backend.

## Estructura del directorio

```text
dashboards/
├── README.md              ← Documentación general y arquitectura de dashboards
├── estudiante/            ← Documentación y entregables de la vista de Estudiante
├── administrador/         ← Documentación y entregables de la vista de Administrador
└── assets/                ← Recursos visuales, capturas y bocetos
```

> **Nota de integración con Frontend (Issue #50):** debido a que `docker-compose.yml` compila el frontend con `context: ./frontend` y `render.yaml` usa `buildFilter: frontend/**`, los componentes Vue ejecutables se encuentran en `frontend/src/features/metrics/vue-dashboards/` (pendiente de ratificación formal con el equipo de Frontend/APIs en el Issue #50), evitando duplicación de código y garantizando compatibilidad con Docker, Render y CI.

## Componentes implementados en Vue 3

- **Gráficos reutilizables (`charts/`):** `DonutChart.vue`, `LineChart.vue`, `BarChart.vue` (vertical, horizontal y comparativo agrupado) y `HeatmapChart.vue` (día × franja horaria).
- **Módulo Administrador (`AdminDashboardVue.vue` + `KnowledgeScorePanel.vue`):**
  - **Reputación y reconocimiento de tutores (*Knowledge Score*):** cálculo con la fórmula `0.5 × tutorías_completadas + 1.5 × promedio` (priorizando el valor entregado por el backend cuando esté disponible), reconocimiento de **«Tutor de alto impacto»** (`≥ 3` opiniones, `≥ 4.5★`, `≥ 5` tutorías completadas y `≥ 90%` cumplimiento), manejo del estado `pocos_datos`, gráfico de impacto y filtros por área, semestre y materia.
  - **Paneles gerenciales base:** resumen general de plataforma, intercambios y mapa de demanda horaria, composición de la comunidad, y análisis de habilidades ofertadas vs. solicitadas.
- **Módulo Estudiante (`StudentDashboardVue.vue`):** tarjetas de créditos, calificación promedio, servicios ofrecidos vs. recibidos, evolución de saldo, historial filtrable de movimientos y detalle filtrable de servicios.

## Fuentes de datos y contratos

- **Fuente principal:** API REST del backend NestJS sobre PostgreSQL (Neon), validada automáticamente contra `docs/openapi.json`.
- **Créditos:** todos los importes se manejan con precisión decimal (`NUMERIC(12,2)` en BD / string decimal en JSON).
- **Endpoints consumidos:**
  - **Administrador:** `GET /analytics/overview`, `/analytics/users`, `/analytics/exchanges`, `/analytics/credits`, `/analytics/skills`, `/analytics/academic`, `/analytics/reputation`, `/analytics/economy`.
  - **Estudiante:** `GET /credits/me`, `/credits/me/movements`, `/reservations/me`, `/intercambios/mis-clases`, `/roadmap/me`.

## Equipo y Roles

| Rol | Responsabilidad |
|---|---|
| **Product Owner** | Priorización de funcionalidades y validación de criterios de aceptación |
| **Scrum Master** | Seguimiento del sprint y coordinación ágil |
| **Jefe de Devs (Gus)** | Arquitectura de dashboards Vue 3, reputación de tutores (*Knowledge Score*), coordinación técnica e integración |
| **Desarrollador (Pablo)** | Seguimiento académico de materias (*Command Center*) y monitoreo de créditos, horarios y cancelaciones |
| **Desarrolladora (Mayte)** | Panel personal actualizado de actividad, calificaciones y progreso del estudiante |
