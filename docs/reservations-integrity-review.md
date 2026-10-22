# Análisis de reservas simultáneas, cobros e integridad

Fecha: 22 de octubre de 2026, America/La_Paz. Base revisada: backend local v0.2.0. Este documento registra una revisión y prepara una actualización; no declara implementadas reservas ni operaciones de crédito.

> Revisión histórica anterior a la implementación. El defecto de PATCH y el flujo local de reservas/créditos pendientes aquí se implementan en v0.3; ver [reporte actual](progress-v0.3.md). Las limitaciones de PostgreSQL y de durabilidad siguen vigentes.

## Resultado

**La prevención de dobles reservas y dobles cobros todavía no está implementada.** No existen servicios, controladores ni repositorios funcionales de reservas, confirmaciones o créditos. Sí existe prevención de duplicados y solapamientos de disponibilidades en memoria, limitada a un proceso.

Además, se reprodujo una pérdida de cambios al ejecutar dos actualizaciones parciales simultáneas de la misma disponibilidad. Las pruebas actuales de concurrencia de creación no cubrían ese caso.

En esta revisión se interpreta «invalidación si hay un error» como rechazo sin efectos parciales, reversión de una operación que no llegó a confirmarse y cancelación de negocio cuando corresponda. No significa eliminar operaciones válidas cada vez que falla una petición HTTP.

## Estado por requisito

| Requisito                                                              | Estado actual                       | Evidencia y alcance                                                                                      |
| ---------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Evitar disponibilidades duplicadas/superpuestas del mismo usuario      | Implementado en un proceso          | MemoryAvailabilityRepository comprueba antes de escribir, sin await intermedio                           |
| Evitar dos creaciones concurrentes superpuestas en memoria compartida  | Verificado                          | Una aceptada, una rechazada con ConflictException/409                                                    |
| Conservar el horario ante una edición inválida o superpuesta           | Implementado para esos rechazos     | Validación anterior a la escritura; pruebas aprobadas                                                    |
| Evitar pérdida de cambios con dos PATCH simultáneos del mismo registro | Fallo confirmado                    | Ambas operaciones pueden tener éxito y una sobrescribe un campo de la otra                               |
| Evitar conflictos entre distintas instancias del backend               | No implementado                     | Cada almacenamiento de memoria es independiente                                                          |
| Impedir dobles reservas de un ofertante o solicitante                  | No implementado                     | El directorio reservations contiene únicamente documentación                                             |
| Detectar reservas simultáneas existentes en datos reales               | No verificable con este repositorio | No hay almacenamiento de reservas, modelos oficiales ni conexión de BD utilizada                         |
| Impedir doble descuento, abono, retención o liberación de créditos     | No implementado                     | No hay cuentas, transferencias ni movimientos funcionales                                                |
| Repetir una operación sin duplicar sus efectos                         | Parcial                             | DELETE de disponibilidad es idempotente; no hay un mecanismo general para creación, confirmación o cobro |
| Reversión transaccional de una operación con varias escrituras         | No implementado                     | No hay unidad de trabajo ni transacciones de negocio                                                     |
| Manejar errores HTTP sin exponer secretos                              | Implementado                        | HttpExceptionFilter; esto no revierte cambios persistidos                                                |

## Evidencia en el código

- [Composición de módulos](../src/app.module.ts): registra los módulos v0.2; no incorpora módulos funcionales de reservas o créditos.
- [Reservas](../src/modules/reservations/README.md), [créditos](../src/modules/credits/README.md), [confirmaciones](../src/modules/confirmations/README.md) e [intercambios](../src/modules/exchanges/README.md): declaran funciones pendientes, sin endpoints ni reglas implementadas.
- [Repositorio de disponibilidades](../src/modules/availability/memory-availability.repository.ts): assertNoOverlap, create, updateOwned y deactivateOwned. Almacena registros propios de disponibilidad, sin participantes de una reserva ni cuentas.
- [Servicio de disponibilidad](../src/modules/availability/availability.service.ts): update lee el registro, combina el PATCH con esa lectura y después manda el intervalo completo a updateOwned.
- [Puerto de disponibilidad](../src/modules/availability/availability.repository.ts): la actualización no recibe una versión esperada ni realiza la combinación parcial contra la versión más reciente.
- [Pruebas de disponibilidad](../src/modules/availability/availability.service.spec.ts): cubren concurrencia de creación y conservación del horario ante conflicto; no cubren dos PATCH parciales simultáneos.
- [Filtro de excepciones](../src/common/filters/http-exception.filter.ts): convierte errores a respuestas HTTP; no administra transacciones, saldos ni compensaciones.
- [Adaptador de usuarios](../src/modules/users/memory-users.repository.ts): createStudentWithAccount rechaza explícitamente la creación de cuentas en modo memoria.
- [Esquema Prisma](../prisma/schema.prisma): contiene generador/proveedor, sin modelos de reservas, cuentas ni movimientos.
- La búsqueda en src, prisma y test no encontró operaciones $transaction, bloqueos de negocio, claves de idempotencia ni restricciones de exclusión implementadas.

## Hallazgo confirmado: pérdida de cambios simultáneos

Prioridad: corregir antes de ampliar el flujo de horarios o integrar reservas.

Ejemplo con horas de Bolivia, zona -04:00:

1. Existe un horario 09:00–10:00.
2. Operación A lee ese horario y solicita cambiar solo el inicio a 09:30.
3. Operación B lee la misma versión y solicita cambiar solo el fin a 11:00.
4. A escribe el intervalo completo 09:30–10:00.
5. B escribe el intervalo completo 09:00–11:00, calculado a partir de su lectura anterior.
6. Las dos operaciones finalizan correctamente; se perdió el inicio 09:30 solicitado por A.

Resultado observado en la reproducción controlada:

```json
{
  "operaciones": ["fulfilled", "fulfilled"],
  "resultadoSiSeCombinan": [
    "2026-11-02T13:30:00.000Z",
    "2026-11-02T15:00:00.000Z"
  ],
  "resultadoGuardado": ["2026-11-02T13:00:00.000Z", "2026-11-02T15:00:00.000Z"],
  "perdidaDeCambio": true
}
```

Se ejecutaron AvailabilityService y MemoryAvailabilityRepository reales, con un doble de la comprobación de estudiante y una barrera en las dos lecturas para reproducir la misma instantánea. Es una prueba de concurrencia de servicios en memoria, no una prueba HTTP ni de PostgreSQL.

El control de solapamientos sigue comprobando el intervalo finalmente escrito contra los demás registros. El defecto observado es pérdida silenciosa de una edición; no demuestra una reserva duplicada ni un cobro, porque esas operaciones no existen.

Corrección requerida: combinar y validar el PATCH contra el registro vigente dentro de una operación protegida, o detectar explícitamente una versión obsoleta y responder conflicto. La comprobación debe incluir cualquier otra disponibilidad del mismo usuario. No basta con proteger solamente el Map.set o el Object.assign final.

## Reservas simultáneas: qué se pudo analizar

Se verificó el comportamiento de horarios publicados, sin consultar datos de una BD externa:

- Mismo usuario, mismo intervalo y dos creaciones concurrentes en el mismo almacenamiento: solo una se acepta.
- Actualización con fin anterior al inicio: se rechaza y el registro conserva su estado anterior.
- Dos almacenamientos independientes: ambos aceptan el mismo usuario/intervalo. Esto demuestra que no hay coordinación compartida entre almacenes; no se ejecutó una prueba con dos servidores PostgreSQL ni con dos procesos HTTP.
- Usuarios diferentes pueden publicar disponibilidades coincidentes. Eso es válido para disponibilidad y no indica doble reserva.
- No se puede comprobar si una persona está reservada como ofertante y solicitante a la vez: no existen esos registros ni esa lógica.

Por tanto, no se encontraron reservas simultáneas almacenadas porque no existe un almacén de reservas que inspeccionar. Tampoco se puede certificar que una BD del otro equipo carezca de ellas: no se consultó esa base.

## Dobles cobros y repetición de peticiones

«Cobro» se interpreta como descuento o transferencia de créditos de tiempo; no se solicita una pasarela de pagos monetarios.

Hoy no se descuenta ni acredita saldo. No hay confirmaciones con efecto económico, retenciones o movimientos que auditar. La inexistencia de cobros actuales no equivale a tener protección contra duplicados.

En la futura implementación se necesitan dos garantías distintas:

1. Idempotencia de peticiones: el mismo usuario repitiendo la misma operación obtiene el resultado anterior sin repetir sus efectos.
2. Unicidad del efecto de negocio: una reserva no puede producir dos liquidaciones aunque los reintentos usen claves de idempotencia diferentes o provengan de confirmaciones concurrentes.

Desactivar dos veces una disponibilidad ya conserva el resultado, pero no resuelve esos dos requisitos para reservas y créditos. Un límite de peticiones tampoco sustituye estas garantías.

## Errores, invalidación y reversión

| Momento o clase de error                                 | Comportamiento actual / requerido                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| DTO, fecha o permiso inválido                            | Actualmente se rechaza antes de modificar el horario                                                                              |
| Superposición detectada al crear/editar                  | Actualmente se rechaza antes de escribir; se conserva el horario previo                                                           |
| Fallo durante una operación futura con varias escrituras | Falta una transacción que revierta reserva, cuentas, retenciones, movimientos y resultado de operación conjuntamente              |
| Se confirmó el cambio, pero se perdió la respuesta HTTP  | No debe cancelarse ni cobrarse otra vez por asumir que falló; hace falta recuperar el resultado mediante idempotencia             |
| Cancelación válida de una reserva futura                 | Requiere transición autorizada y liberación exactamente una vez; no está implementado                                             |
| Fallo después de una operación de negocio ya completada  | Requiere reconciliación o una compensación definida; no borrar movimientos ni deshacer una reserva válida de forma indiscriminada |

El filtro HTTP solo informa errores. Ejemplo adicional de que no existe una reversión global: AuthService registra ultimo_acceso antes de firmar el JWT; si la firma falla, no hay código que restaure esa marca. Esto se observa por inspección del orden de operaciones, no mediante una prueba de fallo de firma. No es un cobro parcial y no se propone reescribir la autenticación por ese motivo.

## Verificaciones ejecutadas en esta revisión

```powershell
npm.cmd test -- --runTestsByPath src/modules/availability/availability.service.spec.ts
```

Resultado: 1 suite, 17 pruebas aprobadas.

Además se ejecutó una reproducción temporal con node y ts-node sobre las clases reales para los cuatro escenarios descritos: creación concurrente, conservación tras error, pérdida de cambios entre PATCH y dos almacenamientos independientes. No se modificó código de aplicación ni se añadieron pruebas permanentes que declaren corregido el fallo.

Los resultados de 70 unitarias y 80 HTTP del reporte v0.2 corresponden a la entrega anterior; no se repitieron todas esas suites durante esta revisión. Que esas pruebas pasen no cubre el caso nuevo de PATCH concurrente.

## Actualización preparada

La [orden para Codex](codex-order-reservations-integrity.md) incluye corrección de concurrencia, prevención de doble reserva para ambos participantes, idempotencia de créditos, reversión antes de commit, recuperación después de commit y pruebas con fallos inducidos.

La implementación real de reservas y créditos requiere el esquema oficial y las políticas pendientes. El análisis no cambia esa dependencia ni inventa una BD, saldos o estados definitivos. Durante esta revisión solo se crean estos dos documentos; el defecto queda identificado y pendiente de corrección. Sin commit, push, PR ni modificación de bases de datos.
