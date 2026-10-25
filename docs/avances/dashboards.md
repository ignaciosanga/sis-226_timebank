# Avances — Equipo Dashboards

## Sprint 0 — Definición, Estimación y Primeras Entregas (HU05 & HU07)

- **Fecha:** 2026-10-25
- **Estado:** En progreso (16 de 42 puntos completados)
- **Responsables:** Equipo Dashboards (5 integrantes)

### Descripción

En el marco del Sprint 0 (22 oct – 5 nov), se completó la configuración inicial de la plataforma unificada **Google Looker Studio**, la importación de datos semilla del catálogo demo y el desarrollo completo de las dos primeras historias de usuario correspondientes al módulo administrativo de análisis operativo: **SCRUM-8 (HU05)** y **SCRUM-10 (HU07)**. Además, se desarrolló y entregó el componente Vue 3 para la incrustación directa en el frontend web del proyecto.

### Funcionalidades y Estado de Historias

- **Total de puntos del Sprint 0:** 42 Story Points.
- **Puntos completados:** 16 Story Points (38% del sprint completado).

| Código | HU | Estado | Puntos | Entregables |
|:------:|:---|:------:|:------:|:------------|
| **SCRUM-8** | **HU05 — Análisis de intercambio de horas** | **Completado (100%)** | 8 pts | • Tarjeta KPI de Total Horas Solicitadas.<br>• Filtro interactivo desplegable por estado.<br>• Serie temporal con desglose multidimensional por estado (`aceptada`, `pendiente`, `rechazada`). |
| **SCRUM-10** | **HU07 — Análisis de habilidades y demanda** | **Completado (100%)** | 8 pts | • Combinación de datos (JOIN) entre solicitudes y habilidades.<br>• Gráfico de barras horizontales con ranking de habilidades más demandadas y etiquetas numéricas. |
| SCRUM-1 | HU01 — Panel personal del estudiante | En progreso | 3 pts | En desarrollo por Dev 1 (fecha límite 27 oct). |
| SCRUM-5 | HU02 — Historial de movimientos | Por hacer | 5 pts | Asignado a Dev 1. |
| SCRUM-6 | HU03 — Reporte de servicios | Por hacer | 5 pts | Asignado a Dev 1. |
| SCRUM-7 | HU04 — Dashboard general de la plataforma | En progreso | 8 pts | Asignado a Dev 2. |
| SCRUM-9 | HU06 — Reporte de usuarios y participación | Por hacer | 5 pts | Asignado a Dev 2. |

### Componentes de Código e Integración Web

- **Componente Vue 3 entregado:** `dashboards/administrador/DashboardAdminIntercambios.vue`
  - Contenedor responsivo con soporte para desktop y mobile.
  - Integración mediante `<iframe>` con sandbox de seguridad habilitado.
- **Enlace oficial del reporte interactivo:**  
  `https://datastudio.google.com/embed/reporting/1bac8147-8dd5-43b1-9aed-2db46c8e5392/page/p_g27hvlxo8d`

### Evidencias y Pruebas

- Interfaz funcional y probada en Looker Studio con interacción de filtros en tiempo real.
- Datos semilla verificados y validados contra el diccionario relacional `v0.31plus`.
- Coordinación con Frontend: confirmada la compatibilidad del componente entregado.

### Próximos Pasos

- Apoyar a Dev 1 para el cierre de HU01 antes de la fecha límite del 27 de octubre.
- Apoyar a Dev 2 en la construcción de KPIs globales de HU04.
- Actualizar el tablero de Jira pasando HU05 y HU07 a estado completado.
