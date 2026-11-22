# Verificación de cumplimiento — 21/11/2026

> Actualización 22/11: integración económica y académica sobre BD v4 disponible. Consultar [guía v4](skillswap-v4-integration.md) y [verificación actual](verification-2026-11-22.md). Los pendientes de BD descritos abajo corresponden al estado histórico del 21/11.


**Conclusión: no se cumplen todavía todos los criterios de entrega.** Hay código
y pruebas locales aprobadas, pero no certificación PostgreSQL ni reglas económicas
oficiales. No confundir «implementado» con «integrado y aceptado».

Se compararon la Guía de continuación, el Plan de trabajo (secciones 6/7) y las
Historias Sprint 3 actualizadas. Rama feat/backend-academico-reputacion-parcial3,
base 8fe275bc465b061e9df651dfc870ef293b3870f7. Cambios aún locales, sin commit/PR/push.

## Resultados ejecutados

| Comprobación | Resultado |
| --- | --- |
| Prisma validate | Aprobado |
| Build TypeScript | Aprobado |
| ESLint | Aprobado, sin warnings |
| npm test completo | 261/261 pruebas, 28/28 suites |
| E2E HTTP | 10 suites comprobadas; 188 casos finales aprobados entre ejecución completa y repeticiones de suites afectadas |
| Catálogo estático | 49 materias, MAT-030 externo, sin electivas indefinidas, referencias resolubles y sin ciclos |
| PostgreSQL | No ejecutado: motor Docker inactivo, sin conexión de pruebas configurada |
| Frontend/Dashboards/Google remoto | No verificados conjuntamente |
| CI, PR y despliegue | No ejecutados |

Las pruebas fueron secuenciales. Los E2E usan Nest, HTTP y JWT reales con repositorio
en memoria; correo simulado y sin API de desarrollo permanente. El 503 académico
en memoria es deliberado. No se inició Docker, PostgreSQL, demo:academic ni se
ejecutó SQL contra bases compartidas. No se leyeron ni publicaron secretos.

La primera pasada detectó un fallo en el test de contrato Prisma y una expectativa
HTTP antigua de cancelación. Después de corregirlos, se repitió la suite unitaria
completa y las suites HTTP afectadas. Al ajustar el error de materia inexistente,
también se actualizó su expectativa anterior y se repitió la suite de ofertas.
No se afirma una única ejecución completa final de E2E: los resultados finales
combinan la pasada completa con las repeticiones indicadas.

## Correcciones durante esta verificación

- Contrato Prisma: comprueba explícitamente las cinco tablas académicas y conserva
  la comparación exacta de tablas/columnas originales. No se ignoró el test fallido.
- HU-08: la prueba HTTP exige 409 al cancelar de nuevo con otra clave; misma clave
  sigue devolviendo el resultado original. Conserva controles de saldo y liberación única.
- HU-05: publicar materia inexistente/inactiva devuelve 400 conforme a la historia;
  se añadió comprobación HTTP de ausencia de escrituras parciales.
- HU-05: cobertura HTTP nueva de detalle, exclusión de tutor, edición por propietario,
  rechazo de tercero, replay y conservación de saldos.
- A02: comprobación de ausencia de ciclos en el grafo de prerrequisitos cargado.

## Plan académico A01–A10

| Tarea | Qué está comprobado | Qué falta para aceptación |
| --- | --- | --- |
| A01 Catálogo | Fuente frontend transcrita, 49 códigos, exclusión de electivas, script que preserva UUID y rechaza ambigüedades | Confirmación institucional, carga real, equivalencias resultantes y recarga idempotente en PostgreSQL |
| A02 Pensum | Prisma válido, relaciones propuestas, referencias/ciclos del catálogo y consulta implementada | Aprobación/migración BD y consultas reales del plan |
| A03 Mi ruta | Rutas/DTO/propiedad implementadas; sesión y 503 sin BD comprobados | Persistencia, concurrentes, MAT-030, pending y aislamiento comprobados contra PostgreSQL; hoy requiere la propuesta y carga |
| A04 Opiniones | Unitarias y HTTP: autor válido, 1–5, duplicados, replay, aislamiento, no mover saldo | Escritura y concurrencia verificadas en PostgreSQL; coordinación de titularidad con APIs |
| A05 Reputación | Media nullable y conteos por tutor/materia comprobados; ranking descriptivo implementado | Validar ranking SQL; aprobar fórmula Knowledge Score y reglas de cancelación con PO |
| A06 Aprendí/Enseñé | Consulta autenticada y agregados implementados sin tablas nuevas | Verificar totales SQL, períodos y ambos participantes con datos persistidos |
| A07 Command Center | Consultas y definiciones implementadas; proyección etiquetada | Recalcular KPIs con fixtures PostgreSQL y validar con BI |
| A08 Monitor | Dataset de lectura, precios/cancelaciones/inactividad; sin cargos automáticos | Validación SQL y definiciones oficiales de sin uso/injustificada |
| A09 Dashboards | Guards ADMIN, contratos y diccionario documentados | Acuerdo de consumo, DTO de agregados más precisos en OpenAPI e integración BI/Frontend |
| A10 Calidad/entrega | Prisma, build, lint, unitarias y E2E en memoria aprobados; README actualizado | Pruebas PostgreSQL de los módulos nuevos, demo persistente, OpenAPI exportado, CI y PR revisado |

El punto 7 es el orden de ejecución, no otra funcionalidad. La estructura de las
etapas está implementada, pero sus condiciones de cierre siguen dependiendo de
BD, PO e integración. La guía menciona «validación de prerrequisitos» y el contrato
frontend permite declaraciones manuales sin exigirlos: actualmente se valida el
catálogo y se usan requisitos para recomendación/proyección, sin bloquear una
declaración. Confirmar esa interpretación con PO antes de aceptación formal.

## Historias HU-01–HU-08

| Historia | Resultado |
| --- | --- |
| HU-01 | Flujos de activación/bono único heredados pasan tests locales; SMTP/Google y persistencia real no certificados aquí |
| HU-02 | JWT/roles/propiedad y separación de propósito pasan pruebas locales; no implica prueba remota de Calendar |
| HU-03 | No cerrada: falta consolidar la migración oficial con BD y validar actualización de base poblada |
| HU-04 | Parcial: compilación/tests locales sí; export OpenAPI, CI/PR y certificación PostgreSQL pendientes |
| HU-05 | Comportamiento HTTP verificado en memoria, incluidos edición y errores; persistencia PostgreSQL pendiente |
| HU-06 | No terminada: faltan migración oficial, tarifa, factores, redondeo y reglas; esquema entero sigue bloqueando contratación de oferta con OFFER_PRICE_FLOW_PENDING |
| HU-07 | Reservas/solapamientos heredados pasan HTTP; Mis clases SQL e integración de calendario completo aún no certificados |
| HU-08 | Auditoría, liberación, motivo y duplicados pasan tests; clasificación injustificada/penalización aún no implementadas por falta de reglas |

El documento actualizado asigna opiniones a APIs y seed oficial a BD, mientras
el plan anterior los asigna al frente académico. Se conserva el trabajo ya pedido
para revisión/entrega, pero debe acordarse quién integra cada parte para no duplicarla.

## Siguiente paso necesario

1. Recibir y acordar con BD la migración de créditos/economía y el esquema académico.
2. PO/BD definen factores, umbral, penalización y Knowledge Score. No se sustituyen
   por valores supuestos ni se presentan null como funcionalidad terminada.
3. Habilitar un servidor PostgreSQL de pruebas aislado, aplicar allí la propuesta
   aprobada y comprobar carga doble, persistencia/reconexión, concurrencia de ruta,
   opiniones y exactitud de todos los KPIs. El runner heredado test:postgres por
   sí solo no cubre las nuevas tablas académicas: necesita ampliar esos casos.
4. Verificar integración frontend/BI, exportar OpenAPI y preparar PR con CI.

Hasta entonces no activar flags de integración ni presentar el backend como
entrega completa y funcional en PostgreSQL/Neon.
