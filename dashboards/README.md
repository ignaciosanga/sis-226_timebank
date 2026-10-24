# Dashboards — Banco de Tiempo Universitario

Componentes de visualización y reportes del proyecto Banco de Tiempo Universitario.

## Alcance

Este equipo es responsable de diseñar, construir y mantener los dashboards y reportes de la plataforma. Se trabaja en dos frentes:

- **Vista del estudiante:** gráficos embebidos en la aplicación web, construidos con Chart.js (vue-chartjs).
- **Vista del administrador:** dashboards gerenciales construidos con Power BI, conectados a la base de datos PostgreSQL.

## Historias de usuario (Sprint 0)

| HU | Título | Vista |
|----|--------|-------|
| HU01 | Panel personal del estudiante | Estudiante |
| HU02 | Historial de movimientos de créditos | Estudiante |
| HU03 | Reporte de servicios realizados | Estudiante |
| HU04 | Dashboard general de la plataforma | Administrador |
| HU05 | Análisis de intercambios y reservas | Administrador |
| HU06 | Reporte de usuarios y composición de la comunidad | Administrador |
| HU07 | Análisis de habilidades y demanda | Administrador |

## Estructura del directorio

```
dashboards/
├── README.md              ← Este archivo
├── estudiante/            ← Componentes Chart.js para la vista del estudiante
│   └── (pendiente)
├── administrador/         ← Archivos Power BI para la vista del administrador
│   └── (pendiente)
└── assets/                ← Recursos compartidos (paleta de colores, bocetos)
    └── (pendiente)
```

## Fuentes de datos

### Para la vista del estudiante (API REST)

| Endpoint | Datos |
|----------|-------|
| `GET /credits/me` | Saldo, créditos retenidos, disponibles |
| `GET /credits/me/movements` | Historial de movimientos de créditos |
| `GET /exchanges/me` | Solicitudes de intercambio del estudiante |
| `GET /reservations/me` | Reservas del estudiante |

### Para la vista del administrador (PostgreSQL directo)

| Tabla | Datos |
|-------|-------|
| `USUARIOS` | Registros, estados, carreras, semestres |
| `SOLICITUDES_INTERCAMBIO` | Solicitudes por estado y periodo |
| `RESERVAS` | Reservas, cancelaciones, motivos |
| `MOVIMIENTOS_CREDITO` | Flujo de créditos |
| `HABILIDADES` + `CATEGORIAS` | Oferta y demanda de habilidades |
| `USUARIO_HABILIDADES` | Habilidades publicadas por usuarios |
| `CALIFICACIONES` | Puntuaciones y comentarios |

## Equipo

| Rol | Responsabilidad |
|-----|----------------|
| Product Owner | Priorización y validación de historias |
| Scrum Master | Seguimiento del sprint y resolución de impedimentos |
| Dev Lead | Diseño de bocetos, dashboards Power BI de intercambios, coordinación |
| Dev A | Componentes Chart.js del estudiante (HU01, HU02) |
| Dev B | Componentes Chart.js de servicios (HU03) + Power BI (HU04, HU06, HU07) |

## Dependencias con otros equipos

Toda solicitud a otro equipo se gestiona mediante GitHub Issues, según las normas del proyecto.

- **Backend:** datos de prueba y posibles endpoints de estadísticas agregadas.
- **Frontend:** integración de los componentes Chart.js en la aplicación Vue 3.
- **Base de Datos:** confirmación de tablas pobladas en PostgreSQL.
