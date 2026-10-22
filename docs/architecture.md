# Arquitectura v0.3 local

Monolito NestJS existente con controladores, DTO, casos de uso y puertos de repositorio. Se conservan autenticación, catálogos y perfiles. No hay Frontend ni API Gateway.

## Composición y almacenamiento compartido

AppModule registra Auth, Users (mediante Auth), Health, Categories, Skills, UserSkills, Availability, Exchanges, Reservations y Credits, además de configuración, throttling e infraestructura Prisma anterior.

ExchangePersistenceModule proporciona una única instancia de EXCHANGE_REPOSITORY. AvailabilityModule, UserSkillsModule y ExchangesModule importan ese mismo módulo; Nest comparte el proveedor. Así las disponibilidades, ofertas publicadas, solicitudes, reservas, cuentas, retenciones, movimientos, transferencias, confirmaciones, cancelaciones e idempotencia participan del mismo almacenamiento.

MemoryAvailabilityRepository y MemoryUserSkillsRepository implementan sus puertos sobre ese almacén. Los constructores sin argumentos de sus pruebas aisladas crean un almacén propio; la aplicación inyecta explícitamente el singleton compartido. Users y los catálogos siguen en sus adaptadores previos y se consultan antes de aceptar operaciones. No hay endpoints de suspensión ni desactivación del catálogo en esta entrega.

ExchangesService implementa los casos de uso de solicitudes y coordina las operaciones de reservas/créditos; los controladores de esos módulos delegan a ese caso de uso compartido. No se crean repositorios financieros independientes que puedan confirmar saldos y reservas por separado.

## Atomicidad y rechazo de errores

MemoryExchangeRepository serializa las transacciones mediante una cola por instancia. Toma el snapshot después de adquirir el turno; ejecuta el caso de uso contra un borrador; clona el resultado y el estado para evitar referencias escapadas; sustituye la referencia del estado confirmado solo cuando todo termina correctamente. Cualquier excepción anterior a ese punto descarta el borrador completo. Un finally libera el turno tras éxito o error.

Las lecturas reciben snapshots del estado confirmado, nunca el borrador de otra transacción. Los servicios no ejecutan una segunda transacción anidada desde un callback: acceden al mismo borrador para evitar bloqueos y lecturas obsoletas.

Antes de confirmar operaciones de negocio, inspectIntegrity comprueba coherencia de cuentas, ledger, reservas, retenciones, transferencias y participantes. La auditoría ADMIN reutiliza ese inspector sobre una lectura sin modificar datos. No se restaura un snapshot antiguo sobre el estado de otra operación ya confirmada.

## Concurrencia de disponibilidad

PATCH pasa únicamente los extremos presentes. El adaptador lee el registro vigente, combina los campos, valida el intervalo y sus solapamientos y escribe dentro de una sola transacción. Dos ediciones compatibles conservan ambos cambios; si juntas producen un intervalo inválido se rechaza la segunda sin borrar el cambio válido.

La edición/desactivación comparte la misma transacción que la aceptación de reservas. Un horario con reservas CONFIRMADA no puede desactivarse ni recortarse de forma que deje alguna fuera de cobertura; se permiten ampliaciones que preservan todas las reservas. Despublicar una habilidad impide nuevas aceptaciones pero no elimina reservas aceptadas.

## Reservas, créditos y reintentos

Al aceptar se comprueban nuevamente ambos estudiantes, la habilidad/categoría activa, la oferta publicada, la disponibilidad vigente, el futuro del intervalo y los conflictos de cualquiera de los participantes en ambos roles. Una reserva y su retención se confirman juntas.

El saldo inicial es cero; las cuentas se crean sin saldo al consultarse o participar en una aceptación. Una carga de desarrollo requiere ADMIN actual, motivo e idempotencia; solo se admite en desarrollo/pruebas. Los importes internos son enteros bigint en centésimas de crédito y los públicos son strings decimales. Una hora equivale provisionalmente a 1.00 crédito; las reservas duran múltiplos de 15 minutos, como máximo 8 horas.

Dos confirmaciones únicas, después del fin, producen una única transferencia con débito, abono, consumo de retención y movimientos. Los participantes pueden cancelar antes del inicio; ADMIN puede resolver una cancelación antes de completarse. La liberación es única y no borra el historial.

Idempotency-Key se guarda en el mismo commit que sus efectos, con ámbito usuario/operación y fingerprint del contenido. Repetir la clave devuelve el resultado original; otro contenido recibe 409. La identidad de la solicitud/reserva protege además contra efectos duplicados con claves diferentes. Si falla la respuesta después del commit, el reintento recupera ese resultado; no se deshace el negocio por un error de transporte.

## Seguridad y límites

Se reutilizan Argon2id, JWT HS256, emisor/audiencia/expiración, estado y roles actuales, JwtAuthGuard, RolesGuard y CurrentUser. La firma JWT ocurre antes de escribir ultimo_acceso para que un fallo de firma no deje un acceso registrado. La escritura conserva su comprobación de usuario activo.

DTO y pipes rechazan campos adicionales, importes del cliente en reservas, IDs de actor arbitrarios y cuerpos no admitidos. Los públicos no exponen bigint, hashes ni contraseñas. CORS incluye DELETE e Idempotency-Key.

La cola cubre solo un proceso. La memoria se pierde al reiniciar, incluidas las claves de idempotencia. No hay garantías entre instancias, durabilidad ni tolerancia a caídas del proceso. NODE_ENV=production sigue bloqueado mientras no haya persistencia real.

## PostgreSQL y compatibilidad

PrismaService conserva su ciclo de vida diferido anterior y no se usa para estas operaciones. prisma/schema.prisma no se modifica ni se inventan modelos SQL. No se ejecutan migraciones ni comandos sobre BD.

Los nombres oficiales conocidos de v0.2 se conservan. Para las tablas posteriores solo existe un inventario de nombres: sus columnas, estados y restricciones del adaptador local son provisionales y requieren mapeo contra la fuente oficial. Ver [compatibilidad de base de datos](database-compatibility.md), [contrato API](api-contract.md) y [reporte v0.3](progress-v0.3.md).
