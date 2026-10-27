# Ofertas desde Inicio y pestaña Horarios

Entrega de Frontend del 27 de octubre de 2026, en `frontend/ofertar-habilidad`.

## Alcance de esta rama

- Inicio muestra el botón amarillo **Ofertar una habilidad** a estudiantes con
  sesión. No aparece para visitantes ni para sesiones ADMIN.
- `features/offers/OfferDialog.vue` permite elegir una habilidad propia activa,
  fecha y horas en la zona de La Paz. Incluye validación, estados sin habilidades
  y revisión de los datos.
- **Publicar oferta permanece deshabilitado.** Se avisa desde el inicio del
  formulario que no se guardan datos ni se publica nada. El borrador vive solo
  en la ventana y se descarta al cerrarla.
- El enlace de Perfil abre este mismo formulario en Inicio mediante
  `/?ofertar=1`. Al abrirlo se consume ese parámetro, conservando la búsqueda y
  el fragmento de la URL.
- El menú de escritorio y móvil cambia Disponibilidad por **Horarios**. Se
  mantienen la ruta `/disponibilidad`, su nombre `availability` y la vista
  `AvailabilityView.vue` para conservar los accesos existentes.
- Se retira de esa vista el formulario de publicación de horarios generales.
  Continúan el listado y las acciones de edición y desactivación con sus
  servicios actuales. Por tanto, **esta rama no permite crear horarios nuevos
  hasta completar la integración de ofertas**; es el alcance preparado acordado.

## Validación del formulario

Solo se admiten habilidades que el estudiante ya comparte en su Perfil y que
siguen activas en el catálogo recibido. Fecha real, inicio futuro, final posterior
al inicio y horas en intervalos de 15 minutos dentro de la misma fecha.

`toOfferDraft` conserva `skillId` y convierte los límites a `fechaInicio` y
`fechaFin` en UTC. Es un formato de borrador de la interfaz, **no un contrato
de endpoint aprobado**. No se agrega ninguna llamada HTTP ni persistencia local.

## Coordinación con APIs y Backend

El `POST /availability` vigente y `services/timebank.publishAvailability`
reciben únicamente `fechaInicio` y `fechaFin`. La disponibilidad pertenece al
usuario y no identifica una habilidad. Enviar el borrador a esa función perdería
la selección; agregar campos sin acordarlos podría ser rechazado por el backend.

Antes de habilitar Publicar oferta, los equipos responsables deben acordar:

1. Endpoint, campos de entrada y respuesta para guardar una oferta con habilidad
   y horario, usando la identidad autenticada.
2. Asociación persistente y validación de habilidad propia, fechas, solapamientos
   y conflictos entre reservas del mismo ofertante, incluso de habilidades distintas.
3. Lectura de la oferta y su horario por habilidad, tanto en el catálogo de Inicio
   como en Horarios. El listado actual todavía utiliza horarios generales.
4. Servicio del frontend y acción del store que espere la respuesta, actualice las
   listas y muestre errores. Solo entonces habilitar el botón y mostrar éxito.

Frontend termina el estado de envío y resultado cuando ese contrato esté disponible.
APIs e Implementación conectará su carpeta de servicios; Backend y Base de Datos
resolverán reglas y persistencia. La ampliación del catálogo de materias se solicita
a los equipos responsables: esta rama conserva el catálogo dinámico de la API y no
agrega materias ficticias.

Los filtros que ocultan ofertas propias y la actualización automática del catálogo
de otros usuarios no se modifican en esta entrega.

## Verificación

`npm test` incluye las validaciones del borrador y las pruebas funcionales de
`tests/offer-form.integration.test.js`. Estas ejecutan la lógica real de las vistas,
el router y los servicios existentes con HTTP controlado. Comprueban roles,
selección propia, fechas, revisión, descarte, cierre de sesión y la conservación
de editar/desactivar horarios. No escriben en el backend desplegado.

`npm run build` comprueba la compilación de producción. Quedan pendientes la
revisión visual en navegador y la prueba completa con el contrato de ofertas real.
