# Adaptación de la encriptación y las vistas v2 al esquema v0.31+

## Resumen

Los cuatro archivos recibidos eran: `v0.31+.sql`, `encriptacion_bd_v2.sql`, `vistas_bd_v2.sql` y `cambios.txt`.

- **`v0.31+.sql` se usa tal cual.** Es la fuente de verdad: el diseño nuevo de 12 tablas.
- **La encriptación y las vistas se escribieron para el diseño anterior**, que tenía las tablas `cancelaciones`, `roles`, `usuario_roles`, `cuentas_credito` y `transferencias_credito`. Por eso, sobre v0.31+ **no corren**.

Esto es lo que pasa al ejecutar los originales, en el orden de `cambios.txt`, sobre una base v0.31+ con datos:

```
encriptacion_bd_v2.sql:34: ERROR:  relation "cancelaciones" does not exist
encriptacion_bd_v2.sql:35: ERROR:  current transaction is aborted, commands ignored ...
vistas_bd_v2.sql:13:      ERROR:  relation "v_usuarios_desencriptados" does not exist
vistas_bd_v2.sql:19:      ERROR:  current transaction is aborted, commands ignored ...
```

Como la encriptación está dentro de `BEGIN … COMMIT`, el primer error **anula todo el archivo**. El resultado es que no se cifra nada y no se crea ninguna vista.

Se hicieron los cambios mínimos para que funcionen sobre v0.31+, conservando la lógica, los nombres y las columnas de salida de las vistas. Cada cambio está marcado con `[ADAPTADO]` en el SQL. La diferencia completa contra los originales está en `diferencias_vs_original.diff`.

**Resultado:** 12 tablas, 37 vistas y 5 triggers de cifrado, y **59 de 59 pruebas** correctas (`db/tests/pruebas.sql`). Probado con PostgreSQL 16 (imagen oficial de Docker), 17 y 18.

---

## 1. `encriptacion_bd_v2.sql` → `db/init/sql/encriptacion_bd_v2.sql`

| # | Cambio | Por qué |
|---|---|---|
| E1 | `cancelaciones.motivo_enc` → **`reservas.motivo_cancelacion_enc`**, con su backfill | En v0.31+ no existe la tabla `cancelaciones`: el motivo está en `reservas.motivo_cancelacion`. Este era el error que anulaba todo el archivo |
| E2 | `trf_encrypt_cancelacion` / `trg_encrypt_cancelacion` → **`trf_encrypt_reserva` / `trg_encrypt_reserva`** sobre `reservas` | El mismo motivo. Cifra el motivo al cancelar una reserva |
| E3 | **`v_cancelaciones_desencriptadas` sale de `reservas`** (solo las canceladas) | Mantiene las columnas `id_reserva`, `id_usuario` (quien canceló), `motivo`, `horas_anticipacion` y `fecha_cancelacion`. Se pierde `id_cancelacion`, porque esa tabla ya no existe |
| E4 | Los **triggers vuelven a cifrar en UPDATE** si cambió el dato plano (`IS DISTINCT FROM OLD`) | El original solo cifraba si `*_enc` estaba vacío. Al editar un correo o un nombre, la copia cifrada y el `correo_hash` **quedaban con el valor viejo**: la vista mostraba el nombre anterior y el login fallaba con el correo nuevo. Al insertar, se mantiene la lógica original |
| E5 | `buscar_usuario_por_correo`: **`u.password_hash::text`** | La columna es `varchar(255)` y la función declara `text`. `RETURN QUERY` exige el tipo exacto, así que **siempre** fallaba: `Returned type character varying(255) does not match expected type text in column 5` |
| E6 | `v_usuarios_desencriptados` **agrega al final** `rol`, `saldo` y `creditos_retenidos` | En v0.31+ el rol y el saldo están en `usuarios`, y las vistas los necesitan (E8, V2, V6). Se agregan al final para no cambiar el orden de las columnas existentes |
| E7 | En el bloque de reinicio, las vistas `*_desencriptad*` se borran **antes** de las funciones, con `CASCADE` | En el original, al volver a correr el script fallaba: `cannot drop function decrypt_text(bytea) because other objects depend on it`. Ahora se puede repetir |

**Lo que no se cambió:** `pgcrypto`, `pgp_sym_encrypt` / `pgp_sym_decrypt`, `hash_lookup` (SHA-256 del correo normalizado), `get_app_key()` leyendo `app.encryption_key`, la validación de 32 caracteres o más, el índice único `ux_usuarios_correo_hash`, el `SECURITY DEFINER` con `search_path` fijo y el doble guardado (texto plano + cifrado) de la fase 1.

## 2. `vistas_bd_v2.sql` → `db/init/04_vistas_bd_v2.sql`

| # | Vista / función | Cambio | Por qué |
|---|---|---|---|
| V0 | (inicio) | `DROP` de las 4 funciones `fn_*` y de las 32 vistas, con `CASCADE` | `CREATE OR REPLACE VIEW` no puede cambiar columnas, y las vistas dependen unas de otras. Así el archivo se puede volver a correr |
| V1 | `v_usuarios_roles` | Usa `u.rol` | En v0.31+ no existen `roles` ni `usuario_roles` |
| V2 | `v_cuentas_credito_usuario` | Lee `saldo` y `creditos_retenidos` de `usuarios`. Ya no tiene `id_cuenta` | No existe `cuentas_credito`: el saldo está en `usuarios` |
| V3 | `v_movimientos_credito_detalle` | Une por `mc.id_usuario` | `movimientos_credito` se relaciona con el usuario directamente |
| V4 | `v_transferencias_detalle` | **Se arma desde las reservas completadas**: emisor = solicitante, receptor = ofertante, cantidad = créditos, fecha = `completed_at` | No existe `transferencias_credito`. Mantiene el nombre y las columnas para que el backend no cambie. `id_transferencia` es el `id_reserva` |
| V5 | `v_ranking_creditos`, `v_estadisticas_generales` | Saldo desde `usuarios` | Igual que V2 |
| V6 | `v_disponibilidades_*` | `estado IN ('disponible','activo')` | El DDL crea las disponibilidades con `'disponible'`, y la vista buscaba `'activo'`: **siempre salía vacía** |
| V7 | `v_solicitudes_pendientes`, `fn_solicitudes_recibidas`, estadísticas | `estado IN ('pendiente','solicitada')` | El DDL usa `'pendiente'` y la vista buscaba `'solicitada'`: siempre vacía |
| V8 | `v_reservas_activas`, estadísticas | `estado IN ('pendiente','confirmada')` | El DDL crea las reservas como `'pendiente'` |
| V9 | `fn_solicitudes_recibidas`, `fn_solicitudes_enviadas`, `fn_reservas_usuario` | `h.nombre::text` | El mismo problema que E5: la función fallaba al llamarla (`varchar` frente a `text`) |

En V6 a V8 se dejan **los dos valores** (el del DDL y el de la vista) para que funcione sin importar cuál termine usando el backend. Lo ideal es que el equipo decida los valores y los fije con un `CHECK` en el esquema (ver pendientes).

## 3. Archivos nuevos

| Archivo | Qué hace |
|---|---|
| `docker-compose.yml` | PostgreSQL 16 en el puerto 15434. Carga `db/init/` en orden la primera vez, monta `db/tests/` en `/tests` y tiene healthcheck. Exige `POSTGRES_PASSWORD` y `APP_ENCRYPTION_KEY` |
| `db/init/02_seed_demo.sql` | Datos de demo, que **se cargan antes de la encriptación** (como dice `cambios.txt`) para que el backfill tenga qué cifrar: 5 usuarios (uno admin), 4 habilidades, 4 solicitudes y 3 reservas (completada, pendiente y cancelada con motivo), además de movimientos, calificaciones, notificaciones y auditoría. Reemplaza al `seed_data.sql` que menciona `cambios.txt` y que no venía en la carpeta |
| `db/init/03_encriptacion.sh` | Toma `APP_ENCRYPTION_KEY` del `.env`, valida que tenga 32 caracteres o más y la carga **solo en la sesión** (`set_config`) antes de correr `sql/encriptacion_bd_v2.sql`. La clave **no** queda escrita en ningún archivo SQL ni en la base (verificado: `pg_db_role_setting` vacío). El `.sql` está en la subcarpeta `sql/` para que Docker no lo ejecute solo, sin la clave |
| `db/tests/pruebas.sql` | 59 pruebas: datos cifrados e ilegibles, cifrado no determinista, login por correo sin importar mayúsculas, correo duplicado rechazado, re-cifrado al editar, clave corta o equivocada rechazada, las 37 vistas y las 4 funciones. Termina en `ROLLBACK` |
| `.env.example`, `.gitignore`, `.gitattributes` | Plantilla de claves, exclusión del `.env` del repositorio y finales de línea LF (para que los `.sh` funcionen aunque se editen en Windows) |

## 4. Pendientes y advertencias para el equipo

1. **Fase 1 = todavía no hay confidencialidad real.** Las columnas en texto plano (`nombre`, `correo`, `comentario`, `motivo_cancelacion`, `mensaje`, `datos_*`) siguen llenas, junto a las cifradas. Cuando el backend ya use solo las vistas y `buscar_usuario_por_correo`, hay que hacer la **fase 2** (borrar las columnas planas). En ese momento hay que:
   - quitar el bloque de reinicio de `encriptacion_bd_v2.sql`, que borra y recalcula las columnas `*_enc` **desde el texto plano**;
   - cambiar los triggers, que hoy cifran a partir de la columna plana (`NEW.nombre`, `NEW.correo`…);
   - cambiar `buscar_usuario_por_correo`, que devuelve `u.nombre`, `u.apellido` y `u.correo` planos, para que use `decrypt_text(...)`.

   Las 32 vistas de `vistas_bd_v2.sql` **no hay que tocarlas**: ya leen nombres, correos, comentarios, mensajes y auditoría desde las vistas `*_desencriptad*`.
2. **El backend debe cargar la clave en cada conexión** (`SELECT set_config('app.encryption_key', $1, false)`). Si no lo hace, fallan:
   - los `INSERT` en `usuarios` y `notificaciones`;
   - los `INSERT` en `calificaciones` con comentario y en `auditoria` con datos;
   - los `UPDATE` que cambian un nombre o correo, o que cancelan una reserva con motivo.

   Ver la sección 5 del LEEME.
3. **No se puede cambiar la clave sin más.** `correo_hash` usa la clave como "pimienta", así que con otra clave el login por correo deja de encontrar a los usuarios. Rotarla requiere un script que descifre con la vieja y cifre con la nueva.
4. **`v_usuarios_completo` devuelve `password_hash`.** No conviene exponerla en una API ni dársela a un rol de solo lectura.
5. **Valores de `estado`:** el esquema no tiene `CHECK`. Conviene acordar una sola lista (por ejemplo, reservas: `pendiente`, `confirmada`, `completada`, `cancelada`) y fijarla en `v0.31+.sql`.
6. **`seed_data.sql`:** si el equipo lo tiene, se pone en lugar de `02_seed_demo.sql`, con un nombre que empiece por `02_` para que cargue antes de la encriptación. Ojo: `pruebas.sql` usa los datos de la demo (Ana, Luis…), así que con otros datos algunas pruebas pueden fallar.
7. **`v_transferencias_detalle`** ahora es una vista derivada de las reservas completadas. Si más adelante vuelve a existir una tabla de transferencias, hay que cambiarla.
