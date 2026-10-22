# Entrega v0.4 — Modelo optimizado de 12 tablas

Fecha: 22 de octubre de 2026, America/La_Paz.

Se adopta la documentación optimizada por elección explícita del usuario. SQL/JSON de18 tablas son legado; no se ejecutan ni se alteran. La fuente Markdown elegida se incluye en esta entrega; la carpeta local de scripts legados no se publica con el backend.

## Cambios

- Prisma completo de12 tablas, cliente generado localmente y prueba de contrato que compara columnas/tipos con el modelo entregado.
- Un solo rol y saldos dentro de USUARIOS; confirmación/cancelación integradas en RESERVAS; movimientos por usuario con snapshots. Se retiran las estructuras persistentes de cuentas, roles M:N, confirmaciones/cancelaciones/transferencias separadas.
- Créditos INTEGER, máximo2147483647; unidad local1 crédito por15 minutos. Se reemplaza la antigua política decimal de v0.3. Las respuestas de saldo conservan formato string de enteros; la reserva expone creditos como número.
- Profesor, Experto, estados del documento, carrera UUID activa y semestre validado. Se añade catálogo GET /careers.
- Repositorios reales Prisma para catálogos y unidad transaccional, seleccionables por configuración; modo memoria preservado.
- Concurrencia, idempotencia, rollback y permisos conservados. Confirmaciones usan el mismo reloj que las reglas temporales y las pruebas controladas.
- Idempotencia y contexto de API se almacenan en AUDITORIA, sin columnas/tabla ajenas al modelo. El ledger es inmutable desde el adaptador.
- Pruebas anteriores se adaptan al nuevo modelo y unidad, conservando los escenarios de fallos y concurrencia. La auditoría se adapta a snapshots y confirmaciones inline.

## Límites verificados

Build, lint, pruebas unitarias/HTTP, formato y Prisma validate/generate se verifican localmente antes de publicar. No se conectó ni modificó PostgreSQL; el adaptador requiere validar el despliegue real de las12 tablas en un entorno autorizado. Los índices Prisma son declarativos, no migraciones aplicadas. No se ejecutan automáticamente scripts heredados con claves de ejemplo o rutinas de concurrencia incompatibles.

La memoria solo coordina un proceso y se pierde al reiniciar. El adaptador PostgreSQL coordina instancias cooperantes mediante un bloqueo asesor compartido; no certifica escritores externos que ignoren ese protocolo. Notificaciones y calificaciones tienen modelos declarados, pero no nuevos endpoints de negocio.

Ver README y Swagger para ejecutar, probar y consultar los cuerpos actuales. Documentos v0.2/v0.3 se conservan como históricos.

Resultados finales: 16 suites unitarias (154 pruebas) y 5 suites HTTP (131 pruebas), todas aprobadas. Total285. Build, ESLint, Prettier y Prisma validate correctos. PostgreSQL real no fue probado ni modificado.
