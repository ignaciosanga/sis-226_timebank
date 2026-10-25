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

## Integración
Este panel se visualiza embebido dentro del perfil de usuario en la aplicación web mediante el contenedor asignado por el equipo de Frontend.
