# SkillSwap – PostgreSQL listo para Docker (base corregida)

## Qué incluye

- PostgreSQL 16 (imagen oficial Alpine).
- Esquema y catálogo de carreras originales de SkillSwap.
- Funciones criptográficas basadas en `pgcrypto` (AES-256 PGP).
- Pepper de búsqueda separado de la clave de cifrado.
- Backfill cifrado de datos existentes y triggers BEFORE INSERT/UPDATE.
- Vistas desencriptadas y búsqueda de usuario por hash de correo.
- Auditoría automática, incluida la PK compuesta de `USUARIO_HABILIDADES`.
- Roles `rol_app` y `rol_lectura` con privilegios diferenciados.
- Inicialización en una sola transacción SQL.


## Modulos nuevos del parcial 3 (adaptados a la primera base)

Se agregan dos scripts al esquema original, sin cambiar los tipos de creditos de `01_base_a_schema.sql`:

- `07_economia_dinamica.sql`: crea `config_economia`, la funcion `fn_calcular_costo_clase` y los triggers de cancelacion/penalizacion.
- `08_impacto_match_brechas.sql`: crea `v_knowledge_score`, `fn_obtener_top_tutores`, `v_knowledge_gap_index` y `v_command_center_resumen`.
- `09_vistas_bi_hu07.sql`: completa HU-07 con horarios pico en `America/La_Paz`, materias con oferta cero y Knowledge Score con promedio `NULL` cuando no hay calificaciones.
- `tests/13_pruebas_bi_hu07.sql`: validaciones de aceptación para las vistas BI y sus permisos.
- `tests/12_pruebas_economia_match.sql`: pruebas transaccionales con datos ficticios; al final hace `ROLLBACK` y no conserva las filas de prueba.

### Escala de creditos (IMPORTANTE PARA BACKEND Y FRONTEND)

Los campos de creditos del esquema original se conservan como `INTEGER`, pero **no representan creditos enteros directamente**: almacenan decimas de credito para admitir importes como 1.5 sin cambiar los tipos de datos ni romper los contratos con los otros equipos.

La regla es:

- `10` en PostgreSQL = `1.0` credito en la aplicacion.
- `15` en PostgreSQL = `1.5` creditos en la aplicacion.
- `13` en PostgreSQL = `1.3` creditos en la aplicacion.
- `12` en PostgreSQL = `1.2` creditos en la aplicacion.
- `5` en PostgreSQL = `0.5` creditos en la aplicacion.

Se aplica a todos estos campos: `USUARIOS.saldo`, `USUARIOS.creditos_retenidos`, `SOLICITUDES_INTERCAMBIO.creditos_requeridos`, `RESERVAS.creditos` y `MOVIMIENTOS_CREDITO.cantidad`, `saldo_anterior`, `saldo_posterior`, `retenidos_anterior`, `retenidos_posterior`.

**No redondear el costo final a un credito entero.** `fn_calcular_costo_clase` devuelve un `INTEGER` ya escalado en decimas. La app divide entre 10 exclusivamente para mostrar. Para guardar o realizar operaciones de negocio, debe conservar el entero escalado.

Ejemplo de la diapositiva:

| Concepto | Visible en la app | Entero guardado |
|---|---:|---:|
| Clase estandar | +1.0 | +10 |
| Materia con pocos tutores | +1.5 | +15 |
| Horario de alta demanda | +1.3 | +13 |
| Tutor con alto impacto | +1.2 | +12 |
| Cancelacion injustificada | -0.5 | -5 |

Cuando se aplican todos los bonos a una clase: `10 + 15 + 13 + 12 = 50` unidades internas; la app muestra `50 / 10 = 5.0` creditos. La penalizacion de `-0.5` se registra como movimiento `cantidad = -5`.

La penalizacion se activa cuando la cancelacion ocurre a **menos de 5 horas** del inicio. Con 5 horas exactas o mas no se aplica. La regla se compara usando la marca temporal exacta de cancelacion; `horas_anticipacion_cancelacion` conserva el numero de horas completas como dato informativo. Por defecto, se descuenta `5` unidades internas (`0.5` creditos). Si el saldo libre no alcanza para cubrir las 5 decimas completas, no se realiza un descuento parcial: se registra `penalizacion_sin_saldo` con cantidad `0`.

#### Conversion en la aplicacion

JavaScript / TypeScript:

```ts
// PostgreSQL/API -> mostrar en pantalla
const creditosVisibles = (creditosDecimas / 10).toFixed(1);

// Valor ingresado/confirmado en pantalla -> enviar a backend/guardar
const creditosDecimas = Math.round(Number(creditosVisibles) * 10);
```

No hagas la division antes de guardar una reserva, actualizar un saldo o insertar un movimiento. Por ejemplo, para guardar una reserva de `2.5` creditos, `RESERVAS.creditos` debe recibir `25`, no `2.5` ni `3`.

Para facilitar el consumo de datos, se incluyen las vistas `v_cuentas_credito_app` y `v_movimientos_credito_app`: exponen tanto los enteros internos (`*_decimas`) como los importes listos para mostrar (`*_creditos`). En `v_command_center_resumen`, `creditos_en_cuentas_decimas` contiene el total interno y `creditos_en_cuentas` el total dividido entre 10.

Los parametros de `config_economia` guardan importes tambien en decimas (`costo_base=10`, `mult_escasez=15`, `mult_demanda=13`, `mult_impacto=12`, `penalizacion_creditos=5`). Los umbrales no monetarios (`umbral_tutores_escasez`, `horas_minimas_cancelacion`) se guardan en unidades naturales.

```sql
SELECT clave, valor, descripcion
FROM public.config_economia
ORDER BY clave;

-- Ejemplo: cambiar la penalizacion a 0.7 creditos (7 decimas internas)
UPDATE public.config_economia
SET valor = 7, actualizado_at = now()
WHERE clave = 'penalizacion_creditos';
```

### Ejecutar las pruebas

Con PostgreSQL ya iniciado y desde la carpeta del proyecto, ejecuta el archivo como administrador de la base. En Windows PowerShell:

```powershell
Get-Content .\tests\12_pruebas_economia_match.sql -Raw | docker compose exec -T db psql -U skillswap_admin -d skillswap
```

En Linux/macOS:

```bash
docker compose exec -T db psql -U skillswap_admin -d skillswap < tests/12_pruebas_economia_match.sql
```

Las pruebas verifican que 1.0 + 1.5 se guarda como 25 (y se muestra como 2.5), que la suma de todos los bonos llega a 50 (se muestra como 5.0), que las vistas convierten los importes entre decimas y creditos, el matching, Knowledge Gap, Knowledge Score y la penalizacion de -5 unidades (se muestra como -0.5) solo al cancelar con menos de 5 horas. Todas las filas temporales se revierten.

> Importante: la prueba usa `skillswap_admin` y `skillswap` como valores predeterminados del `.env.example`. Si cambiaste esos nombres, adapta el comando. El SQL de pruebas debe ejecutarse después de una inicialización exitosa.

### HU-07: contrato de vistas para BI

Las vistas nuevas son:

- `v_bi_reservas_por_hora`: devuelve las 24 horas del dia y cuenta las reservas por hora de inicio convertida explicitamente a `America/La_Paz`. Incluye el total y el desglose por estado.
- `v_bi_reservas_dia_hora`: complemento para un mapa de calor de 7 dias por 24 horas.
- `v_bi_materias_oferta_demanda`: devuelve cada materia/habilidad activa del catalogo, incluso cuando no tiene tutores.
- `v_bi_materias_sin_tutores`: devuelve directamente las materias activas con `oferta_tutores = 0`.
- `v_bi_knowledge_score`: version para BI sin nombre, apellido ni correo; un tutor con `total_calificaciones = 0` tiene `promedio_estrellas = NULL`.

**Alcance del catalogo:** el esquema acordado no contiene una tabla independiente llamada `PENSUM` o `MATERIAS`; por eso estas vistas toman el catalogo desde `HABILIDADES`, que es la entidad relacionada con `USUARIO_HABILIDADES`, `SOLICITUDES_INTERCAMBIO` y `RESERVAS`. Para que aparezcan todas las materias del pensum, incluso las que ningun tutor ofrece, el catalogo `HABILIDADES` debe cargarse con todas esas materias activas, no solamente con las que ya tienen tutores. El esquema original no tiene una tabla independiente `PENSUM`; si el contrato de datos exige una tabla separada, ese cambio debe acordarse primero con Backend y Frontend.

Permisos: `rol_lectura` recibe `SELECT` sobre las vistas BI agregadas. `v_bi_knowledge_score` expone el UUID del tutor para relacionar metricas, pero no nombre, apellido ni correo.

Pruebas HU-07:

```bash
docker compose exec -T db psql -U skillswap_admin -d skillswap < tests/13_pruebas_bi_hu07.sql
```

La prueba valida que existan las cinco vistas, que la vista horaria devuelva 24 filas, que la vista de mapa de calor devuelva 168 combinaciones, que las materias sin tutor tengan oferta cero, que el promedio de quien no tiene calificaciones sea `NULL` y que `rol_lectura` tenga permiso de consulta. Para demostrar visualmente los dos casos alternativos, deben existir en los datos de prueba al menos una materia sin tutor y un tutor sin calificaciones.

## Preparación

1. Copia `.env.example` a `.env`.
2. Cambia todas las contraseñas de ejemplo.
3. Genera dos secretos diferentes, por ejemplo con `openssl rand -hex 32`:
   - uno para `APP_ENCRYPTION_KEY`;
   - otro para `APP_HASH_PEPPER`.
4. No subas `.env` a Git ni compartas esos secretos.

Ejemplo de generación (ejecutar dos veces, guardar cada salida en su variable correspondiente):

```bash
openssl rand -hex 32
```

## Iniciar PostgreSQL

Desde esta carpeta:

```bash
docker compose up -d db
docker compose logs -f db
```

Cuando el log indique que SkillSwap fue inicializado, PostgreSQL estará listo.

Comprobar estado:

```bash
docker compose ps
```

Conectarse como administrador (ajusta usuario y base si cambiaste los valores predeterminados del `.env`):

```bash
docker compose exec db psql -U skillswap_admin -d skillswap
```

Conectarse desde otra herramienta o el backend con `rol_app` o `rol_lectura`, usando las contraseñas guardadas en `.env`.

## Scripts anteriores reemplazados por el orquestador

En este paquete, `initdb/00_init.sh` ejecuta todos los SQL en el orden correcto y dentro de una sola transacción. Por eso no ejecutes además el `05_seguridad_roles.sh` antiguo: su plantilla ya se ejecuta desde `00_bootstrap.sql`.

Tampoco ejecutes el `99_encriptacion.sh` antiguo. Ese script guardaba `app.encryption_key` en la configuración de roles con `ALTER ROLE`; esta versión no persiste secretos en PostgreSQL y exige que el backend los establezca por conexión, como se explica abajo.

## Configuración obligatoria del backend

Las claves criptográficas NO se guardan con `ALTER ROLE` ni en tablas. El backend debe configurar ambas variables en **cada conexión nueva del pool** antes de usar funciones o vistas cifradas:

```sql
SELECT set_config('app.encryption_key', '<APP_ENCRYPTION_KEY>', false);
SELECT set_config('app.hash_pepper', '<APP_HASH_PEPPER>', false);
```

Sustituye los marcadores por los secretos de entorno del backend; usa parámetros del driver, no concatenes entradas de usuario en SQL. Si el pool recicla una conexión, vuelve a establecerlas al inicializar esa conexión.

Para atribuir las acciones a un usuario, establece el UUID dentro de cada transacción de negocio:

```sql
SELECT set_config('app.usuario_actual', '<UUID_DEL_USUARIO>', true);
```

El tercer argumento `true` limita el valor a la transacción actual. Si no se establece, la auditoría registra `id_usuario = NULL`.

## Importante sobre la protección de datos

El esquema original conserva `USUARIOS.nombre`, `USUARIOS.apellido`, `USUARIOS.correo` y algunos otros campos en texto plano por compatibilidad con las consultas y el modelo de aplicación actuales. Los triggers mantienen también columnas cifradas `*_enc`, y el login utiliza `correo_hash`, pero **esto no equivale a cifrado completo en reposo de esos campos** mientras los originales continúen en claro.

La tabla `AUDITORIA` sí guarda `datos_anteriores` y `datos_nuevos` en columnas cifradas y deja los JSON originales en `NULL`. Para completar el cifrado en reposo de los demás campos hay que adaptar el backend para leer/escribir exclusivamente mediante vistas/funciones y después retirar o hacer nulas las columnas heredadas; no conviene hacerlo sin revisar el código de la aplicación.

El rol `rol_lectura` sólo recibe catálogos y una lista blanca de vistas agregadas. No recibe acceso a vistas con nombres, correos, identificadores de usuarios, mensajes individuales ni datos de auditoría individuales.

## Inicialización y datos existentes

Los scripts de `docker-entrypoint-initdb.d` se ejecutan sólo cuando el volumen de PostgreSQL está vacío. Este paquete está preparado para **crear una base nueva**. No lo uses como migración directa sobre una base que ya contiene datos.

Para reiniciar desde cero en desarrollo:

```bash
docker compose down -v
docker compose up -d db
```

`docker compose down -v` elimina permanentemente el volumen y todos sus datos. Haz un backup antes. En producción, usa migraciones específicas y un gestor de secretos.

## Si ya tienes una base anterior con datos

El paquete Docker inicializa un volumen vacio. Si ya tienes una base poblada y sus `INTEGER` de credito guardan creditos completos (por ejemplo, `5` significa `5.0`), **no borres el volumen**. Haz primero un backup y revisa que los importes todavia no esten en decimas.

En ese caso, usa manualmente `migrations/01_convertir_creditos_a_decimas.sql` una sola vez. El script multiplica por 10 saldos, creditos requeridos, creditos de reservas y movimientos, y deja una marca para impedir que se repita. Si ya guardabas `15` para representar `1.5`, NO ejecutes esa migracion porque multiplicaria los saldos otra vez.

Despues de la migracion, aplica los modulos `07_economia_dinamica.sql`, `08_impacto_match_brechas.sql` y `09_vistas_bi_hu07.sql` con el usuario administrador. Si `rol_lectura` ya existe, el modulo 09 concede sus permisos BI; si no existe, los concede despues `05_seguridad_roles.sql.tpl` al inicializar desde cero. El modulo 09 tambien requiere otorgar a `rol_lectura` los permisos de consulta sobre las vistas BI nuevas:

```sql
GRANT SELECT ON public.config_economia,
  public.v_cuentas_credito_app,
  public.v_movimientos_credito_app TO rol_app;
GRANT EXECUTE ON FUNCTION public.fn_calcular_costo_clase(uuid, uuid, timestamptz),
  public.fn_obtener_top_tutores(uuid, timestamptz, timestamptz, text) TO rol_app;
GRANT SELECT ON public.v_knowledge_gap_index,
  public.v_command_center_resumen,
  public.v_bi_reservas_por_hora,
  public.v_bi_reservas_dia_hora,
  public.v_bi_materias_oferta_demanda,
  public.v_bi_materias_sin_tutores,
  public.v_bi_knowledge_score TO rol_lectura;
```

Esta ruta es para bases preexistentes. En una instalacion nueva con Docker, no ejecutes la migracion manual: el bootstrap crea directamente la escala de decimas.

## Pruebas recomendadas después del arranque

```sql
-- Debe devolver ambos roles:
SELECT rolname FROM pg_roles WHERE rolname IN ('rol_app', 'rol_lectura');

-- Debe existir el índice de búsqueda:
SELECT indexname FROM pg_indexes WHERE indexname = 'ux_usuarios_correo_hash';

-- Los triggers sensibles deben existir:
SELECT tgname FROM pg_trigger
WHERE NOT tgisinternal AND tgname LIKE 'trg_encrypt_%';

-- La tabla de auditoría no debe conservar JSON en claro:
SELECT count(*) FROM public."AUDITORIA"
WHERE datos_anteriores IS NOT NULL OR datos_nuevos IS NOT NULL;
```

El último resultado debe ser `0`.
