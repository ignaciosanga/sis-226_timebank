# Dashboards — Banco de Tiempo Universitario

Componentes de visualización y reportes del proyecto Banco de Tiempo Universitario.

## Alcance

Este equipo es responsable de diseñar, construir y mantener los dashboards y reportes de la plataforma utilizando **Google Looker Studio**. Se cubren dos módulos principales:

- **Vista del estudiante:** panel personal interactivo embebido en la aplicación web mediante `<iframe>`, con balance de horas, historial y servicios.
- **Vista del administrador:** paneles de control gerenciales para el seguimiento global de la plataforma, métricas de participación, análisis de intercambios y oferta/demanda de habilidades.

## Historias de usuario y estimación (Sprint 0: 42 Puntos)

| Código | HU | Título | Vista | Puntos | Responsable |
|--------|-----|--------|-------|:------:|-------------|
| SCRUM-1 | HU01 | Panel personal del estudiante (horas acumuladas, usadas, disponibles) | Estudiante | **3** | Dev 1 |
| SCRUM-5 | HU02 | Historial de movimientos de horas | Estudiante | **5** | Dev 1 |
| SCRUM-6 | HU03 | Reporte de servicios realizados y recibidos | Estudiante | **5** | Dev 1 |
| SCRUM-7 | HU04 | Dashboard general de la plataforma (KPIs globales y balance) | Administrador | **8** | Dev 2 |
| SCRUM-8 | HU05 | Análisis de intercambio de horas y tendencias temporales | Administrador | **8** | Dev Lead |
| SCRUM-9 | HU06 | Reporte de usuarios, carreras y participación | Administrador | **5** | Dev 2 |
| SCRUM-10 | HU07 | Análisis de habilidades y brecha de oferta/demanda | Administrador | **8** | Dev Lead |

**Total:** 42 Story Points (13 pts Dev 1, 13 pts Dev 2, 16 pts Dev Lead).

## Estructura del directorio

```
dashboards/
├── README.md              ← Documentación general del equipo y mapa de HUs
├── estudiante/            ← Especificación y configuración de la vista de Estudiante (Looker Studio)
├── administrador/         ← Especificación y configuración de vistas de Administrador (Looker Studio)
└── assets/                ← Paleta de colores, capturas de pantalla de los dashboards y bocetos
```

## Arquitectura de Integración (Looker Studio + Vue 3)

1. **Construcción en Looker Studio:** Se desarrolla un informe colaborativo centralizado con páginas específicas para cada módulo.
2. **Generación de código embebido:** Se habilita la opción *"Insertar informe"* para generar la URL pública interactiva.
3. **Incrustación en Frontend:** El equipo de Frontend incluye el elemento en la interfaz web:
   ```html
   <iframe 
     src="https://lookerstudio.google.com/embed/reporting/[ID_INFORME]/page/[ID_PAGINA]" 
     width="100%" 
     height="700" 
     frameborder="0" 
     style="border:0" 
     allowfullscreen>
   </iframe>
   ```

## Fuentes de datos

- **Fuente principal:** Base de datos relacional PostgreSQL del proyecto (`timebank`).
- **Fuente de desarrollo/pruebas:** Conjunto de datos semilla (Google Sheets / CSV) para maquetación y validación antes de la conexión directa a producción.

### Tablas clave:
- `USUARIOS` (carrera, facultad, fecha_registro, estado)
- `TRANSACCIONES_HORAS` / `MOVIMIENTOS_CREDITO` (emisor, receptor, horas, fecha, tipo)
- `SERVICIOS` / `SOLICITUDES` (título, categoría, estado, fecha)
- `HABILIDADES` y `CATEGORIAS` (oferta y demanda declarada)

## Equipo y Roles

| Rol | Integrante / Responsabilidad |
|-----|------------------------------|
| **Product Owner** | Priorización y validación de criterios de aceptación de negocio |
| **Scrum Master** | Seguimiento del Sprint y facilitación ágil |
| **Dev Lead (Gus)** | Arquitectura de reportería, HU05, HU07, coordinación técnica y revisión |
| **Dev 1** | Implementación de vistas de Estudiante: HU01, HU02, HU03 (13 pts) |
| **Dev 2** | Implementación de vistas de Administrador General: HU04, HU06 (13 pts) |
