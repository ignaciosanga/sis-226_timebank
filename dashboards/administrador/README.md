# Módulos Administrador — Looker Studio

Especificación y diseño de los dashboards de control gerencial para la administración del Banco de Tiempo Universitario.

## Responsables
- **Dev 2** (13 Story Points): HU04 y HU06.
- **Dev Lead / Gus** (16 Story Points): HU05 y HU07.

## Dashboards y componentes planificados

| HU | Título | Tipo de visualización | Responsable |
|----|--------|-----------------------|:-----------:|
| **HU04** (8 pts) | Dashboard general de la plataforma | Tarjetas KPI maestras (Usuarios registrados, Horas en circulación, Intercambios completados) + Gráficos de distribución | Dev 2 |
| **HU05** (8 pts) | Análisis de intercambio de horas | Gráfico de líneas temporal (evolución mensual/semanal) + Matriz de flujo de intercambio entre facultades/carreras | Dev Lead |
| **HU06** (5 pts) | Reporte de usuarios y participación | Tabla de clasificación (ranking de usuarios más activos) + Filtros por Carrera, Facultad y Semestre + Alerta de cuentas inactivas | Dev 2 |
| **HU07** (8 pts) | Análisis de habilidades y demanda | Gráfico de barras horizontales (Top habilidades solicitadas vs ofertadas) + Identificación de brecha / déficit | Dev Lead |

## Conexión y Fuentes de Datos
- **Entorno de producción:** Conexión directa desde Looker Studio a la base de datos PostgreSQL (`timebank`).
- **Entorno de desarrollo/pruebas:** Dataset semilla de prueba en Google Sheets / CSV para maquetación ágil de los componentes.
