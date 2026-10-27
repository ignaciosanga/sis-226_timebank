# Módulos Administrador — Looker Studio

Especificación y diseño de los dashboards de control gerencial para la administración del Banco de Tiempo Universitario.

## Responsables
- **Dev 2** (13 Story Points): HU04 y HU06.
- **Dev Lead / Gus** (16 Story Points): HU05 y HU07.

## Dashboards y componentes implementados

| HU | Título | Tipo de visualización | Estado | Responsable |
|:--:|--------|-----------------------|:------:|:-----------:|
| **HU04** (8 pts) | Dashboard general de la plataforma | Tarjetas KPI maestras + Gráficos de distribución | **Completado (100%)** | Dev 2 |
| **HU05** (8 pts) | Análisis de intercambio de horas | Tarjetas KPI, Serie temporal por fecha (`created_at`/`fecha_inicio`) y filtro por estado (`aceptada`, `pendiente`, `rechazada`) | **Completado (100%)** | Dev Lead |
| **HU06** (5 pts) | Reporte de usuarios y participación | Tabla de clasificación + Filtros por Carrera y Facultad | **Completado (100%)** | Dev 2 |
| **HU07** (8 pts) | Análisis de habilidades y demanda | Gráfico de barras horizontales (Top materias/habilidades solicitadas con JOIN entre tablas) | **Completado (100%)** | Dev Lead |

## Integración con Frontend (Vue 3)

El panel administrativo de Intercambios y Habilidades (HU05 & HU07) ya cuenta con su componente Vue 3 listo para ser importado en la aplicación web:

- **Archivo del componente:** `DashboardAdminIntercambios.vue`
- **URL directa del reporte en Looker Studio:**  
  `https://lookerstudio.google.com/embed/reporting/a8f8857e-67b0-40ae-a773-32afcaf3f1bf/page/p_11luxd2o8d`

### Modo de uso en Frontend:
```vue
<script setup>
import DashboardAdminIntercambios from '@/dashboards/administrador/DashboardAdminIntercambios.vue'
</script>

<template>
  <DashboardAdminIntercambios />
</template>
```

## Datos conectados

Los dashboards de administrador se conectan directamente a la base de datos PostgreSQL (Neon) del proyecto vía Looker Studio con el rol de solo lectura `dashboards_lectura`, utilizando SSL para la conexión segura. Los datos se visualizan en tiempo real. Se embeben dentro del panel de administración en la aplicación web mediante el contenedor `div#dashboard-administrador` asignado por el equipo de Frontend/APIs.
