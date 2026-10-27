# Módulo de disponibilidad v0.3

Implementado: creación, consulta propia/publicada, edición parcial y desactivación lógica. Propietario del JWT, fechas ISO con zona, fin posterior al inicio y exclusión de solapamientos activos [inicio, fin) por usuario.

En v0.3, MemoryAvailabilityRepository utiliza el mismo EXCHANGE_REPOSITORY transaccional que reservas, ofertas y créditos. PATCH combina con el registro vigente y no pierde cambios simultáneos. Editar/desactivar no puede quitar cobertura a reservas CONFIRMADA; ampliar manteniendo cobertura está permitido.

La exclusión por proceso y el rollback están verificados en memoria. Persistencia duradera y exclusión entre instancias quedan pendientes de PostgreSQL. Ver [contrato API](../../../docs/api-contract.md) y [reporte v0.3](../../../docs/progress-v0.3.md).
