# Módulo Estudiante — Looker Studio

Especificación y diseño de los paneles interactivos para los estudiantes de la plataforma Banco de Tiempo Universitario.

## Responsable
- **Dev 1** (13 Story Points totales)

## Vistas y componentes planificados

| HU | Título | Tipo de visualización | Datos requeridos |
|----|--------|-----------------------|------------------|
| **HU01** (3 pts) | Panel personal de horas | Tarjetas KPI (Horas Disponibles, Horas Ganadas, Horas Gastadas) + Gráfico de dona (usadas vs disponibles) | Saldo actual, total recibido, total transferido |
| **HU02** (5 pts) | Historial de movimientos | Tabla interactiva con filtro de fecha + buscador por concepto/servicio | Fecha, tipo (ingreso/egreso), cantidad de horas, contraparte |
| **HU03** (5 pts) | Reporte de servicios | Gráfico de barras comparativo (ofrecidos vs recibidos) + desglose por estado (completado, en proceso, cancelado) | Servicios publicados, solicitudes aceptadas, estado |

## Integración con Frontend (Vue 3)

El panel de resumen personal del estudiante ya cuenta con su componente Vue 3 listo para ser importado en la aplicación web:

- **Archivo del componente:** `DashboardEstudianteResumen.vue`
- **URL directa del reporte en Looker Studio:**  
  `https://lookerstudio.google.com/embed/reporting/67e3aee0-28d4-4d25-9dc9-dc9b45f74b2a/page/11BCG`

### Modo de uso en Frontend:
```vue
<script setup>
import DashboardEstudianteResumen from '@/dashboards/estudiante/DashboardEstudianteResumen.vue'
</script>

<template>
  <DashboardEstudianteResumen />
</template>
```

## Datos conectados

Este panel se conecta a la base de datos PostgreSQL (Neon) del proyecto vía Looker Studio, visualizando datos en tiempo real del estudiante autenticado. Se embebe dentro del perfil de usuario en la aplicación web mediante el contenedor `div#dashboard-estudiante` asignado por el equipo de Frontend/APIs.
