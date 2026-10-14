📘 Normas de Desarrollo y Colaboración del Proyecto

1. Objetivo

Este documento establece las normas de trabajo, organización y colaboración entre los equipos de desarrollo.

El objetivo es mantener un repositorio organizado, facilitar el seguimiento de avances, evitar conflictos entre equipos y garantizar el cumplimiento de los lineamientos establecidos por el cliente.

El cumplimiento de estas normas es obligatorio para todos los integrantes del proyecto.

2. Equipos de trabajo

El proyecto está dividido en cinco áreas de desarrollo, cada una responsable de sus propias implementaciones.
Cada equipo deberá trabajar exclusivamente dentro del alcance asignado a su área.

3. Organización mediante ramas (branches)

3.1. Creación obligatoria de ramas

Cada equipo deberá crear su propia rama de trabajo dentro del repositorio de GitHub.

Las ramas propuestas son:

Equipo	Rama
Backend	equipo/backend
Frontend	equipo/frontend
Base de Datos	equipo/base-de-datos
Dashboards	equipo/dashboards
APIs e Implementación	equipo/apis-implementacion

Estas ramas deberán crearse a partir de main.

Cada equipo será responsable de mantener actualizada su rama, realizar sus commits y verificar el funcionamiento de sus implementaciones.

3.2. Restricción de modificaciones entre equipos

⚠️ REGLA OBLIGATORIA DEL CLIENTE

Está terminantemente prohibido que un equipo modifique directamente el código, los archivos o la rama de trabajo pertenecientes a otro equipo sin autorización.

Cualquier cambio requerido en un área distinta deberá solicitarse mediante GitHub Issues.

Esto significa que:

* Backend no puede modificar directamente archivos propiedad de Frontend.
* Frontend no puede modificar directamente la implementación de Backend.
* Base de Datos, Dashboards y APIs e Implementación deben respetar igualmente los límites de los demás equipos.
* Ningún integrante podrá ingresar a la rama de otro equipo para efectuar cambios por su cuenta.
* Las solicitudes de modificación deberán ser revisadas y ejecutadas por el equipo responsable.

Que un equipo necesite una modificación no lo autoriza a realizarla por sí mismo.

4. Registro obligatorio de avances

Cada equipo deberá documentar sus principales avances mediante un archivo Markdown (.md).

Estos documentos deberán estar disponibles en la rama principal main, independientemente de que el desarrollo continúe en las ramas de cada equipo.

4.1. Organización de los archivos

Se utilizará la siguiente estructura:

repositorio/
├── README.md
├── docs/
│   └── avances/
│       ├── backend.md
│       ├── frontend.md
│       ├── base-de-datos.md
│       ├── dashboards.md
│       └── apis-implementacion.md

Cada equipo es responsable de crear, mantener y actualizar únicamente su archivo de avances.

4.2. ¿Qué debe documentarse?

Los archivos Markdown deberán registrar los hitos importantes del desarrollo, no necesariamente cada cambio pequeño o cada commit.

Como mínimo, cada registro deberá incluir:

* Fecha: día en que se completó el avance.
* Hito: nombre del avance realizado.
* Descripción: explicación de la funcionalidad implementada.
* Estado: completado, en progreso o bloqueado.
* Responsables: integrantes involucrados.
* Evidencia: enlaces a commits, pull requests, capturas o pruebas, cuando corresponda.
* Dependencias: si existe algún requerimiento pendiente de otro equipo.

4.3. Ejemplo de registro

# Avances - Equipo Backend
## Hito 1: Implementación de autenticación
**Fecha:** 14/10/2026
**Estado:** Completado
**Responsables:** Equipo Backend
### Descripción
Se implementó el sistema de autenticación
para el inicio de sesión de usuarios.
### Funcionalidades
- Validación de credenciales.
- Generación de tokens de autenticación.
- Manejo de errores de acceso.
### Evidencias
- Commit: [enlace al commit]
- Pruebas: [enlace o descripción]
### Dependencias
Se requiere que Frontend integre el
formulario de inicio de sesión.
Issue relacionado: #12

4.4. Publicación de avances en main

Los equipos deberán publicar sus avances importantes en main mediante un Pull Request (PR) dedicado exclusivamente a la documentación.

Para evitar integrar código aún no aprobado, las actualizaciones documentales deberán prepararse en una rama temporal creada desde main, sin incluir los cambios de desarrollo pendientes de la rama del equipo.

El proceso será:

1. Completar un hito significativo en la rama del equipo.
2. Actualizar el archivo Markdown correspondiente.
3. Crear un Pull Request de documentación hacia main.
4. Obtener la revisión correspondiente.
5. Incorporar el registro de avances a main.

No es necesario finalizar todo el desarrollo para publicar los hitos alcanzados.

Los archivos de avances deberán reflejar el progreso real del proyecto.

5. Comunicación obligatoria mediante GitHub Issues

5.1. Solicitudes entre equipos

Toda solicitud que requiera una modificación por parte de otro equipo deberá registrarse mediante un GitHub Issue.

No se permitirá utilizar modificaciones directas en ramas ajenas como alternativa a este procedimiento.

5.2. Ejemplo práctico

Supongamos que el equipo Backend implementa una función que devuelve los valores X e Y, pero el equipo Frontend solamente muestra X.

Si Backend necesita que Frontend también muestre Y, deberá:

1. Crear un nuevo Issue en GitHub.
2. Indicar que la solicitud está dirigida al equipo Frontend.
3. Describir el comportamiento actual y el comportamiento esperado.
4. Adjuntar la información técnica necesaria.
5. Esperar a que Frontend revise y realice la modificación en su propia rama.

Backend no podrá modificar directamente el código de Frontend para implementar este cambio.

El mismo procedimiento aplica a todos los equipos.

5.3. Formato recomendado de Issues

## Equipo solicitante
Backend
## Equipo responsable
Frontend
## Tipo de solicitud
Integración / Modificación
## Descripción
Se requiere mostrar el campo Y,
actualmente disponible desde Backend.
## Comportamiento actual
La interfaz solamente muestra X.
## Comportamiento esperado
La interfaz deberá mostrar X e Y.
## Información técnica
Endpoint: GET /api/ejemplo
Campos disponibles: X, Y
## Criterios de aceptación
- El campo Y debe visualizarse correctamente.
- No debe afectarse la visualización de X.
- Se debe verificar la integración.
## Prioridad
Media
## Estado
Pendiente de revisión

5.4. Seguimiento de solicitudes

Cada Issue deberá mantenerse actualizado hasta su resolución.

El equipo responsable deberá revisar la solicitud, comunicar impedimentos si existieran y vincular el Pull Request o commit que resuelva el requerimiento.

Una vez verificada su implementación, podrá cerrarse el Issue.

Los acuerdos realizados mediante reuniones o mensajes deberán quedar registrados en el Issue correspondiente para mantener la trazabilidad.

6. Reglas para Pull Requests

Las integraciones de código hacia main deberán efectuarse mediante Pull Requests revisados.

Cada Pull Request deberá:

* Identificar claramente al equipo responsable.
* Describir los cambios realizados.
* Vincular los Issues relacionados, cuando existan.
* Contener únicamente cambios autorizados dentro del alcance del equipo.
* Superar las verificaciones y revisiones correspondientes antes de integrarse.

La rama main deberá mantenerse como referencia estable del proyecto.

Ningún equipo podrá utilizar un Pull Request para incorporar modificaciones no autorizadas en archivos de otra área.

7. Coordinación entre equipos

Para evitar bloqueos y facilitar la integración, cada equipo deberá:

1. Mantener su rama de trabajo actualizada respecto de los cambios aprobados en main.
2. Registrar los hitos relevantes en su archivo Markdown.
3. Comunicar las dependencias mediante GitHub Issues.
4. Revisar periódicamente las solicitudes que le hayan sido asignadas.
5. Coordinar con los demás equipos antes de realizar cambios en contratos, interfaces o estructuras compartidas.
6. Informar oportunamente los bloqueos que puedan afectar al resto del proyecto.

En caso de que una funcionalidad involucre más de un área, cada equipo implementará únicamente la parte correspondiente a su responsabilidad.

8. Resumen de las normas obligatorias

Norma	Cumplimiento
Crear una rama exclusiva por equipo	Obligatorio
Trabajar dentro del área asignada	Obligatorio
Documentar hitos importantes en Markdown	Obligatorio
Publicar los avances documentados en main	Obligatorio
Solicitar cambios entre equipos mediante Issues	Obligatorio
Revisar los PR antes de integrarlos a main	Obligatorio
Modificar directamente ramas de otros equipos	Prohibido
Modificar código ajeno sin autorización	Prohibido
Integrar cambios no aprobados a main	Prohibido

⸻

9. Disposición final

Estas normas buscan asegurar una colaboración ordenada, transparente y verificable durante todo el ciclo de desarrollo.

Cada equipo es responsable tanto de la calidad de sus entregables como del cumplimiento de los procesos de coordinación establecidos.

Las restricciones de modificación entre equipos son una disposición expresa del cliente y deberán respetarse durante todo el proyecto.

Cualquier excepción deberá contar con autorización previa y quedar documentada en GitHub.

La comunicación, documentación y trazabilidad forman parte del trabajo de desarrollo, no son actividades opcionales.
