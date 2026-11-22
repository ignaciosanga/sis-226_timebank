# Avances — Equipo Dashboards

## Sprint 0 — Definición, Estimación y Primeras Entregas

- **Fecha:** 2026-10-27
- **Estado:** Completado (42 de 42 puntos completados)
- **Responsables:** Equipo Dashboards (5 integrantes)

### Descripción

En el marco del Sprint 0 (22 oct – 5 nov), se completaron las **7 historias de usuario** del equipo de Dashboards: configuración de la plataforma **Google Looker Studio** conectada directamente a la base de datos PostgreSQL de producción (Neon), implementación de los módulos de estudiante (HU01–HU03) y administrador (HU04–HU07), y entrega de los componentes Vue 3 para ambas vistas. El equipo de APIs ya integró los dashboards en la rama `apis/integrar-dashboards-looker`.

### Funcionalidades y Estado de Historias

- **Total de puntos del Sprint 0:** 42 Story Points.
- **Puntos completados:** 42 Story Points (100% del sprint completado). ✅

| Código | HU | Estado | Puntos | Entregables |
|:------:|:---|:------:|:------:|:------------|
| **SCRUM-8** | **HU05 — Análisis de intercambio de horas** | **Completado (100%)** | 8 pts | • Tarjeta KPI de Total Horas Solicitadas.<br>• Filtro interactivo desplegable por estado.<br>• Serie temporal con desglose multidimensional por estado (`aceptada`, `pendiente`, `rechazada`). |
| **SCRUM-10** | **HU07 — Análisis de habilidades y demanda** | **Completado (100%)** | 8 pts | • Combinación de datos (JOIN) entre solicitudes y habilidades.<br>• Gráfico de barras horizontales con ranking de habilidades más demandadas y etiquetas numéricas. |
| **SCRUM-1** | **HU01 — Panel personal del estudiante** | **Completado (100%)** | 3 pts | • Tarjetas KPI de horas disponibles, ganadas y gastadas.<br>• Gráfico de dona de distribución de horas. |
| **SCRUM-5** | **HU02 — Historial de movimientos de horas** | **Completado (100%)** | 5 pts | • Tabla interactiva con filtro de fecha.<br>• Buscador por concepto/servicio. |
| **SCRUM-6** | **HU03 — Reporte de servicios** | **Completado (100%)** | 5 pts | • Gráfico de barras comparativo (ofrecidos vs recibidos).<br>• Desglose por estado. |
| **SCRUM-7** | **HU04 — Dashboard general de la plataforma** | **Completado (100%)** | 8 pts | • Tarjetas KPI maestras.<br>• Gráficos de distribución global. |
| **SCRUM-9** | **HU06 — Reporte de usuarios y participación** | **Completado (100%)** | 5 pts | • Tabla de clasificación.<br>• Filtros por Carrera y Facultad. |

### Componentes de Código e Integración Web

- **Componente Vue 3 — Admin:**  
  `dashboards/administrador/DashboardAdminIntercambios.vue`  
  Contenedor responsivo con soporte para desktop y mobile.  
  URL: `https://lookerstudio.google.com/embed/reporting/a8f8857e-67b0-40ae-a773-32afcaf3f1bf/page/p_11luxd2o8d`

- **Componente Vue 3 — Estudiante:**  
  `dashboards/estudiante/DashboardEstudianteResumen.vue`  
  Contenedor responsivo para el resumen personal del estudiante.  
  URL: `https://lookerstudio.google.com/embed/reporting/67e3aee0-28d4-4d25-9dc9-dc9b45f74b2a/page/11BCG`

### Conexión a Base de Datos

- **Motor:** PostgreSQL (Neon) — conexión directa desde Looker Studio.
- **Rol de acceso:** `dashboards_lectura` (solo lectura).
- **SSL:** Habilitado con certificado `isrgrootx1.pem` (Let's Encrypt Root).
- **Variables de entorno del frontend (`.env`):**
  - `VITE_LOOKER_STUDENT_URL` → Reporte de estudiante.
  - `VITE_LOOKER_ADMIN_URL` → Reporte de administrador.

### Integración con equipo de APIs

- El equipo de APIs integró los dashboards en la rama `apis/integrar-dashboards-looker`.
- Los componentes `ReportPanel.vue`, `MetricsView.vue`, `report-config.js` y estilos `metrics.css` fueron creados por el equipo de APIs para la incrustación en el frontend principal.
- Documentación de endpoints analíticos disponible en `backend/docs/dashboard-integration.md`.

### Evidencias y Pruebas

- Interfaz funcional y probada en Looker Studio con interacción de filtros en tiempo real.
- Conexión verificada con base de datos PostgreSQL (Neon) de producción.
- Coordinación con Frontend: confirmada la compatibilidad de los componentes entregados.
- Credenciales de admin del sistema proporcionadas para pruebas: `admin.timebank@ucb.edu.bo`.

### Próximos Pasos

- Actualizar el tablero de Jira pasando todas las HU a estado completado.
- El equipo de APIs subirá su rama y abrirá un PR a main para la revisión e integración.
- Validación final con datos reales de producción.

---

## Parcial 3 — Prototipo de migración a Vue 3 nativo (Sprint 0 replicado y validación técnica)

- **Fecha:** 2026-11-22
- **Estado:** En progreso
- **Responsables:** Equipo Dashboards (Gustavo Quisbert, Jefe de Devs)

### Descripción

Tras verificar en producción que el `<iframe>` de Google Looker Studio bloquea el acceso a usuarios autenticados con cuentas institucionales `@ucb.edu.bo` (*"no tienes acceso a Data Studio"* en Google Workspace, incluso con el reporte en modo público) y que no permite aislar de forma segura los datos por estudiante, se implementó un prototipo funcional en **Vue 3 con gráficos SVG/CSS nativos** en la rama `equipo/dashboards-parcial3-vue` (basada en `origin/apis/integracion-parcial3`). Este prototipo replica todas las visualizaciones del Sprint 0 (HU01–HU07) para validar estética, rendimiento y factibilidad antes de desarrollar HU08–HU11 con datos reales.

### Funcionalidades

- **Componentes de gráficos reutilizables (`frontend/src/features/metrics/vue-dashboards/charts/`):**
  - `DonutChart.vue`: gráfico de anillo interactivo con leyenda y porcentajes.
  - `LineChart.vue`: gráfico de línea/área con puntos interactivos y tooltip.
  - `BarChart.vue`: gráfico de barras verticales, horizontales y comparativas agrupadas.
  - `HeatmapChart.vue`: mapa de calor por día de la semana y franja horaria.
- **Vista Estudiante (`StudentDashboardVue.vue`):** resumen de créditos (disponibles, retenidos, totales), calificación promedio, servicios ofrecidos vs. recibidos, evolución de saldo, tabla de movimientos con filtro por tipo, servicios por estado y tabla con filtros por tipo y estado.
- **Vista Administrador (`AdminDashboardVue.vue`):** KPIs generales, actividad por semana/mes, intercambios por estado, solicitudes por estado y tendencia, motivos de cancelación, mapa de calor horario, usuarios por carrera/semestre/estado, crecimiento de registros, ranking de habilidades ofertadas/solicitadas, comparativa oferta vs. demanda y distribución por categoría.

### Evidencias y pruebas

- Rama de trabajo: `equipo/dashboards-parcial3-vue` (actualizada sobre `origin/apis/integracion-parcial3`, commit base `e6642bc`).
- Pruebas ejecutadas:
  - `npm test` en `frontend/`: **114/114 pruebas aprobadas** (incluidas `openapi-contract.test.js` y `screen-guide.test.js`).
  - `npm run build` en `frontend/`: compilación de producción correcta en Vite.
  - Verificación visual local en `localhost:5173/?demo=1` para `/perfil/resumen` y `/administracion/metricas`.
- Pruebas pendientes o limitaciones:
  - El prototipo actual opera sobre datos sintéticos/demo (`sprint0-data.js`) y mantiene un ajuste temporal en `ReportPanel.vue` y `AppShell.vue` para previsualización local.
  - Pendiente trasladar los componentes finales a `dashboards/` y conectar los datos reales desde los endpoints `/analytics/*`, `/credits/me`, `/intercambios/mis-clases` y `/roadmap/me`.
  - Pendientes las historias del Sprint 1 (`SCRUM-55` a `SCRUM-58`: HU08–HU11).

### Dependencias

- **Frontend / APIs:** Issue pendiente para montar los componentes de `dashboards/` en `ReportPanel.vue` y exponer el consumo de `/analytics/*` en `frontend/src/services/analytics.js`.
- **Backend / PO:** Issue pendiente para definir e implementar `knowledge_score` (`GET /analytics/reputation`), `cancelaciones_injustificadas` / `reglas_economia` (`GET /analytics/economy`) y confirmar el endpoint de reputación propia del estudiante.
- **Base de Datos:** Confirmar esquema único de créditos en producción (`NUMERIC` decimal vs. enteros `x10`).
