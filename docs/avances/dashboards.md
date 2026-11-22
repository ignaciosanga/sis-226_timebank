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

## Parcial 3 — Migración a Vue 3 nativo y validación técnica

- **Fecha:** 2026-11-22
- **Estado:** En progreso
- **Responsables:** Equipo Dashboards (Gustavo Quisbert, Jefe de Devs)

### Descripción

Tras verificar en producción que el `<iframe>` de Google Looker Studio bloquea el acceso a usuarios autenticados con cuentas institucionales `@ucb.edu.bo` (*"no tienes acceso a Data Studio"* en Google Workspace, incluso con el reporte en modo público) y que no permite aislar de forma segura los datos por estudiante, se implementó una arquitectura nativa en **Vue 3 con gráficos SVG/CSS** en la rama `equipo/dashboards-parcial3-vue` (sincronizada con `origin/apis/integracion-parcial3`, commit `fa79c3f`). Se replicaron todas las visualizaciones base de estudiante y administrador para validar estética, rendimiento y compatibilidad con Docker, Render y el CI antes de completar los paneles decisionales con datos reales.

### Funcionalidades

- **Componentes de gráficos reutilizables (`frontend/src/features/metrics/vue-dashboards/charts/`):**
  - `DonutChart.vue`: gráfico de anillo interactivo con leyenda y porcentajes.
  - `LineChart.vue`: gráfico de línea/área con puntos interactivos y tooltip.
  - `BarChart.vue`: gráfico de barras verticales, horizontales y comparativas agrupadas.
  - `HeatmapChart.vue`: mapa de calor por día de la semana y franja horaria.
- **Vista Estudiante (`StudentDashboardVue.vue`):** resumen de créditos (disponibles, retenidos, totales), calificación promedio, servicios ofrecidos vs. recibidos, evolución de saldo, tabla de movimientos con filtro por tipo, servicios por estado y tabla con filtros por tipo y estado.
- **Vista Administrador (`AdminDashboardVue.vue`):** KPIs generales, actividad por semana/mes, intercambios por estado, solicitudes por estado y tendencia, motivos de cancelación, mapa de calor horario, usuarios por carrera/semestre/estado, crecimiento de registros, ranking de habilidades ofertadas/solicitadas, comparativa oferta vs. demanda y distribución por categoría.

### Evidencias y pruebas

- Rama de trabajo: `equipo/dashboards-parcial3-vue` (sincronizada limpiamente con `origin/apis/integracion-parcial3`, commit `fa79c3f`, sin conflictos).
- Pruebas ejecutadas:
  - `npm test` en `frontend/`: **121/121 pruebas aprobadas** (incluidas `openapi-contract.test.js`, `screen-guide.test.js` y `notification-model.test.js`).
  - `npm run build` en `frontend/`: compilación de producción correcta en Vite.
  - Verificación visual local en modo demo (`?demo=1`) y con stack completo en Docker (PostgreSQL + Backend + Frontend).
- Pruebas pendientes o limitaciones:
  - Las vistas base de resumen en `sprint0-data.js` aún esperan la conexión final con `/analytics/{users,exchanges,credits,skills}` coordinada en el Issue `#50`.
  - Los cambios temporales en `ReportPanel.vue` y `AppShell.vue` están sujetos a aprobación e integración formal de Frontend/APIs.

### Dependencias

- **Issue #50 (Frontend / APIs):** aprobación de la subcarpeta dedicada `frontend/src/features/metrics/vue-dashboards/` (requerida por el contexto de build `./frontend` en Docker y `buildFilter` en Render), montaje en `ReportPanel.vue` y exposición de los endpoints `/analytics/*` en `analytics.js`.
- **Issue #51 (Backend / PO):** completar `knowledge_score` (`GET /analytics/reputation`), `reglas_economia.factores`, `inactividad.criterio_sin_uso_PO` y confirmar el endpoint de reputación propia del estudiante. *(Avance verificado el 22/11: `cancelaciones_injustificadas` con multa `0.5` / 5 h ya está integrado en `apis/integracion-parcial3`, y Base de Datos ya unificó créditos a `NUMERIC(12,2)` en V6).*

---

## Parcial 3 — Panel de Puntaje y Reconocimiento de Tutores (*Knowledge Score*)

- **Fecha:** 2026-11-22
- **Estado:** En progreso (implementado y verificado localmente en `equipo/dashboards-parcial3-vue`; pendiente integración por Issue `#50` y validación con datos reales de producción tras cierre del Issue `#51`)
- **Responsables:** Gustavo Walter Quisbert Chana (Equipo Dashboards)

### Descripción

Se implementó la vista de **Reputación y reconocimiento de tutores** dentro del panel de administración en Vue 3, adoptando la fórmula alineada con Base de Datos V6 (`v_knowledge_score`) y Backend: `Knowledge Score = 0.5 × tutorías_completadas + 1.5 × promedio` (priorizando siempre el puntaje calculado por el backend cuando llegue numérico), y el umbral oficial para la insignia **«Tutor de alto impacto»** (`opiniones >= 3`, `promedio >= 4.5`, `tutorías_completadas >= 5`, `tasa_cumplimiento >= 90%`).

### Funcionalidades

- **Lógica de cálculo y normalización (`knowledge-score.js`):** cálculo de *Knowledge Score*, evaluación de alto impacto vs. `pocos_datos`, enriquecimiento del contrato `GET /analytics/reputation` con las 49 materias, 7 áreas y 9 semestres del pensum, ordenamiento del ranking, filtros y cálculo de KPIs.
- **Vista de Reputación (`KnowledgeScorePanel.vue`):**
  - 4 tarjetas KPI: *Tutores evaluados*, *Promedio global (★)*, *Tutores de alto impacto* y *Cancelaciones injustificadas*.
  - Filtros interactivos por **Área académica**, **Semestre**, **Materia (49 materias)**, *Solo tutores de alto impacto* y visibilidad de `pocos_datos`.
  - Gráfico de barras horizontales del Top tutores por *Knowledge Score*.
  - Tabla de ranking con insignia **«Tutor de alto impacto»**, estado `pocos_datos` y manejo de estados de carga, error y vacío.
- **Servicio e integración (`analytics.js` + `AdminDashboardVue.vue`):** agregada la función `getReputation()` para consumir `GET /analytics/reputation` (validada por `openapi-contract.test.js`) con respaldo sintético únicamente en `?demo=1`.

### Evidencias y pruebas

- `node --test src/features/metrics/vue-dashboards/knowledge-score.test.js`: **4/4 pruebas aprobadas** (fórmula y prioridad al backend, umbrales de alto impacto, manejo de `pocos_datos`, filtros por materia/área/semestre y KPIs).
- `npm test` en `frontend/`: **121/121 pruebas aprobadas** (incluida `openapi-contract.test.js` verificando `GET /analytics/reputation` contra `docs/openapi.json`).
- `npm run build` en `frontend/`: compilación de producción limpia en Vite (7.32 s).
- Verificación visual en navegador sobre `/administracion/metricas`.

### Dependencias

- **Issue #50 (Frontend / APIs):** aprobación de ubicación en `frontend/src/features/metrics/vue-dashboards/` e integración en `ReportPanel.vue`.
- **Issue #51 (Backend):** publicar `knowledge_score` calculado en `GET /analytics/reputation` dentro de `apis/integracion-parcial3`.
