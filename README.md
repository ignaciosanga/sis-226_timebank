# Normas de desarrollo y colaboración

Guía de trabajo para los equipos que colaboran en este repositorio. Establece cómo organizar el desarrollo, solicitar cambios entre áreas, documentar avances e integrar entregas.

**El cumplimiento de estas normas es obligatorio para todos los integrantes del proyecto.** Su objetivo es mantener un repositorio organizado, evitar conflictos y facilitar el seguimiento de los compromisos establecidos con el cliente.

## Índice

- [1. Equipos y responsabilidades](#1-equipos-y-responsabilidades)
- [2. Ramas de trabajo](#2-ramas-de-trabajo)
- [3. Límites entre equipos](#3-límites-entre-equipos)
- [4. Solicitudes mediante GitHub Issues](#4-solicitudes-mediante-github-issues)
- [5. Registro de avances](#5-registro-de-avances)
- [6. Pull Requests e integración](#6-pull-requests-e-integración)
- [7. Coordinación y dependencias](#7-coordinación-y-dependencias)
- [8. Lista de verificación](#8-lista-de-verificación)
- [9. Excepciones y responsabilidad](#9-excepciones-y-responsabilidad)

## 1. Equipos y responsabilidades

El proyecto se organiza en cinco áreas. Cada equipo desarrolla, verifica y documenta las implementaciones correspondientes a su alcance asignado.

| Equipo | Rama de trabajo | Archivo de avances |
| --- | --- | --- |
| Backend | `equipo/backend` | `docs/avances/backend.md` |
| Frontend | `equipo/frontend` | `docs/avances/frontend.md` |
| Base de Datos | `equipo/base-de-datos` | `docs/avances/base-de-datos.md` |
| Dashboards | `equipo/dashboards` | `docs/avances/dashboards.md` |
| APIs e Implementación | `equipo/apis-implementacion` | `docs/avances/apis-implementacion.md` |

Si una funcionalidad involucra varias áreas, cada equipo implementará únicamente su parte. Antes de modificar un archivo compartido o cuya responsabilidad no esté clara, se deberá acordar y registrar su alcance mediante un Issue.

## 2. Ramas de trabajo

Cada equipo deberá:

1. Crear su rama de trabajo a partir de `main`, utilizando el nombre indicado en la tabla anterior.
2. Mantenerla actualizada con los cambios aprobados en `main`.
3. Realizar commits que permitan identificar los cambios realizados.
4. Verificar el funcionamiento de sus implementaciones antes de solicitar su integración.
5. Integrar sus entregas mediante Pull Requests revisados.

**`main` es la referencia estable del proyecto.** Las integraciones de código y documentación deberán pasar por revisión antes de incorporarse a esta rama.

## 3. Límites entre equipos

> **Disposición obligatoria del cliente:** ningún equipo podrá modificar directamente el código, los archivos o la rama de trabajo de otro equipo sin autorización previa.

Esta restricción se aplica a todos los equipos:

- Backend no puede modificar por cuenta propia los archivos de Frontend.
- Frontend no puede modificar por cuenta propia la implementación de Backend.
- Base de Datos, Dashboards y APIs e Implementación deben respetar los mismos límites.
- Ningún integrante puede realizar cambios por su cuenta en la rama de otro equipo.
- Un Pull Request tampoco autoriza a incluir modificaciones en archivos ajenos al alcance del equipo.

**Necesitar una modificación no autoriza a realizarla.** Los cambios entre áreas deberán solicitarse mediante GitHub Issues y ser revisados y ejecutados por el equipo responsable. Toda excepción requiere autorización previa y un registro en GitHub.

## 4. Solicitudes mediante GitHub Issues

### Cuándo crear un Issue

Toda solicitud que requiera una modificación por parte de otro equipo deberá registrarse en un Issue. El registro debe permitir comprender qué se necesita, quién debe atenderlo y cómo verificar su resolución.

### Procedimiento

1. Crear el Issue e identificar al equipo solicitante y al equipo responsable.
2. Describir el comportamiento actual y el resultado esperado.
3. Adjuntar la información técnica necesaria y los criterios de aceptación.
4. Indicar la prioridad y las dependencias o bloqueos conocidos.
5. El equipo responsable revisará la solicitud, comunicará los impedimentos y realizará los cambios en su propia rama.
6. Vincular el Pull Request o commit que resuelva la solicitud.
7. Verificar los criterios de aceptación antes de cerrar el Issue.

Los acuerdos alcanzados en reuniones o mensajes deberán registrarse en el Issue correspondiente. Cada solicitud debe mantenerse actualizada hasta su resolución.

### Ejemplo de colaboración

Backend entrega los campos `X` e `Y`, pero Frontend muestra únicamente `X`. Si se necesita mostrar también `Y`, Backend deberá crear un Issue dirigido a Frontend, describir el cambio y proporcionar los datos de integración. Frontend revisará e implementará la modificación en su propia rama.

### Plantilla recomendada

Copiar esta plantilla en el cuerpo del Issue y sustituir los campos entre corchetes:

```markdown
## Equipos
- Solicitante: [equipo que solicita el cambio]
- Responsable: [equipo que debe implementarlo]

## Tipo de solicitud
[Integración / Modificación / Corrección]

## Descripción
[Qué se necesita y por qué]

## Comportamiento actual
[Qué ocurre actualmente]

## Comportamiento esperado
[Qué debe ocurrir después del cambio]

## Información técnica
[Endpoints, campos, contratos, capturas o enlaces pertinentes]

## Criterios de aceptación
- [ ] [Resultado verificable]
- [ ] [Comportamiento existente que debe conservarse]
- [ ] [Comprobación de integración necesaria]

## Dependencias o bloqueos
[Requerimientos pendientes y sus Issues, o «Sin dependencias»]

## Prioridad
[Alta / Media / Baja, con su justificación]

## Estado
Pendiente de revisión
```

## 5. Registro de avances

Cada equipo deberá registrar sus hitos importantes en un archivo Markdown (`.md`). No es necesario documentar cada cambio pequeño ni cada commit; sí los avances relevantes, las dependencias y los bloqueos.

### Estructura de referencia

Los archivos de avances deberán estar disponibles en `main`, aunque el desarrollo continúe en las ramas de los equipos:

```text
repositorio/
├── README.md
└── docs/
    └── avances/
        ├── backend.md
        ├── frontend.md
        ├── base-de-datos.md
        ├── dashboards.md
        └── apis-implementacion.md
```

Cada equipo deberá crear, mantener y actualizar únicamente su propio archivo de avances. Esta estructura describe la organización requerida; no afirma que los archivos ya estén creados.

### Contenido mínimo de cada registro

| Campo | Información requerida |
| --- | --- |
| Fecha | Fecha del registro; si el hito está completado, fecha de finalización. |
| Hito | Nombre concreto del avance. |
| Descripción | Funcionalidad implementada o trabajo realizado. |
| Estado | Completado, en progreso o bloqueado. |
| Responsables | Integrantes involucrados. |
| Evidencia | Enlaces a commits, PR, capturas o resultados de pruebas, cuando corresponda. |
| Dependencias | Requerimientos pendientes de otros equipos e Issues relacionados. |

Los registros deberán reflejar el progreso real. Las pruebas pendientes deben distinguirse de las ejecutadas y una funcionalidad en progreso no debe presentarse como completada.

### Plantilla de un hito

El archivo tendrá un único título principal, por ejemplo `# Avances — Equipo Backend`. Para cada hito, añadir un bloque como el siguiente:

```markdown
## [Nombre del hito]

- **Fecha:** [AAAA-MM-DD]
- **Estado:** [Completado / En progreso / Bloqueado]
- **Responsables:** [integrantes involucrados]

### Descripción
[Explicación del avance y su alcance]

### Funcionalidades
- [Funcionalidad implementada]
- [Funcionalidad implementada]

### Evidencias y pruebas
- Commit o PR: [añadir enlace real]
- Pruebas ejecutadas: [descripción y resultados]
- Pruebas pendientes o limitaciones: [indicar cuáles, si existen]

### Dependencias
[Requerimiento pendiente y referencia al Issue, o «Sin dependencias»]
```

### Publicación de avances en `main`

Los hitos se publicarán mediante un **Pull Request exclusivo de documentación**. Para evitar incorporar código pendiente de aprobación:

1. Identificar el hito que se registrará y su estado real en la rama del equipo.
2. Crear una rama temporal desde `main` actualizado.
3. Añadir o actualizar en esa rama únicamente el archivo de avances del equipo.
4. Abrir un PR hacia `main` y comprobar que contiene solo la documentación prevista.
5. Obtener la revisión correspondiente e integrar el PR.

No es necesario finalizar todo el desarrollo para publicar un hito. Publicar su registro **no equivale a aprobar ni integrar el código** de la rama del equipo.

## 6. Pull Requests e integración

Toda integración hacia `main` deberá realizarse mediante un Pull Request revisado.

Cada PR deberá:

- Identificar claramente al equipo responsable.
- Describir los cambios y su propósito.
- Vincular los Issues relacionados, cuando existan.
- Incluir únicamente cambios autorizados dentro del alcance del equipo.
- Indicar las verificaciones realizadas y sus resultados.
- Superar las verificaciones y revisiones correspondientes antes de integrarse.

No se podrán incorporar cambios no aprobados a `main` ni utilizar un PR para eludir las restricciones entre equipos.

## 7. Coordinación y dependencias

Para facilitar la integración, cada equipo deberá:

1. Mantener su rama actualizada respecto de `main`.
2. Registrar los hitos relevantes y publicar su documentación.
3. Comunicar las dependencias mediante Issues.
4. Revisar periódicamente las solicitudes dirigidas a su área.
5. Coordinar antes de modificar contratos, interfaces o estructuras compartidas.
6. Informar oportunamente los bloqueos que puedan afectar a otros equipos.

Los cambios que involucren varias áreas deberán coordinarse antes de implementarse. Los acuerdos, dependencias y autorizaciones deben quedar vinculados al Issue correspondiente.

## 8. Lista de verificación

Antes de solicitar la integración de una entrega:

- [ ] Los cambios se realizaron en la rama correspondiente.
- [ ] Todos los archivos modificados pertenecen al alcance asignado o cuentan con autorización documentada.
- [ ] Las solicitudes y dependencias entre equipos están registradas en Issues.
- [ ] El PR describe los cambios y vincula los Issues relacionados.
- [ ] Se registraron las pruebas ejecutadas, sus resultados y las limitaciones reales.
- [ ] Los hitos relevantes están documentados y su publicación en `main` se gestionó mediante un PR de documentación.

Antes de integrar el PR:

- [ ] Se completaron las verificaciones y revisiones correspondientes.
- [ ] Los cambios están aprobados para su incorporación a `main`.

| Obligatorio | Prohibido |
| --- | --- |
| Usar una rama de trabajo por equipo. | Modificar ramas ajenas por cuenta propia. |
| Respetar el alcance asignado. | Modificar código o archivos ajenos sin autorización. |
| Documentar los hitos relevantes en Markdown. | Presentar avances o pruebas pendientes como completados. |
| Publicar los registros de avances en `main`. | Mezclar código pendiente en un PR exclusivo de documentación. |
| Solicitar cambios entre equipos mediante Issues. | Sustituir las solicitudes por modificaciones directas no autorizadas. |
| Revisar los PR antes de integrarlos. | Incorporar cambios no aprobados a `main`. |

## 9. Excepciones y responsabilidad

Cualquier excepción deberá contar con **autorización previa** y quedar documentada en GitHub, indicando su alcance y los equipos involucrados.

Cada equipo es responsable de la calidad de sus entregables y del cumplimiento de estas normas. Las restricciones entre áreas son una disposición expresa del cliente y deberán respetarse durante todo el proyecto.

**La comunicación, la documentación y la trazabilidad forman parte del trabajo de desarrollo.**
