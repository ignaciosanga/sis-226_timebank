# Orden para Codex — Concurrencia, reservas y créditos sin duplicados

Documento preparado el 22 de octubre de 2026. **Es una orden para una implementación posterior; su creación no significa que estas funcionalidades estén implementadas.**

> Orden de referencia. Después, el usuario autorizó reglas provisionales coherentes y se implementó el flujo de memoria v0.3. Ver [reporte de ejecución](progress-v0.3.md) y [compatibilidad](database-compatibility.md). No implica integración de PostgreSQL.

## 1. Contexto y objetivo

Trabaja sobre el backend NestJS existente del Banco de Tiempo Universitario, actualmente v0.2. Lee primero README.md, docs/progress-v0.2.md y docs/reservations-integrity-review.md; después contrasta cada afirmación con el código y las pruebas.

Objetivos:

- Corregir la pérdida de cambios entre actualizaciones simultáneas de disponibilidad.
- Impedir dobles reservas que involucren a cualquiera de los participantes.
- Impedir dobles descuentos, abonos, retenciones, liberaciones y transferencias de créditos de tiempo.
- Garantizar rechazo sin efectos parciales y reversión de operaciones fallidas antes de confirmarse.
- Recuperar el resultado de operaciones confirmadas aunque el cliente no haya recibido su respuesta.
- Detectar conflictos existentes y documentar lo implementado, simulado y pendiente por separado.

No tratar disponibilidades publicadas como reservas. No introducir pagos monetarios ni pasarelas de cobro.

## 2. Restricciones obligatorias

1. No crear otro proyecto, reescribir autenticación ni cambiar nombres oficiales arbitrariamente.
2. Reutilizar módulos, JWT, guards, DTO, servicios, interfaces y proveedores existentes.
3. Preservar todas las funcionalidades y pruebas anteriores. No afirmar que una prueba local de memoria certifica concurrencia en PostgreSQL o entre procesos.
4. No ejecutar commit, push, Pull Request, despliegue ni otros cambios remotos.
5. No ejecutar migraciones, db push, introspección ni comandos sobre una BD del otro equipo bajo esta orden.
6. No inventar esquema definitivo, saldo inicial, estados, equivalencia tiempo/crédito, precisión o reglas de cancelación.
7. No instalar otra BD ni fabricar un repositorio Prisma que aparente integración real.
8. No borrar datos válidos como solución genérica ante excepciones o conflictos.

## 3. Separar el trabajo según las dependencias reales

### Parte A: correcciones compatibles con la v0.2 local

Implementar y verificar la corrección de PATCH concurrente de disponibilidad, sin necesitar PostgreSQL ni reservas. Mantener los endpoints públicos existentes y registrar una prueba permanente que reproduzca el defecto antes de corregirlo.

Investigar creación, edición y desactivación concurrentes, tanto del mismo registro como de registros diferentes del mismo usuario. La exclusión de solapamientos debe conservarse.

### Parte B: reservas y créditos

Antes de implementar persistencia de negocio, comprobar que se dispone de:

- Modelo oficial completo de SOLICITUDES_INTERCAMBIO, RESERVAS, CONFIRMACIONES, CANCELACIONES, CUENTAS_CREDITO, MOVIMIENTOS_CREDITO y TRANSFERENCIAS_CREDITO, con sus relaciones y restricciones.
- Estados y transiciones que ocupan/liberan el horario, aprobados por PO/BD.
- Política de saldo, retención, unidad, precisión, liquidación, confirmación y cancelación aprobada.
- Contrato de API y mecanismo autorizado para preparar/probar la persistencia real.

Si falta información, completar la parte A, contratos, análisis y diseño que no dependan de ella. Dejar constancia exacta de las dependencias pendientes, sin sustituirlas por saldos o reglas inventados. No presentar la parte B como terminada. Esta orden por sí sola no autoriza cambios en bases de datos externas.

## 4. Corregir las actualizaciones simultáneas de horarios

Defecto conocido: update lee el horario y combina el PATCH antes de updateOwned; dos lecturas de la misma versión generan dos intervalos completos y una escritura puede descartar un cambio previo.

Requisitos:

- La lectura vigente, combinación de campos, validación completa y escritura deben formar una operación protegida, o debe detectarse una versión obsoleta mediante comparación y conflicto explícito.
- En memoria, cualquier exclusión mutua debe compartirse mediante un proveedor y abarcar todos los horarios del mismo usuario que puedan solaparse. No crear un bloqueo independiente en cada petición ni proteger solamente la asignación final.
- No dejar bloqueos retenidos si una validación o repositorio falla. Probar la liberación después de una excepción.
- En persistencia real, la protección debe funcionar entre procesos. Un mutex de Node.js no es suficiente para certificar esa garantía.
- No agregar columnas oficiales supuestas para versionado. Si se propone control de versión en BD o cambios públicos de API, documentar la necesidad y coordinar el modelo/contrato.
- Para el ejemplo 09:00–10:00, PATCH de inicio a 09:30 y PATCH de fin a 11:00: deben conservarse ambos cambios cuando sean compatibles o debe rechazarse explícitamente la operación obsoleta. Dos respuestas exitosas con pérdida silenciosa no son aceptables.

## 5. Prevención de dobles reservas

Cuando el modelo y las reglas estén disponibles:

- Obtener el actor del JWT, comprobar estado activo, permisos y participación autorizada.
- Exigir participantes distintos y habilidad válida publicada por el ofertante.
- Comprobar que el intervalo solicitado esté cubierto por la disponibilidad válida según el contrato aprobado. Volver a comprobar dentro de la operación atómica que crea/confirma la reserva.
- Impedir solapamientos de reservas que ocupen horario para ambos participantes: ofertante y solicitante.
- Considerar también el cruce de roles: una persona reservada como ofertante no puede reservarse simultáneamente como solicitante en otro intercambio, ni viceversa.
- Usar instantes con zona horaria y el criterio [inicio, fin), manteniendo válidos los extremos contiguos si el PO conserva esa regla.
- La comprobación de conflicto, transición de la solicitud/reserva y creación de la retención correspondiente deben ejecutarse atómicamente.
- Evitar que dos aceptaciones de una misma solicitud creen reservas distintas si el contrato aprobado establece una única reserva por solicitud.
- No usar únicamente «consultar si existe y luego insertar» fuera de una transacción protegida.
- Definir con BD restricciones, bloqueo o aislamiento que cubran las inserciones concurrentes, incluso cuando todavía no exista una reserva que bloquear. Bloquear solo las filas de reservas ya encontradas no basta si ambas consultas iniciales están vacías.
- Ante dos intentos incompatibles y simultáneos, solo uno debe producir una reserva válida y retener créditos; el otro debe recibir un conflicto controlado sin efectos económicos.
- Definir qué sucede al editar/desactivar una disponibilidad que ya respalda reservas. Aplicar la política aprobada con la misma protección de concurrencia; no invalidar reservas existentes silenciosamente.

## 6. Evitar dobles cobros de créditos

Implementar tanto idempotencia de petición como unicidad del efecto de negocio:

- Proponer/documentar una clave de idempotencia por actor y operación para acciones con efectos de reserva o crédito. Asociarla al contenido canónico de la solicitud; no usarla como autorización.
- Misma clave y mismo contenido: recuperar el resultado ya confirmado sin repetir efectos. Dos solicitudes simultáneas con esa clave no pueden ejecutar el negocio dos veces.
- Misma clave con distinto contenido: rechazar con conflicto. No devolver resultados de otro usuario ni colisionar claves entre operaciones diferentes.
- Definir respuesta/recuperación cuando una operación con esa clave sigue en curso o su resultado es incierto. No usar una marca temporal de «procesando» que quede bloqueada para siempre tras una caída.
- Resultado de idempotencia y efectos de negocio deben confirmarse de forma coherente. Un cache local no certifica persistencia ante reinicio ni varias instancias.
- Una reserva/evento no debe generar dos liquidaciones aunque se presenten claves distintas, confirmaciones repetidas o peticiones desde participantes diferentes. Proteger esa identidad de negocio en persistencia.
- Crear una retención una sola vez; liberarla una sola vez al cancelar o consumarla una sola vez al liquidar, según la política aprobada.
- Registrar descuento, abono, transferencia y movimientos asociados como una unidad atómica. No responder éxito hasta confirmar el conjunto.
- Impedir saldo disponible negativo y sobreasignación de retenciones por operaciones simultáneas sobre la misma cuenta, incluso si las reservas usan horarios diferentes.
- Utilizar una representación exacta de créditos acorde con la unidad/precisión oficial; no cálculos financieros con punto flotante binario ni conversiones implícitas que redondeen saldos.
- Si el modelo usa saldo y creditos_retenidos, verificar sus invariantes aprobadas, incluida disponibilidad = saldo - creditos_retenidos y límites de retención. No inventar un saldo inicial para probar el flujo real; usar fixtures aislados claramente identificados.

Confirmación y cancelación deben tener transiciones condicionales. Una carrera entre finalizar y cancelar debe producir un único resultado permitido y saldos/movimientos coherentes. No permitir una segunda liquidación, una segunda liberación ni una cancelación que borre un cobro ya completado.

## 7. Fallos, reversión y resultado incierto

Distinguir explícitamente estos casos:

1. **Validación o permiso inválido:** rechazar sin modificar datos.
2. **Fallo antes del commit:** revertir todas las escrituras de esa operación. No dejar reserva sin retención, retención sin reserva, descuento sin abono, movimientos huérfanos o un resultado de idempotencia que diga éxito.
3. **Conflicto de concurrencia:** mantener el estado válido y devolver conflicto. Reintentar solo errores transitorios identificados, con límite y preservando idempotencia; no repetir automáticamente errores de negocio.
4. **Commit completado, respuesta perdida o timeout:** consultar/recuperar el resultado de la misma operación. No asumir que no ocurrió ni volver a cobrar; tampoco cancelar una reserva válida solo porque falló la comunicación.
5. **Cancelación de negocio posterior:** aplicar la transición autorizada y una compensación/liberación identificable exactamente una vez, según la política. Conservar el historial, sin borrar movimientos.

La unidad de trabajo debe abarcar los repositorios que participan en el caso de uso. Añadir un filtro HTTP, un try/catch o un estado «ERROR» no demuestra rollback.

Si se incluye una implementación transaccional de memoria para pruebas, la reserva, cuentas, movimientos e idempotencia deben compartir el mismo límite de commit. No usar copias independientes de cada repositorio ni restaurar un snapshot global que pueda borrar cambios válidos de otra operación concurrente. Documentar que no ofrece durabilidad ante caída del proceso.

Notificaciones o efectos externos futuros no deben repetirse por reintentos de una transacción. Si existen al implementar, diseñar su entrega recuperable después del commit; no inventar servicios externos para esta actualización.

## 8. Análisis de conflictos existentes

- Inventariar primero qué datos existen realmente y dónde están almacenados.
- Sin BD/modelos de reservas, informar «no verificable» y explicar por qué; no afirmar que no existen conflictos en una base no inspeccionada.
- Si posteriormente se dispone de un entorno de prueba autorizado, preparar una auditoría de solo lectura que identifique reservas superpuestas por participante en cualquier rol, efectos de crédito duplicados, retenciones inconsistentes y operaciones incompletas.
- No cancelar automáticamente reservas ni alterar saldos encontrados. Entregar un reporte con evidencia, impacto y propuesta de corrección para revisión.

## 9. Pruebas obligatorias

Preservar las pruebas anteriores y añadir escenarios que demuestren el comportamiento, con concurrencia real entre operaciones y barreras de sincronización cuando hagan falta.

### Disponibilidad: ejecutar en la parte A

1. Dos creaciones superpuestas: una aceptada y otra rechazada, sin dos registros activos incompatibles.
2. Dos PATCH parciales del mismo registro: combinación coherente o conflicto explícito, sin pérdida silenciosa.
3. Dos ediciones de registros diferentes que intentarían superponerse: se conserva la exclusión por usuario.
4. PATCH y desactivación concurrentes: resultado consistente; no reactivar silenciosamente un horario eliminado lógicamente.
5. Validación/solapamiento o excepción: registro original conservado y recursos de sincronización liberados; una operación válida posterior funciona.

### Reservas, créditos y persistencia: ejecutar al habilitar la parte B

6. Dos reservas simultáneas del mismo ofertante y horario: una válida.
7. Dos reservas simultáneas del mismo solicitante y horario: una válida.
8. Conflicto entre una reserva como ofertante y otra como solicitante para la misma persona: una válida.
9. Dos aceptaciones de la misma solicitud: no duplicar reserva/retención.
10. Intervalos equivalentes expresados en zonas diferentes y todos los casos de solapamiento; intervalos contiguos válidos si corresponde.
11. Dos reservas distintas que consumen simultáneamente el mismo saldo disponible: no excederlo.
12. Repetición y ejecución simultánea con la misma clave: un solo efecto y resultado recuperable; otra carga con la misma clave se rechaza.
13. Claves diferentes para el mismo evento de liquidación: un solo descuento, abono y transferencia.
14. Confirmaciones simultáneas/repetidas de participantes: una sola liquidación.
15. Cancelación repetida y cancelación simultánea con finalización: un resultado permitido, sin doble liberación o cobro.
16. Fallos inducidos en cada punto previo al commit: comparar todos los registros/saldos antes y después; ningún efecto parcial.
17. Fallo después del commit pero antes de responder: el reintento recupera el resultado y conserva un único efecto.
18. Reintento de error transitorio con límite: no duplicar efectos y no dejar claves en curso indefinidamente.
19. JWT ausente/inválido, usuario suspendido, actor ajeno y campos de usuario/saldo arbitrarios: rechazo sin escrituras.
20. Persistencia real: verificar con conexiones independientes y múltiples instancias del backend contra un entorno aislado autorizado. Reiniciar el proceso y repetir una operación ya confirmada: no volver a cobrar.

No sustituir las pruebas transaccionales reales por mocks y declararlas equivalentes. Si falta el entorno autorizado, registrar cuáles quedan pendientes.

## 10. Documentación y entrega

- Actualizar README, Swagger y contratos únicamente con funcionalidades realmente implementadas.
- Documentar estados/transiciones aprobados, intervalos que ocupan horario, claves de idempotencia, errores HTTP, representación de créditos y límites de persistencia.
- Ejecutar build, lint, pruebas y formato adecuados a los cambios; corregir problemas reales conservando el resto del backend.
- Entregar un reporte con archivos cambiados, escenarios ejecutados, defectos corregidos, garantías por proceso y entre procesos, dependencias pendientes y resultados de fallos inducidos.
- Separar claramente «implementado», «verificado en memoria», «verificado en PostgreSQL» y «pendiente».
- Mantener todo local. No hacer commit, push, PR, despliegue ni cambios sobre la BD del otro equipo.

## 11. Criterios de aceptación

Parte A terminada: el defecto de PATCH simultáneo tiene prueba permanente, se corrige sin romper el contrato y pasan las comprobaciones de exclusión, error y desactivación concurrente.

Parte B terminada: además del modelo/políticas aprobados y las pruebas locales, se verifica en persistencia compartida autorizada que no hay doble reserva por participante, doble efecto de crédito, escrituras parciales antes del commit ni duplicación después de una respuesta perdida. Si falta esa verificación, declarar la garantía pendiente y no presentar el sistema como preparado para producción.
