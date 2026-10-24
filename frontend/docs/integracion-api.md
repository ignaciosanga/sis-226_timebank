# Contratos Propuestos de Integración

Este documento separa el mockup de Frontend de las responsabilidades de Backend, Base de Datos, Dashboards y APIs e Implementación. Los nombres son una propuesta para coordinar mediante Issues antes de desarrollar los servicios reales.

## Autenticación

- `POST /auth/login`
- Entrada: `email`, `password`.
- Salida: usuario autenticado, rol y vigencia de sesión.
- Responsable propuesto: Backend y APIs e Implementación.

## Cursos

- `GET /courses`
- Filtros: búsqueda, categoría, modalidad y fecha.
- Salida mínima: identificador, título, tema, tutor, fecha, modalidad, ubicación, cupos, puntos y valoración.
- Responsable propuesto: Backend; persistencia a cargo de Base de Datos.

## Inscripciones

- `GET /me/enrollments`
- `POST /courses/:id/enrollments`
- Resultado esperado: inscripción confirmada, saldo actualizado y fecha de sesión.
- Responsable propuesto: Backend y APIs e Implementación.

## Perfil

- `GET /me/profile`
- Salida mínima: carrera, semestre, sede, intereses, puntos, valoración, cursos tomados y cursos impartidos.
- Responsable propuesto: Backend; persistencia a cargo de Base de Datos.

## Analíticas

- `GET /me/analytics?period=6m`
- Salida mínima: cursos tomados, completados, tasa de éxito, horas, actividad mensual y categorías.
- Responsable propuesto: Dashboards, en coordinación con Backend y Base de Datos.

## Manejo de errores

Todas las respuestas de error deben incluir un código estable y un mensaje comprensible. Frontend no debe inferir reglas de negocio que correspondan al servidor.
