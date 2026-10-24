# Banco de Tiempo Universitario · BD v0.31+ con encriptación y vistas v2 (Docker)

Esta carpeta levanta en Docker el **nuevo diseño v0.31+** con la **encriptación** (`encriptacion_bd_v2.sql`) y las **vistas** (`vistas_bd_v2.sql`), en el orden que indica `cambios.txt`.

- El esquema `v0.31+.sql` va **sin ningún cambio**: es idéntico byte por byte al original (MD5 `ad589ae894367bef2c2e3e3e05f95682`).
- La encriptación y las vistas se **adaptaron** porque, tal como venían, no corrían sobre v0.31+. Hacían referencia a tablas de la v0.31 vieja (`cancelaciones`, `roles`, `cuentas_credito`, `transferencias_credito`) y tenían errores de tipos.
- Todos los cambios están marcados con `[ADAPTADO]` dentro de los SQL y explicados en [`docs/ADAPTACION.md`](docs/ADAPTACION.md). Además, en [`docs/diferencias_vs_original.diff`](docs/diferencias_vs_original.diff) está la diferencia línea por línea con los originales.

```
BancoTiempo_BD_v0.31plus/
├─ LEEME.md                         ← este archivo
├─ docker-compose.yml               ← PostgreSQL 16 + carga automática
├─ .env.example                     ← copiar como .env (claves tuyas)
├─ .gitignore / .gitattributes      ← el .env nunca se sube a GitHub
├─ db/
│  ├─ init/                         ← se ejecuta solo, en orden, la 1.ª vez
│  │  ├─ 01_schema_v0.31+.sql       ← esquema ORIGINAL, sin modificar
│  │  ├─ 02_seed_demo.sql           ← datos de demo (5 usuarios, 3 reservas…)
│  │  ├─ 03_encriptacion.sh         ← pasa la clave del .env y corre ↓
│  │  ├─ sql/encriptacion_bd_v2.sql ← encriptación (adaptada)
│  │  └─ 04_vistas_bd_v2.sql        ← 32 vistas + 4 funciones (adaptadas)
│  └─ tests/pruebas.sql             ← 59 pruebas automáticas
└─ docs/
   ├─ ADAPTACION.md                 ← qué se cambió y por qué
   ├─ diferencias_vs_original.diff  ← diff contra los originales
   └─ cambios.txt                   ← notas originales del equipo
```

| Dato | Valor |
|---|---|
| Motor | PostgreSQL 16 (imagen `postgres:16-alpine`) |
| Base de datos | `banco_tiempo` |
| Usuario | `banco_owner` |
| Puerto en tu computadora | **15434** |
| Contenido | 12 tablas · 37 vistas (32 + 5 desencriptadas) · 5 triggers de cifrado |

---

## 1. Requisitos (una sola vez)

1. Instala **Docker Desktop**: https://www.docker.com/products/docker-desktop/
   - **Mac**: elige *Apple Silicon* (M1/M2/M3/M4) o *Intel* según tu Mac ( → Acerca de esta Mac).
   - **Windows**: opciones por defecto. Si pide WSL, ejecuta `wsl --install` en PowerShell como administrador y reinicia.
2. Abre Docker Desktop y espera a que diga **"Engine running"**. Tiene que estar abierto cada vez que uses la base.

## 2. Levantar la base

### Mac (Terminal)

Abre **Terminal** y entra a la carpeta. Puedes escribir `cd ` (con espacio) y arrastrar la carpeta a la ventana.

```bash
cd ~/Desktop/basede_datos/BancoTiempo_BD_v0.31plus
cp .env.example .env
openssl rand -base64 36        # genera una clave de cifrado: cópiala
open -e .env                   # abre el .env en TextEdit
```

### Windows (PowerShell)

```powershell
Copy-Item .env.example .env
[Convert]::ToBase64String((1..36 | % {Get-Random -Max 256}))   # clave de cifrado
notepad .env
```

### En el `.env` cambia dos líneas y guarda

```
POSTGRES_PASSWORD=una_clave_tuya
APP_ENCRYPTION_KEY=la_clave_que_generaste_de_32_o_mas_caracteres
```

> ⚠️ **La clave de cifrado es crítica.** Si se pierde, los datos cifrados no se recuperan. Si varias personas usan **la misma** base (por ejemplo, un servidor compartido), todos deben tener la misma clave. Para tu base local, cada uno puede usar la suya. **Nunca** la escribas en un `.sql` ni la subas a GitHub.

Luego levanta la base:

```bash
docker compose up -d
docker compose ps
```

Cuando `STATUS` diga **`(healthy)`**, está lista. La primera vez tarda 1–2 minutos porque descarga la imagen.

## 3. Comprobar que cargó bien

```bash
docker compose logs db | grep -E "running|sourcing|ERROR|Encriptación|init process complete"
```

En Windows usa `| Select-String "running|sourcing|ERROR|Encriptación|init process complete"` en lugar de `| grep -E ...`.

Debe salir, en este orden y **sin líneas con ERROR**:

```
running /docker-entrypoint-initdb.d/01_schema_v0.31+.sql
running /docker-entrypoint-initdb.d/02_seed_demo.sql
sourcing /docker-entrypoint-initdb.d/03_encriptacion.sh
Encriptación aplicada (pgcrypto, pgp_sym_encrypt).
running /docker-entrypoint-initdb.d/04_vistas_bd_v2.sql
PostgreSQL init process complete; ready for start up.
```

Si `03_encriptacion.sh` tiene permiso de ejecución, en lugar de `sourcing` dice `running`; las dos formas funcionan. Las líneas `NOTICE: ... does not exist, skipping` son normales: el script borra lo anterior antes de crearlo.

### Las 59 pruebas automáticas

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v k="$APP_ENCRYPTION_KEY" -f /tests/pruebas.sql'
```

Al final debe decir `ok 59 | fallas 0 | total 59`. Las pruebas cubren lo siguiente:

- Los datos quedan cifrados e ilegibles.
- El login por correo funciona sin importar mayúsculas ni espacios.
- Se rechazan los correos repetidos.
- Al **editar** un nombre, correo, comentario o motivo, se vuelve a cifrar.
- Sin la clave correcta no se puede leer nada.
- Las 37 vistas y las 4 funciones responden.

Todo se deshace al final (ROLLBACK), así que se puede repetir.

## 4. Conectarse con pgAdmin

**Register → Server**:

| Pestaña | Campo | Valor |
|---|---|---|
| General | Name | `Banco Tiempo v0.31+ (Docker)` |
| Connection | Host | `localhost` |
| Connection | Port | `15434` |
| Connection | Maintenance database | `banco_tiempo` |
| Connection | Username | `banco_owner` |
| Connection | Password | tu `POSTGRES_PASSWORD` |

Las tablas están en minúsculas, así que **no necesitan comillas**: `SELECT * FROM usuarios;`.

**Para ver datos descifrados** (las vistas `v_*` y las funciones de login), primero carga la clave en tu sesión. En el Query Tool, ejecuta esta línea antes de tus consultas:

```sql
SET app.encryption_key = 'tu_APP_ENCRYPTION_KEY_del_.env';

SELECT nombre, apellido, correo, rol, saldo FROM v_usuarios_desencriptados;
SELECT * FROM v_reservas_detalle;
SELECT * FROM v_estadisticas_generales;
SELECT * FROM buscar_usuario_por_correo('ana.mamani@ucb.edu.bo');
```

Si no la cargas, sale `app.encryption_key no configurada o demasiado corta`. La clave vale solo para esa pestaña del Query Tool: no queda guardada en la base.

Para ver el diagrama: clic derecho en `banco_tiempo` → **ERD For Database**.

**Usuarios demo** (para probar la app): `ana.mamani@ucb.edu.bo`, `luis.quispe@ucb.edu.bo`, `pedro.flores@ucb.edu.bo`, `maria.condori@ucb.edu.bo` y `admin.banco@ucb.edu.bo` (rol admin), todos con la clave `Demo2026!`.

## 5. Backend: cómo pasarle la clave

Cada conexión del backend tiene que cargar la clave **antes** de usar la base. Si no la carga:

- **Insertar** usuarios, calificaciones, reservas canceladas, notificaciones o auditoría da error.
- **Leer** las vistas `v_*_desencriptad*` también da error.

Ejemplo con Node (`pg`):

```js
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('connect', (client) =>
  client.query("SELECT set_config('app.encryption_key', $1, false)", [process.env.APP_ENCRYPTION_KEY])
);
```

```
DATABASE_URL=postgresql://banco_owner:<clave>@localhost:15434/banco_tiempo
```

Si la clave tiene `#`, `@` o `/`, en la URL se escriben `%23`, `%40` y `%2F`.

Para hacer login, usa `buscar_usuario_por_correo($1)`: devuelve el usuario con su `password_hash`, y el backend verifica la clave con argon2 o bcrypt. **No** busques por `correo = ...`, porque en la fase 2 esa columna desaparece.

## 6. Uso diario

| Quiero… | Comando |
|---|---|
| Apagarla (los datos se guardan) | `docker compose stop` |
| Prenderla | `docker compose start` |
| Ver si está corriendo | `docker compose ps` |
| Consola SQL (salir con `\q`) | `docker compose exec db psql -U banco_owner -d banco_tiempo` |
| Correr las pruebas | ver sección 3 |
| **Borrar todo y recargar desde los scripts** | `docker compose down -v` y luego `docker compose up -d` |

Los scripts de `db/init/` **solo se ejecutan cuando la base está vacía**.

**Si alguien del equipo cambia un script** (después de un `git pull`), lo más simple es `docker compose down -v && docker compose up -d`. Si quieres conservar tus datos, vuelve a aplicar solo la encriptación y las vistas, **en este orden**, porque la encriptación borra y recrea las vistas que dependen de ella:

```bash
docker compose exec db bash /docker-entrypoint-initdb.d/03_encriptacion.sh
docker compose exec db psql -U banco_owner -d banco_tiempo -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/04_vistas_bd_v2.sql
```

## 7. Convivir con otras bases

Esta carpeta usa su propio proyecto (`banco-tiempo-v031plus`), contenedor (`banco_tiempo_v031plus_db`), volumen (`pgdata_v031plus`) y puerto, así que puede estar encendida a la vez que las otras:

| Base | Puerto |
|---|---|
| PostgreSQL instalado en la computadora | 5432 / 5433 |
| v0.31 original en Docker | 15431 |
| v0.4 en Docker | 15433 |
| **Esta v0.31+ en Docker** | **15434** |

## 8. Subir a GitHub

El `.gitignore` ya excluye el `.env`, así que **tus claves no se suben**. Antes de cada commit revisa `git status`: si aparece `.env` en la lista, **detente**.

### Primera vez en esta computadora

```bash
git config --global user.name  "Tu Nombre"
git config --global user.email "tu_correo@ejemplo.com"
```

Para autenticarte, lo más fácil es GitHub CLI. Instálala en Mac con `brew install gh` (o desde https://cli.github.com) y luego ejecuta `gh auth login` (elige GitHub.com → HTTPS → Login with a web browser). La otra opción es un *Personal Access Token*: GitHub → Settings → Developer settings → Tokens. Cuando git pida la contraseña, pega el token.

### Opción A · Subir el repositorio del equipo con una rama para la BD (recomendada)

```bash
cd ~/Desktop
git clone https://github.com/<usuario-u-org>/<repo>.git
cd <repo>
git checkout -b equipo/base-de-datos         # rama del equipo (normas del repo)

# copia la carpeta dentro del repo (por ejemplo, en database/)
mkdir -p database
cp -R ~/Desktop/basede_datos/BancoTiempo_BD_v0.31plus/. database/

git add database
git status                                    # .env NO debe aparecer
git commit -m "BD v0.31+: Docker con encriptación y vistas v2 adaptadas"
git push -u origin equipo/base-de-datos
```

Luego, en GitHub, aparece el botón **Compare & pull request** para pedir que se una a `main` (o a la rama que usen). Si ya tienes el repo clonado, en lugar de `git clone` usa `cd <repo>` y `git pull`.

### Opción B · Repositorio nuevo solo para esta carpeta

```bash
cd ~/Desktop/basede_datos/BancoTiempo_BD_v0.31plus
git init
git add .
git status                                    # .env NO debe aparecer
git check-ignore -v .env                      # debe responder: .gitignore:…  .env
git commit -m "BD v0.31+: Docker con encriptación y vistas v2"
git branch -M main
gh repo create banco-tiempo-bd --private --source=. --push
```

Si no usas `gh`, crea primero el repositorio vacío en github.com (sin README) y en lugar de la última línea ejecuta:

```bash
git remote add origin https://github.com/<usuario>/banco-tiempo-bd.git
git push -u origin main
```

### Después, cada vez que cambies algo

```bash
git pull                                      # trae lo que subieron los demás
git add -A
git status                                    # revisa qué se va a subir
git commit -m "Describe el cambio"
git push
```

### Si subiste el `.env` por error

```bash
git rm --cached .env
git commit -m "Quitar .env del repositorio"
git push
```

Esto lo saca del repositorio, pero **sigue en el historial**. Por eso, además, **cambia las dos claves** del `.env`. Para la clave de cifrado, haz `docker compose down -v` y `docker compose up -d`, que vuelve a cifrar todo con la nueva.

## 9. Problemas frecuentes

| Mensaje o síntoma | Solución |
|---|---|
| `Cannot connect to the Docker daemon` / `failed to connect to the docker API` | Docker Desktop no está abierto: ábrelo y espera a *Engine running* |
| `required variable POSTGRES_PASSWORD is missing` o `Define APP_ENCRYPTION_KEY` | Falta el `.env` o le falta esa línea (sección 2) |
| `APP_ENCRYPTION_KEY falta en .env o tiene menos de 32 caracteres` (en los logs) | Pon una clave más larga y luego `docker compose down -v && docker compose up -d` |
| `port is already allocated` | El 15434 está ocupado: cambia `DB_PORT` en `.env` (por ejemplo 16434) y vuelve a hacer `up -d`. En Mac, para ver quién lo usa: `lsof -i :15434` |
| `app.encryption_key no configurada o demasiado corta` | Te faltó el `SET app.encryption_key = '...';` (sección 4) o el backend no la carga (sección 5) |
| `Wrong key or corrupt data` | La clave de la sesión no es la misma con la que se cifró la base |
| Cambié la clave en `.env` y ahora nada se descifra | La base se cifró con la clave anterior. Vuelve a la anterior, o haz `down -v` y `up -d` para recargar con la nueva |
| Cambié un script y no se nota | Los scripts solo corren con la base vacía: `docker compose down -v && docker compose up -d` (sección 6) |
| `password authentication failed` | Usuario `banco_owner` y la clave `POSTGRES_PASSWORD` de tu `.env` |
| pgAdmin no muestra `banco_tiempo` | Te conectaste a otro PostgreSQL: el puerto es el 15434 |
| Error al montar la carpeta (Windows) | Copia la carpeta fuera de OneDrive, por ejemplo a `C:\dev\` |
