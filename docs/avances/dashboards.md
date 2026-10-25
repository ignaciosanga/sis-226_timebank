# Avances — Equipo Dashboards

## Inicio del Sprint 0 — Definición, Estimación y Preparación

- **Fecha:** 2026-10-24
- **Estado:** En progreso
- **Responsables:** Equipo Dashboards (5 integrantes)

### Descripción

En el marco del Sprint 0 (22 oct – 5 nov), se completó la estimación de las 7 historias de usuario alcanzando **42 puntos de historia** en escala Fibonacci. Se definió la adopción de **Google Looker Studio** como herramienta unificada de reportería y visualización gerencial y de usuario. Se completó la asignación de HUs a los 3 desarrolladores y se coordinó exitosamente con el equipo de Frontend la estrategia de integración mediante componentes embebidos (`<iframe>`).

### Funcionalidades y Estimación

- **Estimación en Jira (42 Story Points totales):**
  - **SCRUM-1 (HU01):** Panel personal del estudiante — **3 pts** *(Fecha límite: 27 oct)*
  - **SCRUM-5 (HU02):** Historial de movimientos de horas — **5 pts**
  - **SCRUM-6 (HU03):** Reporte de servicios realizados y recibidos — **5 pts**
  - **SCRUM-7 (HU04):** Dashboard general de la plataforma — **8 pts**
  - **SCRUM-8 (HU05):** Análisis de intercambio de horas — **8 pts**
  - **SCRUM-9 (HU06):** Reporte de usuarios y participación — **5 pts**
  - **SCRUM-10 (HU07):** Análisis de habilidades y demanda — **8 pts**

- **Distribución del equipo de desarrollo:**
  - **Dev 1 (13 pts):** Módulo Estudiante / Cliente (`HU01`, `HU02`, `HU03`).
  - **Dev 2 (13 pts):** Módulo Administrador: Vista General y Usuarios (`HU04`, `HU06`).
  - **Dev Lead (16 pts):** Módulo Administrador: Intercambios y Habilidades (`HU05`, `HU07`).

- **Selección tecnológica:**
  - Adopción de **Google Looker Studio** para todos los dashboards.
  - Integración directa con el sistema web (Vue 3) a través de contenedores responsivos `<iframe>` en el perfil del estudiante y el panel administrativo.

### Evidencias y pruebas

- Historias de usuario y estimaciones registradas en Jira: https://ucb-team-reportesbi.atlassian.net
- Rama creada y mantenida: `equipo/dashboards`
- Coordinación con Frontend: confirmada la reserva de espacios/contenedores responsivos (`width: 100%`, `height: 600-750px`) en el frontend web.
- Pruebas pendientes: validación de fuentes de datos (Google Sheets de prueba / conexión PostgreSQL) y publicación de vistas interactivas.

### Dependencias

- **Equipo Base de Datos / Backend:** Diccionario de datos final y carga de datos de prueba en PostgreSQL (o exportación CSV) para alimentar las visualizaciones.
- **Equipo Frontend:** Inserción del snippet `<iframe>` de Looker Studio en las rutas del estudiante y administrador una vez publicados los informes.
