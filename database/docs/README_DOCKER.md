# SkillSwap / Nexo U — PostgreSQL 16 (V6: créditos decimales reales + hardening solo BD)

## Modelo de créditos acordado con Backend, Frontend, API y BI

Los importes se guardan directamente en PostgreSQL como `NUMERIC(12,2)`. La regla de negocio acepta una sola cifra decimal: `3.0`, `3.5`, `3.7`, `4.2`, `0.5`. Un valor como `3.75` debe rechazarse. No se multiplica ni se divide entre diez y no se usa `INTEGER × 10`. Todos los saldos, retenciones, precios, importes de solicitudes, reservas y movimientos están en créditos reales.

Se utiliza `NUMERIC(12,2)` con restricciones `CHECK` que limitan los valores persistidos a una cifra decimal. La API también debe validar el valor recibido antes de mapearlo a la columna, para evitar redondeos de entrada. Prisma debe representar estos campos como `Decimal @db.Decimal(12,2)`.

### Campos de créditos

- `USUARIOS.saldo`
- `USUARIOS.creditos_retenidos`
- `SOLICITUDES_INTERCAMBIO.creditos_requeridos`
- `RESERVAS.creditos`
- `MOVIMIENTOS_CREDITO.cantidad`, `saldo_anterior`, `saldo_posterior`, `retenidos_anterior`, `retenidos_posterior`
- `OFERTAS_TUTORIA.costo_creditos`
- `PENALIZACIONES_PENDIENTES.monto`
- `config_economia.valor` (incluye también parámetros enteros, que tienen una validación propia)

## Regla de precio de tutoría

El tutor define el precio de la oferta y el estudiante acepta ese importe. Ese precio queda guardado como snapshot en `SOLICITUDES_INTERCAMBIO.creditos_requeridos` y después en `RESERVAS.creditos`. Si el tutor modifica su oferta, no cambia las solicitudes ya aceptadas.

`fn_sugerir_precio_clase()` calcula una sugerencia basada en costo base, escasez, demanda e impacto. Es orientativa: no sustituye el precio elegido por el tutor ni calcula el cargo definitivo. `fn_validar_precio_creditos()` valida importes positivos con una sola cifra decimal.

## Ciclo de retención y pago (HU-10)

1. Al crear una reserva confirmada, la base retiene el precio en `USUARIOS.creditos_retenidos`; el saldo total no baja.
2. La primera confirmación solamente registra su fecha.
3. La segunda confirmación transfiere el importe una sola vez: baja el saldo y la retención del estudiante, y aumenta el saldo del tutor.
4. Si se cancela antes de transferir, se libera la retención. El tutor no recibe créditos por esa reserva.
5. La penalización acordada es `0.5` créditos cuando la cancelación se realiza con menos de cinco horas. Si el saldo libre no alcanza, queda como penalización pendiente según el módulo 10.

La idempotencia se protege con validaciones y un índice único parcial sobre los movimientos de cada etapa.

## Módulos de inicialización

`initdb/00_init.sh` ejecuta `initdb/sql/00_bootstrap.sql` en una única transacción. El orden incluye esquema, cifrado, auditoría, economía, vistas BI, penalizaciones, ofertas, ciclo de pago y permisos generales.

Las cuentas de equipos preparadas para la fase final permanecen separadas de la inicialización automática, según el acuerdo previo del equipo.

## Inicio de PostgreSQL

Configure `.env` tomando `.env.example` como base y use secretos distintos para la clave de cifrado y el pepper. Después ejecute:

```bash
docker compose up -d db
docker compose logs -f db
```

El seed de demostración se carga de forma separada:

```bash
docker compose exec -T db psql -U skillswap_admin -d skillswap < 03_datos_demo_skillswap.sql
```

## Pruebas

El seed y los archivos HU-04/HU-06/HU-10 usan créditos reales (ej.: 3.7), nunca 37. El seed de demostración es para una base de pruebas limpia; si se vuelve a cargar, primero debe restablecerse esa base para evitar duplicados.


Ejecute como administrador en la base de pruebas:

```bash
docker compose exec -T db psql -U skillswap_admin -d skillswap < tests/12_pruebas_economia_match.sql
docker compose exec -T db psql -U skillswap_admin -d skillswap < tests/13_pruebas_bi_hu07.sql
docker compose exec -T db psql -U skillswap_admin -d skillswap < tests/14_pruebas_penalizaciones_pendientes.sql
docker compose exec -T db psql -U skillswap_admin -d skillswap < tests/17_pruebas_ofertas_hu04.sql
docker compose exec -T db psql -U skillswap_admin -d skillswap < tests/18_pruebas_pago_clases_hu10.sql
docker compose exec -T db psql -U skillswap_admin -d skillswap < tests/19_pruebas_hardening.sql
```

HU-06 requiere pasar `APP_ENCRYPTION_KEY` como variable `enc_key`:

```bash
docker compose exec -T db sh -lc 'psql --no-psqlrc -v ON_ERROR_STOP=1 -v enc_key="$APP_ENCRYPTION_KEY" -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < tests/16_pruebas_auditoria_hu06.sql
```

Todas las pruebas usan transacciones que terminan con `ROLLBACK`, salvo el seed de demostración.

## Prisma 7

En `schema.prisma`, cambia los campos de créditos de `Int` a `Decimal @db.Decimal(12,2)`. Ejemplo:

```prisma
saldo              Decimal @default(0) @db.Decimal(12, 2)
creditos_retenidos Decimal @default(0) @db.Decimal(12, 2)
creditos_requeridos Decimal @db.Decimal(12, 2)
creditos            Decimal @db.Decimal(12, 2)
cantidad            Decimal @db.Decimal(12, 2)
saldo_anterior      Decimal @db.Decimal(12, 2)
saldo_posterior     Decimal @db.Decimal(12, 2)
retenidos_anterior  Decimal @db.Decimal(12, 2)
retenidos_posterior Decimal @db.Decimal(12, 2)
```

El modelo de ofertas nuevo debe declarar `costo_creditos Decimal @db.Decimal(12,2)`. Las validaciones de una sola cifra decimal deben mantenerse en API y PostgreSQL.

## Hardening de la base (V6, solo BD, sin coordinar con backend)

`initdb/sql/13_hardening_search_path.sql` se ejecuta al final del bootstrap (después de los roles). Solo hace lo siguiente:

- Fija `search_path = pg_catalog, public, pg_temp` en las 23 funciones `SECURITY DEFINER` del paquete (antes terminaban en `public`, sin `pg_temp`).
- Antes de modificar nada comprueba la versión (PostgreSQL 16), el superusuario, que existan las funciones esperadas y que ningún rol de aplicación tenga `CREATE` en `public` ni acceso a las claves o al ETL. Si algo no cuadra, aborta la inicialización.

**No cambia**: tablas, datos, vistas, créditos, triggers, penalizaciones, ni ningún `GRANT`/`REVOKE` de `rol_app` o `rol_lectura`. No crea funciones que el backend deba adoptar.

**No resuelve** inyección SQL en el backend: se deben usar siempre parámetros del driver (`$1`, `$2`…). Tampoco restringe el DML amplio de `rol_app`, sus vistas descifradas, ni evita que SQL arbitrario lea `app.encryption_key`/`app.hash_pepper` desde una sesión que las tenga configuradas. Eso requiere una segunda fase coordinada con el backend.

Para una base **ya inicializada** (sin recrear el volumen) aplicar una sola vez, como administrador:

```bash
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U skillswap_admin -d skillswap < migrations/01_hardening_search_path_solo_bd.sql
```

Es idempotente y transaccional. Si en el futuro se agrega otra función `SECURITY DEFINER`, el script emite un `WARNING` con su nombre para que se añada a la lista.

`tests/19_pruebas_hardening.sql` verifica el `search_path` de todas las funciones, que `rol_app` no pueda crear objetos en `public`, que no acceda a las claves ni al ETL, la política de precio (solo `fn_sugerir_precio_clase`) y que los permisos funcionales existentes se conserven.

## Importante al actualizar un volumen local

Los scripts dentro de `docker-entrypoint-initdb.d` solo se ejecutan cuando PostgreSQL inicializa un directorio de datos vacío. Como este proyecto está en entorno de pruebas sin datos reales, para aplicar el esquema limpio se puede recrear el volumen local. **Esto elimina los datos locales de ese volumen**:

```bash
docker compose down -v
docker compose up -d db
```

No ejecute ningún archivo antiguo que multiplique saldos por diez. La base nueva guarda créditos reales directamente. No aplicar esta instrucción a un entorno compartido o a Neon sin coordinación y respaldo.
