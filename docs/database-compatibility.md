# Compatibilidad de base de datos y reglas provisionales

Fecha: 22 de octubre de 2026. Esta entrega mantiene persistencia exclusivamente en memoria. **No se dispone del SQL/DBML completo de reservas y créditos; no se afirma compatibilidad verificada con columnas que no fueron entregadas.**

## Fuente recibida y conservada

Se conservan exactamente los nombres conocidos de CATEGORIAS (id_categoria, nombre, estado), HABILIDADES (id_habilidad, nombre, id_categoria, estado), USUARIO_HABILIDADES (id_usuario, id_habilidad, nivel), DISPONIBILIDADES (id_disponibilidad, id_usuario, fecha_inicio, fecha_fin, estado) y USUARIOS (id_usuario, nombre, apellido, correo, password_hash, id_carrera, semestre, fecha_registro, ultimo_acceso, estado).

El usuario público conserva su contrato previo id/idCarrera/roles; MemoryUsersRepository es el adaptador a los nombres anteriores. categoryId, skillId, providerId, availabilityId, fechaInicio y fechaFin son DTO de aplicación, no nombres de columnas impuestos a PostgreSQL.

## Tablas conocidas solo por nombre

El inventario incluye SOLICITUDES_INTERCAMBIO, RESERVAS, CONFIRMACIONES, CANCELACIONES, CUENTAS_CREDITO, MOVIMIENTOS_CREDITO y TRANSFERENCIAS_CREDITO. No se recibió una fuente con sus columnas, PK/FK, nulabilidad, restricciones, estados, índices o precisión decimal.

exchange.types.ts define el modelo del adaptador local para esas entidades. IDs como id_solicitud, id_reserva o id_cuenta, los estados y las relaciones internas son una propuesta de aplicación, no una declaración del esquema oficial. No se añaden modelos Prisma, SQL ni migraciones basados en esa propuesta.

Los importes internos saldo_centavos, retenidos_centavos y monto_centavos representan centésimas exactas de crédito mediante bigint. No son una moneda ni columnas oficiales supuestas. En HTTP se adaptan a saldo, creditos_retenidos, disponibles, monto y monto_creditos como strings decimales. Un adaptador PostgreSQL deberá mapearlos a los tipos/columnas definitivos sin perder precisión.

## Reglas locales adoptadas por autorización del usuario

- Saldo inicial cero, sin créditos de bienvenida ni cuentas con contraseñas fijas.
- Cargas manuales únicamente por ADMIN en desarrollo/pruebas, con motivo y clave de idempotencia.
- Una hora de ayuda equivale a 1.00 crédito; 15 minutos a 0.25; duración de reserva en múltiplos de 15 minutos, hasta 8 horas.
- La solicitud no retiene; la aceptación reserva horario y retiene créditos.
- Ambas personas quedan ocupadas en cualquier rol durante [inicio, fin).
- Dos confirmaciones, después del fin, liquidan una vez. Un participante no puede confirmar por el otro.
- Cancelación por participantes antes del inicio; posteriormente requiere ADMIN mientras no esté completada. No se permite cancelar una liquidación completada.
- Despublicar una habilidad no cancela reservas existentes. La disponibilidad no se puede modificar de manera que deje sin cobertura una reserva activa.

Estas decisiones permiten probar un flujo coherente sin inventar una base definitiva. Deben contrastarse con PO/BD antes de persistencia real y producción.

## Trabajo que requiere la fuente oficial

Confirmar nombres y tipos, mapear entidades/estados, definir restricciones de unicidad/exclusión por participante, transacciones e aislamiento real, idempotencia duradera y precisión de créditos. Verificar con conexiones y procesos independientes que no se repiten reservas ni transferencias después de reinicios o respuestas perdidas.

No se cambia la base del otro equipo ni se certifica compatibilidad de PostgreSQL mediante pruebas de memoria.
