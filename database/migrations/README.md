# Migraciones manuales V6

Este paquete inicializa una base de pruebas limpia con créditos decimales reales (`NUMERIC(12,2)`). No ejecute scripts de conversión `INTEGER × 10` (existen en la V5, no aquí).

- `01_hardening_search_path_solo_bd.sql`: aplicar una sola vez a una base **ya inicializada** con V4/V6 (en una base nueva el mismo cambio ya está en `initdb/sql/13_hardening_search_path.sql`). Solo ajusta `search_path` de funciones `SECURITY DEFINER`; no toca permisos ni datos. Idempotente.

Para un volumen Docker de pruebas sin datos que deban conservarse, recree el volumen siguiendo el README principal. Para una base con datos, haga backup y pruebe primero en una copia.
