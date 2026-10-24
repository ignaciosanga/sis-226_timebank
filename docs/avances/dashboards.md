# Avances — Equipo Dashboards

## Inicio del Sprint 0 — Definición y preparación

- **Fecha:** 2026-10-22
- **Estado:** En progreso
- **Responsables:** Equipo Dashboards (5 integrantes)

### Descripción

Inicio del Sprint 0 (22 oct – 5 nov). Se definieron las 7 historias de usuario, se seleccionaron las herramientas de trabajo y se distribuyeron las tareas entre los tres desarrolladores. Se creó la rama del equipo y la estructura inicial del proyecto.

### Funcionalidades

- Definición de 7 historias de usuario (HU01–HU07) con criterios de aceptación y subtareas.
- Selección de herramientas: Chart.js (vue-chartjs) para gráficos de estudiante, Power BI para dashboards del administrador.
- Creación de la rama `equipo/dashboards` y estructura inicial de archivos.
- Registro del equipo en Jira (ucb-team-reportesbi).

### Evidencias y pruebas

- Historias de usuario registradas en Jira: https://ucb-team-reportesbi.atlassian.net
- Rama creada: `equipo/dashboards`
- Pruebas ejecutadas: no aplica en esta fase.
- Pruebas pendientes: verificar conexión a la base de datos PostgreSQL y a los endpoints de la API.

### Dependencias

- Equipo Backend: se requieren datos de prueba cargados en la base de datos (usuarios, intercambios, reservas, movimientos de créditos) para que los dashboards tengan contenido. Issue pendiente de crear.
- Equipo Frontend: se requiere coordinar la integración de los componentes Chart.js dentro de la aplicación Vue 3. Issue pendiente de crear.
- Equipo Base de Datos: se requiere confirmar que las tablas en PostgreSQL están pobladas con datos de prueba. Issue pendiente de crear.
