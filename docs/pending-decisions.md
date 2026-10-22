# Pendientes y dependencias — v0.3 local

## Equipo de BD

La aplicación funciona en memoria. No se recibió el SQL/DBML completo ni se consultó una base compartida; no se aplicaron migraciones ni se generó un cliente de las tablas oficiales.

Se conservan los campos oficiales conocidos de v0.2 y el inventario de tablas posteriores. Los contratos de solicitudes, reservas, cuentas y movimientos son un adaptador provisional de aplicación, no una copia certificada del esquema PostgreSQL. Ver [database-compatibility.md](database-compatibility.md).

Se necesita confirmar nombres, tipos, nulabilidad, claves, índices, estados, catálogos, precisión de créditos, versiones y restricciones. Luego implementar los puertos sobre el cliente oficial, con transacciones e idempotencia duradera, y verificar concurrencia con conexiones/procesos independientes.

## PO y reglas provisionales

Por autorización del usuario se implementaron reglas locales coherentes: saldo inicial cero, 1 hora=1.00 crédito, reservas en múltiplos de 15 minutos hasta 8 horas, retención al aceptar, liquidación con dos confirmaciones después del fin y cancelación según rol/momento. Cargas de prueba exclusivamente ADMIN en desarrollo/test.

Estas reglas permiten demostrar el flujo, pero requieren validación con PO/BD antes de producción. No se aprueban por inferencia los valores oficiales de estados ni se migran nuevas columnas.

## APIs y Frontend

El contrato actual está publicado en Swagger y docs/api-contract.md. Los nuevos POST de solicitudes/reservas/créditos requieren Idempotency-Key; el cliente debe conservar esa clave al repetir la misma operación. Un replay recupera el resultado original y GET permite consultar el estado actual.

No se desarrolla Frontend ni API Gateway. Confirmar orígenes CORS y contratos definitivos con esos equipos.

## Operación y funciones posteriores

Memoria no sobrevive reinicios ni coordina procesos. NODE_ENV=production permanece bloqueado. La auditoría de esta instancia no certifica datos de una BD externa. Docker no se ejecutó durante esta actualización.

Continúan pendientes integración real de PostgreSQL, recuperación/verificación de correo, refresh tokens, logout remoto, gestión persistente de ADMIN, notificaciones, calificaciones y auditoría histórica duradera. No se deben introducir servicios externos o migraciones sin el entorno y autorización correspondientes.
