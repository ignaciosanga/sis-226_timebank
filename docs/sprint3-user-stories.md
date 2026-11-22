# Historias Sprint 3: continuación de Kevin Tapia

> Actualización 22/11: integración económica y académica sobre BD v4 disponible. Consultar [guía v4](skillswap-v4-integration.md) y [verificación actual](verification-2026-11-22.md). Los pendientes de BD descritos abajo corresponden al estado histórico del 21/11.


Fecha: 21/11/2026. Rama: feat/backend-academico-reputacion-parcial3, base 8fe275b.
Se conserva la implementación académica de los puntos 6/7 del plan anterior.
El nuevo documento añade HU-05, HU-06 y HU-08 a Kevin; no reasigna automáticamente
las tareas de Gonzalo/Beymar ni autoriza publicar o migrar Neon.

| Historia | Estado en esta rama |
| --- | --- |
| HU-01 / HU-02 | Núcleo de seguridad heredado, sin cambiar sus reglas ni bono |
| HU-03 | Modelo académico y SQL propuesto, sin migrar; integración final a cargo de BD/lead |
| HU-04 | Build, esquema y tipos revisados localmente; certificación PostgreSQL, CI y PR pendientes |
| HU-05 | POST heredado, GET detalle/filtros y PUT propio implementados; comprobación PostgreSQL pendiente |
| HU-06 | Snapshot, retención, liquidación, bloqueo e idempotencia heredados; cálculo dinámico pendiente de reglas/migración BD |
| HU-07 | Mis clases y resumen añadidos; reservas/calendario heredados |
| HU-08 | Auditoría y Liberacion heredadas; duplicado con clave nueva 409 y agregados de cancelación añadidos; clasificación/penalización pendiente de BD |

## Contrato de ofertas HU-05

- GET /tutoring/offers conserva page/limit/search y añade skillId/codigo/tutorId/
  excludeTutorId. La búsqueda textual incluye el código si BD cargó el mapeo.
  Todos los listados permanecen abiertos a cualquier carrera.
- GET /tutoring/offers/:id devuelve una oferta visible bajo las mismas reglas
  de actividad, propiedad de habilidad, nivel y disponibilidad; 404 si no es visible.
- PUT /tutoring/offers/:id requiere JWT del tutor propietario y Idempotency-Key.
  Recibe el DTO completo de POST; omitir bannerUrl quita la imagen. Las URLs se
  validan contra cargas propias, no se admiten URLs arbitrarias de terceros.
- La materia no cambia; requiere habilidad activa propia y nivel vigente. Precio
  como texto exacto; sigue pendiente el cálculo dinámico de HU-06. No modifica
  snapshots de solicitudes/reservas ni escribe movimientos de crédito.
- Cambiar horario requiere futuro, sin solapamientos, sin solicitudes Solicitada/
  Aceptada vinculadas y disponibilidad libre. Contenido/precio pueden actualizarse
  conservando el horario contratado y su precio anterior. El banner anterior se
  desasocia al reemplazarlo; no se borra físicamente dentro de la transacción.
- El cliente resuelve códigos con GET /skills y envía skillId UUID. Se conserva
  el contrato del frontend y se impide publicar códigos como identificadores UUID.

## Dependencia concreta de HU-06 y HU-08

El documento dice «reglas definidas en la migración de Base de Datos», pero no
adjunta esa migración ni define valores. Antes de cambiar el motor se requiere:

| Dato pendiente | Por qué se necesita |
| --- | --- |
| Rama/commit y migración Prisma de BD | Consolidar columnas, vistas y tipos reales sin otro DDL paralelo |
| Tarifa base, factores, orden y ámbito | Evitar asumir multiplicadores, precios o incentivos |
| Precisión, redondeo y límites | Mantener aritmética exacta y contrato de cadenas monetarias |
| Versión/vigencia de reglas y momento del cálculo | Guardar precio y regla aplicados en el snapshot, reproducibles tras reintentos |
| Umbral de cancelación y tratamiento del límite exacto | No confundir la hora entera auditada con el intervalo exacto de decisión |
| Excepciones, ADMIN y revisión de justificación | No imputar toda cancelación tardía como injustificada automáticamente |
| Penalización: monto/base, destinatario y tipo de movimiento | Conservar saldo >= retenidos >= 0 sin inventar cargos ni transferencias |
| Reglas aplicables a reservas existentes | No alterar retroactivamente acuerdos anteriores |

Hasta recibirlo no se aplican factores, bonos ni Penalizacion. El esquema oficial
entero sigue rechazando contratación de ofertas con OFFER_PRICE_FLOW_PENDING,
como el commit base. El SQL decimal provisional heredado no se promueve como
migración oficial. Ningún indicador debe presentar HU-06 como finalizado.

La cancelación actual libera la retención una sola vez y audita motivo, actor,
cancelled_at y horas enteras de anticipación. Un replay con la misma clave sigue
siendo éxito; una nueva clave para una reserva cancelada devuelve 409. Cancelar
Completada o sin motivo mantiene el rechazo previo. El monitor añade cancelaciones
por cancelled_at, actor relativo (solicitante/ofertante/administrador) y media de
anticipación. No expone motivos personales ni IDs de cuentas. La clasificación
injustificada y las reglas económicas se muestran pendientes/null.

## Reparto actualizado

El nuevo documento asigna CALIFICACIONES/NOTIFICACIONES a APIs y la semilla oficial
a BD. El módulo de opiniones y la semilla académica preparados según el encargo
anterior permanecen disponibles para revisión y entrega a esos equipos; no se
creó una segunda implementación ni se modificó su código. Coordinar antes de
integrar para que exista un único responsable de cada ruta/carga. No se añadió
chatbot, notificaciones, despliegue, publicación de rama ni ejecución en Neon.

La propuesta académica permanece fuera de prisma/migrations. Hasta aprobar y
aplicar ese SQL y cargar el catálogo, Mi ruta/indicadores académicos responden 503.
GET /skills y los flujos heredados continúan disponibles sobre el esquema anterior.

## Validación

Node 26.13.1 y npm 11.20.0 detectados. Se amplió solo el rango Node a >=26.8.2 <27
en package.json y lockfile; no se actualizaron dependencias. Instalación exacta
con npm ci y CA de Windows completada, Prisma Client generado y esquema validado.
Pruebas focalizadas se ejecutan secuencialmente en memoria; no equivalen a
certificación PostgreSQL. Resultados finales registrados en academic-integration.md.
No se inició API, Docker o PostgreSQL ni se aplicaron migraciones.
