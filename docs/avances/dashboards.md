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
